import { after, NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { getAdminUser } from "@/server/auth/authorization";
import { recordAdminAction } from "@/server/admin/audit";
import { enqueueContestFinalization, refreshContestFinalization } from "@/server/evaluations/queue";
import { publishContestProblemsToArchive } from "@/server/archive/indexing";
import { canAccessContest } from "@/server/contests/access";
import { serializeContestDetail, serializeContestSummary } from "@/server/contests/serialize";
import { validateContestInput } from "@/server/contests/validation";
import {
  apiError,
  formErrorRedirect,
  hasValidOrigin,
  isFormSubmission,
  readJsonBody
} from "@/server/http/responses";
import { isUuid } from "@/server/validation/primitives";
import { canRevealContestProblems } from "@/server/contests/lifecycle";

export const maxDuration = 300;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) {
    return apiError("Контест не найден", 404);
  }

  try {
    const viewer = await getCurrentUser();
    const contest = await prisma.contest.findUnique({
      include: {
        _count: {
          select: { problems: true, registrations: true }
        },
        organization: true,
        problems: {
          orderBy: { orderIndex: "asc" }
        }
      },
      where: { id }
    });

    if (!contest || !canAccessContest(contest, viewer)) {
      return apiError("Контест не найден", 404);
    }

    const registration = viewer
      ? await prisma.contestRegistration.findUnique({
          select: { id: true },
          where: {
            contestId_userId: {
              contestId: contest.id,
              userId: viewer.id
            }
          }
        })
      : null;

    return NextResponse.json({
      contest: serializeContestDetail(
        contest,
        Boolean(registration),
        canRevealContestProblems(contest, viewer?.role === "ADMIN")
      )
    });
  } catch (error: unknown) {
    console.error("Не удалось загрузить контест", error);
    return apiError("Не удалось загрузить контест", 500);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const submittedAsForm = isFormSubmission(request);
  const respondWithError = (
    message: string,
    status: number,
    fieldErrors?: Record<string, string>
  ) =>
    submittedAsForm
      ? formErrorRedirect(
          request,
          `/admin/contests/${id}`,
          Object.values(fieldErrors ?? {})[0] ?? message
        )
      : apiError(message, status, fieldErrors);

  if (!hasValidOrigin(request)) {
    return respondWithError("Запрос отклонён", 403);
  }

  if (!isUuid(id)) {
    return respondWithError("Контест не найден", 404);
  }

  const body = submittedAsForm
    ? contestBodyFromForm(await request.formData())
    : await readJsonBody(request);
  const validation = validateContestInput(body, true);
  if (validation.errors) {
    return respondWithError("Проверьте параметры контеста", 422, validation.errors);
  }

  try {
    const admin = await getAdminUser();
    if (!admin) {
      return respondWithError("Требуются права администратора", 403);
    }

    const existing = await prisma.contest.findUnique({
      include: {
        _count: { select: { problems: true } },
        finalization: { select: { id: true, status: true } }
      },
      where: { id }
    });
    if (!existing) {
      return respondWithError("Контест не найден", 404);
    }

    const input = validation.data;
    const changedFields = Object.keys(input);
    const isFinishRequest = changedFields.length === 1 && input.status === "FINISHED";
    const operationalFields = new Set([
      "autoCalculateRating",
      "autoFinalRejudge",
      "autoPublishArchive",
      "registrationClosesAt",
      "reviewConfidenceThreshold",
      "showOthersSubmissions",
      "showPreliminaryScores",
      "showStandingsDuringContest",
      "showSubmissionComments"
    ]);
    const isOperationalUpdate =
      changedFields.length > 0 && changedFields.every((field) => operationalFields.has(field));

    if (existing.status !== "ANNOUNCED" && !isFinishRequest && !isOperationalUpdate) {
      return respondWithError(
        "После запуска расписание и условия зафиксированы. Настройки доступа и автоматизации всё ещё можно менять",
        409
      );
    }
    if (existing.status === "ANNOUNCED" && input.status !== undefined) {
      return respondWithError(
        "Запускайте контест отдельной кнопкой — она фиксирует стартовый рейтинг участников",
        409
      );
    }
    if (
      input.requiredProblemCount !== undefined &&
      input.requiredProblemCount < existing._count.problems
    ) {
      return respondWithError(
        "Сначала удалите лишние задачи или оставьте текущее количество",
        422,
        { requiredProblemCount: `Уже добавлено задач: ${existing._count.problems}` }
      );
    }
    if (isFinishRequest && existing.status !== "RUNNING") {
      return respondWithError(
        existing.status === "FINISHED" ? "Контест уже завершён" : "Сначала запустите контест",
        409
      );
    }
    if (isFinishRequest && existing._count.problems !== existing.requiredProblemCount) {
      return respondWithError(
        `Нельзя завершить контест: требуется ${existing.requiredProblemCount} задач`,
        409
      );
    }

    if (input.organizationId) {
      const organization = await prisma.organization.findUnique({
        select: { id: true },
        where: { id: input.organizationId }
      });
      if (!organization) {
        return respondWithError("Организация не найдена", 404);
      }
    }

    const startAt = input.startAt ?? existing.startAt;
    const durationMinutes = input.durationMinutes ?? existing.durationMinutes;
    const endAt = new Date(startAt.getTime() + durationMinutes * 60_000);
    const registrationClosesAt =
      input.registrationClosesAt !== undefined
        ? input.registrationClosesAt
        : input.startAt && existing.registrationClosesAt?.getTime() === existing.startAt.getTime()
          ? startAt
          : existing.registrationClosesAt;
    if (registrationClosesAt && registrationClosesAt > endAt) {
      return respondWithError("Регистрация должна закрываться не позже окончания контеста", 422, {
        registrationClosesAt: "Выберите время не позже окончания тура"
      });
    }
    const organizationId =
      input.isPublic === false &&
      input.organizationId === undefined &&
      existing.organizationId === null
        ? admin.organizationId
        : input.organizationId;

    const contest = await prisma.$transaction(async (tx) => {
      const updated = await tx.contest.update({
        data: {
          ...input,
          endAt,
          registrationClosesAt,
          organizationId
        },
        include: {
          _count: {
            select: { problems: true, registrations: true }
          },
          organization: true
        },
        where: { id }
      });

      await recordAdminAction(tx, {
        action: "CONTEST_UPDATED",
        adminId: admin.id,
        details: {
          changedFields,
          previousStatus: existing.status,
          status: updated.status
        },
        entityId: id,
        entityType: "CONTEST",
        summary: `Обновлён контест «${updated.title}»`
      });

      return updated;
    });
    const shouldStartFinalization =
      (input.status === "FINISHED" && existing.status !== "FINISHED" && contest.autoFinalRejudge) ||
      (existing.status === "FINISHED" &&
        input.autoFinalRejudge === true &&
        !existing.autoFinalRejudge);
    if (shouldStartFinalization) {
      after(async () => {
        await enqueueContestFinalization(id, admin.id).catch((error) => {
          console.error("Финальная перепроверка контеста не поставлена в очередь", {
            contestId: id,
            error
          });
        });
      });
    }
    if (
      existing.status === "FINISHED" &&
      existing.finalization?.status === "COMPLETED" &&
      ((input.autoCalculateRating === true && !existing.autoCalculateRating) ||
        (input.autoPublishArchive === true && !existing.autoPublishArchive))
    ) {
      after(async () => {
        if (input.autoCalculateRating === true && !existing.autoCalculateRating) {
          await refreshContestFinalization(existing.finalization!.id, admin.id);
        }
        if (input.autoPublishArchive === true && !existing.autoPublishArchive) {
          await publishContestProblemsToArchive(id);
        }
      });
    }

    return submittedAsForm
      ? NextResponse.redirect(new URL(`/admin/contests/${id}`, request.url), 303)
      : NextResponse.json({
          contest: serializeContestSummary(contest)
        });
  } catch (error: unknown) {
    console.error("Не удалось изменить контест", error);
    return respondWithError("Не удалось изменить контест", 500);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return PATCH(request, context);
}

function contestBodyFromForm(form: FormData) {
  if (form.get("status")) {
    return { status: form.get("status") };
  }

  const isPublic = form.get("isPublic") !== "false";
  return {
    description: form.get("description"),
    durationMinutes: form.get("durationMinutes"),
    isPublic,
    organizationId: isPublic ? null : form.get("organizationId"),
    rules: form.get("rules"),
    startAt: form.get("startAt"),
    tags: String(form.get("tags") ?? "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    title: form.get("title")
  };
}
