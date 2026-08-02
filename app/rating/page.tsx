import type { Metadata } from "next";
import { RatingLeaderboard } from "@/components/rating/RatingLeaderboard";
import { getRatingLeaderboard, listRatingOrganizations } from "@/server/rating/leaderboard";
import { isUuid } from "@/server/validation/primitives";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Рейтинг",
  description: "Общая таблица рейтинга участников Mathforces и рейтинги организаций."
};

export const dynamic = "force-dynamic";

export default async function RatingPage({
  searchParams
}: {
  searchParams: Promise<{
    organization?: string | string[];
    page?: string | string[];
    scope?: string | string[];
  }>;
}) {
  const requested = await searchParams;
  const requestedOrganization =
    typeof requested.organization === "string" ? requested.organization : null;
  const organizationId =
    requestedOrganization && isUuid(requestedOrganization) ? requestedOrganization : null;
  const requestedPage = typeof requested.page === "string" ? Number(requested.page) : 1;
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const viewer = await getCurrentUser();
  const friendsOnly = requested.scope === "friends" && Boolean(viewer);
  const [organizations, leaderboard] = await Promise.all([
    listRatingOrganizations(),
    getRatingLeaderboard({ friendsOnly, organizationId, page, viewerId: viewer?.id })
  ]);
  const resolvedOrganizationId = organizations.some(
    (organization) => organization.id === organizationId
  )
    ? organizationId
    : null;
  const resolvedLeaderboard =
    resolvedOrganizationId === organizationId
      ? leaderboard
      : await getRatingLeaderboard({
          friendsOnly,
          organizationId: null,
          page,
          viewerId: viewer?.id
        });

  return (
    <RatingLeaderboard
      initialLeaderboard={resolvedLeaderboard}
      key={`${resolvedOrganizationId ?? "all"}:${resolvedLeaderboard.page}`}
      organizations={organizations}
    />
  );
}
