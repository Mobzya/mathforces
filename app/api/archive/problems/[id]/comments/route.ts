import { NextResponse } from "next/server";
import { getRankMeta } from "@/lib/rating/rank";
import { getCurrentUser } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import { apiError, hasValidOrigin, readJsonBody } from "@/server/http/responses";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { isUuid } from "@/server/validation/primitives";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!hasValidOrigin(request)) return apiError("Запрос отклонён", 403);
  const user = await getCurrentUser();
  if (!user) return apiError("Войдите, чтобы обсуждать задачу", 401);
  const { id } = await context.params;
  if (!isUuid(id)) return apiError("Задача не найдена", 404);
  const limit = await consumeRateLimit(request, {
    identity: user.id,
    limit: 12,
    scope: "archive-comment",
    windowMs: 10 * 60_000
  });
  if (!limit.allowed) return apiError("Слишком много комментариев", 429);
  const body = await readJsonBody(request);
  const text =
    typeof body === "object" && body && "body" in body && typeof body.body === "string"
      ? body.body.trim()
      : "";
  if (text.length < 2 || text.length > 1200)
    return apiError("Комментарий должен содержать от 2 до 1200 символов", 422);
  const problem = await prisma.problem.findFirst({
    select: { id: true },
    where: { archiveEnabled: true, archivedAt: { not: null }, id }
  });
  if (!problem) return apiError("Задача не найдена", 404);
  const comment = await prisma.problemComment.create({
    data: { body: text, problemId: id, userId: user.id },
    include: { user: { select: { currentRating: true, id: true, nickname: true } } }
  });
  return NextResponse.json(
    {
      comment: {
        author: {
          id: comment.user.id,
          nickname: comment.user.nickname,
          rankColor: getRankMeta(comment.user.currentRating).color
        },
        body: comment.body,
        createdAt: comment.createdAt.toISOString(),
        id: comment.id,
        score: 0,
        viewerVote: 0
      }
    },
    { status: 201 }
  );
}
