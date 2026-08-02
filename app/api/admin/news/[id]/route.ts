import { NextResponse } from "next/server";
import { getAdminUser } from "@/server/auth/authorization";
import { prisma } from "@/server/db/client";
import { apiError, hasValidOrigin, readJsonBody } from "@/server/http/responses";
import { isUuid } from "@/server/validation/primitives";
export async function PATCH(request: Request, route: { params: Promise<{ id: string }> }) {
  if (!hasValidOrigin(request)) return apiError("Запрос отклонён", 403);
  if (!(await getAdminUser())) return apiError("Требуются права админа", 403);
  const { id } = await route.params;
  if (!isUuid(id)) return apiError("Новость не найдена", 404);
  const raw = await readJsonBody(request);
  if (!raw || typeof raw !== "object") return apiError("Некорректный запрос", 422);
  const existing = await prisma.newsPost.findUnique({
    select: { isPublished: true },
    where: { id }
  });
  if (!existing) return apiError("Новость не найдена", 404);
  const isPublished = "isPublished" in raw ? Boolean(raw.isPublished) : existing.isPublished;
  const post = await prisma.newsPost.update({
    data: {
      ...("body" in raw ? { body: String(raw.body).trim().slice(0, 50000) } : {}),
      ...("excerpt" in raw ? { excerpt: String(raw.excerpt).trim().slice(0, 500) } : {}),
      isPublished,
      ...(!existing.isPublished && isPublished ? { publishedAt: new Date() } : {}),
      ...("title" in raw ? { title: String(raw.title).trim().slice(0, 160) } : {})
    },
    where: { id }
  });
  return NextResponse.json({ post });
}
export async function DELETE(request: Request, route: { params: Promise<{ id: string }> }) {
  if (!hasValidOrigin(request)) return apiError("Запрос отклонён", 403);
  if (!(await getAdminUser())) return apiError("Требуются права админа", 403);
  const { id } = await route.params;
  if (!isUuid(id)) return apiError("Новость не найдена", 404);
  await prisma.newsPost.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
