import { Prisma } from "@/generated/prisma/client";
import { getRankMeta } from "@/lib/rating/rank";
import { prisma } from "@/server/db/client";
import type { RatingLeaderboardPayload, RatingOrganization } from "@/types/rating";
import { publicAvatarUrl } from "@/lib/profile/customization";
import { cached } from "@/server/cache/ttl";
import { listFriendIds } from "@/server/friends/queries";

export const RATING_PAGE_SIZE = 50;

type LeaderboardDatabaseRow = {
  avatarStorageKey: string | null;
  avatarVersion: number;
  currentRating: number;
  id: string;
  maxRating: number;
  nickname: string;
  organizationId: string;
  organizationName: string;
  place: bigint | number;
  previousPlace: bigint | number;
  ratingDelta: number | null;
};

type LeaderboardRevisionRow = {
  revision: string;
};

export async function getRatingLeaderboardRevision(organizationId?: string | null) {
  const resolvedOrganizationId = organizationId ?? null;
  const rows = await prisma.$queryRaw<LeaderboardRevisionRow[]>`
    SELECT MD5(CONCAT_WS(':',
      COUNT(*)::text,
      COALESCE(MAX(u."updatedAt")::text, ''),
      COALESCE((
        SELECT MAX(o."updatedAt")::text
        FROM "Organization" o
        WHERE o."id" IN (
          SELECT scoped_user."organizationId"
          FROM "User" scoped_user
          WHERE (
            ${resolvedOrganizationId}::uuid IS NULL
            OR scoped_user."organizationId" = ${resolvedOrganizationId}::uuid
          )
        )
      ), ''),
      COALESCE((
        SELECT MAX(rc."calculatedAt")::text FROM "RatingCalculation" rc
      ), '')
    )) AS "revision"
    FROM "User" u
    WHERE (
      ${resolvedOrganizationId}::uuid IS NULL
      OR u."organizationId" = ${resolvedOrganizationId}::uuid
    )
  `;
  return rows[0]?.revision ?? "empty";
}

export async function listRatingOrganizations(): Promise<RatingOrganization[]> {
  return cached("rating:organizations", 10_000, async () => {
    const organizations = await prisma.organization.findMany({
      orderBy: { name: "asc" },
      select: {
        _count: { select: { members: true } },
        id: true,
        name: true
      }
    });
    return organizations.map((organization) => ({
      id: organization.id,
      memberCount: organization._count.members,
      name: organization.name
    }));
  });
}

export async function getRatingLeaderboard(options?: {
  friendsOnly?: boolean;
  organizationId?: string | null;
  page?: number;
  viewerId?: string | null;
}): Promise<RatingLeaderboardPayload> {
  return cached(
    `rating:leaderboard:${options?.organizationId ?? "all"}:${options?.page ?? 1}:${options?.friendsOnly ? (options.viewerId ?? "guest") : "global"}`,
    2_000,
    () => loadRatingLeaderboard(options)
  );
}

async function loadRatingLeaderboard(options?: {
  friendsOnly?: boolean;
  organizationId?: string | null;
  page?: number;
  viewerId?: string | null;
}): Promise<RatingLeaderboardPayload> {
  const organizationId = options?.organizationId ?? null;
  const friendsOnly = Boolean(options?.friendsOnly && options.viewerId);
  const scopedUserIds = friendsOnly
    ? [options!.viewerId!, ...(await listFriendIds(options!.viewerId!))]
    : null;
  const userWhere = {
    ...(organizationId ? { organizationId } : {}),
    ...(scopedUserIds ? { id: { in: scopedUserIds } } : {})
  };
  const [total, ratedCount, lastCalculation] = await Promise.all([
    prisma.user.count({
      where: userWhere
    }),
    prisma.user.count({
      where: {
        currentRating: { gt: 0 },
        ...userWhere
      }
    }),
    prisma.ratingCalculation.findFirst({
      orderBy: [{ contest: { endAt: "desc" } }, { calculatedAt: "desc" }],
      select: {
        calculatedAt: true,
        id: true,
        contest: { select: { id: true, title: true } }
      }
    })
  ]);
  const totalPages = Math.max(1, Math.ceil(total / RATING_PAGE_SIZE));
  const page = Math.min(totalPages, Math.max(1, Math.floor(options?.page ?? 1)));
  const calculationId = lastCalculation?.id ?? null;
  const offset = (page - 1) * RATING_PAGE_SIZE;
  const friendsFilter = scopedUserIds
    ? Prisma.sql`AND u."id" IN (${Prisma.join(scopedUserIds)})`
    : Prisma.empty;

  const records = await prisma.$queryRaw<LeaderboardDatabaseRow[]>`
    WITH "ranked" AS (
      SELECT
        u."id",
        u."nickname",
        u."avatarStorageKey",
        u."avatarVersion",
        u."currentRating",
        u."maxRating",
        o."id" AS "organizationId",
        o."name" AS "organizationName",
        rc."delta" AS "ratingDelta",
        ROW_NUMBER() OVER (
          ORDER BY
            u."currentRating" DESC,
            u."nicknameNormalized" ASC,
            u."id" ASC
        ) AS "place",
        ROW_NUMBER() OVER (
          ORDER BY
            CASE
              WHEN rc."id" IS NULL THEN u."currentRating"
              ELSE COALESCE(rc."previousRating", 0)
            END DESC,
            u."nicknameNormalized" ASC,
            u."id" ASC
        ) AS "previousPlace"
      FROM "User" u
      INNER JOIN "Organization" o ON o."id" = u."organizationId"
      LEFT JOIN "RatingChange" rc
        ON rc."userId" = u."id"
        AND rc."calculationId" = ${calculationId}
      WHERE (
        ${organizationId}::uuid IS NULL
        OR u."organizationId" = ${organizationId}::uuid
      )
      ${friendsFilter}
    )
    SELECT
      "id",
      "nickname",
      "avatarStorageKey",
      "avatarVersion",
      "currentRating",
      "maxRating",
      "organizationId",
      "organizationName",
      "ratingDelta",
      "place",
      "previousPlace"
    FROM "ranked"
    ORDER BY "place" ASC
    LIMIT ${RATING_PAGE_SIZE}
    OFFSET ${offset}
  `;

  return {
    generatedAt: new Date().toISOString(),
    lastContest: lastCalculation
      ? {
          calculatedAt: lastCalculation.calculatedAt.toISOString(),
          id: lastCalculation.contest.id,
          title: lastCalculation.contest.title
        }
      : null,
    organizationId,
    page,
    pageSize: RATING_PAGE_SIZE,
    ratedCount,
    rows: records.map((record) => {
      const place = Number(record.place);
      const previousPlace = Number(record.previousPlace);
      const rank = getRankMeta(record.currentRating);
      return {
        avatarUrl: publicAvatarUrl(record),
        currentRating: record.currentRating,
        id: record.id,
        maxRating: record.maxRating,
        nickname: record.nickname,
        organization: {
          id: record.organizationId,
          name: record.organizationName
        },
        place,
        placeDelta: previousPlace - place,
        previousPlace,
        rankColor: rank.color,
        rankTitle: rank.title,
        ratingDelta: record.ratingDelta
      };
    }),
    scope: friendsOnly ? "friends" : "all",
    total,
    totalPages
  };
}
