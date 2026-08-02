import { prisma } from "@/server/db/client";
import { submissionStorage } from "@/services/storage";

export async function getSystemMetrics() {
  const startedAt = Date.now();
  const [
    queueGroups,
    finalizationGroups,
    oldestQueued,
    needsReview,
    missedStarts,
    expiredContests,
    storage
  ] = await Promise.all([
    prisma.evaluationJob.groupBy({
      _count: { _all: true },
      by: ["status"]
    }),
    prisma.contestFinalization.groupBy({
      _count: { _all: true },
      by: ["status"]
    }),
    prisma.evaluationJob.findFirst({
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
      where: { status: "QUEUED" }
    }),
    prisma.submission.count({ where: { status: "NEEDS_REVIEW" } }),
    prisma.contest.count({
      where: {
        endAt: { gt: new Date() },
        startAt: { lte: new Date() },
        status: "ANNOUNCED"
      }
    }),
    prisma.contest.count({
      where: { endAt: { lte: new Date() }, status: "RUNNING" }
    }),
    submissionStorage.healthCheck()
  ]);

  return {
    collectedAt: new Date().toISOString(),
    databaseLatencyMs: Date.now() - startedAt,
    expiredContests,
    missedStarts,
    finalizations: Object.fromEntries(
      finalizationGroups.map((group) => [group.status, group._count._all])
    ),
    needsReview,
    oldestQueuedAgeSeconds: oldestQueued
      ? Math.max(0, Math.round((Date.now() - oldestQueued.createdAt.getTime()) / 1_000))
      : 0,
    queue: Object.fromEntries(queueGroups.map((group) => [group.status, group._count._all])),
    storage
  };
}
