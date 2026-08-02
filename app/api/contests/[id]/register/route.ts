import { NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { canAccessContest } from "@/server/contests/access";
import {
  apiError,
  formErrorRedirect,
  hasValidOrigin,
  isFormSubmission
} from "@/server/http/responses";
import { isUuid } from "@/server/validation/primitives";
import { isContestRegistrationOpen } from "@/server/contests/lifecycle";
import { synchronizeContestRatingSnapshot } from "@/server/rating/snapshot";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const formSubmission = isFormSubmission(request);
  const contestPath = `/contests/${id}`;
  const fail = (message: string, status: number, pathname = contestPath) =>
    formSubmission ? formErrorRedirect(request, pathname, message) : apiError(message, status);

  if (!hasValidOrigin(request)) {
    return fail("Запрос отклонён", 403);
  }

  if (!isUuid(id)) {
    return fail("Контест не найден", 404);
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      return fail("Сессия завершилась. Войдите снова", 401, "/login");
    }

    const contest = await prisma.contest.findUnique({
      select: {
        endAt: true,
        id: true,
        isPublic: true,
        organizationId: true,
        registrationClosesAt: true,
        startAt: true,
        status: true
      },
      where: { id }
    });
    if (!contest || !canAccessContest(contest, user)) {
      return fail("Контест не найден", 404);
    }
    if (!isContestRegistrationOpen(contest)) {
      return fail("Регистрация на этот контест закрыта", 409);
    }

    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(hashtext(${`contest-registration:${contest.id}`}))::text AS "lock"
      `;
      await tx.contestRegistration.upsert({
        create: {
          contestId: contest.id,
          userId: user.id
        },
        update: {},
        where: {
          contestId_userId: {
            contestId: contest.id,
            userId: user.id
          }
        }
      });
      if (contest.status === "RUNNING") {
        await synchronizeContestRatingSnapshot(tx, contest.id);
      }
    });

    return formSubmission
      ? NextResponse.redirect(new URL(contestPath, request.url), 303)
      : NextResponse.json({ registered: true });
  } catch (error: unknown) {
    console.error("Не удалось зарегистрироваться на контест", error);
    return fail("Не удалось зарегистрироваться на контест", 500);
  }
}
