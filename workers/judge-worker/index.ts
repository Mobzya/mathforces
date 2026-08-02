import { processNextQueuedSubmission } from "@/server/evaluations/worker";
import { finalizeExpiredContests } from "@/server/evaluations/queue";
import { startScheduledContests } from "@/server/contests/start";
import { cleanupExpiredSecurityRecords } from "@/server/maintenance/cleanup";
import { maybeRunMonthlyArchiveIndex } from "@/server/archive/indexing";
import { processNextPracticeAttemptJob } from "@/server/archive/attempt-queue";

export async function runJudgeWorker(options?: {
  idleDelayMs?: number;
  once?: boolean;
  signal?: AbortSignal;
}) {
  const idleDelayMs = options?.idleDelayMs ?? 2_000;
  let nextContestSweepAt = 0;
  let nextMaintenanceAt = 0;

  do {
    if (Date.now() >= nextContestSweepAt) {
      await startScheduledContests();
      await finalizeExpiredContests();
      nextContestSweepAt = Date.now() + 30_000;
    }
    if (Date.now() >= nextMaintenanceAt) {
      await cleanupExpiredSecurityRecords();
      await maybeRunMonthlyArchiveIndex();
      nextMaintenanceAt = Date.now() + 30 * 60_000;
    }
    const contestResult = await processNextQueuedSubmission();
    const result = contestResult.processed ? contestResult : await processNextPracticeAttemptJob();
    if (options?.once || options?.signal?.aborted) return result;
    if (!result.processed) {
      await new Promise((resolve) => setTimeout(resolve, idleDelayMs));
    }
  } while (!options?.signal?.aborted);

  return { processed: false as const };
}
