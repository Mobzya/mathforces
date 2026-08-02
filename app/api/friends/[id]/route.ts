import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import { apiError, hasValidOrigin } from "@/server/http/responses";
import { isUuid } from "@/server/validation/primitives";

async function context(request: Request, id: string) {
  if (!hasValidOrigin(request)) return { error: apiError("Запрос отклонён", 403) };
  const user = await getCurrentUser();
  if (!user) return { error: apiError("Войдите в аккаунт", 401) };
  if (!isUuid(id)) return { error: apiError("Запрос не найден", 404) };
  const friendship = await prisma.friendship.findFirst({
    where: { id, OR: [{ userAId: user.id }, { userBId: user.id }] }
  });
  if (!friendship) return { error: apiError("Запрос не найден", 404) };
  return { friendship, user };
}

export async function PATCH(request: Request, route: { params: Promise<{ id: string }> }) {
  const { id } = await route.params;
  const auth = await context(request, id);
  if ("error" in auth) return auth.error;
  if (auth.friendship.status !== "PENDING" || auth.friendship.requestedById === auth.user.id)
    return apiError("Этот запрос нельзя принять", 409);
  const friendship = await prisma.friendship.update({
    data: { respondedAt: new Date(), status: "ACCEPTED" },
    where: { id }
  });
  return NextResponse.json({ friendship });
}

export async function DELETE(request: Request, route: { params: Promise<{ id: string }> }) {
  const { id } = await route.params;
  const auth = await context(request, id);
  if ("error" in auth) return auth.error;
  await prisma.friendship.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
