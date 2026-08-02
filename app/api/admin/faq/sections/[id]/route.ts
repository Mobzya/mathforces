import { NextResponse } from "next/server";
import { getAdminUser } from "@/server/auth/authorization";
import { prisma } from "@/server/db/client";
import { apiError, hasValidOrigin, readJsonBody } from "@/server/http/responses";
import { isUuid } from "@/server/validation/primitives";

export async function PATCH(request: Request, route: { params: Promise<{ id: string }> }) {
  if (!hasValidOrigin(request)) return apiError("Запрос отклонён", 403);
  if (!(await getAdminUser())) return apiError("Требуются права админа", 403);
  const { id } = await route.params;
  if (!isUuid(id)) return apiError("Раздел не найден", 404);
  const body = await readJsonBody(request);
  if (!body || typeof body !== "object") return apiError("Некорректный запрос", 422);
  const section = await prisma.faqSection.update({
    data: {
      ...("description" in body
        ? { description: String(body.description).trim().slice(0, 500) }
        : {}),
      ...("isPublished" in body ? { isPublished: Boolean(body.isPublished) } : {}),
      ...("orderIndex" in body ? { orderIndex: Number(body.orderIndex) || 1 } : {}),
      ...("title" in body ? { title: String(body.title).trim().slice(0, 120) } : {})
    },
    where: { id }
  });
  return NextResponse.json({ section });
}
export async function DELETE(request: Request, route: { params: Promise<{ id: string }> }) {
  if (!hasValidOrigin(request)) return apiError("Запрос отклонён", 403);
  if (!(await getAdminUser())) return apiError("Требуются права админа", 403);
  const { id } = await route.params;
  if (!isUuid(id)) return apiError("Раздел не найден", 404);
  await prisma.faqSection.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
