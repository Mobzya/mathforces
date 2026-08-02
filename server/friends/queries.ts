import { getRankMeta } from "@/lib/rating/rank";
import { publicAvatarUrl } from "@/lib/profile/customization";
import { prisma } from "@/server/db/client";

export async function listFriendIds(userId: string) {
  const rows = await prisma.friendship.findMany({
    select: { userAId: true, userBId: true },
    where: { OR: [{ userAId: userId }, { userBId: userId }], status: "ACCEPTED" }
  });
  return rows.map((row) => (row.userAId === userId ? row.userBId : row.userAId));
}

export async function getFriendshipBetween(userId: string, targetId: string) {
  const [userAId, userBId] = canonicalPair(userId, targetId);
  return prisma.friendship.findUnique({ where: { userAId_userBId: { userAId, userBId } } });
}

export async function listFriendDashboard(userId: string, query = "") {
  const friendships = await prisma.friendship.findMany({
    include: {
      requestedBy: { select: { id: true } },
      userA: { include: { organization: { select: { name: true } } } },
      userB: { include: { organization: { select: { name: true } } } }
    },
    orderBy: { createdAt: "desc" },
    where: { OR: [{ userAId: userId }, { userBId: userId }] }
  });
  const mapped = friendships.map((friendship) => {
    const person = friendship.userAId === userId ? friendship.userB : friendship.userA;
    return {
      friendshipId: friendship.id,
      isIncoming: friendship.status === "PENDING" && friendship.requestedById !== userId,
      isOnline: Date.now() - person.lastSeenAt.getTime() < 5 * 60_000,
      person: {
        avatarUrl: publicAvatarUrl(person),
        currentRating: person.currentRating,
        id: person.id,
        nickname: person.nickname,
        organization: person.organization.name,
        rankColor: getRankMeta(person.currentRating).color
      },
      status: friendship.status
    };
  });
  const search = query.trim().slice(0, 60);
  const existingIds = new Set([userId, ...mapped.map((row) => row.person.id)]);
  const suggestions =
    search.length >= 2
      ? await prisma.user.findMany({
          include: { organization: { select: { name: true } } },
          orderBy: [{ currentRating: "desc" }, { nicknameNormalized: "asc" }],
          take: 12,
          where: {
            id: { notIn: [...existingIds] },
            nickname: { contains: search, mode: "insensitive" }
          }
        })
      : [];
  return {
    accepted: mapped.filter((row) => row.status === "ACCEPTED"),
    incoming: mapped.filter((row) => row.status === "PENDING" && row.isIncoming),
    outgoing: mapped.filter((row) => row.status === "PENDING" && !row.isIncoming),
    suggestions: suggestions.map((person) => ({
      avatarUrl: publicAvatarUrl(person),
      currentRating: person.currentRating,
      id: person.id,
      nickname: person.nickname,
      organization: person.organization.name,
      rankColor: getRankMeta(person.currentRating).color
    }))
  };
}

export function canonicalPair(first: string, second: string): [string, string] {
  return first.localeCompare(second) < 0 ? [first, second] : [second, first];
}
