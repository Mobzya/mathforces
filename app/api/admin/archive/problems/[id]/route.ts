import { NextResponse } from "next/server";
import { recordAdminAction } from "@/server/admin/audit";
import { reindexArchiveProblems } from "@/server/archive/indexing";
import { getAdminUser } from "@/server/auth/authorization";
import { validateProblemInput } from "@/server/contests/validation";
import { prisma } from "@/server/db/client";
import { apiError, hasValidOrigin, readJsonBody } from "@/server/http/responses";
import { isUuid } from "@/server/validation/primitives";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!hasValidOrigin(request)) return apiError("Запрос отклонён", 403);
  const admin = await getAdminUser();
  if (!admin) return apiError("Требуются права администратора", 403);
  const { id } = await context.params;
  if (!isUuid(id)) return apiError("Задача не найдена", 404);
  const raw = await readJsonBody(request);
  const validation = validateProblemInput(raw, true);
  if (validation.errors) return apiError("Проверьте поля", 422, validation.errors);
  const existing = await prisma.problem.findUnique({
    select: { archiveEnabled: true, contestId: true, title: true },
    where: { id }
  });
  if (!existing) return apiError("Задача не найдена", 404);

  const updated = await prisma.$transaction(async (tx) => {
    const problem = await tx.problem.update({
      data: {
        ...validation.data,
        ...(validation.data.archiveEnabled === true && !existing.archiveEnabled
          ? { archivedAt: new Date() }
          : {}),
        ...(validation.data.archiveEnabled === false ? { archivedAt: null } : {})
      },
      where: { id }
    });
    await recordAdminAction(tx, {
      action: "ARCHIVE_PROBLEM_UPDATED",
      adminId: admin.id,
      details: { changedFields: Object.keys(validation.data) },
      entityId: id,
      entityType: "PROBLEM",
      summary: `Обновлена архивная задача «${existing.title}»`
    });
    return problem;
  });
  if (updated.archiveEnabled && updated.archivedAt)
    await reindexArchiveProblems({ contestId: updated.contestId });
  return NextResponse.json({ problem: updated });
}

// Removing from the archive is deliberately a soft delete: hard deletion would
// destroy historical contest submissions and standings.
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!hasValidOrigin(request)) return apiError("Запрос отклонён", 403);
  const admin = await getAdminUser();
  if (!admin) return apiError("Требуются права администратора", 403);
  const { id } = await context.params;
  if (!isUuid(id)) return apiError("Задача не найдена", 404);
  const existing = await prisma.problem.findUnique({ select: { title: true }, where: { id } });
  if (!existing) return apiError("Задача не найдена", 404);
  await prisma.$transaction(async (tx) => {
    await tx.problem.update({ data: { archiveEnabled: false, archivedAt: null }, where: { id } });
    await recordAdminAction(tx, {
      action: "ARCHIVE_PROBLEM_REMOVED",
      adminId: admin.id,
      entityId: id,
      entityType: "PROBLEM",
      summary: `Задача «${existing.title}» убрана из архива`
    });
  });
  return NextResponse.json({ removed: true });
}
