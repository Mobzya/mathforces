import type { User } from "@/generated/prisma/client";
import { getRankMeta } from "@/lib/rating/rank";
import { canAccessContest } from "@/server/contests/access";
import { prisma } from "@/server/db/client";
import { buildRatingSeeds } from "@/server/rating/formula";
import { availableProblemScore } from "@/server/scoring/decay";
import { visibleSubmissionScore } from "@/server/scoring/result";
import { canRevealContestProblems } from "@/server/contests/lifecycle";
import type { ContestStandings, StandingCell, StandingRow } from "@/types/standing";

type StandingsViewer = Pick<User, "id" | "organizationId" | "role"> | null;

export async function getContestStandings(
  contestId: string,
  viewer: StandingsViewer
): Promise<ContestStandings | null> {
  const contest = await prisma.contest.findUnique({
    include: {
      problems: {
        orderBy: { orderIndex: "asc" },
        select: {
          id: true,
          baseScore: true,
          maxScore: true,
          orderIndex: true,
          scoreDecayPer5Min: true,
          title: true
        }
      },
      finalization: {
        select: {
          completedCount: true,
          failedCount: true,
          queuedCount: true,
          status: true
        }
      },
      ratingSnapshot: {
        include: { seeds: true }
      },
      registrations: {
        include: {
          user: {
            select: {
              currentRating: true,
              id: true,
              nickname: true
            }
          }
        }
      },
      submissions: {
        include: {
          comments: {
            orderBy: { createdAt: "asc" }
          },
          user: {
            select: {
              currentRating: true,
              id: true,
              nickname: true
            }
          }
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }]
      }
    },
    where: { id: contestId }
  });

  if (!contest || !canAccessContest(contest, viewer)) {
    return null;
  }

  const now = new Date();
  const scoringAt = contest.status === "FINISHED" && now > contest.endAt ? contest.endAt : now;
  const problems = !canRevealContestProblems(contest, viewer?.role === "ADMIN", now)
    ? []
    : contest.problems.map((problem) => ({
        id: problem.id,
        baseScore: problem.baseScore,
        currentMaxScore: availableProblemScore(problem, contest.startAt, scoringAt),
        label: String.fromCharCode(64 + problem.orderIndex),
        maxScore: problem.maxScore,
        orderIndex: problem.orderIndex,
        scoreDecayPer5Min: problem.scoreDecayPer5Min,
        title: problem.title
      }));
  const users = new Map<
    string,
    {
      currentRating: number;
      id: string;
      nickname: string;
    }
  >();

  for (const registration of contest.registrations) {
    users.set(registration.user.id, registration.user);
  }
  for (const submission of contest.submissions) {
    users.set(submission.user.id, submission.user);
  }
  const registrationTimeByUser = new Map(
    contest.registrations.map((registration) => [registration.userId, registration.registeredAt])
  );
  const previewSeeds = contest.ratingSnapshot
    ? contest.ratingSnapshot.seeds
    : buildRatingSeeds(
        [...users.values()].map((user) => ({
          ratingAtStart: user.currentRating,
          registeredAt: registrationTimeByUser.get(user.id) ?? contest.startAt,
          userId: user.id
        }))
      );
  const seedByUser = new Map(previewSeeds.map((seed) => [seed.userId, seed]));

  const cellsByUser = new Map<string, Map<string, StandingCell>>();
  const rankingScoresByUser = new Map<string, Map<string, number>>();
  const problemById = new Map(contest.problems.map((problem) => [problem.id, problem]));
  for (const submission of contest.submissions) {
    let cells = cellsByUser.get(submission.userId);
    if (!cells) {
      cells = new Map();
      cellsByUser.set(submission.userId, cells);
    }

    const isAdmin = viewer?.role === "ADMIN";
    const isOwn = viewer?.id === submission.userId;
    const canSeeSharedHistory = isAdmin || isOwn || contest.showSubmissionComments;
    const canSeePreliminary =
      isAdmin || isOwn || contest.status === "FINISHED" || contest.showPreliminaryScores;
    const canSeeFinal = isAdmin || submission.status === "FINALIZED";
    const publicStatus =
      !isAdmin && submission.status === "NEEDS_REVIEW" ? "PRELIMINARY_READY" : submission.status;
    const problem = problemById.get(submission.problemId);
    let rankingScores = rankingScoresByUser.get(submission.userId);
    if (!rankingScores) {
      rankingScores = new Map();
      rankingScoresByUser.set(submission.userId, rankingScores);
    }
    rankingScores.set(submission.problemId, visibleSubmissionScore(submission) ?? 0);
    cells.set(submission.problemId, {
      adminComment: canSeeSharedHistory ? submission.adminComment : "",
      aiComment: isAdmin ? submission.aiComment : "",
      finalScore: canSeeFinal ? submission.finalScore : null,
      history: submission.comments
        .filter((comment) => isAdmin || (canSeeSharedHistory && !comment.isPrivate))
        .map((comment) => ({
          body: comment.body,
          createdAt: comment.createdAt.toISOString(),
          kind: comment.kind
        })),
      maxScoreAtSubmission: problem
        ? availableProblemScore(problem, contest.startAt, submission.createdAt)
        : null,
      preliminaryScore: canSeePreliminary ? submission.preliminaryScore : null,
      problemId: submission.problemId,
      score: canSeePreliminary || canSeeFinal ? visibleSubmissionScore(submission) : null,
      scoreDelta:
        canSeeFinal && submission.finalScore !== null && submission.preliminaryScore !== null
          ? submission.finalScore - submission.preliminaryScore
          : null,
      status: publicStatus,
      submissionId: submission.id,
      submittedAt: submission.createdAt.toISOString()
    });
  }

  const rows: StandingRow[] = Array.from(users.values()).map((user) => {
    const userCells = cellsByUser.get(user.id);
    const cells = problems.map(
      (problem): StandingCell =>
        userCells?.get(problem.id) ?? {
          adminComment: "",
          aiComment: "",
          finalScore: null,
          history: [],
          maxScoreAtSubmission: null,
          preliminaryScore: null,
          problemId: problem.id,
          score: null,
          scoreDelta: null,
          status: null,
          submissionId: null,
          submittedAt: null
        }
    );
    const rank = getRankMeta(user.currentRating);
    const seed = seedByUser.get(user.id);
    const submittedTimes = cells
      .map((cell) => cell.submittedAt)
      .filter((value): value is string => Boolean(value));

    return {
      cells,
      isOwn: viewer?.id === user.id,
      lastSubmissionAt:
        submittedTimes.length > 0
          ? submittedTimes.sort((left, right) => right.localeCompare(left))[0]
          : null,
      place: 0,
      preContest: seed
        ? {
            expectedPlace: seed.expectedPlace,
            ratingAtStart: seed.ratingAtStart,
            seedPlace: seed.seedPlace
          }
        : null,
      totalScore: cells.reduce((total, cell) => total + (cell.score ?? 0), 0),
      user: {
        currentRating: user.currentRating,
        id: user.id,
        nickname: user.nickname,
        rankColor: rank.color,
        rankTitle: rank.title
      }
    };
  });

  rows.sort(
    !canRevealContestProblems(contest, viewer?.role === "ADMIN", now)
      ? (left, right) =>
          (left.preContest?.seedPlace ?? Number.MAX_SAFE_INTEGER) -
            (right.preContest?.seedPlace ?? Number.MAX_SAFE_INTEGER) ||
          left.user.nickname.localeCompare(right.user.nickname, "ru")
      : (left, right) => {
          const leftRankingScore = sumScores(rankingScoresByUser.get(left.user.id));
          const rightRankingScore = sumScores(rankingScoresByUser.get(right.user.id));
          if (leftRankingScore !== rightRankingScore) {
            return rightRankingScore - leftRankingScore;
          }
          if (left.lastSubmissionAt !== right.lastSubmissionAt) {
            if (!left.lastSubmissionAt) return 1;
            if (!right.lastSubmissionAt) return -1;
            return left.lastSubmissionAt.localeCompare(right.lastSubmissionAt);
          }
          return left.user.id.localeCompare(right.user.id);
        }
  );

  rows.forEach((row, index) => {
    row.place = index + 1;
  });
  const visibleRows =
    contest.status === "RUNNING" && !contest.showStandingsDuringContest && viewer?.role !== "ADMIN"
      ? rows.filter((row) => row.isOwn)
      : rows;

  return {
    contestId,
    generatedAt: new Date().toISOString(),
    problems,
    rows: visibleRows,
    scoring: {
      currentMaxScore: contest.problems.reduce(
        (total, problem) => total + availableProblemScore(problem, contest.startAt, scoringAt),
        0
      ),
      endAt: contest.endAt.toISOString(),
      finalReview: contest.finalization
        ? {
            completed: contest.finalization.completedCount,
            failed: contest.finalization.failedCount,
            queued: contest.finalization.queuedCount,
            status: contest.finalization.status
          }
        : null,
      maxScore: contest.problems.reduce((total, problem) => total + problem.maxScore, 0),
      serverNow: now.toISOString(),
      startAt: contest.startAt.toISOString()
    },
    status: contest.status
  };
}

