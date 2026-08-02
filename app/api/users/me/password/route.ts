import { NextResponse } from "next/server";
import { createAuthSession, getCurrentUser } from "@/server/auth/session";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { validateChangePasswordInput } from "@/server/auth/validation";
import { prisma } from "@/server/db/client";
import { apiError, hasValidOrigin, readJsonBody } from "@/server/http/responses";
import { consumeRateLimit } from "@/server/security/rate-limit";

export async function PATCH(request: Request) {
  if (!hasValidOrigin(request)) {
    return apiError("Запрос отклонён", 403);
  }

  const validation = validateChangePasswordInput(await readJsonBody(request));
  if (validation.errors) {
    return apiError("Проверьте пароли", 422, validation.errors);
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      return apiError("Требуется вход", 401);
    }
    const rateLimit = await consumeRateLimit(request, {
      identity: user.id,
      limit: 5,
      scope: "password-change",
      windowMs: 60 * 60_000
    });
    if (!rateLimit.allowed) {
      return apiError("Слишком много попыток смены пароля. Попробуйте позже", 429);
    }

    const passwordMatches = await verifyPassword(
      validation.data.currentPassword,
      user.passwordHash
    );
    if (!passwordMatches) {
      return apiError("Текущий пароль указан неверно", 422, {
        currentPassword: "Проверьте текущий пароль"
      });
    }

    const passwordHash = await hashPassword(validation.data.newPassword);
    await prisma.$transaction([
      prisma.user.update({
        data: { passwordHash },
        where: { id: user.id }
      }),
      prisma.authSession.deleteMany({ where: { userId: user.id } })
    ]);

    try {
      await createAuthSession(user.id, request);
    } catch (error: unknown) {
      console.error("Пароль изменён, но новая сессия не создана", error);
      return apiError("Пароль изменён. Войдите заново с новым паролем", 503);
    }

    return NextResponse.json({ message: "Пароль изменён" });
  } catch (error: unknown) {
    console.error("Не удалось изменить пароль", error);
    return apiError("Не удалось изменить пароль", 500);
  }
}
