import type { Prisma } from "@/generated/prisma/client";
import { buildRatingSeeds } from "@/server/rating/formula";

export async function captureContestRatingSnapshot(
  tx: Prisma.TransactionClient,
  contestId: string
) {
  const existing = await tx.contestRatingSnapshot.findUnique({
    include: { seeds: true },
    where: { contestId }
  });
  if (existing) return existing;

  const contest = await tx.contest.findUnique({
    include: {
      problems: { select: { maxScore: true } },
      registrations: {
        include: {
          user: { select: { currentRating: true, id: true } }
        },
        orderBy: [{ registeredAt: "asc" }, { userId: "asc" }]
      }
    },
    where: { id: contestId }
  });
  if (!contest) {
    throw new Error("Контест не найден");
  }

  const submissionUsers = await tx.submission.findMany({
    distinct: ["userId"],
    select: {
      user: { select: { currentRating: true, id: true } },
      userId: true
    },
    where: { contestId }
  });
  const entrants = new Map(
    contest.registrations.map((registration) => [
      registration.userId,
      {
        ratingAtStart: registration.user.currentRating,
        registeredAt: registration.registeredAt,
        userId: registration.userId
      }
    ])
  );
  // This fallback only matters for legacy contests where an administrator was
  // allowed to submit without registering before rating snapshots existed.
  for (const submission of submissionUsers) {
    if (!entrants.has(submission.userId)) {
      entrants.set(submission.userId, {
        ratingAtStart: submission.user.currentRating,
        registeredAt: contest.startAt,
        userId: submission.userId
      });
    }
  }
  const seeds = buildRatingSeeds([...entrants.values()]);
  const maxScore = contest.problems.reduce((total, problem) => total + problem.maxScore, 0);

  return tx.contestRatingSnapshot.create({
    data: {
      contestId,
      durationMinutes: contest.durationMinutes,
      maxScore,
      participantCount: seeds.length,
      seeds:
        seeds.length > 0
          ? {
              createMany: {
                data: seeds.map((seed) => ({
                  expectedPlace: seed.expectedPlace,
                  ratingAtStart: seed.ratingAtStart,
                  registeredAt: seed.registeredAt,
                  seedPlace: seed.seedPlace,
                  userId: seed.userId
                }))
              }
            }
          : undefined
    },
    include: { seeds: true }
  });
}

/**
 * Adds late registrations without changing the rating captured for people who
 * were already present at the start. Seed and expected places are rebuilt so
 * the pre-contest ranking remains internally consistent.
 */
export async function synchronizeContestRatingSnapshot(
  tx: Prisma.TransactionClient,
  contestId: string
) {
  const snapshot = await tx.contestRatingSnapshot.findUnique({
    include: { seeds: true },
    where: { contestId }
  });
  if (!snapshot) return captureContestRatingSnapshot(tx, contestId);

  const registrations = await tx.contestRegistration.findMany({
    include: { user: { select: { currentRating: true } } },
    orderBy: [{ registeredAt: "asc" }, { userId: "asc" }],
    where: { contestId }
  });
  const previousByUser = new Map(snapshot.seeds.map((seed) => [seed.userId, seed]));
  const seeds = buildRatingSeeds(
    registrations.map((registration) => ({
      ratingAtStart:
        previousByUser.get(registration.userId)?.ratingAtStart ?? registration.user.currentRating,
      registeredAt: registration.registeredAt,
      userId: registration.userId
    }))
  );

  await tx.contestRatingSeed.deleteMany({ where: { snapshotId: snapshot.id } });
  if (seeds.length > 0) {
    await tx.contestRatingSeed.createMany({
      data: seeds.map((seed) => ({
        expectedPlace: seed.expectedPlace,
        ratingAtStart: seed.ratingAtStart,
        registeredAt: seed.registeredAt,
        seedPlace: seed.seedPlace,
        snapshotId: snapshot.id,
        userId: seed.userId
      }))
    });
  }
  return tx.contestRatingSnapshot.update({
    data: { participantCount: seeds.length },
    include: { seeds: true },
    where: { id: snapshot.id }
  });
}
