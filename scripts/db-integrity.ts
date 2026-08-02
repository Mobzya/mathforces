import { existsSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile?.(".env");

export {};

const { prisma } = await import("@/server/db/client");

try {
  const now = new Date();
  const [
    queuedJobs,
    processingJobs,
    failedJobs,
    staleJobs,
    queuedPracticeJobs,
    processingPracticeJobs,
    failedPracticeJobs,
    stalePracticeJobs,
    expiredRunningContests,
    submissionsWithoutFiles,
    expiredResetTokens
  ] = await Promise.all([
    prisma.evaluationJob.count({ where: { status: "QUEUED" } }),
    prisma.evaluationJob.count({ where: { status: "PROCESSING" } }),
    prisma.evaluationJob.count({ where: { status: "FAILED" } }),
    prisma.evaluationJob.count({
      where: {
        lockedAt: { lt: new Date(Date.now() - 10 * 60_000) },
        status: "PROCESSING"
      }
    }),
    prisma.practiceAttemptJob.count({ where: { status: "QUEUED" } }),
    prisma.practiceAttemptJob.count({ where: { status: "PROCESSING" } }),
    prisma.practiceAttemptJob.count({ where: { status: "FAILED" } }),
    prisma.practiceAttemptJob.count({
      where: {
        lockedAt: { lt: new Date(Date.now() - 15 * 60_000) },
        status: "PROCESSING"
      }
    }),
    prisma.contest.count({
      where: { endAt: { lte: now }, status: "RUNNING" }
    }),
    prisma.submission.count({ where: { file: null } }),
    prisma.passwordResetToken.count({
      where: { expiresAt: { lte: now }, usedAt: null }
    })
  ]);
  const staleRatingRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS "count"
    FROM "RatingCalculation" rc
    INNER JOIN "Contest" c ON c."id" = rc."contestId"
    WHERE rc."resultsRevision" <> c."resultsRevision"
  `;
  const result = {
    expiredResetTokens,
    expiredRunningContests,
    failedJobs,
    failedPracticeJobs,
    processingJobs,
    processingPracticeJobs,
    queuedJobs,
    queuedPracticeJobs,
    staleJobs,
    stalePracticeJobs,
    staleRatings: Number(staleRatingRows[0]?.count ?? 0),
    submissionsWithoutFiles
  };
  console.log(JSON.stringify(result, null, 2));
  if (
    failedJobs > 0 ||
    failedPracticeJobs > 0 ||
    staleJobs > 0 ||
    stalePracticeJobs > 0 ||
    expiredRunningContests > 0 ||
    submissionsWithoutFiles > 0 ||
    result.staleRatings > 0
  ) {
    process.exitCode = 1;
  }
} finally {
  await prisma.$disconnect();
}
