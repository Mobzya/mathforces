import { NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { getAdminUser } from "@/server/auth/authorization";
import { serializeContestSummary } from "@/server/contests/serialize";
import { validateContestInput } from "@/server/contests/validation";
import { recordAdminAction } from "@/server/admin/audit";
import { listContests } from "@/server/contests/queries";
import {
  apiError,
  formErrorRedirect,
  hasValidOrigin,
  isFormSubmission,
  readJsonBody
} from "@/server/http/responses";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const viewer = await getCurrentUser();
    const url = new URL(request.url);
    const statusValue = url.searchParams.get("status");
    const status =
      statusValue === "ANNOUNCED" || statusValue === "RUNNING" || statusValue === "FINISHED"
        ? statusValue
        : null;
    const pageValue = Number(url.searchParams.get("page"));
    const result = await listContests(viewer, {
      page: Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1,
      query: url.searchParams.get("query")?.trim() ?? "",
      status
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Не удалось получить список контестов", error);
    return apiError("Не удалось загрузить контесты", 500);
  }
}

export async function POST(request: Request) {
  const submittedAsForm = isFormSubmission(request);
  const respondWithError = (
    message: string,
    status: number,
    fieldErrors?: Record<string, string>
  ) =>
    submittedAsForm
      ? formErrorRedirect(
          request,
          "/admin/contests?create=1",
          Object.values(fieldErrors ?? {})[0] ?? message
        )
      : apiError(message, status, fieldErrors);

  if (!hasValidOrigin(request)) {
    return respondWithError("Запрос отклонён", 403);
  }

  let body: unknown;
  if (submittedAsForm) {
    const form = await request.formData();
    const isPublic = form.get("isPublic") !== "false";
    body = {
      description: form.get("description"),
      durationMinutes: form.get("durationMinutes"),
      isPublic,
      organizationId: isPublic ? null : form.get("organizationId"),
      rules: form.get("rules"),
      requiredProblemCount: form.get("requiredProblemCount"),
      startAt: form.get("startAt"),
      status: "ANNOUNCED",
      tags: String(form.get("tags") ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      title: form.get("title")
    };
  } else {
    body = await readJsonBody(request);
  }

  const validation = validateContestInput(body);
  if (validation.errors) {
    return respondWithError("Проверьте параметры контеста", 422, validation.errors);
  }

  try {
    const admin = await getAdminUser();
    if (!admin) {
      return respondWithError("Требуются права администратора", 403);
    }

    const input = validation.data;
    if (input.status !== "ANNOUNCED") {
      return respondWithError(
        "Новый контест создаётся анонсированным. Сначала добавьте комплект задач",
        409
      );
    }

    const organizationId =
      input.organizationId ?? (input.isPublic === false ? admin.organizationId : null);

    if (organizationId) {
      const organization = await prisma.organization.findUnique({
        select: { id: true },
        where: { id: organizationId }
      });
      if (!organization) {
        return respondWithError("Организация не найдена", 404);
      }
    }

    const startAt = input.startAt as Date;
    const durationMinutes = input.durationMinutes as number;
    const endAt = new Date(startAt.getTime() + durationMinutes * 60_000);
    const registrationClosesAt = input.registrationClosesAt ?? startAt;
    if (registrationClosesAt > endAt) {
      return respondWithError("Регистрация должна закрываться не позже окончания контеста", 422, {
        registrationClosesAt: "Выберите время не позже окончания тура"
      });
    }
    const contest = await prisma.$transaction(async (tx) => {
      const created = await tx.contest.create({
        data: {
          autoCalculateRating: input.autoCalculateRating,
          autoFinalRejudge: input.autoFinalRejudge,
          autoPublishArchive: input.autoPublishArchive,
          createdById: admin.id,
          description: input.description,
          durationMinutes,
          endAt,
          isPublic: input.isPublic,
          organizationId,
          registrationClosesAt,
          requiredProblemCount: input.requiredProblemCount,
          reviewConfidenceThreshold: input.reviewConfidenceThreshold,
          rules: input.rules,
          showOthersSubmissions: input.showOthersSubmissions,
          showPreliminaryScores: input.showPreliminaryScores,
          showStandingsDuringContest: input.showStandingsDuringContest,
          showSubmissionComments: input.showSubmissionComments,
          startAt,
          status: input.status,
          tags: input.tags,
          title: input.title as string
        },
        include: {
          _count: {
            select: { problems: true, registrations: true }
          },
          organization: true
        }
      });

      await recordAdminAction(tx, {
        action: "CONTEST_CREATED",
        adminId: admin.id,
        details: {
          durationMinutes,
          isPublic: input.isPublic ?? true,
          startAt: startAt.toISOString()
        },
        entityId: created.id,
        entityType: "CONTEST",
        summary: `Создан контест «${created.title}»`
      });

      return created;
    });

    return submittedAsForm
      ? NextResponse.redirect(new URL(`/admin/contests/${contest.id}`, request.url), 303)
      : NextResponse.json({ contest: serializeContestSummary(contest) }, { status: 201 });
  } catch (error: unknown) {
    console.error("Не удалось создать контест", error);
    return respondWithError("Не удалось создать контест", 500);
  }
}
