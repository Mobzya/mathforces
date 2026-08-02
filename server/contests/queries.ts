import type { User } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import { canAccessContest, contestAccessWhere } from "@/server/contests/access";
import { serializeContestDetail, serializeContestSummary } from "@/server/contests/serialize";
import { canRevealContestProblems } from "@/server/contests/lifecycle";
import { cached } from "@/server/cache/ttl";

type Viewer = Pick<User, "id" | "organizationId" | "role"> | null;

export async function listContests(
  viewer: Viewer,
  options?: {
    page?: number;
    query?: string;
    status?: "ANNOUNCED" | "RUNNING" | "FINISHED" | null;
  }
) {
  const cacheKey = [
    "contests:list",
    viewer?.role ?? "PUBLIC",
    viewer?.organizationId ?? "all",
    options?.status ?? "all",
    options?.page ?? 1,
    options?.query ?? ""
  ].join(":");
  return cached(cacheKey, 2_000, () => loadContests(viewer, options));
}

async function loadContests(
  viewer: Viewer,
  options?: {
    page?: number;
    query?: string;
    status?: "ANNOUNCED" | "RUNNING" | "FINISHED" | null;
  }
) {
  const pageSize = 30;
  const where = {
    AND: [
      contestAccessWhere(viewer),
      options?.status ? { status: options.status } : {},
      options?.query
        ? {
            title: {
              contains: options.query.slice(0, 80),
              mode: "insensitive" as const
            }
          }
        : {}
    ]
  };
  const requestedPage = Math.max(1, options?.page ?? 1);
  const [total, requestedContests] = await Promise.all([
    prisma.contest.count({ where }),
    prisma.contest.findMany({
      include: {
        _count: {
          select: { problems: true, registrations: true }
        },
        organization: true
      },
      orderBy: { startAt: "desc" },
      skip: (requestedPage - 1) * pageSize,
      take: pageSize,
      where
    })
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(totalPages, requestedPage);
  const contests =
    page === requestedPage
      ? requestedContests
      : await prisma.contest.findMany({
          include: {
            _count: {
              select: { problems: true, registrations: true }
            },
            organization: true
          },
          orderBy: { startAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          where
        });

  return {
    contests: contests.map(serializeContestSummary),
    pagination: { page, pageSize, total, totalPages }
  };
}

export async function findContest(id: string, viewer: Viewer) {
  const contest = await prisma.contest.findUnique({
    include: {
      _count: {
        select: { problems: true, registrations: true }
      },
      organization: true,
      problems: {
        orderBy: { orderIndex: "asc" }
      },
      registrations: {
        select: { id: true },
        take: 1,
        where: {
          userId: viewer?.id ?? "00000000-0000-0000-0000-000000000000"
        }
      }
    },
    where: { id }
  });

  if (!contest || !canAccessContest(contest, viewer)) {
    return null;
  }

  return serializeContestDetail(
    contest,
    contest.registrations.length > 0,
    canRevealContestProblems(contest, viewer?.role === "ADMIN")
  );
}
