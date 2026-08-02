import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

process.loadEnvFile?.(".env");

const { prisma } = await import("@/server/db/client");
const { startContest } = await import("@/server/contests/start");
const { refreshContestFinalization } = await import("@/server/evaluations/queue");

const organizationId = randomUUID();
const adminId = randomUUID();
const firstUserId = randomUUID();
const secondUserId = randomUUID();
const contestId = randomUUID();

try {
  await prisma.organization.create({
    data: {
      id: organizationId,
      name: `Cycle smoke ${organizationId.slice(0, 8)}`,
      normalizedName: `cycle-smoke-${organizationId}`
    }
  });
  await prisma.user.createMany({
    data: [
      {
        email: `cycle-admin-${adminId}@mathforces.local`,
        id: adminId,
        nickname: `admin_${adminId.replaceAll("-", "").slice(0, 10)}`,
        nicknameNormalized: `admin_${adminId.replaceAll("-", "").slice(0, 10)}`,
        organizationId,
        passwordHash: "cycle-smoke-not-a-password",
        role: "ADMIN"
      },
      {
        email: `cycle-first-${firstUserId}@mathforces.local`,
        id: firstUserId,
        nickname: `first_${firstUserId.replaceAll("-", "").slice(0, 10)}`,
        nicknameNormalized: `first_${firstUserId.replaceAll("-", "").slice(0, 10)}`,
        organizationId,
        passwordHash: "cycle-smoke-not-a-password"
      },
      {
        email: `cycle-second-${secondUserId}@mathforces.local`,
        id: secondUserId,
        nickname: `second_${secondUserId.replaceAll("-", "").slice(0, 10)}`,
        nicknameNormalized: `second_${secondUserId.replaceAll("-", "").slice(0, 10)}`,
        organizationId,
        passwordHash: "cycle-smoke-not-a-password"
      }
    ]
  });
  const startAt = new Date(Date.now() - 1_000);
  await prisma.contest.create({
    data: {
      createdById: adminId,
      durationMinutes: 90,
      endAt: new Date(Date.now() + 90 * 60_000),
      id: contestId,
      startAt,
      title: "Full cycle smoke"
    }
  });
  const problemIds = Array.from({ length: 5 }, () => randomUUID());
  await prisma.problem.createMany({
    data: problemIds.map((id, index) => ({
      baseScore: 100 + index * 10,
      contestId,
      evaluationRubric: "Ручная проверка smoke-сценария",
      id,
      maxScore: 100 + index * 10,
      orderIndex: index + 1,
      statement: `Условие ${index + 1}`,
      title: `Задача ${index + 1}`,
      topic: ["ALGEBRA", "COMBINATORICS", "NUMBER_THEORY", "GEOMETRY", "ALGEBRA"][index] as
        "ALGEBRA" | "COMBINATORICS" | "NUMBER_THEORY" | "GEOMETRY"
    }))
  });
  await prisma.contestRegistration.createMany({
    data: [firstUserId, secondUserId].map((userId) => ({ contestId, userId }))
  });

  await startContest(contestId, { actorId: adminId });
  const snapshot = await prisma.contestRatingSnapshot.findUniqueOrThrow({
    include: { seeds: true },
    where: { contestId }
  });
  assert.equal(snapshot.participantCount, 2);
  assert.deepEqual(
    snapshot.seeds.map((seed) => seed.ratingAtStart),
    [0, 0]
  );

  const firstSubmissionId = randomUUID();
  const secondSubmissionId = randomUUID();
  await prisma.submission.createMany({
    data: [
      {
        contestId,
        finalScore: 100,
        id: firstSubmissionId,
        imageUrl: "local://cycle-smoke-first",
        preliminaryScore: 80,
        problemId: problemIds[0]!,
        status: "NEEDS_REVIEW",
        userId: firstUserId
      },
      {
        contestId,
        finalScore: 60,
        id: secondSubmissionId,
        imageUrl: "local://cycle-smoke-second",
        preliminaryScore: 55,
        problemId: problemIds[0]!,
        status: "NEEDS_REVIEW",
        userId: secondUserId
      }
    ]
  });
  await prisma.contest.update({
    data: { resultsRevision: 1, status: "FINISHED" },
    where: { id: contestId }
  });
  const finalization = await prisma.contestFinalization.create({
    data: {
      contestId,
      completedCount: 2,
      queuedCount: 2,
      requestedById: adminId,
      status: "PROCESSING"
    }
  });
  await prisma.evaluationJob.createMany({
    data: [firstSubmissionId, secondSubmissionId].map((submissionId) => ({
      completedAt: new Date(),
      finalizationId: finalization.id,
      mode: "REJUDGE",
      status: "COMPLETED",
      submissionId
    }))
  });

  await refreshContestFinalization(finalization.id, adminId);
  assert.equal(
    (
      await prisma.contestFinalization.findUniqueOrThrow({
        where: { id: finalization.id }
      })
    ).status,
    "NEEDS_REVIEW"
  );
  assert.equal(await prisma.ratingCalculation.count({ where: { contestId } }), 0);

  await prisma.$transaction([
    prisma.submission.updateMany({
      data: { status: "FINALIZED" },
      where: { contestId }
    }),
    prisma.contest.update({
      data: { resultsRevision: { increment: 1 } },
      where: { id: contestId }
    })
  ]);
  await refreshContestFinalization(finalization.id, adminId);

  const completed = await prisma.contestFinalization.findUniqueOrThrow({
    where: { id: finalization.id }
  });
  assert.equal(completed.status, "COMPLETED");
  const calculation = await prisma.ratingCalculation.findUniqueOrThrow({
    include: { changes: { orderBy: { place: "asc" } } },
    where: { contestId }
  });
  const contest = await prisma.contest.findUniqueOrThrow({ where: { id: contestId } });
  assert.equal(calculation.resultsRevision, contest.resultsRevision);
  assert.equal(calculation.changes.length, 2);
  assert.ok(calculation.changes.every((change) => change.newRating > 0));
  assert.ok(calculation.changes.every((change) => change.previousRating === null));

  console.log(
    "✓ Полный цикл: рейтинг 0 скрыт до тура, manual gate блокирует и затем публикует rating"
  );
} finally {
  await prisma.adminAction.deleteMany({
    where: {
      OR: [{ entityId: contestId }, { entityId: { in: [adminId, firstUserId, secondUserId] } }]
    }
  });
  await prisma.contest.deleteMany({ where: { id: contestId } });
  await prisma.user.deleteMany({
    where: { id: { in: [adminId, firstUserId, secondUserId] } }
  });
  await prisma.organization.deleteMany({ where: { id: organizationId } });
  await prisma.$disconnect();
}
