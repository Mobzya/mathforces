import { NextResponse } from "next/server";
import { createAuthSession } from "@/server/auth/session";
import { hashPassword } from "@/server/auth/password";
import { hashPasswordResetToken } from "@/server/auth/password-reset";
import { prisma } from "@/server/db/client";
import { apiError, hasValidOrigin, readJsonBody } from "@/server/http/responses";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { isRecord } from "@/server/validation/primitives";

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) return apiError("Запрос отклонён", 403);
  const body = await readJsonBody(request);
  if (!isRecord(body)) return apiError("Некорректный формат запроса", 422);
  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (token.length < 32 || token.length > 200) {
    return apiError("Ссылка восстановления недействительна", 422);
  }
  if (password.length < 8 || password.length > 72) {
    return apiError("Проверьте новый пароль", 422, {
      password: "Пароль должен содержать от 8 до 72 символов"
    });
  }

  try {
    const rateLimit = await consumeRateLimit(request, {
      limit: 10,
      scope: "password-reset-consume",
      windowMs: 60 * 60_000
    });
    if (!rateLimit.allowed) {
      return apiError("Слишком много попыток. Попробуйте позже", 429);
    }
    const tokenHash = hashPasswordResetToken(token);
    const reset = await prisma.passwordResetToken.findUnique({
      where: { tokenHash }
    });
    if (!reset || reset.usedAt || reset.expiresAt <= new Date()) {
      return apiError("Ссылка восстановления недействительна или устарела", 422);
    }
    const passwordHash = await hashPassword(password);
    const consumed = await prisma.$transaction(async (tx) => {
      const claim = await tx.passwordResetToken.updateMany({
        data: { usedAt: new Date() },
        where: {
          expiresAt: { gt: new Date() },
          id: reset.id,
          usedAt: null
        }
      });
      if (claim.count === 0) return false;
      await tx.user.update({
        data: { passwordHash },
        where: { id: reset.userId }
      });
      await tx.authSession.deleteMany({ where: { userId: reset.userId } });
      return true;
    });
    if (!consumed) {
      return apiError("Ссылка восстановления уже использована", 409);
    }
    await createAuthSession(reset.userId, request);
    return NextResponse.json({
      profileUrl: `/profile/${reset.userId}`
    });
  } catch (error: unknown) {
    console.error("Не удалось восстановить пароль", error);
    return apiError("Не удалось восстановить пароль", 500);
  }
}
