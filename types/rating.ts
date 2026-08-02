export type RatingLeaderboardRow = {
  avatarUrl: string | null;
  currentRating: number;
  id: string;
  maxRating: number;
  nickname: string;
  organization: {
    id: string;
    name: string;
  };
  place: number;
  placeDelta: number;
  previousPlace: number;
  rankColor: string;
  rankTitle: string;
  ratingDelta: number | null;
};

export type RatingLeaderboardPayload = {
  generatedAt: string;
  lastContest: {
    calculatedAt: string;
    id: string;
    title: string;
  } | null;
  organizationId: string | null;
  page: number;
  pageSize: number;
  ratedCount: number;
  rows: RatingLeaderboardRow[];
  scope: "all" | "friends";
  total: number;
  totalPages: number;
};

export type RatingOrganization = {
  id: string;
  memberCount: number;
  name: string;
};
