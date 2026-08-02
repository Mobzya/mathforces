import type { User, Organization } from "@/generated/prisma/client";
import { getRankMeta } from "@/lib/rating/rank";
import {
  publicAvatarUrl,
  type ProfileAccent,
  type ProfilePattern
} from "@/lib/profile/customization";
import type { CurrentUser, PublicUser } from "@/types/account";

type UserWithOrganization = User & {
  organization: Organization;
};

export function serializePublicUser(user: UserWithOrganization): PublicUser {
  return {
    avatarUrl: publicAvatarUrl(user),
    createdAt: user.createdAt.toISOString(),
    currentRating: user.currentRating,
    description: user.description,
    favoriteTopic: user.favoriteTopic,
    grade: user.showGrade ? user.grade : null,
    id: user.id,
    maxRating: user.maxRating,
    nickname: user.nickname,
    organization: user.showOrganization
      ? {
          id: user.organization.id,
          name: user.organization.name
        }
      : null,
    profileAccent: user.profileAccent as ProfileAccent,
    profilePattern: user.profilePattern as ProfilePattern,
    rank: getRankMeta(user.currentRating),
    showGrade: user.showGrade,
    showOrganization: user.showOrganization
  };
}

export function serializeCurrentUser(user: UserWithOrganization): CurrentUser {
  return {
    ...serializePublicUser(user),
    email: user.email,
    grade: user.grade,
    organization: {
      id: user.organization.id,
      name: user.organization.name
    },
    role: user.role
  };
}
