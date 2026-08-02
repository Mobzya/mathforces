import { NextResponse } from "next/server";
import { recordAdminAction } from "@/server/admin/audit";
import { reindexArchiveProblems } from "@/server/archive/indexing";
import { getAdminUser } from "@/server/auth/authorization";
import { prisma } from "@/server/db/client";
import { apiError, hasValidOrigin, readJsonBody } from "@/server/http/responses";
import { isUuid } from "@/server/validation/primitives";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!hasValidOrigin(request)) return apiError("Запрос отклонён", 403);
  const admin = await getAdminUser();
  if (!admin) return apiError("Требуются права администратора", 403);
  const { id } = await context.params;
  if (!isUuid(id)) return apiError("Попытка не найдена", 404);
  const body = await readJsonBody(request);
  const score =
    typeof body === "object" && body && "score" in body ? Number(body.score) : Number.NaN;
  const feedback =
    typeof body === "object" && body && "feedback" in body
      ? String(body.feedback).trim().slice(0, 5000)
      : "";
  if (!Number.isInteger(score) || score < 0 || score > 100)
    return apiError("Балл должен быть от 0 до 100", 422);
  const existing = await prisma.practiceAttempt.findUnique({
    select: { problemId: true },
    where: { id }
  });
  if (!existing) return apiError("Попытка не найдена", 404);
  const attempt = await prisma.$transaction(async (tx) => {
    const updated = await tx.practiceAttempt.update({
      data: { completedAt: new Date(), feedback, needsReview: false, score, status: "COMPLETED" },
      where: { id }
    });
    await recordAdminAction(tx, {
      action: "PRACTICE_ATTEMPT_REVIEWED",
      adminId: admin.id,
      details: { score },
      entityId: id,
      entityType: "PRACTICE_ATTEMPT",
      summary: `Архивная попытка подтверждена: ${score}/100`
    });
    return updated;
  });
  const problem = await prisma.problem.findUnique({
    select: { contestId: true },
    where: { id: existing.problemId }
  });
  if (problem) await reindexArchiveProblems({ contestId: problem.contestId });
  return NextResponse.json({ attempt });
}
