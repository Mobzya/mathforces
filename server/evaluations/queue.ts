import type { EvaluationMode, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import { processQueuedSubmission } from "@/server/evaluations/worker";
import { calculateContestRating, RatingCalculationError } from "@/server/rating/calculate";
import { recordAdminAction } from "@/server/admin/audit";
import { publishContestProblemsToArchive } from "@/server/archive/indexing";

const LOCK_TIMEOUT_MS = 10 * 60_000;
const STALE_RELEASE_INTERVAL_MS = 60_000;
const workerId = `${process.env.HOSTNAME ?? "local"}:${process.pid}`;
let lastStaleReleaseAt = 0;

export async function enqueueEvaluation(
  tx: Prisma.TransactionClient,
  input: {
    finalizationId?: string;
    mode: EvaluationMode;
    submissionId: string;
  }
) {
  await tx.$queryRaw`
    SELECT pg_advisory_xact_lock(hashtext(${input.submissionId}))::text AS "lock"
  `;

  const activeJobs = await tx.evaluationJob.findMany({
    orderBy: { createdAt: "asc" },
    where: {
      status: { in: ["QUEUED", "PROCESSING"] },
      submissionId: input.submissionId
    }
  });

  if (input.mode === "PRELIMINARY" && activeJobs.length > 0) {
    return { created: false as const, job: activeJobs[0]! };
  }

  const activeRejudge = activeJobs.find((job) => job.mode === "REJUDGE");
  if (activeRejudge) {
    const job =
      input.finalizationId && !activeRejudge.finalizationId
        ? await tx.evaluationJob.update({
            data: { finalizationId: input.finalizationId },
            where: { id: activeRejudge.id }
          })
        : activeRejudge;
    if (input.finalizationId) {
      await markFinalizationQueued(tx, input.finalizationId);
    }
    return { created: false as const, job };
  }

  if (input.mode === "REJUDGE") {
    const queuedPreliminary = activeJobs.find(
      (job) => job.mode === "PRELIMINARY" && job.status === "QUEUED"
    );
    if (queuedPreliminary) {
      await tx.submission.update({
        data: { finalScore: null, status: "QUEUED" },
        where: { id: input.submissionId }
      });
      const job = await tx.evaluationJob.update({
        data: {
          finalizationId: input.finalizationId,
          mode: "REJUDGE"
        },
        where: { id: queuedPreliminary.id }
      });
      if (input.finalizationId) {
        await markFinalizationQueued(tx, input.finalizationId);
      }
      return { created: true as const, job };
    }

    const failedFinalJob = await tx.evaluationJob.findFirst({
      orderBy: { createdAt: "desc" },
      where: {
        ...(input.finalizationId
          ? { finalizationId: input.finalizationId }
          : {
              finalization: { is: { status: "FAILED" } },
              finalizationId: { not: null }
            }),
        mode: "REJUDGE",
        status: "FAILED",
        submissionId: input.submissionId
      }
    });
    if (failedFinalJob?.finalizationId) {
      await tx.contestFinalization.update({
        data: {
          completedAt: null,
          status: "QUEUED"
        },
        where: { id: failedFinalJob.finalizationId }
      });
      await tx.submission.update({
        data: { finalScore: null, status: "QUEUED" },
        where: { id: input.submissionId }
      });
      const job = await tx.evaluationJob.update({
        data: {
          attempts: 0,
          availableAt: new Date(),
          completedAt: null,
          error: "",
          lockedAt: null,
          status: "QUEUED",
          workerId: null
        },
        where: { id: failedFinalJob.id }
      });
      return { created: true as const, job };
    }
  }

  await tx.submission.update({
    data: {
      ...(input.mode === "REJUDGE" ? { finalScore: null } : {}),
      status: "QUEUED"
    },
    where: { id: input.submissionId }
  });
  const job = await tx.evaluationJob.create({
    data: {
      finalizationId: input.finalizationId,
      mode: input.mode,
      submissionId: input.submissionId
    }
  });
  if (input.finalizationId) {
    await markFinalizationQueued(tx, input.finalizationId);
  }
  return { created: true as const, job };
}

async function markFinalizationQueued(tx: Prisma.TransactionClient, finalizationId: string) {
  await tx.contestFinalization.update({
    data: { completedAt: null, status: "QUEUED" },
    where: { id: finalizationId }
  });
}

export async function enqueueContestFinalization(contestId: string, requestedById: string) {
  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      const existing = await tx.contestFinalization.findUnique({
        where: { contestId }
      });
      if (existing) return existing;

      const submissions = await tx.submission.findMany({
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true, problemId: true, userId: true },
        where: { contestId }
      });
      const latest = new Map<string, string>();
      for (const submission of submissions) {
        latest.set(`${submission.userId}:${submission.problemId}`, submission.id);
      }
      const submissionIds = [...latest.values()];
      const finalization = await tx.contestFinalization.create({
        data: {
          contestId,
          queuedCount: submissionIds.length,
          requestedById,
          status: submissionIds.length > 0 ? "QUEUED" : "COMPLETED",
          ...(submissionIds.length === 0 ? { completedAt: new Date() } : {})
        }
      });
      for (const submissionId of submissionIds) {
        await enqueueEvaluation(tx, {
          finalizationId: finalization.id,
          mode: "REJUDGE",
          submissionId
        });
      }
      return finalization;
    });
  } catch (error: unknown) {
    // Another web/worker instance may have won the unique contest claim.
    const existing = await prisma.contestFinalization.findUnique({
      where: { contestId }
    });
    if (existing) result = existing;
    else throw error;
  }
  if (result.status === "COMPLETED") {
    const contest = await prisma.contest.findUnique({
      select: { autoPublishArchive: true },
      where: { id: contestId }
    });
    if (contest?.autoPublishArchive) {
      await publishContestProblemsToArchive(contestId);
    }
  }
  return result;
}

