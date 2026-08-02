import { NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { recordAdminAction } from "@/server/admin/audit";
import { getAdminUser } from "@/server/auth/authorization";
import { getCurrentUser } from "@/server/auth/session";
import { canAccessContest } from "@/server/contests/access";
import { apiError, hasValidOrigin, readJsonBody } from "@/server/http/responses";
import { serializeSubmissionDetail } from "@/server/submissions/serialize";
import {
  validateSubmissionAdminPatch,
  validateSubmissionAdminTransition
} from "@/server/submissions/validation";
import { isUuid } from "@/server/validation/primitives";
import { availableProblemScore } from "@/server/scoring/decay";
import { refreshContestFinalization } from "@/server/evaluations/queue";

const publicRelations = {
  problem: {
    select: {
      id: true,
      orderIndex: true,
      title: true
    }
  },
  user: {
    select: {
      id: true,
      nickname: true
    }
  }
} as const;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) {
    return apiError("Посылка не найдена", 404);
  }

  try {
    const viewer = await getCurrentUser();
    const submission = await prisma.submission.findUnique({
      include: {
        ...publicRelations,
        contest: {
          select: {
            isPublic: true,
            organizationId: true,
            showSubmissionComments: true
          }
        }
      },
      where: { id }
    });

    if (
      !submission ||
      !canAccessContest(submission.contest, viewer) ||
      (!submission.isPublic && viewer?.role !== "ADMIN" && submission.userId !== viewer?.id)
    ) {
      return apiError("Посылка не найдена", 404);
    }

    return NextResponse.json({
      submission: serializeSubmissionDetail(submission, viewer)
    });
  } catch (error: unknown) {
    console.error("Не удалось получить посылку", error);
    return apiError("Не удалось загрузить посылку", 500);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasValidOrigin(request)) {
    return apiError("Запрос отклонён", 403);
  }

  const { id } = await params;
  if (!isUuid(id)) {
    return apiError("Посылка не найдена", 404);
  }

  const validation = validateSubmissionAdminPatch(await readJsonBody(request));
  if (validation.errors) {
    return apiError("Проверьте изменения посылки", 422, validation.errors);
  }

  try {
    const admin = await getAdminUser();
    if (!admin) {
      return apiError("Требуются права администратора", 403);
    }

    const existing = await prisma.submission.findUnique({
      include: {
        evaluationJobs: {
          select: { id: true },
          take: 1,
          where: { status: { in: ["QUEUED", "PROCESSING"] } }
        },
        problem: {
          select: {
            baseScore: true,
            maxScore: true,
            scoreDecayPer5Min: true
          }
        },
        contest: {
          select: {
            finalization: { select: { id: true } },
            startAt: true
          }
        }
      },
      where: { id }
    });
    if (!existing) {
      return apiError("Посылка не найдена", 404);
    }
    const transition = validateSubmissionAdminTransition(existing, validation.data);
    if (transition.errors) {
      return apiError("Проверьте ручную коррекцию", 422, transition.errors);
    }
    const { changesEvaluationState } = transition;
    if (changesEvaluationState && existing.evaluationJobs.length > 0) {
      return apiError(
        "Проверка этой посылки ещё выполняется. Дождитесь её завершения перед ручной коррекцией",
        409
      );
    }

    const availableScore = availableProblemScore(
      existing.problem,
      existing.contest.startAt,
      existing.createdAt
    );
    for (const [field, value] of [
      ["preliminaryScore", validation.data.preliminaryScore],
      ["finalScore", validation.data.finalScore]
    ] as const) {
      if (typeof value === "number" && value > availableScore) {
        return apiError("Балл превышает максимум задачи", 422, {
          [field]: `На момент отправки максимум задачи — ${availableScore}`
        });
      }
    }

    const auditParts: string[] = [];
    if (
      validation.data.preliminaryScore !== undefined &&
      validation.data.preliminaryScore !== existing.preliminaryScore
    ) {
      auditParts.push(
        `предварительный балл: ${formatScore(
          existing.preliminaryScore
        )} → ${formatScore(validation.data.preliminaryScore)}`
      );
    }
    if (
      validation.data.finalScore !== undefined &&
      validation.data.finalScore !== existing.finalScore
    ) {
      auditParts.push(
        `итоговый балл: ${formatScore(existing.finalScore)} → ${formatScore(
          validation.data.finalScore
        )}`
      );
    }
    if (validation.data.status !== undefined && validation.data.status !== existing.status) {
      auditParts.push(`статус: ${existing.status} → ${validation.data.status}`);
    }
    if (validation.data.isPublic !== undefined && validation.data.isPublic !== existing.isPublic) {
      auditParts.push(
        `видимость: ${existing.isPublic ? "публичная" : "скрытая"} → ${
          validation.data.isPublic ? "публичная" : "скрытая"
        }`
      );
    }
    const auditBody = [
      auditParts.length > 0 ? `Администратор изменил ${auditParts.join("; ")}.` : "",
      validation.data.adminComment ? `Комментарий: ${validation.data.adminComment}` : ""
    ]
      .filter(Boolean)
      .join(" ");

    const submission = await prisma.$transaction(async (tx) => {
      const updated = await tx.submission.update({
        data: validation.data,
        include: publicRelations,
        where: { id }
      });

      if (changesEvaluationState) {
        await tx.contest.update({
          data: { resultsRevision: { increment: 1 } },
          where: { id: existing.contestId }
        });
      }

      await tx.submissionComment.create({
        data: {
          body: auditBody || "Администратор обновил посылку.",
          isPrivate: false,
          kind: "ADMIN",
          submissionId: id
        }
      });

      await recordAdminAction(tx, {
        action: "SUBMISSION_UPDATED",
        adminId: admin.id,
        details: {
          changedFields: Object.keys(validation.data),
          contestId: existing.contestId,
          problemId: existing.problemId
        },
        entityId: id,
        entityType: "SUBMISSION",
        summary: auditBody || "Администратор обновил посылку"
      });

      return updated;
    });

    if (changesEvaluationState && existing.contest.finalization) {
      await refreshContestFinalization(existing.contest.finalization.id, admin.id);
    }

    return NextResponse.json({
      submission: serializeSubmissionDetail(submission, admin)
    });
  } catch (error: unknown) {
    console.error("Не удалось изменить посылку", error);
    return apiError("Не удалось сохранить изменения посылки", 500);
  }
}

function formatScore(score: number | null): string {
  return score === null ? "—" : String(score);
}
