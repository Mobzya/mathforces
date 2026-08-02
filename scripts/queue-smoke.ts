import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

process.loadEnvFile?.(".env");

const { prisma } = await import("@/server/db/client");
const { enqueueContestFinalization, enqueueEvaluation, refreshContestFinalization } =
  await import("@/server/evaluations/queue");

const organizationId = randomUUID();
const userId = randomUUID();
const contestId = randomUUID();
const problemId = randomUUID();
const submissionId = randomUUID();

try {
  await prisma.organization.create({
    data: {
      id: organizationId,
      name: `Queue smoke ${organizationId.slice(0, 8)}`,
      normalizedName: `queue-smoke-${organizationId}`
    }
  });
  await prisma.user.create({
    data: {
      email: `queue-smoke-${userId}@mathforces.local`,
      id: userId,
      nickname: `queue_${userId.replaceAll("-", "").slice(0, 10)}`,
      nicknameNormalized: `queue_${userId.replaceAll("-", "").slice(0, 10)}`,
      organizationId,
      passwordHash: "queue-smoke-not-a-password"
    }
  });
  await prisma.contest.create({
    data: {
      durationMinutes: 90,
      endAt: new Date(Date.now() - 1_000),
      id: contestId,
      isPublic: true,
      startAt: new Date(Date.now() - 90 * 60_000),
      status: "FINISHED",
      title: "Queue smoke contest"
    }
  });
  await prisma.problem.create({
    data: {
      baseScore: 100,
      contestId,
      id: problemId,
      maxScore: 100,
      orderIndex: 1,
      statement: "Тестовое условие очереди.",
      title: "Queue smoke problem",
      topic: "ALGEBRA"
    }
  });
  await prisma.submission.create({
    data: {
      contestId,
      id: submissionId,
      imageUrl: "local://queue-smoke",
      problemId,
      status: "QUEUED",
      userId
    }
  });
  const preliminary = await prisma.evaluationJob.create({
    data: { mode: "PRELIMINARY", submissionId }
  });

  const finalization = await enqueueContestFinalization(contestId, userId);
  const activeAfterFinalization = await prisma.evaluationJob.findMany({
    where: {
      status: { in: ["QUEUED", "PROCESSING"] },
      submissionId
    }
  });
  assert.equal(activeAfterFinalization.length, 1);
  assert.equal(activeAfterFinalization[0]?.id, preliminary.id);
  assert.equal(activeAfterFinalization[0]?.mode, "REJUDGE");
  assert.equal(activeAfterFinalization[0]?.finalizationId, finalization.id);

  const duplicate = await prisma.$transaction((tx) =>
    enqueueEvaluation(tx, { mode: "REJUDGE", submissionId })
  );
  assert.equal(duplicate.created, false);
  assert.equal(duplicate.job.id, preliminary.id);

  await prisma.$transaction([
    prisma.evaluationJob.update({
      data: {
        attempts: 3,
        completedAt: new Date(),
        error: "SMOKE_FAILURE",
        status: "FAILED"
      },
      where: { id: preliminary.id }
    }),
    prisma.contestFinalization.update({
      data: {
        completedAt: new Date(),
        failedCount: 1,
        status: "FAILED"
      },
      where: { id: finalization.id }
    })
  ]);

  const retry = await prisma.$transaction((tx) =>
    enqueueEvaluation(tx, { mode: "REJUDGE", submissionId })
  );
  assert.equal(retry.created, true);
  assert.equal(retry.job.id, preliminary.id);
  assert.equal(retry.job.status, "QUEUED");
  assert.equal(retry.job.attempts, 0);
  const recoveredFinalization = await prisma.contestFinalization.findUniqueOrThrow({
    where: { id: finalization.id }
  });
  assert.equal(recoveredFinalization.status, "QUEUED");

  await prisma.$transaction([
    prisma.evaluationJob.update({
      data: {
        completedAt: new Date(),
        error: "",
        status: "COMPLETED"
      },
      where: { id: preliminary.id }
    }),
    prisma.submission.update({
      data: {
        finalScore: 50,
        status: "NEEDS_REVIEW"
      },
      where: { id: submissionId }
    })
  ]);
  await refreshContestFinalization(finalization.id);
  const gatedFinalization = await prisma.contestFinalization.findUniqueOrThrow({
    where: { id: finalization.id }
  });
  assert.equal(gatedFinalization.status, "NEEDS_REVIEW");

  await prisma.submission.update({
    data: { status: "FINALIZED" },
    where: { id: submissionId }
  });
  await refreshContestFinalization(finalization.id);
  const reviewedFinalization = await prisma.contestFinalization.findUniqueOrThrow({
    where: { id: finalization.id }
  });
  assert.equal(reviewedFinalization.status, "COMPLETED");

  console.log("✓ Очередь не дублирует проверку, восстанавливается и ждёт ручное подтверждение");
} finally {
  await prisma.contest.deleteMany({ where: { id: contestId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.organization.deleteMany({ where: { id: organizationId } });
  await prisma.$disconnect();
}
