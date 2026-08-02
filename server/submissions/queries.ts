import type { User } from "@/generated/prisma/client";
import { encodeTimelineCursor, type TimelineCursor } from "@/server/pagination/cursor";
import { prisma } from "@/server/db/client";
import { serializePublicSubmission } from "@/server/submissions/serialize";

type Viewer = Pick<User, "id" | "role"> | null;

export const PUBLIC_SUBMISSION_PAGE_SIZE = 50;

export async function listPublicContestSubmissions(input: {
  contestId: string;
  cursor?: TimelineCursor | null;
  viewer: Viewer;
}) {
  const contest = await prisma.contest.findUnique({
    select: {
      showOthersSubmissions: true,
      showPreliminaryScores: true
    },
    where: { id: input.contestId }
  });
  if (!contest) return { nextCursor: null, submissions: [] };
  const canSeeOthers = input.viewer?.role === "ADMIN" || contest.showOthersSubmissions;
  const rows = await prisma.submission.findMany({
    include: {
      evaluations: {
        orderBy: { createdAt: "desc" },
        select: { confidence: true, status: true },
        take: 1
      },
      problem: {
        select: { id: true, orderIndex: true, title: true }
      },
      user: {
        select: { currentRating: true, id: true, nickname: true }
      }
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PUBLIC_SUBMISSION_PAGE_SIZE + 1,
    where: {
      contestId: input.contestId,
      AND: [
        input.cursor
          ? {
              OR: [
                { createdAt: { lt: input.cursor.createdAt } },
                {
                  createdAt: input.cursor.createdAt,
                  id: { lt: input.cursor.id }
                }
              ]
            }
          : {},
        !canSeeOthers
          ? input.viewer
            ? { userId: input.viewer.id }
            : { id: { equals: "00000000-0000-0000-0000-000000000000" } }
          : input.viewer?.role === "ADMIN"
            ? {}
            : input.viewer
              ? { OR: [{ isPublic: true }, { userId: input.viewer.id }] }
              : { isPublic: true }
      ]
    }
  });
  const hasMore = rows.length > PUBLIC_SUBMISSION_PAGE_SIZE;
  const pageRows = hasMore ? rows.slice(0, PUBLIC_SUBMISSION_PAGE_SIZE) : rows;
  const last = pageRows.at(-1);
  return {
    nextCursor:
      hasMore && last ? encodeTimelineCursor({ createdAt: last.createdAt, id: last.id }) : null,
    submissions: pageRows.map((submission) =>
      serializePublicSubmission(submission, {
        isAdmin: input.viewer?.role === "ADMIN",
        showPreliminaryScores: contest.showPreliminaryScores,
        viewerId: input.viewer?.id
      })
    )
  };
}
