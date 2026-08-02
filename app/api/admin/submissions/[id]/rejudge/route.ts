import { NextResponse } from "next/server";
import { recordAdminAction } from "@/server/admin/audit";
import { getAdminUser } from "@/server/auth/authorization";
import { prisma } from "@/server/db/client";
import { enqueueEvaluation } from "@/server/evaluations/queue";
import { apiError, hasValidOrigin } from "@/server/http/responses";
import { isUuid } from "@/server/validation/primitives";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasValidOrigin(request)) {
    return apiError("Запрос отклонён", 403);
  }

  const { id } = await params;
  if (!isUuid(id)) {
    return apiError("Посылка не найдена", 404);
  }

  try {
    const admin = await getAdminUser();
    if (!admin) {
      return apiError("Требуются права администратора", 403);
    }
    const existing = await prisma.submission.findUnique({
      include: {
        contest: {
          select: {
            finalization: { select: { id: true } },
            status: true
          }
        },
        problem: { select: { orderIndex: true, title: true } }
      },
      where: { id }
    });
    if (!existing) {
      return apiError("Посылка не найдена", 404);
    }

    const result = await prisma.$transaction(async (tx) => {
      const queued = await enqueueEvaluation(tx, {
        ...(existing.contest.status === "FINISHED" && existing.contest.finalization
          ? { finalizationId: existing.contest.finalization.id }
          : {}),
        mode: "REJUDGE",
        submissionId: id
      });
      if (!queued.created) {
        return queued;
      }
      await tx.contest.update({
        data: { resultsRevision: { increment: 1 } },
        where: { id: existing.contestId }
      });
      await tx.submissionComment.create({
        data: {
          body: "Администратор отправил решение на повторную проверку.",
          isPrivate: false,
          kind: "ADMIN",
          submissionId: id
        }
      });
      await recordAdminAction(tx, {
        action: "SUBMISSION_REJUDGED",
        adminId: admin.id,
        details: {
          previousFinalScore: existing.finalScore,
          previousStatus: existing.status
        },
        entityId: id,
        entityType: "SUBMISSION",
        summary: `Посылка по задаче ${existing.problem.orderIndex} отправлена на перепроверку`
      });
      return queued;
    });

    return NextResponse.json(
      {
        job: { id: result.job.id, status: result.job.status },
        reused: !result.created
      },
      { status: 202 }
    );
  } catch (error: unknown) {
    console.error("Не удалось отправить посылку на перепроверку", error);
    return apiError("Не удалось запустить перепроверку", 500);
  }
}
