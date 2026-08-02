import { Prisma, type ProblemTopic } from "@/generated/prisma/client";
import { getRankMeta } from "@/lib/rating/rank";
import { prisma } from "@/server/db/client";
import type { ArchiveComment, ArchiveProblemSummary } from "@/types/archive";

const PAGE_SIZE = 40;

export function listArchiveWheelProblems() {
  return prisma.problem.findMany({
    orderBy: { archivedAt: "desc" },
    select: { id: true, subtopic: true, topic: true },
    where: {
      archiveEnabled: true,
      archivedAt: { not: null },
      contest: { isPublic: true }
    }
  });
}

type ArchiveStatsRow = {
  averageScore: number | string | null;
  fullSolverCount: bigint | number;
  problemId: string;
};

export async function listArchiveProblems(options?: {
  maxRating?: number | null;
  minRating?: number | null;
  page?: number;
  query?: string;
  sort?: "featured" | "rating" | "solved" | "newest";
  subtopic?: string | null;
  topic?: ProblemTopic | null;
  viewerId?: string | null;
}) {
  const requestedPage = Math.max(1, Math.floor(options?.page ?? 1));
  const query = options?.query?.trim().slice(0, 100) ?? "";
  const where: Prisma.ProblemWhereInput = {
    archiveEnabled: true,
    archivedAt: { not: null },
    contest: { isPublic: true },
    ...(options?.topic ? { topic: options.topic } : {}),
    ...(options?.subtopic
      ? { subtopic: { contains: options.subtopic.slice(0, 80), mode: "insensitive" } }
      : {}),
    ...(options?.minRating !== null && options?.minRating !== undefined
      ? { difficultyRating: { gte: options.minRating } }
      : {}),
    ...(options?.maxRating !== null && options?.maxRating !== undefined
      ? {
          difficultyRating: {
            ...(options?.minRating !== null && options?.minRating !== undefined
              ? { gte: options.minRating }
              : {}),
            lte: options.maxRating
          }
        }
      : {}),
    ...(query
      ? {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { subtopic: { contains: query, mode: "insensitive" } },
            { contest: { title: { contains: query, mode: "insensitive" } } }
          ]
        }
      : {})
  };
  const orderBy = archiveOrderBy(options?.sort ?? "featured");
  const [total, requestedProblems] = await Promise.all([
    prisma.problem.count({ where }),
    prisma.problem.findMany({
      include: {
        _count: { select: { stars: true } },
        contest: { select: { id: true, title: true } },
        practiceAttempts: options?.viewerId
          ? {
              orderBy: { score: "desc" },
              select: { score: true, status: true },
              take: 1,
              where: { userId: options.viewerId }
            }
          : false,
        stars: options?.viewerId
          ? { select: { userId: true }, where: { userId: options.viewerId } }
          : false,
        submissions: options?.viewerId
          ? {
              orderBy: { finalScore: "desc" },
              select: { finalScore: true },
              take: 1,
              where: { status: "FINALIZED", userId: options.viewerId }
            }
          : false
      },
      orderBy,
      skip: (requestedPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      where
    })
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const problems =
    page === requestedPage
      ? requestedProblems
      : await prisma.problem.findMany({
          include: {
            _count: { select: { stars: true } },
            contest: { select: { id: true, title: true } },
            practiceAttempts: options?.viewerId
              ? {
                  orderBy: { score: "desc" },
                  select: { score: true, status: true },
                  take: 1,
                  where: { userId: options.viewerId }
                }
              : false,
            stars: options?.viewerId
              ? { select: { userId: true }, where: { userId: options.viewerId } }
              : false,
            submissions: options?.viewerId
              ? {
                  orderBy: { finalScore: "desc" },
                  select: { finalScore: true },
                  take: 1,
                  where: { status: "FINALIZED", userId: options.viewerId }
                }
              : false
          },
          orderBy,
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
          where
        });

  const stats = await getArchiveProblemStats(problems.map((problem) => problem.id));
  return {
    pagination: { page, pageSize: PAGE_SIZE, total, totalPages },
    problems: problems.map((problem): ArchiveProblemSummary => {
      const practiceBest = problem.practiceAttempts?.[0]?.score ?? null;
      const contestBest = problem.submissions?.[0]?.finalScore ?? null;
      const normalizedContestBest =
        contestBest === null ? null : Math.round((contestBest / problem.maxScore) * 100);
      const bestScore = Math.max(practiceBest ?? -1, normalizedContestBest ?? -1);
      const problemStats = stats.get(problem.id);
      return {
        averageScore: problemStats?.averageScore ?? null,
        bestScore: bestScore >= 0 ? bestScore : null,
        contest: problem.contest,
        difficultyRating: problem.difficultyRating,
        fullSolverCount: problemStats?.fullSolverCount ?? 0,
        id: problem.id,
        isFeatured: problem.isFeatured,
        isSolved: bestScore >= 90,
        isStarred: (problem.stars?.length ?? 0) > 0,
        maxScore: problem.maxScore,
        number: `${problem.contest.title} · ${String.fromCharCode(64 + problem.orderIndex)}`,
        starCount: problem._count.stars,
        subtopic: problem.subtopic,
        title: problem.title,
        topic: problem.topic
      };
    })
  };
}

export async function getArchiveProblem(id: string, viewerId?: string | null) {
  const problem = await prisma.problem.findFirst({
    include: {
      _count: { select: { stars: true } },
      comments: {
        include: {
          user: { select: { currentRating: true, id: true, nickname: true } },
          votes: { select: { userId: true, value: true } }
        },
        orderBy: { createdAt: "desc" },
        take: 100
      },
      contest: { select: { endAt: true, id: true, title: true } },
      practiceAttempts: viewerId
        ? {
            orderBy: { createdAt: "desc" },
            select: {
              createdAt: true,
              feedback: true,
              id: true,
              score: true,
              status: true
            },
            take: 20,
            where: { userId: viewerId }
          }
        : false,
      stars: viewerId ? { select: { userId: true }, where: { userId: viewerId } } : false
    },
    where: {
      archiveEnabled: true,
      archivedAt: { not: null },
      contest: { isPublic: true },
      id
    }
  });
  if (!problem) return null;

  const stats = (await getArchiveProblemStats([problem.id])).get(problem.id);
  const friendIds = viewerId ? await listFriendIds(viewerId) : [];
  const friendAverage =
    friendIds.length > 0 ? await averageUserBestScore(problem.id, friendIds) : null;
  const comments: ArchiveComment[] = problem.comments.map((comment) => ({
    author: {
      id: comment.user.id,
      nickname: comment.user.nickname,
      rankColor: getRankMeta(comment.user.currentRating).color
    },
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
    id: comment.id,
    score: comment.votes.reduce((sum, vote) => sum + vote.value, 0),
    viewerVote: comment.votes.find((vote) => vote.userId === viewerId)?.value ?? 0
  }));

  return {
    ...problem,
    archivedAt: problem.archivedAt!.toISOString(),
    comments,
    contest: { ...problem.contest, endAt: problem.contest.endAt.toISOString() },
    friendAverage,
    isStarred: (problem.stars?.length ?? 0) > 0,
    overallAverage: stats?.averageScore ?? null,
    solverCount: stats?.fullSolverCount ?? 0,
    attempts:
      problem.practiceAttempts?.map((attempt) => ({
        ...attempt,
        createdAt: attempt.createdAt.toISOString()
      })) ?? []
  };
}

async function getArchiveProblemStats(problemIds: string[]) {
  const result = new Map<string, { averageScore: number | null; fullSolverCount: number }>();
  if (problemIds.length === 0) return result;
  const rows = await prisma.$queryRaw<ArchiveStatsRow[]>(Prisma.sql`
    WITH attempts AS (
      SELECT s."problemId", s."userId",
        LEAST(100.0, GREATEST(0.0, s."finalScore"::double precision * 100.0 / NULLIF(p."maxScore", 0))) AS score
      FROM "Submission" s
      JOIN "Problem" p ON p."id" = s."problemId"
      WHERE s."status" = 'FINALIZED' AND s."finalScore" IS NOT NULL
        AND s."problemId" IN (${Prisma.join(problemIds)})
      UNION ALL
      SELECT pa."problemId", pa."userId", pa."score"::double precision AS score
      FROM "PracticeAttempt" pa
      WHERE pa."status" = 'COMPLETED' AND pa."score" IS NOT NULL
        AND pa."problemId" IN (${Prisma.join(problemIds)})
    ), best AS (
      SELECT "problemId", "userId", MAX(score) AS score
      FROM attempts GROUP BY "problemId", "userId"
    )
    SELECT "problemId",
      COUNT(*) FILTER (WHERE score >= 90) AS "fullSolverCount",
      AVG(score)::double precision AS "averageScore"
    FROM best GROUP BY "problemId"
  `);
  for (const row of rows) {
    result.set(row.problemId, {
      averageScore: row.averageScore === null ? null : Math.round(Number(row.averageScore)),
      fullSolverCount: Number(row.fullSolverCount)
    });
  }
  return result;
}

async function listFriendIds(userId: string) {
  const friendships = await prisma.friendship.findMany({
    select: { userAId: true, userBId: true },
    where: {
      OR: [{ userAId: userId }, { userBId: userId }],
      status: "ACCEPTED"
    }
  });
  return friendships.map((friendship) =>
    friendship.userAId === userId ? friendship.userBId : friendship.userAId
  );
}

async function averageUserBestScore(problemId: string, userIds: string[]) {
  if (userIds.length === 0) return null;
  const rows = await prisma.$queryRaw<Array<{ averageScore: number | string | null }>>(Prisma.sql`
    WITH attempts AS (
      SELECT s."userId",
        LEAST(100.0, GREATEST(0.0, s."finalScore"::double precision * 100.0 / NULLIF(p."maxScore", 0))) AS score
      FROM "Submission" s
      JOIN "Problem" p ON p."id" = s."problemId"
      WHERE s."problemId" = ${problemId}::uuid
        AND s."userId" IN (${Prisma.join(userIds)})
        AND s."status" = 'FINALIZED'
        AND s."finalScore" IS NOT NULL
      UNION ALL
      SELECT pa."userId", pa."score"::double precision AS score
      FROM "PracticeAttempt" pa
      WHERE pa."problemId" = ${problemId}::uuid
        AND pa."userId" IN (${Prisma.join(userIds)})
        AND pa."status" = 'COMPLETED'
        AND pa."score" IS NOT NULL
    ), best AS (
      SELECT "userId", MAX(score) AS score
      FROM attempts
      GROUP BY "userId"
    )
    SELECT AVG(score)::double precision AS "averageScore" FROM best
  `);
  const average = rows[0]?.averageScore;
  return average === null || average === undefined ? null : Math.round(Number(average));
}

function archiveOrderBy(
  sort: "featured" | "rating" | "solved" | "newest"
): Prisma.ProblemOrderByWithRelationInput[] {
  if (sort === "rating") return [{ difficultyRating: "asc" }, { archivedAt: "desc" }];
  if (sort === "solved") return [{ submissions: { _count: "desc" } }, { archivedAt: "desc" }];
  if (sort === "newest") return [{ archivedAt: "desc" }];
  return [{ isFeatured: "desc" }, { stars: { _count: "desc" } }, { archivedAt: "desc" }];
}
