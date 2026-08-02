import type { FavoriteTopic, ProfileAccent, ProfilePattern } from "@/lib/profile/customization";

export type PublicOrganization = {
  id: string;
  memberCount: number;
  name: string;
};

export type PublicUser = {
  avatarUrl: string | null;
  createdAt: string;
  currentRating: number;
  description: string;
  favoriteTopic: FavoriteTopic | null;
  grade: number | null;
  id: string;
  maxRating: number;
  nickname: string;
  organization: {
    id: string;
    name: string;
  } | null;
  profileAccent: ProfileAccent;
  profilePattern: ProfilePattern;
  rank: {
    color: string;
    title: string;
  };
  showGrade: boolean;
  showOrganization: boolean;
};

export type CurrentUser = Omit<PublicUser, "organization"> & {
  email: string;
  organization: {
    id: string;
    name: string;
  };
  role: "PARTICIPANT" | "ADMIN";
};
