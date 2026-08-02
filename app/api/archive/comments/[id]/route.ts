import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import { apiError, hasValidOrigin, readJsonBody } from "@/server/http/responses";
import { isUuid } from "@/server/validation/primitives";

async function authorize(request: Request, id: string) {
  if (!hasValidOrigin(request)) return { error: apiError("Запрос отклонён", 403) };
  const user = await getCurrentUser();
  if (!user) return { error: apiError("Войдите в аккаунт", 401) };
  if (!isUuid(id)) return { error: apiError("Комментарий не найден", 404) };
  const comment = await prisma.problemComment.findUnique({
    select: { userId: true },
    where: { id }
  });
  if (!comment) return { error: apiError("Комментарий не найден", 404) };
  if (comment.userId !== user.id && user.role !== "ADMIN")
    return { error: apiError("Нет прав на это действие", 403) };
  return { user };
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await authorize(request, id);
  if ("error" in auth) return auth.error;
  const body = await readJsonBody(request);
  const text =
    typeof body === "object" && body && "body" in body && typeof body.body === "string"
      ? body.body.trim()
      : "";
  if (text.length < 2 || text.length > 1200)
    return apiError("Комментарий должен содержать от 2 до 1200 символов", 422);
  const comment = await prisma.problemComment.update({
    data: { body: text, editedAt: new Date() },
    where: { id }
  });
  return NextResponse.json({ comment });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await authorize(request, id);
  if ("error" in auth) return auth.error;
  await prisma.problemComment.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
