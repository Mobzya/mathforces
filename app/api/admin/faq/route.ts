import { NextResponse } from "next/server";
import { getAdminUser } from "@/server/auth/authorization";
import { prisma } from "@/server/db/client";
import { apiError, hasValidOrigin, readJsonBody } from "@/server/http/responses";
import { isUuid } from "@/server/validation/primitives";

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) return apiError("Запрос отклонён", 403);
  const admin = await getAdminUser();
  if (!admin) return apiError("Требуются права администратора", 403);
  const body = await readJsonBody(request);
  if (!body || typeof body !== "object") return apiError("Некорректный запрос", 422);
  const kind = "kind" in body ? String(body.kind) : "";
  if (kind === "section") {
    const title = "title" in body ? String(body.title).trim() : "";
    const slug = slugify("slug" in body ? String(body.slug) : title);
    if (title.length < 2 || title.length > 120 || !slug)
      return apiError("Проверьте название раздела", 422);
    const section = await prisma.faqSection.create({
      data: {
        description: "description" in body ? String(body.description).trim().slice(0, 500) : "",
        orderIndex: Number("orderIndex" in body ? body.orderIndex : 1) || 1,
        slug,
        title
      }
    });
    return NextResponse.json({ section }, { status: 201 });
  }
  if (kind === "item") {
    const sectionId = "sectionId" in body ? String(body.sectionId) : "";
    const question = "question" in body ? String(body.question).trim() : "";
    const answer = "answer" in body ? String(body.answer).trim() : "";
    if (
      !isUuid(sectionId) ||
      question.length < 3 ||
      question.length > 240 ||
      answer.length < 3 ||
      answer.length > 30000
    )
      return apiError("Проверьте вопрос и ответ", 422);
    const item = await prisma.faqItem.create({
      data: {
        answer,
        orderIndex: Number("orderIndex" in body ? body.orderIndex : 1) || 1,
        question,
        sectionId
      }
    });
    return NextResponse.json({ item }, { status: 201 });
  }
  return apiError("Неизвестный тип", 422);
}
function slugify(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("ru")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}
