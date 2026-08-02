import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { canAccessContest } from "@/server/contests/access";
import { prisma } from "@/server/db/client";
import { apiError } from "@/server/http/responses";
import { isUuid } from "@/server/validation/primitives";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return apiError("Контест не найден", 404);

  const viewer = await getCurrentUser();
  const contest = await prisma.contest.findUnique({
    include: {
      ratingCalculation: {
        include: {
          changes: {
            include: {
              user: { select: { id: true, nickname: true } }
            },
            orderBy: { place: "asc" }
          }
        }
      }
    },
    where: { id }
  });
  if (!contest || !canAccessContest(contest, viewer)) {
    return apiError("Контест не найден", 404);
  }
  if (!contest.ratingCalculation) {
    return apiError("Рейтинг этого контеста ещё не рассчитан", 404);
  }

  return NextResponse.json({
    rating: {
      calculatedAt: contest.ratingCalculation.calculatedAt.toISOString(),
      formulaVersion: contest.ratingCalculation.formulaVersion,
      isStale: contest.ratingCalculation.resultsRevision !== contest.resultsRevision,
      participants: contest.ratingCalculation.changes.map((change) => ({
        contestWeight: change.contestWeight,
        delta: change.delta,
        expectedPlace: change.expectedPlace,
        newRating: change.newRating,
        nickname: change.user.nickname,
        place: change.place,
        previousRating: change.previousRating,
        ratingAtStart: change.ratingAtStart,
        seedPlace: change.seedPlace,
        totalScore: change.totalScore,
        userId: change.userId
      }))
    }
  });
}
