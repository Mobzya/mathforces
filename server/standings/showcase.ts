import { getRankMeta } from "@/lib/rating/rank";
import { prisma } from "@/server/db/client";

type ShowcaseDatabaseRow = {
  currentRating: number;
  id: string;
  nickname: string;
  place: bigint | number;
  scoredProblemIds: string[];
  totalScore: bigint | number;
};

/**
 * Lightweight public top-five query for the landing page. The full standings
 * payload contains every comment and score history and should not be built for
 * a small decorative preview.
 */
export async function getContestShowcaseStandings(contestId: string) {
  const rows = await prisma.$queryRaw<ShowcaseDatabaseRow[]>`
    WITH participants AS (
      SELECT r."userId"
      FROM "ContestRegistration" r
      WHERE r."contestId" = ${contestId}::uuid
      UNION
      SELECT s."userId"
      FROM "Submission" s
      WHERE s."contestId" = ${contestId}::uuid
    ), latest AS (
      SELECT DISTINCT ON (s."userId", s."problemId")
        s."userId",
        s."problemId",
        s."createdAt",
        CASE
          WHEN s."status" = 'REJECTED' THEN 0
          ELSE COALESCE(s."finalScore", s."preliminaryScore", 0)
        END AS score
      FROM "Submission" s
      WHERE s."contestId" = ${contestId}::uuid
      ORDER BY s."userId", s."problemId", s."createdAt" DESC, s."id" DESC
    ), totals AS (
      SELECT
        p."userId",
        COALESCE(SUM(l.score), 0)::bigint AS "totalScore",
        MAX(l."createdAt") AS "lastSubmissionAt",
        COALESCE(
          ARRAY_AGG(l."problemId"::text) FILTER (WHERE l.score > 0),
          ARRAY[]::text[]
        ) AS "scoredProblemIds"
      FROM participants p
      LEFT JOIN latest l ON l."userId" = p."userId"
      GROUP BY p."userId"
    ), ranked AS (
      SELECT
        u."id",
        u."nickname",
        u."currentRating",
        t."totalScore",
        t."scoredProblemIds",
        ROW_NUMBER() OVER (
          ORDER BY
            t."totalScore" DESC,
            t."lastSubmissionAt" ASC NULLS LAST,
            u."id" ASC
        ) AS place
      FROM totals t
      INNER JOIN "User" u ON u."id" = t."userId"
    )
    SELECT
      "id",
      "nickname",
      "currentRating",
      "totalScore",
      "scoredProblemIds",
      place
    FROM ranked
    ORDER BY place ASC
    LIMIT 5
  `;
  return rows.map((row) => ({
    place: Number(row.place),
    scoredProblemIds: row.scoredProblemIds,
    totalScore: Number(row.totalScore),
    user: {
      id: row.id,
      nickname: row.nickname,
      rankColor: getRankMeta(row.currentRating).color
    }
  }));
}
