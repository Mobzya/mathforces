import { prisma } from "@/server/db/client";
import { evaluatePreliminarySolution } from "@/server/evaluations/pipeline";
import { objectStorage } from "@/services/storage";
import { judgeArchiveSolutionWithLlm } from "@/services/archive-judge/llm";

const LOCK_TIMEOUT_MS = 15 * 60_000;
const workerId = `${process.env.HOSTNAME ?? "local"}:${process.pid}:practice`;
let lastStaleReleaseAt = 0;

export async function processNextPracticeAttemptJob() {
  if (Date.now() - lastStaleReleaseAt > 60_000) {
    lastStaleReleaseAt = Date.now();
    await releaseStalePracticeJobs();
  }
  const candidate = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "PracticeAttemptJob"
      WHERE "status" = 'QUEUED' AND "availableAt" <= NOW()
      ORDER BY "availableAt" ASC, "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `;
    const id = rows[0]?.id;
    if (!id) return null;
    return tx.practiceAttemptJob.update({
      data: {
        attempts: { increment: 1 },
        lockedAt: new Date(),
        status: "PROCESSING",
        workerId
      },
      include: {
        attempt: {
          include: {
            problem: {
              select: {
                evaluationRubric: true,
                id: true,
                officialSolution: true,
                statement: true,
                title: true
              }
            }
          }
        }
      },
      where: { id }
    });
  });
  if (!candidate) return { processed: false as const };

  await prisma.practiceAttempt.update({
    data: { status: "PROCESSING" },
    where: { id: candidate.attemptId }
  });
  try {
    const image = await objectStorage.read(candidate.attempt.storageKey);
    const strongResult = await judgeArchiveSolutionWithLlm({
      image,
      mimeType: candidate.attempt.mimeType,
      officialSolution: candidate.attempt.problem.officialSolution,
      rubric: candidate.attempt.problem.evaluationRubric,
      statement: candidate.attempt.problem.statement,
      title: candidate.attempt.problem.title
    });
    if (strongResult) {
      const needsReview = strongResult.confidence < 0.72;
      await prisma.$transaction([
        prisma.practiceAttempt.update({
          data: {
            completedAt: new Date(),
            feedback: strongResult.feedback,
            needsReview,
            recognizedText: strongResult.recognizedText,
            score: strongResult.score,
            status: needsReview ? "NEEDS_REVIEW" : "COMPLETED"
          },
          where: { id: candidate.attemptId }
        }),
        prisma.practiceAttemptJob.update({
          data: {
            completedAt: new Date(),
            error: "",
            lockedAt: null,
            status: "COMPLETED",
            workerId: null
          },
          where: { id: candidate.id }
        })
      ]);
      return {
        attemptId: candidate.attemptId,
        processed: true as const,
        status: needsReview ? ("NEEDS_REVIEW" as const) : ("COMPLETED" as const)
      };
    }
    const result = await evaluatePreliminarySolution({
      image,
      maxScore: 100,
      rubric: candidate.attempt.problem.evaluationRubric
    });
    const feedback =
      `${result.comment} Это оценка структуры решения без подсказок и ` +
      "подтверждения ответа. До подключения математической LLM результат должен подтвердить администратор.";
    await prisma.$transaction([
      prisma.practiceAttempt.update({
        data: {
          completedAt: new Date(),
          feedback,
          needsReview: true,
          recognizedText: result.recognizedText,
          score: result.score,
          status: "NEEDS_REVIEW"
        },
        where: { id: candidate.attemptId }
      }),
      prisma.practiceAttemptJob.update({
        data: {
          completedAt: new Date(),
          error: "",
          lockedAt: null,
          status: "COMPLETED",
          workerId: null
        },
        where: { id: candidate.id }
      })
    ]);
    return {
      attemptId: candidate.attemptId,
      processed: true as const,
      status: "NEEDS_REVIEW" as const
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : "PRACTICE_JUDGE_FAILED";
    const retry = candidate.attempts < candidate.maxAttempts;
    await prisma.$transaction([
      prisma.practiceAttemptJob.update({
        data: retry
          ? {
              availableAt: new Date(Date.now() + retryDelayMs(candidate.attempts)),
              error: message,
              lockedAt: null,
              status: "QUEUED",
              workerId: null
            }
          : {
              completedAt: new Date(),
              error: message,
              lockedAt: null,
              status: "FAILED",
              workerId: null
            },
        where: { id: candidate.id }
      }),
      prisma.practiceAttempt.update({
        data: retry
          ? { error: "", status: "QUEUED" }
          : {
              completedAt: new Date(),
              error: message,
              feedback: "Проверка не завершилась. Попытку можно отправить повторно.",
              status: "FAILED"
            },
        where: { id: candidate.attemptId }
      })
    ]);
    return { attemptId: candidate.attemptId, processed: true as const, retry };
  }
}

async function releaseStalePracticeJobs() {
  const staleBefore = new Date(Date.now() - LOCK_TIMEOUT_MS);
  const jobs = await prisma.practiceAttemptJob.findMany({
    select: { attemptId: true, id: true },
    where: { lockedAt: { lt: staleBefore }, status: "PROCESSING" }
  });
  if (jobs.length === 0) return;
  await prisma.$transaction([
    prisma.practiceAttemptJob.updateMany({
      data: {
        availableAt: new Date(),
        lockedAt: null,
        status: "QUEUED",
        workerId: null
      },
      where: { id: { in: jobs.map((job) => job.id) } }
    }),
    prisma.practiceAttempt.updateMany({
      data: { status: "QUEUED" },
      where: { id: { in: jobs.map((job) => job.attemptId) } }
    })
  ]);
}

function retryDelayMs(attempt: number) {
  return Math.min(10 * 60_000, 10_000 * 2 ** Math.max(0, attempt - 1));
}
