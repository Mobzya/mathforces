import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import { apiError, hasValidOrigin, readJsonBody } from "@/server/http/responses";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { isUuid } from "@/server/validation/primitives";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!hasValidOrigin(request)) return apiError("Запрос отклонён", 403);
  const user = await getCurrentUser();
  if (!user) return apiError("Войдите, чтобы комментировать новости", 401);
  const { id } = await context.params;
  if (!isUuid(id)) return apiError("Новость не найдена", 404);
  const limit = await consumeRateLimit(request, {
    identity: user.id,
    limit: 12,
    scope: "news-comment",
    windowMs: 10 * 60_000
  });
  if (!limit.allowed) return apiError("Слишком много комментариев", 429);
  const raw = await readJsonBody(request);
  const body =
    typeof raw === "object" && raw && "body" in raw && typeof raw.body === "string"
      ? raw.body.trim()
      : "";
  if (body.length < 2 || body.length > 1200)
    return apiError("Комментарий должен содержать от 2 до 1200 символов", 422);
  const post = await prisma.newsPost.findFirst({
    select: { id: true },
    where: { id, isPublished: true }
  });
  if (!post) return apiError("Новость не найдена", 404);
  const comment = await prisma.newsComment.create({
    data: { body, postId: id, userId: user.id },
    include: { user: { select: { id: true, nickname: true } } }
  });
  return NextResponse.json(
    {
      comment: {
        body: comment.body,
        createdAt: comment.createdAt.toISOString(),
        id: comment.id,
        score: 0,
        user: comment.user,
        viewerVote: 0
      }
    },
    { status: 201 }
  );
}
