import { NextResponse } from "next/server";
import { getAdminUser } from "@/server/auth/authorization";
import { FinalizationRequeueError, requeueContestFinalization } from "@/server/evaluations/queue";
import { apiError, hasValidOrigin, readJsonBody } from "@/server/http/responses";
import { isRecord, isUuid } from "@/server/validation/primitives";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasValidOrigin(request)) return apiError("Запрос отклонён", 403);
  const { id } = await params;
  if (!isUuid(id)) return apiError("Контест не найден", 404);

  const body = await readJsonBody(request);
  const scope = isRecord(body) && body.scope === "failed" ? "failed" : "all";
  try {
    const admin = await getAdminUser();
    if (!admin) return apiError("Требуются права администратора", 403);
    const result = await requeueContestFinalization(id, admin.id, scope);
    return NextResponse.json(result, { status: 202 });
  } catch (error: unknown) {
    if (error instanceof FinalizationRequeueError) {
      return apiError(error.message, 409);
    }
    console.error("Не удалось повторить финальную проверку", error);
    return apiError("Не удалось поставить решения в очередь", 500);
  }
}
