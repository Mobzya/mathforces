import { NextResponse } from "next/server";
import { getAdminUser } from "@/server/auth/authorization";
import { prisma } from "@/server/db/client";
import { apiError, hasValidOrigin, readJsonBody } from "@/server/http/responses";
export async function POST(request: Request) {
  if (!hasValidOrigin(request)) return apiError("Запрос отклонён", 403);
  const admin = await getAdminUser();
  if (!admin) return apiError("Требуются права админа", 403);
  const raw = await readJsonBody(request);
  if (!raw || typeof raw !== "object") return apiError("Некорректный запрос", 422);
  const title = "title" in raw ? String(raw.title).trim() : "";
  const body = "body" in raw ? String(raw.body).trim() : "";
  const isPublished = "isPublished" in raw && Boolean(raw.isPublished);
  if (title.length < 3 || title.length > 160 || body.length < 3 || body.length > 50000)
    return apiError("Проверьте заголовок и текст", 422);
  const post = await prisma.newsPost.create({
    data: {
      authorId: admin.id,
      body,
      excerpt: "excerpt" in raw ? String(raw.excerpt).trim().slice(0, 500) : "",
      isPublished,
      publishedAt: isPublished ? new Date() : null,
      title
    }
  });
  return NextResponse.json({ post }, { status: 201 });
}
