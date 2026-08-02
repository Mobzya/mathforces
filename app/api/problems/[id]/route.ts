import { NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { getAdminUser } from "@/server/auth/authorization";
import { recordAdminAction } from "@/server/admin/audit";
import { serializeProblem } from "@/server/contests/serialize";
import { validateProblemInput } from "@/server/contests/validation";
import {
  apiError,
  formErrorRedirect,
  hasValidOrigin,
  isFormSubmission,
  isUniqueConstraintError,
  readJsonBody
} from "@/server/http/responses";
import { isUuid } from "@/server/validation/primitives";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const submittedAsForm = isFormSubmission(request);
  const respondWithError = (
    message: string,
    status: number,
    contestId?: string,
    fieldErrors?: Record<string, string>
  ) =>
    submittedAsForm
      ? formErrorRedirect(
          request,
          contestId ? `/admin/contests/${contestId}` : "/admin/contests",
          Object.values(fieldErrors ?? {})[0] ?? message
        )
      : apiError(message, status, fieldErrors);

  if (!hasValidOrigin(request)) {
    return respondWithError("Запрос отклонён", 403);
  }

  if (!isUuid(id)) {
    return respondWithError("Задача не найдена", 404);
  }

  const body = submittedAsForm
    ? problemBodyFromForm(await request.formData())
    : await readJsonBody(request);
  const validation = validateProblemInput(body, true);
  if (validation.errors) {
    return respondWithError("Проверьте параметры задачи", 422, undefined, validation.errors);
  }

  try {
    const admin = await getAdminUser();
    if (!admin) {
      return respondWithError("Требуются права администратора", 403);
    }

    const existing = await prisma.problem.findUnique({
      include: {
        contest: { select: { requiredProblemCount: true, status: true } }
      },
      where: { id }
    });
    if (!existing) {
      return respondWithError("Задача не найдена", 404);
    }
    if (existing.contest.status !== "ANNOUNCED") {
      return respondWithError(
        "Задачи можно менять только до запуска контеста",
        409,
        existing.contestId
      );
    }
    if (
      validation.data.orderIndex !== undefined &&
      validation.data.orderIndex > existing.contest.requiredProblemCount
    ) {
      return respondWithError(
        `Номер задачи не может быть больше ${existing.contest.requiredProblemCount}`,
        422,
        existing.contestId,
        { orderIndex: "Выберите номер внутри комплекта контеста" }
      );
    }

    const problem = await prisma.$transaction(async (tx) => {
      const updated = await tx.problem.update({
        data: validation.data,
        where: { id }
      });

      await recordAdminAction(tx, {
        action: "PROBLEM_UPDATED",
        adminId: admin.id,
        details: {
          changedFields: Object.keys(validation.data),
          contestId: existing.contestId
        },
        entityId: id,
        entityType: "PROBLEM",
        summary: `Обновлена задача ${updated.orderIndex}: «${updated.title}»`
      });

      return updated;
    });

    return submittedAsForm
      ? NextResponse.redirect(new URL(`/admin/contests/${existing.contestId}`, request.url), 303)
      : NextResponse.json({ problem: serializeProblem(problem) });
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) {
      return respondWithError("Задача с таким номером уже существует", 409);
    }
    console.error("Не удалось изменить задачу", error);
    return respondWithError("Не удалось изменить задачу", 500);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return PATCH(request, context);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasValidOrigin(request)) return apiError("Запрос отклонён", 403);
  const { id } = await params;
  if (!isUuid(id)) return apiError("Задача не найдена", 404);

  try {
    const admin = await getAdminUser();
    if (!admin) return apiError("Требуются права администратора", 403);
    const existing = await prisma.problem.findUnique({
      include: { contest: { select: { status: true, title: true } } },
      where: { id }
    });
    if (!existing) return apiError("Задача не найдена", 404);
    if (existing.contest.status !== "ANNOUNCED") {
      return apiError("После запуска удалять задачи нельзя", 409);
    }
    await prisma.$transaction(async (tx) => {
      await tx.problem.delete({ where: { id } });
      await recordAdminAction(tx, {
        action: "PROBLEM_DELETED",
        adminId: admin.id,
        details: {
          contestId: existing.contestId,
          orderIndex: existing.orderIndex
        },
        entityId: id,
        entityType: "PROBLEM",
        summary: `Удалена задача ${existing.orderIndex}: «${existing.title}» из контеста «${existing.contest.title}»`
      });
    });
    return NextResponse.json({ deleted: true });
  } catch (error: unknown) {
    console.error("Не удалось удалить задачу", error);
    return apiError("Не удалось удалить задачу", 500);
  }
}

function problemBodyFromForm(form: FormData) {
  return {
    archiveEnabled: form.get("archiveEnabled") === "on",
    archiveIntro: form.get("archiveIntro"),
    baseScore: form.get("baseScore"),
    evaluationRubric: form.get("evaluationRubric"),
    maxScore: form.get("maxScore"),
    officialSolution: form.get("officialSolution"),
    orderIndex: form.get("orderIndex"),
    scoreDecayPer5Min: form.get("scoreDecayPer5Min"),
    statement: form.get("statement"),
    subtopic: form.get("subtopic"),
    title: form.get("title"),
    topic: form.get("topic")
  };
}
