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

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    ? problemBodyFromForm(await request.formData())
    : await readJsonBody(request);
  const validation = validateProblemInput(body);
  if (validation.errors) {
    return respondWithError("Проверьте параметры задачи", 422, validation.errors);
  }

  try {
    const admin = await getAdminUser();
    if (!admin) {
      return respondWithError("Требуются права администратора", 403);
    }

    const contest = await prisma.contest.findUnique({
      include: { _count: { select: { problems: true } } },
      where: { id }
    });
    if (!contest) {
      return respondWithError("Контест не найден", 404);
    }
    if (contest.status !== "ANNOUNCED") {
      return respondWithError("Задачи можно менять только до запуска контеста", 409);
    }
    if (contest._count.problems >= contest.requiredProblemCount) {
      return respondWithError(
        `В этом контесте может быть только ${contest.requiredProblemCount} задач`,
        409
      );
    }

    const problem = await prisma.$transaction(async (tx) => {
      const created = await tx.problem.create({
        data: {
          ...(validation.data as Required<typeof validation.data>),
          contestId: contest.id
        }
      });

      await recordAdminAction(tx, {
        action: "PROBLEM_CREATED",
        adminId: admin.id,
        details: {
          maxScore: created.maxScore,
          orderIndex: created.orderIndex,
          topic: created.topic
        },
        entityId: created.id,
        entityType: "PROBLEM",
        summary: `Добавлена задача ${created.orderIndex}: «${created.title}»`
      });

      return created;
    });

    return submittedAsForm
      ? NextResponse.redirect(new URL(`/admin/contests/${id}`, request.url), 303)
      : NextResponse.json({ problem: serializeProblem(problem) }, { status: 201 });
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) {
      return respondWithError("Задача с таким номером уже существует", 409);
    }
    console.error("Не удалось добавить задачу", error);
    return respondWithError("Не удалось добавить задачу", 500);
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
