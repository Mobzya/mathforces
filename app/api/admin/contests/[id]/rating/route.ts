import { NextResponse } from "next/server";
import { getAdminUser } from "@/server/auth/authorization";
import { prisma } from "@/server/db/client";
import { calculateContestRating, RatingCalculationError } from "@/server/rating/calculate";
import {
  apiError,
  formErrorRedirect,
  hasValidOrigin,
  isFormSubmission
} from "@/server/http/responses";
import { isUuid } from "@/server/validation/primitives";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return apiError("Контест не найден", 404);
  const admin = await getAdminUser();
  if (!admin) return apiError("Требуются права администратора", 403);

  const calculation = await prisma.ratingCalculation.findUnique({
    include: {
      contest: { select: { resultsRevision: true } },
      changes: {
        include: { user: { select: { id: true, nickname: true } } },
        orderBy: { place: "asc" }
      }
    },
    where: { contestId: id }
  });
  return NextResponse.json({
    calculation: calculation
      ? {
          ...calculation,
          isStale: calculation.resultsRevision !== calculation.contest.resultsRevision
        }
      : null
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const submittedAsForm = isFormSubmission(request);
  const fail = (message: string, status: number) =>
    submittedAsForm
      ? formErrorRedirect(request, `/admin/contests/${id}`, message)
      : apiError(message, status);
  if (!hasValidOrigin(request)) return fail("Запрос отклонён", 403);
  if (!isUuid(id)) return fail("Контест не найден", 404);

  try {
    const admin = await getAdminUser();
    if (!admin) return fail("Требуются права администратора", 403);
    const calculation = await calculateContestRating(id, admin.id);
    return submittedAsForm
      ? NextResponse.redirect(new URL(`/admin/contests/${id}`, request.url), 303)
      : NextResponse.json({ calculation });
  } catch (error: unknown) {
    if (error instanceof RatingCalculationError) {
      return fail(error.message, 409);
    }
    console.error("Не удалось рассчитать рейтинг", error);
    return fail("Не удалось рассчитать рейтинг контеста", 500);
  }
}
