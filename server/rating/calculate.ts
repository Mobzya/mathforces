import { recordAdminAction } from "@/server/admin/audit";
import { prisma } from "@/server/db/client";
import {
  calculateRatingChanges,
  MAX_RATING,
  MAX_RATING_DELTA,
  RATING_FORMULA_VERSION
} from "@/server/rating/formula";
import { captureContestRatingSnapshot } from "@/server/rating/snapshot";
import { effectiveSubmissionScore } from "@/server/scoring/result";
import { invalidateCache } from "@/server/cache/ttl";

export class RatingCalculationError extends Error {
  constructor(
    public readonly code:
      | "CONTEST_NOT_FINISHED"
      | "FINAL_REVIEW_PENDING"
      | "NOT_ENOUGH_PARTICIPANTS"
      | "OUT_OF_ORDER"
      | "RESULTS_CHANGED",
    message: string
  ) {
    super(message);
  }
}

export async function calculateContestRating(contestId: string, calculatedById: string) {
  let contest = await loadContest(contestId);
  if (!contest || contest.status !== "FINISHED") {
    throw new RatingCalculationError(
      "CONTEST_NOT_FINISHED",
      "Рейтинг можно рассчитать только после завершения контеста"
    );
  }
  if (contest.finalization && contest.finalization.status !== "COMPLETED") {
    throw new RatingCalculationError(
      "FINAL_REVIEW_PENDING",
      "Рейтинг будет рассчитан после завершения финальной перепроверки посылок"
    );
  }
  const pendingRejudges = await prisma.evaluationJob.count({
    where: {
      mode: "REJUDGE",
      status: { in: ["QUEUED", "PROCESSING"] },
      submission: { contestId }
    }
  });
  if (pendingRejudges > 0) {
    throw new RatingCalculationError(
      "FINAL_REVIEW_PENDING",
      "Рейтинг будет рассчитан после завершения всех активных перепроверок"
    );
  }

  if (!contest.ratingSnapshot) {
    await prisma.$transaction((tx) => captureContestRatingSnapshot(tx, contestId));
    contest = await loadContest(contestId);
  }
  if (!contest?.ratingSnapshot) {
    throw new Error("Не удалось зафиксировать стартовый рейтинг участников");
  }

  const latestByUserProblem = new Map<string, (typeof contest.submissions)[number]>();
  for (const submission of contest.submissions) {
    latestByUserProblem.set(`${submission.userId}:${submission.problemId}`, submission);
  }

  const seedByUser = new Map(contest.ratingSnapshot.seeds.map((seed) => [seed.userId, seed]));
  const participants = new Map<
    string,
    {
      currentRating: number;
      lastSubmissionAt: Date;
      nickname: string;
      ratingAtStart: number;
      seedPlace: number;
      totalScore: number;
      userId: string;
    }
  >();
  for (const submission of latestByUserProblem.values()) {
    const seed = seedByUser.get(submission.userId);
    if (!seed) continue;

    const existing = participants.get(submission.userId);
    // A new unchecked submission intentionally replaces the older checked
    // submission and contributes zero until preliminary scoring is ready.
    const score = effectiveSubmissionScore(submission);
    if (existing) {
      existing.totalScore += score;
      if (submission.createdAt > existing.lastSubmissionAt) {
        existing.lastSubmissionAt = submission.createdAt;
      }
    } else {
      participants.set(submission.userId, {
        currentRating: submission.user.currentRating,
        lastSubmissionAt: submission.createdAt,
        nickname: submission.user.nickname,
        ratingAtStart: seed.ratingAtStart,
        seedPlace: seed.seedPlace,
        totalScore: score,
        userId: submission.userId
      });
    }
  }
  if (participants.size < 2) {
    throw new RatingCalculationError(
      "NOT_ENOUGH_PARTICIPANTS",
      "Для рейтингового расчёта нужны минимум два участника с посылками"
    );
  }

  const existingChanges = new Map(
    contest.ratingCalculation?.changes.map((change) => [change.userId, change]) ?? []
  );
  if (contest.ratingCalculation) {
    const changedAfterCalculation = contest.ratingCalculation.changes.some(
      (change) => change.user.currentRating !== change.newRating
    );
    if (changedAfterCalculation) {
      throw new RatingCalculationError(
        "RESULTS_CHANGED",
        "После этого контеста уже менялся рейтинг. Пересчитайте более поздние туры в обратном порядке"
      );
    }
  } else {
    const laterChange = await prisma.ratingChange.findFirst({
      select: { id: true },
      where: {
        contest: { endAt: { gt: contest.endAt } },
        userId: { in: [...participants.keys()] }
      }
    });
    if (laterChange) {
      throw new RatingCalculationError(
        "OUT_OF_ORDER",
        "Нельзя впервые рассчитать старый контест после более нового рейтингового тура"
      );
    }
  }

  const formulaInput = [...participants.values()].map((participant) => {
    const existingChange = existingChanges.get(participant.userId);
    return {
      currentRating: existingChange
        ? (existingChange.previousRating ?? 0)
        : participant.currentRating,
      lastSubmissionAt: participant.lastSubmissionAt,
      ratingAtStart: participant.ratingAtStart,
      seedPlace: participant.seedPlace,
      totalScore: participant.totalScore,
      userId: participant.userId
    };
  });
  const results = calculateRatingChanges(formulaInput, {
    durationMinutes: contest.ratingSnapshot.durationMinutes,
    maxScore: contest.ratingSnapshot.maxScore
  });
  const previousHistoryMax = await prisma.ratingChange.groupBy({
    _max: { newRating: true },
    by: ["userId"],
    where: {
      contestId: { not: contestId },
      userId: { in: results.map((result) => result.userId) }
    }
  });
  const historyMaxByUser = new Map(
    previousHistoryMax.map((row) => [row.userId, row._max.newRating ?? 0])
  );

  const output = await prisma.$transaction(async (tx) => {
    const calculation = await tx.ratingCalculation.upsert({
      create: {
        calculatedById,
        contestId,
        formulaVersion: RATING_FORMULA_VERSION,
        metadata: {
          activeParticipants: results.length,
          durationMinutes: contest.ratingSnapshot!.durationMinutes,
          maxDelta: MAX_RATING_DELTA,
          maxRating: MAX_RATING,
          maxScore: contest.ratingSnapshot!.maxScore,
          registeredParticipants: contest.ratingSnapshot!.participantCount,
          scoringRule: "latest-submission-per-problem",
          tieBreak: "last-submission-time"
        },
        participantCount: results.length,
        resultsRevision: contest.resultsRevision
      },
      update: {
        calculatedAt: new Date(),
        calculatedById,
        formulaVersion: RATING_FORMULA_VERSION,
        metadata: {
          activeParticipants: results.length,
          durationMinutes: contest.ratingSnapshot!.durationMinutes,
          maxDelta: MAX_RATING_DELTA,
          maxRating: MAX_RATING,
          maxScore: contest.ratingSnapshot!.maxScore,
          registeredParticipants: contest.ratingSnapshot!.participantCount,
          scoringRule: "latest-submission-per-problem",
          tieBreak: "last-submission-time"
        },
        participantCount: results.length,
        resultsRevision: contest.resultsRevision
      },
      where: { contestId }
    });
    await tx.ratingChange.deleteMany({ where: { contestId } });
    await tx.ratingChange.createMany({
      data: results.map((result) => ({
        actualScore: result.actualScore,
        calculationId: calculation.id,
        contestId,
        contestWeight: result.contestWeight,
        delta: result.delta,
        expectedPlace: result.expectedPlace,
        expectedScore: result.expectedScore,
        newRating: result.newRating,
        performance: result.performance,
        place: result.place,
        previousRating: result.previousRating,
        ratingAtStart: result.ratingAtStart,
        seedPlace: result.seedPlace,
        totalScore: result.totalScore,
        userId: result.userId
      }))
    });
    for (const result of results) {
      await tx.user.update({
        data: {
          currentRating: result.newRating,
          maxRating: Math.max(historyMaxByUser.get(result.userId) ?? 0, result.newRating)
        },
        where: { id: result.userId }
      });
    }
    await recordAdminAction(tx, {
      action: contest.ratingCalculation ? "RATING_RECALCULATED" : "RATING_CALCULATED",
      adminId: calculatedById,
      details: {
        formulaVersion: RATING_FORMULA_VERSION,
        netDelta: results.reduce((total, result) => total + result.delta, 0),
        participantCount: results.length
      },
      entityId: contestId,
      entityType: "CONTEST",
      summary: `${
        contest.ratingCalculation ? "Пересчитан" : "Рассчитан"
      } рейтинг контеста «${contest.title}»`
    });

    return {
      calculatedAt: calculation.calculatedAt.toISOString(),
      contestId,
      formulaVersion: RATING_FORMULA_VERSION,
      netDelta: results.reduce((total, result) => total + result.delta, 0),
      participants: results.map((result) => ({
        ...result,
        nickname: participants.get(result.userId)?.nickname ?? "Участник"
      }))
    };
  });
  invalidateCache("rating:");
  return output;
}

function loadContest(contestId: string) {
  return prisma.contest.findUnique({
    include: {
      finalization: {
        select: { status: true }
      },
      ratingCalculation: {
        include: {
          changes: {
            include: {
              user: { select: { currentRating: true } }
            }
          }
        }
      },
      ratingSnapshot: {
        include: { seeds: true }
      },
      submissions: {
        include: {
          user: {
            select: { currentRating: true, id: true, nickname: true }
          }
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }]
      }
    },
    where: { id: contestId }
  });
}
