import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import { canonicalPair, listFriendDashboard } from "@/server/friends/queries";
import { apiError, hasValidOrigin, readJsonBody } from "@/server/http/responses";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { isUuid } from "@/server/validation/primitives";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("Войдите в аккаунт", 401);
  const query = new URL(request.url).searchParams.get("q") ?? "";
  return NextResponse.json(await listFriendDashboard(user.id, query));
}

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) return apiError("Запрос отклонён", 403);
  const user = await getCurrentUser();
  if (!user) return apiError("Войдите в аккаунт", 401);
  const limit = await consumeRateLimit(request, {
    identity: user.id,
    limit: 30,
    scope: "friend-request",
    windowMs: 60 * 60_000
  });
  if (!limit.allowed) return apiError("Слишком много запросов", 429);
  const body = await readJsonBody(request);
  const targetUserId =
    typeof body === "object" && body && "targetUserId" in body ? String(body.targetUserId) : "";
  if (!isUuid(targetUserId) || targetUserId === user.id)
    return apiError("Некорректный пользователь", 422);
  const target = await prisma.user.findUnique({
    select: { id: true },
    where: { id: targetUserId }
  });
  if (!target) return apiError("Пользователь не найден", 404);
  const [userAId, userBId] = canonicalPair(user.id, targetUserId);
  const existing = await prisma.friendship.findUnique({
    where: { userAId_userBId: { userAId, userBId } }
  });
  if (existing) {
    if (existing.status === "PENDING" && existing.requestedById !== user.id) {
      const friendship = await prisma.friendship.update({
        data: { respondedAt: new Date(), status: "ACCEPTED" },
        where: { id: existing.id }
      });
      return NextResponse.json({ friendship });
    }
    return apiError(
      existing.status === "ACCEPTED" ? "Вы уже в друзьях" : "Запрос уже отправлен",
      409
    );
  }
  const friendship = await prisma.friendship.create({
    data: { requestedById: user.id, userAId, userBId }
  });
  return NextResponse.json({ friendship }, { status: 201 });
}
