import type { Prisma, User } from "@/generated/prisma/client";

type Viewer = Pick<User, "organizationId" | "role"> | null;

export function contestAccessWhere(viewer: Viewer): Prisma.ContestWhereInput {
  if (viewer?.role === "ADMIN") {
    return {};
  }

  return viewer
    ? {
        OR: [{ isPublic: true }, { organizationId: viewer.organizationId }]
      }
    : { isPublic: true };
}

export function canAccessContest(
  contest: { isPublic: boolean; organizationId: string | null },
  viewer: Viewer
): boolean {
  return (
    viewer?.role === "ADMIN" ||
    contest.isPublic ||
    contest.organizationId === viewer?.organizationId
  );
}
