import { getAdminUser } from "@/server/auth/authorization";
import { prisma } from "@/server/db/client";
import { apiError } from "@/server/http/responses";
import { isUuid } from "@/server/validation/primitives";
import { objectStorage } from "@/services/storage";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser();
  if (!admin) return apiError("Требуются права администратора", 403);
  const { id } = await context.params;
  if (!isUuid(id)) return apiError("Попытка не найдена", 404);
  const attempt = await prisma.practiceAttempt.findUnique({
    select: { mimeType: true, originalName: true, storageKey: true },
    where: { id }
  });
  if (!attempt) return apiError("Попытка не найдена", 404);
  try {
    const bytes = await objectStorage.read(attempt.storageKey);
    return new Response(bytes.slice().buffer as ArrayBuffer, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="solution.${attempt.mimeType.split("/")[1] ?? "jpg"}"`,
        "Content-Type": attempt.mimeType,
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return apiError("Файл не найден", 404);
  }
}
