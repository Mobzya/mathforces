import { NextResponse } from "next/server";
import { recordAdminAction } from "@/server/admin/audit";
import { getAdminUser } from "@/server/auth/authorization";
import {
  createPasswordResetSecret,
  PASSWORD_RESET_LIFETIME_MS
} from "@/server/auth/password-reset";
import { prisma } from "@/server/db/client";
import { apiError, hasValidOrigin } from "@/server/http/responses";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { isUuid } from "@/server/validation/primitives";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasValidOrigin(request)) return apiError("Запрос отклонён", 403);
  const { id } = await params;
  if (!isUuid(id)) return apiError("Пользователь не найден", 404);

  try {
    const admin = await getAdminUser();
    if (!admin) return apiError("Требуются права администратора", 403);
    const rateLimit = await consumeRateLimit(request, {
      identity: admin.id,
      limit: 20,
      scope: "admin-password-reset",
      windowMs: 60 * 60_000
    });
    if (!rateLimit.allowed) {
      return apiError("Слишком много ссылок восстановления. Попробуйте позже", 429);
    }
    const user = await prisma.user.findUnique({
      select: { id: true, nickname: true },
      where: { id }
    });
    if (!user) return apiError("Пользователь не найден", 404);

    const secret = createPasswordResetSecret();
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_LIFETIME_MS);
    await prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.deleteMany({
        where: { userId: id, usedAt: null }
      });
      await tx.passwordResetToken.create({
        data: {
          createdById: admin.id,
          expiresAt,
          tokenHash: secret.tokenHash,
          userId: id
        }
      });
      await recordAdminAction(tx, {
        action: "PASSWORD_RESET_ISSUED",
        adminId: admin.id,
        details: { expiresAt: expiresAt.toISOString() },
        entityId: id,
        entityType: "USER",
        summary: `Создана одноразовая ссылка восстановления для ${user.nickname}`
      });
    });

    const resetUrl = new URL("/reset-password", request.url);
    resetUrl.searchParams.set("token", secret.token);
    return NextResponse.json({
      expiresAt: expiresAt.toISOString(),
      resetUrl: resetUrl.toString()
    });
  } catch (error: unknown) {
    console.error("Не удалось создать ссылку восстановления", error);
    return apiError("Не удалось создать ссылку восстановления", 500);
  }
}