function sumScores(scores: Map<string, number> | undefined) {
  if (!scores) return 0;
  let total = 0;
  for (const score of scores.values()) total += score;
  return total;
}

type StandingsRevisionRow = {
  revision: string;
};

export async function getContestStandingsRevision(contestId: string) {
  const rows = await prisma.$queryRaw<StandingsRevisionRow[]>`
    SELECT MD5(CONCAT_WS(':',
      c."updatedAt"::text,
      FLOOR(EXTRACT(EPOCH FROM (NOW() - c."startAt")) / 300)::text,
      COALESCE((
        SELECT MAX(p."updatedAt")::text FROM "Problem" p
        WHERE p."contestId" = c."id"
      ), ''),
      COALESCE((
        SELECT MAX(s."updatedAt")::text FROM "Submission" s
        WHERE s."contestId" = c."id"
      ), ''),
      (
        SELECT COUNT(*)::text FROM "Submission" s
        WHERE s."contestId" = c."id"
      ),
      COALESCE((
        SELECT MAX(r."registeredAt")::text FROM "ContestRegistration" r
        WHERE r."contestId" = c."id"
      ), ''),
      (
        SELECT COUNT(*)::text FROM "ContestRegistration" r
        WHERE r."contestId" = c."id"
      ),
      COALESCE((
        SELECT f."updatedAt"::text FROM "ContestFinalization" f
        WHERE f."contestId" = c."id"
      ), ''),
      COALESCE((
        SELECT MAX(u."updatedAt")::text
        FROM "User" u
        WHERE u."id" IN (
          SELECT r."userId" FROM "ContestRegistration" r
          WHERE r."contestId" = c."id"
          UNION
          SELECT s."userId" FROM "Submission" s
          WHERE s."contestId" = c."id"
        )
      ), '')
    )) AS "revision"
    FROM "Contest" c
    WHERE c."id" = ${contestId}::uuid
  `;
  return rows[0]?.revision ?? null;
}
