import { recordAdminAction } from "@/server/admin/audit";
import { prisma } from "@/server/db/client";
import { captureContestRatingSnapshot } from "@/server/rating/snapshot";

export class ContestStartError extends Error {
  constructor(
    public readonly code:
      "NOT_FOUND" | "ALREADY_STARTED" | "PROBLEM_COUNT" | "TOO_EARLY" | "WINDOW_EXPIRED",
    message: string
  ) {
    super(message);
  }
}

export async function startContest(
  contestId: string,
  options: { actorId: string | null; automatic?: boolean }
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT pg_advisory_xact_lock(hashtext(${`contest-start:${contestId}`}))::text AS "lock"
    `;
    const contest = await tx.contest.findUnique({
      include: { _count: { select: { problems: true } } },
      where: { id: contestId }
    });
    if (!contest) {
      throw new ContestStartError("NOT_FOUND", "Контест не найден");
    }
    if (contest.status !== "ANNOUNCED") {
      throw new ContestStartError("ALREADY_STARTED", "Контест уже был запущен");
    }
    if (contest._count.problems !== contest.requiredProblemCount) {
      throw new ContestStartError(
        "PROBLEM_COUNT",
        `Для запуска контеста нужно ровно ${contest.requiredProblemCount} задач`
      );
    }
    const now = new Date();
    if (contest.startAt > now) {
      throw new ContestStartError(
        "TOO_EARLY",
        "Контест нельзя запустить раньше указанного времени начала"
      );
    }
    if (contest.endAt <= now) {
      throw new ContestStartError(
        "WINDOW_EXPIRED",
        "Запланированное время контеста уже закончилось. Измените расписание перед запуском"
      );
    }

    const claim = await tx.contest.updateMany({
      data: { status: "RUNNING" },
      where: { id: contestId, status: "ANNOUNCED" }
    });
    if (claim.count === 0) {
      throw new ContestStartError("ALREADY_STARTED", "Контест уже был запущен");
    }
    const snapshot = await captureContestRatingSnapshot(tx, contestId);
    const updated = await tx.contest.findUniqueOrThrow({ where: { id: contestId } });
    await recordAdminAction(tx, {
      action: options.automatic ? "CONTEST_AUTOMATICALLY_STARTED" : "CONTEST_PUBLISHED",
      adminId: options.actorId,
      details: {
        automatic: Boolean(options.automatic),
        ratingParticipants: snapshot.participantCount,
        ratingSnapshotAt: snapshot.capturedAt.toISOString(),
        status: "RUNNING"
      },
      entityId: contestId,
      entityType: "CONTEST",
      summary: `${options.automatic ? "Автоматически запущен" : "Запущен"} контест «${updated.title}»`
    });
    return { contest: updated, snapshot };
  });
}

export async function startScheduledContests() {
  const now = new Date();
  const candidates = await prisma.contest.findMany({
    include: { _count: { select: { problems: true } } },
    orderBy: { startAt: "asc" },
    take: 20,
    where: {
      endAt: { gt: now },
      startAt: { lte: now },
      status: "ANNOUNCED"
    }
  });
  let started = 0;
  let invalid = 0;
  for (const candidate of candidates) {
    if (candidate._count.problems !== candidate.requiredProblemCount) {
      invalid += 1;
      continue;
    }
    try {
      await startContest(candidate.id, { actorId: null, automatic: true });
      started += 1;
    } catch (error: unknown) {
      if (
        !(error instanceof ContestStartError) ||
        (error.code !== "ALREADY_STARTED" && error.code !== "WINDOW_EXPIRED")
      ) {
        throw error;
      }
    }
  }
  return { invalid, started };
}
