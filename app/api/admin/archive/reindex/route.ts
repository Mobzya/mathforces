import { NextResponse } from "next/server";
import { recordAdminAction } from "@/server/admin/audit";
import { reindexArchiveProblems } from "@/server/archive/indexing";
import { getAdminUser } from "@/server/auth/authorization";
import { prisma } from "@/server/db/client";
import { apiError, hasValidOrigin } from "@/server/http/responses";

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) return apiError("Запрос отклонён", 403);
  const admin = await getAdminUser();
  if (!admin) return apiError("Требуются права администратора", 403);
  const result = await reindexArchiveProblems();
  await recordAdminAction(prisma, {
    action: "ARCHIVE_REINDEXED",
    adminId: admin.id,
    details: { problemCount: result.problemCount },
    entityId: result.indexedAt.toISOString(),
    entityType: "ARCHIVE",
    summary: `Переиндексировано ${result.problemCount} задач`
  });
  return NextResponse.json(result);
}
