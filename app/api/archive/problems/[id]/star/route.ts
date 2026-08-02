import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import { apiError, hasValidOrigin } from "@/server/http/responses";
import { isUuid } from "@/server/validation/primitives";

async function contextUser(request: Request, id: string) {
  if (!hasValidOrigin(request)) return { error: apiError("Запрос отклонён", 403) };
  const user = await getCurrentUser();
  if (!user) return { error: apiError("Войдите, чтобы сохранить задачу", 401) };
  if (!isUuid(id)) return { error: apiError("Задача не найдена", 404) };
  const problem = await prisma.problem.findFirst({
    where: { archiveEnabled: true, archivedAt: { not: null }, id }
  });
  if (!problem) return { error: apiError("Задача не найдена", 404) };
  return { user };
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await contextUser(request, id);
  if ("error" in auth) return auth.error;
  await prisma.problemStar.upsert({
    create: { problemId: id, userId: auth.user.id },
    update: {},
    where: { userId_problemId: { problemId: id, userId: auth.user.id } }
  });
  return NextResponse.json({ starred: true });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await contextUser(request, id);
  if ("error" in auth) return auth.error;
  await prisma.problemStar.deleteMany({ where: { problemId: id, userId: auth.user.id } });
  return NextResponse.json({ starred: false });
}
