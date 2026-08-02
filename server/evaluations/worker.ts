import type { EvaluationMode } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import { evaluateFinalSolution, evaluatePreliminarySolution } from "@/server/evaluations/pipeline";
import { availableProblemScore } from "@/server/scoring/decay";
import { submissionStorage } from "@/services/storage";

export async function processQueuedSubmission(
  submissionId: string,
  mode: EvaluationMode = "PRELIMINARY"
) {
  const claimed = await prisma.$transaction(async (tx) => {
    const claim = await tx.submission.updateMany({
      data: { status: "PROCESSING" },
      where: { id: submissionId, status: "QUEUED" }
    });
    if (claim.count === 0) return null;

    const submission = await tx.submission.findUnique({
      include: {
        file: true,
        problem: {
          select: {
            baseScore: true,
            evaluationRubric: true,
            maxScore: true,
            orderIndex: true,
            scoreDecayPer5Min: true,
            title: true
          }
        },
        contest: {
          select: { reviewConfidenceThreshold: true, startAt: true }
        }
      },
      where: { id: submissionId }
    });
    if (!submission?.file) {
      throw new Error("SUBMISSION_FILE_NOT_FOUND");
    }
    const availableScore = availableProblemScore(
      submission.problem,
      submission.contest.startAt,
      submission.createdAt
    );
    const evaluation = await tx.evaluation.create({
      data: {
        maxScore: availableScore,
        mode,
        rubricSnapshot: submission.problem.evaluationRubric,
        submissionId
      }
    });
    return { evaluation, submission };
  });

  if (!claimed) {
    return { processed: false as const };
  }

  try {
    const image = await submissionStorage.read(claimed.submission.file!.storageKey);
    const evaluate = mode === "REJUDGE" ? evaluateFinalSolution : evaluatePreliminarySolution;
    const result = await evaluate({
      image,
      maxScore: claimed.evaluation.maxScore,
      rubric: claimed.submission.problem.evaluationRubric
    });
    const needsReview =
      result.needsReview ||
      result.confidenceValue < claimed.submission.contest.reviewConfidenceThreshold;
    const evaluationStatus = needsReview ? "NEEDS_REVIEW" : "COMPLETED";
    const submissionStatus =
      mode === "REJUDGE"
        ? needsReview
          ? "NEEDS_REVIEW"
          : "FINALIZED"
        : needsReview
          ? "NEEDS_REVIEW"
          : "PRELIMINARY_READY";

    await prisma.$transaction(async (tx) => {
      await tx.evaluation.update({
        data: {
          comment: result.comment,
          completedAt: new Date(),
          confidence: result.confidence,
          confidenceValue: result.confidenceValue,
          geometryDetected: result.geometryDetected,
          recognizedText: result.recognizedText,
          score: result.score,
          status: evaluationStatus
        },
        where: { id: claimed.evaluation.id }
      });
      await tx.judgeModelRun.createMany({
        data: result.runs.map((run) => ({
          confidence: run.confidence,
          error: run.error,
          evaluationId: claimed.evaluation.id,
          inputChars: run.inputChars,
          latencyMs: run.latencyMs,
          output: run.output,
          provider: run.provider,
          stage: run.stage,
          success: run.success
        }))
      });
      await tx.submission.update({
        data: {
          aiComment: result.comment,
          ...(mode === "REJUDGE"
            ? { finalScore: result.score }
            : { preliminaryScore: result.score }),
          status: submissionStatus
        },
        where: { id: submissionId }
      });
      await tx.contest.update({
        data: { resultsRevision: { increment: 1 } },
        where: { id: claimed.submission.contestId }
      });
      if (mode === "PRELIMINARY") {
        await tx.submissionComment.create({
          data: {
            body:
              `${result.comment} Уверенность: ${confidenceLabel(result.confidence)} ` +
              `(${Math.round(result.confidenceValue * 100)}%).`,
            isPrivate: true,
            kind: "AI",
            submissionId
          }
        });
      }
    });

    return {
      confidence: result.confidence,
      evaluationId: claimed.evaluation.id,
      processed: true as const,
      score: result.score,
      status: submissionStatus
    };
  } catch (error: unknown) {
    if (isMissingRecordError(error)) {
      return {
        discarded: true as const,
        processed: false as const
      };
    }
    const message = error instanceof Error ? error.message.slice(0, 1_000) : "JUDGE_FAILED";
    await prisma.$transaction(async (tx) => {
      await tx.evaluation.update({
        data: {
          completedAt: new Date(),
          error: message,
          status: "FAILED"
        },
        where: { id: claimed.evaluation.id }
      });
      await tx.submission.update({
        data: {
          aiComment: "Автоматическая проверка не завершилась. Решение направлено администратору.",
          status: "NEEDS_REVIEW"
        },
        where: { id: submissionId }
      });
      if (mode === "PRELIMINARY") {
        await tx.submissionComment.create({
          data: {
            body: "Автоматическая проверка завершилась ошибкой. Нужна ручная проверка.",
            isPrivate: true,
            kind: "SYSTEM",
            submissionId
          }
        });
      }
    });
    console.error("Не удалось проверить посылку", { error, submissionId });
    return {
      error: message,
      evaluationId: claimed.evaluation.id,
      processed: true as const,
      status: "NEEDS_REVIEW" as const
    };
  }
}

function isMissingRecordError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2025";
}

export async function processNextQueuedSubmission() {
  const { processNextEvaluationJob } = await import("@/server/evaluations/queue");
  return processNextEvaluationJob();
}

function confidenceLabel(confidence: "LOW" | "MEDIUM" | "HIGH") {
  if (confidence === "HIGH") return "высокая";
  if (confidence === "MEDIUM") return "средняя";
  return "низкая";
}
