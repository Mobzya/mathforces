import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import { apiError } from "@/server/http/responses";
import { isUuid } from "@/server/validation/primitives";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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
      select: { id: true, userId: true },
      where: { id }
    });
    if (!submission || (viewer.role !== "ADMIN" && submission.userId !== viewer.id)) {
      return apiError("Посылка не найдена", 404);
    }
    const evaluation = await prisma.evaluation.findFirst({
      include: {
        runs: {
          orderBy: { createdAt: "asc" },
          select: {
            confidence: true,
            createdAt: true,
            error: true,
            latencyMs: true,
            provider: true,
            stage: true,
            success: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      where: { submissionId: id }
    });
    if (!evaluation) {
      return apiError("Проверка ещё не запускалась", 404);
    }

    return NextResponse.json({
      evaluation: {
        comment: evaluation.comment,
        completedAt: evaluation.completedAt?.toISOString() ?? null,
        confidence: evaluation.confidence,
        confidenceValue: evaluation.confidenceValue,
        error: evaluation.error,
        geometryDetected: evaluation.geometryDetected,
        id: evaluation.id,
        maxScore: evaluation.maxScore,
        mode: evaluation.mode,
        recognizedText: evaluation.recognizedText,
        runs: evaluation.runs.map((run) => ({
          ...run,
          createdAt: run.createdAt.toISOString()
        })),
        score: evaluation.score,
        startedAt: evaluation.startedAt.toISOString(),
        status: evaluation.status,
        submissionId: evaluation.submissionId
      }
    });
  } catch (error: unknown) {
    console.error("Не удалось загрузить оценку", error);
    return apiError("Не удалось загрузить результат проверки", 500);
  }
}