export class FinalizationRequeueError extends Error {}

export async function requeueContestFinalization(
  contestId: string,
  adminId: string,
  scope: "all" | "failed"
) {
  let finalization = await prisma.contestFinalization.findUnique({
    where: { contestId }
  });
  if (!finalization) {
    finalization = await enqueueContestFinalization(contestId, adminId);
  }

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT pg_advisory_xact_lock(hashtext(${`finalization:${contestId}`}))::text AS "lock"
    `;
    const contest = await tx.contest.findUnique({
      select: { status: true, title: true },
      where: { id: contestId }
    });
    if (!contest || contest.status !== "FINISHED") {
      throw new FinalizationRequeueError(
        "Перепроверка всего тура доступна только после его завершения"
      );
    }

    let submissionIds: string[];
    if (scope === "failed") {
      const failedJobs = await tx.evaluationJob.findMany({
        distinct: ["submissionId"],
        select: { submissionId: true },
        where: {
          finalizationId: finalization.id,
          mode: "REJUDGE",
          status: "FAILED"
        }
      });
      submissionIds = failedJobs.map((job) => job.submissionId);
    } else {
      const submissions = await tx.submission.findMany({
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true, problemId: true, userId: true },
        where: { contestId }
      });
      const latest = new Map<string, string>();
      for (const submission of submissions) {
        latest.set(`${submission.userId}:${submission.problemId}`, submission.id);
      }
      submissionIds = [...latest.values()];
    }

    let queuedCount = 0;
    for (const submissionId of submissionIds) {
      const queued = await enqueueEvaluation(tx, {
        finalizationId: finalization.id,
        mode: "REJUDGE",
        submissionId
      });
      if (queued.created) queuedCount += 1;
    }
    if (queuedCount > 0) {
      await tx.contest.update({
        data: { resultsRevision: { increment: 1 } },
        where: { id: contestId }
      });
    }
    await recordAdminAction(tx, {
      action: scope === "failed" ? "FINALIZATION_FAILED_REQUEUED" : "FINALIZATION_REJUDGED",
      adminId,
      details: { queuedCount, scope, submissionCount: submissionIds.length },
      entityId: contestId,
      entityType: "CONTEST",
      summary:
        scope === "failed"
          ? `Повторно запущены ошибки финальной проверки «${contest.title}»`
          : `Повторно запущена финальная проверка «${contest.title}»`
    });
    return { finalizationId: finalization.id, queuedCount };
  });
}

export async function finalizeExpiredContests() {
  const contests = await prisma.contest.findMany({
    orderBy: { endAt: "asc" },
    select: { autoFinalRejudge: true, createdById: true, id: true },
    take: 20,
    where: { endAt: { lte: new Date() }, status: "RUNNING" }
  });
  const fallbackAdmin = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
    where: { role: "ADMIN" }
  });
  let finalized = 0;
  for (const contest of contests) {
    const claim = await prisma.contest.updateMany({
      data: { status: "FINISHED" },
      where: { id: contest.id, status: "RUNNING" }
    });
    if (claim.count === 0) continue;
    finalized += 1;
    const requestedById = contest.createdById ?? fallbackAdmin?.id;
    if (requestedById && contest.autoFinalRejudge) {
      await enqueueContestFinalization(contest.id, requestedById);
    }
  }
  const missed = await prisma.contest.findMany({
    orderBy: { endAt: "asc" },
    select: { createdById: true, id: true },
    take: 20,
    where: {
      finalization: null,
      autoFinalRejudge: true,
      ratingCalculation: null,
      status: "FINISHED",
      submissions: { some: {} }
    }
  });
  for (const contest of missed) {
    const requestedById = contest.createdById ?? fallbackAdmin?.id;
    if (!requestedById) continue;
    await enqueueContestFinalization(contest.id, requestedById);
  }
  return { finalized, recovered: missed.length };
}

export async function processNextEvaluationJob(options?: { finalizationId?: string }) {
  if (Date.now() - lastStaleReleaseAt >= STALE_RELEASE_INTERVAL_MS) {
    lastStaleReleaseAt = Date.now();
    await releaseStaleJobs();
  }
  const candidate = await prisma.evaluationJob.findFirst({
    orderBy: [{ availableAt: "asc" }, { createdAt: "asc" }],
    where: {
      ...(options?.finalizationId ? { finalizationId: options.finalizationId } : {}),
      availableAt: { lte: new Date() },
      submission: {
        evaluationJobs: {
          none: { status: "PROCESSING" }
        }
      },
      status: "QUEUED"
    }
  });
  if (!candidate) return { processed: false as const };

  const claim = await prisma.evaluationJob.updateMany({
    data: {
      attempts: { increment: 1 },
      lockedAt: new Date(),
      status: "PROCESSING",
      workerId
    },
    where: { id: candidate.id, status: "QUEUED" }
  });
  if (claim.count === 0) return { processed: false as const };

  if (candidate.finalizationId) {
    await prisma.contestFinalization.updateMany({
      data: { startedAt: new Date(), status: "PROCESSING" },
      where: {
        id: candidate.finalizationId,
        status: "QUEUED"
      }
    });
  }
  const submissionClaim = await prisma.submission.updateMany({
    data: { status: "QUEUED" },
    where: { id: candidate.submissionId }
  });
  if (submissionClaim.count === 0) {
    return {
      discarded: true as const,
      jobId: candidate.id,
      processed: true as const
    };
  }

  const result = await processQueuedSubmission(candidate.submissionId, candidate.mode);
  const jobStillExists = await prisma.evaluationJob.findUnique({
    select: { id: true },
    where: { id: candidate.id }
  });
  if (!jobStillExists) {
    return {
      discarded: true as const,
      jobId: candidate.id,
      processed: true as const
    };
  }
  const failed = !result.processed || "error" in result;
  const attempts = candidate.attempts + 1;
  if (failed && attempts < candidate.maxAttempts) {
    await prisma.$transaction(async (tx) => {
      await tx.evaluationJob.updateMany({
        data: {
          availableAt: new Date(Date.now() + retryDelayMs(attempts)),
          error: result.processed && "error" in result ? result.error : "SUBMISSION_NOT_CLAIMED",
          lockedAt: null,
          status: "QUEUED",
          workerId: null
        },
        where: { id: candidate.id }
      });
      await tx.submission.updateMany({
        data: { status: "QUEUED" },
        where: { id: candidate.submissionId }
      });
    });
  } else {
    await prisma.evaluationJob.updateMany({
      data: {
        completedAt: new Date(),
        error:
          failed && result.processed && "error" in result
            ? result.error
            : failed
              ? "SUBMISSION_NOT_CLAIMED"
              : "",
        lockedAt: null,
        status: failed ? "FAILED" : "COMPLETED",
        workerId: null
      },
      where: { id: candidate.id }
    });
  }

  const currentJob = await prisma.evaluationJob.findUnique({
    select: { finalizationId: true },
    where: { id: candidate.id }
  });
  const finalizationId = currentJob?.finalizationId ?? candidate.finalizationId;
  if (finalizationId) {
    await refreshContestFinalization(finalizationId);
  }
  return {
    jobId: candidate.id,
    processed: true as const,
    result
  };
}

export async function drainEvaluationQueue(options?: {
  finalizationId?: string;
  maxJobs?: number;
}) {
  const maxJobs = options?.maxJobs ?? 1_000;
  let processed = 0;
  while (processed < maxJobs) {
    const result = await processNextEvaluationJob({
      finalizationId: options?.finalizationId
    });
    if (!result.processed) break;
    processed += 1;
  }
  return { processed };
}

export async function refreshContestFinalization(finalizationId: string, calculatedById?: string) {
  const finalization = await prisma.contestFinalization.findUnique({
    include: {
      contest: {
        select: {
          ratingCalculation: { select: { resultsRevision: true } },
          autoCalculateRating: true,
          autoPublishArchive: true,
          resultsRevision: true
        }
      },
      jobs: {
        select: {
          status: true,
          submission: { select: { status: true } }
        }
      }
    },
    where: { id: finalizationId }
  });
  if (!finalization) return;

  const completedCount = finalization.jobs.filter((job) => job.status === "COMPLETED").length;
  const failedCount = finalization.jobs.filter((job) => job.status === "FAILED").length;
  const pendingCount = finalization.jobs.length - completedCount - failedCount;
  if (pendingCount > 0) {
    await prisma.contestFinalization.update({
      data: {
        completedAt: null,
        completedCount,
        failedCount,
        queuedCount: finalization.jobs.length,
        status: "PROCESSING"
      },
      where: { id: finalizationId }
    });
    return;
  }

  if (failedCount > 0) {
    await prisma.contestFinalization.update({
      data: {
        completedAt: new Date(),
        completedCount,
        failedCount,
        queuedCount: finalization.jobs.length,
        status: "FAILED"
      },
      where: { id: finalizationId }
    });
    return;
  }

  const manualReviewCount = finalization.jobs.filter(
    (job) => job.submission.status === "NEEDS_REVIEW"
  ).length;
  if (manualReviewCount > 0) {
    await prisma.contestFinalization.update({
      data: {
        completedAt: null,
        completedCount,
        failedCount: 0,
        queuedCount: finalization.jobs.length,
        status: "NEEDS_REVIEW"
      },
      where: { id: finalizationId }
    });
    return;
  }

  const completedAt = new Date();
  const completion = await prisma.contestFinalization.updateMany({
    data: {
      completedAt,
      completedCount,
      failedCount: 0,
      queuedCount: finalization.jobs.length,
      status: "COMPLETED"
    },
    where: { id: finalizationId, status: { not: "COMPLETED" } }
  });
  const ratingIsStale =
    !finalization.contest.ratingCalculation ||
    finalization.contest.ratingCalculation.resultsRevision !== finalization.contest.resultsRevision;
  const ratingAuthor = calculatedById ?? finalization.requestedById;
  if (
    ratingAuthor &&
    finalization.contest.autoCalculateRating &&
    ratingIsStale &&
    (completion.count > 0 || finalization.status === "COMPLETED")
  ) {
    await calculateContestRating(finalization.contestId, ratingAuthor).catch((error) => {
      if (error instanceof RatingCalculationError && error.code === "NOT_ENOUGH_PARTICIPANTS") {
        return;
      }
      console.error("Рейтинг после финальной проверки не рассчитан", {
        contestId: finalization.contestId,
        error
      });
    });
  }
  if (
    finalization.contest.autoPublishArchive &&
    (completion.count > 0 || finalization.status === "COMPLETED")
  ) {
    await publishContestProblemsToArchive(finalization.contestId).catch((error) => {
      console.error("Задачи контеста не опубликованы в архив", {
        contestId: finalization.contestId,
        error
      });
    });
  }
}

async function releaseStaleJobs() {
  const staleBefore = new Date(Date.now() - LOCK_TIMEOUT_MS);
  await prisma.evaluationJob.updateMany({
    data: {
      availableAt: new Date(),
      lockedAt: null,
      status: "QUEUED",
      workerId: null
    },
    where: {
      lockedAt: { lt: staleBefore },
      status: "PROCESSING"
    }
  });
}

function retryDelayMs(attempt: number) {
  return Math.min(5 * 60_000, 5_000 * 2 ** Math.max(0, attempt - 1));
}
