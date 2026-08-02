import { NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { submissionStorage } from "@/services/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const checkedAt = new Date().toISOString();
  const startedAt = Date.now();

  try {
    const [, storage, queuedJobs, staleJobs, oldestQueued, expiredContests, missedStarts] =
      await Promise.all([
        prisma.$queryRaw`SELECT 1`,
        submissionStorage.healthCheck(),
        prisma.evaluationJob.count({ where: { status: "QUEUED" } }),
        prisma.evaluationJob.count({
          where: {
            lockedAt: { lt: new Date(Date.now() - 10 * 60_000) },
            status: "PROCESSING"
          }
        }),
        prisma.evaluationJob.findFirst({
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
          where: { status: "QUEUED" }
        }),
        prisma.contest.count({
          where: { endAt: { lte: new Date() }, status: "RUNNING" }
        }),
        prisma.contest.count({
          where: {
            endAt: { gt: new Date() },
            startAt: { lte: new Date() },
            status: "ANNOUNCED"
          }
        })
      ]);
    const oldestQueuedAgeSeconds = oldestQueued
      ? Math.max(0, Math.round((Date.now() - oldestQueued.createdAt.getTime()) / 1_000))
      : 0;
    const maxQueueAgeSeconds = Number(process.env.HEALTH_MAX_QUEUE_AGE_SECONDS ?? 120);
    const queueDelayed =
      oldestQueuedAgeSeconds > (Number.isFinite(maxQueueAgeSeconds) ? maxQueueAgeSeconds : 120);
    const healthy =
      storage.status === "up" &&
      staleJobs === 0 &&
      expiredContests === 0 &&
      missedStarts === 0 &&
      !queueDelayed;
    return NextResponse.json(
      {
        checkedAt,
        checks: {
          database: "up",
          queue: {
            oldestQueuedAgeSeconds,
            queuedJobs,
            staleJobs,
            status: staleJobs === 0 && !queueDelayed ? "up" : "degraded"
          },
          scheduler: {
            expiredContests,
            missedStarts,
            status: expiredContests === 0 && missedStarts === 0 ? "up" : "degraded"
          },
          storage
        },
        latencyMs: Date.now() - startedAt,
        status: healthy ? "ok" : "degraded"
      },
      { status: healthy ? 200 : 503 }
    );
  } catch (error: unknown) {
    console.error("Проверка готовности завершилась ошибкой", error);
    return NextResponse.json(
      {
        checkedAt,
        checks: { database: "down" },
        latencyMs: Date.now() - startedAt,
        status: "down"
      },
      { status: 503 }
    );
  }
}
