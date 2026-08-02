import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
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
    const viewer = await getCurrentUser();
    if (!viewer) {
      return apiError("Требуется вход", 401);
    }
    const submission = await prisma.submission.findUnique({
      select: { status: true, userId: true },
      where: { id }
    });
    if (!submission || (viewer.role !== "ADMIN" && submission.userId !== viewer.id)) {
      return apiError("Посылка не найдена", 404);
    }
    if (submission.status !== "QUEUED") {
      return apiError("Посылка уже обрабатывается или проверена", 409);
    }

    const existingJob = await prisma.evaluationJob.findFirst({
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true },
      where: {
        status: { in: ["QUEUED", "PROCESSING"] },
        submissionId: id
      }
    });
    const job =
      existingJob ??
      (
        await prisma.$transaction((tx) =>
          enqueueEvaluation(tx, {
            mode: "PRELIMINARY",
            submissionId: id
          })
        )
      ).job;
    return NextResponse.json({ job: { id: job.id, status: job.status } }, { status: 202 });
  } catch (error: unknown) {
    console.error("Не удалось запустить проверку посылки", error);
    return apiError("Не удалось запустить проверку", 500);
  }
}
