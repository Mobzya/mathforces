import { prisma } from "@/server/db/client";
import { estimateArchiveDifficulty, type DifficultyObservation } from "@/server/archive/difficulty";
import { adviseArchiveDifficultyWithLlm } from "@/services/archive-indexer/llm";

export async function publishContestProblemsToArchive(contestId: string) {
  const contest = await prisma.contest.findUnique({
    select: { endAt: true, status: true },
    where: { id: contestId }
  });
  if (!contest || contest.status !== "FINISHED") return { published: 0 };
  const published = await prisma.problem.updateMany({
    data: { archivedAt: contest.endAt },
    where: { archiveEnabled: true, archivedAt: null, contestId }
  });
  await reindexArchiveProblems({ contestId });
  return { published: published.count };
}

export async function reindexArchiveProblems(options?: { contestId?: string }) {
  const problems = await prisma.problem.findMany({
    include: {
      contest: { select: { durationMinutes: true } },
      practiceAttempts: {
        select: { score: true, user: { select: { currentRating: true } } },
        where: { score: { not: null }, status: "COMPLETED" }
      },
      submissions: {
        select: {
          finalScore: true,
          user: { select: { currentRating: true } }
        },
        where: { finalScore: { not: null }, status: "FINALIZED" }
      }
    },
    where: {
      archiveEnabled: true,
      archivedAt: { not: null },
      ...(options?.contestId ? { contestId: options.contestId } : {})
    }
  });
  const indexedAt = new Date();
  for (const problem of problems) {
    const observations: DifficultyObservation[] = [
      ...problem.submissions.map((submission) => ({
        rating: submission.user.currentRating,
        score: Math.round((submission.finalScore! / problem.maxScore) * 100)
      })),
      ...problem.practiceAttempts.map((attempt) => ({
        rating: attempt.user.currentRating,
        score: attempt.score!
      }))
    ];
    const deterministicEstimate = estimateArchiveDifficulty({
      observations,
      orderIndex: problem.orderIndex
    });
    let advisedEstimate = null;
    try {
      advisedEstimate = await adviseArchiveDifficultyWithLlm({
        contestDurationMinutes: problem.contest.durationMinutes,
        deterministicRating: deterministicEstimate.rating,
        maxScore: problem.maxScore,
        observations,
        orderIndex: problem.orderIndex,
        subtopic: problem.subtopic,
        title: problem.title
      });
    } catch (error: unknown) {
      console.error("Не удалось получить LLM-индекс сложности", {
        error,
        problemId: problem.id
      });
    }
    const estimate = advisedEstimate ?? deterministicEstimate;
    await prisma.problem.update({
      data: {
        difficultyConfidence: estimate.confidence,
        difficultyIndexedAt: indexedAt,
        difficultyRating: estimate.rating
      },
      where: { id: problem.id }
    });
  }
  return { indexedAt, problemCount: problems.length };
}

export async function maybeRunMonthlyArchiveIndex(now = new Date()) {
  if (now.getUTCDate() !== 1) return { processed: false as const };
  const month = now.toISOString().slice(0, 7);
  const exists = await prisma.archiveRatingIndex.findUnique({ where: { month } });
  if (exists) return { processed: false as const };
  const result = await reindexArchiveProblems();
  await prisma.archiveRatingIndex.create({
    data: {
      metadata: {
        algorithm: "llm-70-percent-v1-with-weighted-fallback",
        indexedAt: result.indexedAt.toISOString()
      },
      month,
      problemCount: result.problemCount
    }
  });
  return { processed: true as const, ...result };
}
