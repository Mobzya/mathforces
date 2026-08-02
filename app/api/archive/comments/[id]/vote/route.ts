import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import { apiError, hasValidOrigin, readJsonBody } from "@/server/http/responses";
import { isUuid } from "@/server/validation/primitives";

async function viewer(request: Request, id: string) {
  if (!hasValidOrigin(request)) return { error: apiError("Запрос отклонён", 403) };
  const user = await getCurrentUser();
  if (!user) return { error: apiError("Войдите, чтобы оценивать комментарии", 401) };
  if (!isUuid(id)) return { error: apiError("Комментарий не найден", 404) };
  const exists = await prisma.problemComment.count({ where: { id } });
  if (!exists) return { error: apiError("Комментарий не найден", 404) };
  return { user };
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await viewer(request, id);
  if ("error" in auth) return auth.error;
  const body = await readJsonBody(request);
  const value = typeof body === "object" && body && "value" in body ? body.value : 0;
  if (value !== 1 && value !== -1) return apiError("Оценка должна быть +1 или −1", 422);
  await prisma.problemCommentVote.upsert({
    create: { commentId: id, userId: auth.user.id, value },
    update: { value },
    where: { userId_commentId: { commentId: id, userId: auth.user.id } }
  });
  return NextResponse.json({ value });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await viewer(request, id);
  if ("error" in auth) return auth.error;
  await prisma.problemCommentVote.deleteMany({ where: { commentId: id, userId: auth.user.id } });
  return NextResponse.json({ value: 0 });
}
