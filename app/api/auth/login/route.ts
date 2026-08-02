import { NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { verifyPassword } from "@/server/auth/password";
import { createAuthSession } from "@/server/auth/session";
import { validateLoginInput } from "@/server/auth/validation";
import {
  apiError,
  formErrorRedirect,
  hasValidOrigin,
  isFormSubmission,
  readJsonBody
} from "@/server/http/responses";
import { serializeCurrentUser } from "@/server/users/serialize";
import { consumeRateLimit } from "@/server/security/rate-limit";

export async function POST(request: Request) {
  const submittedAsForm = isFormSubmission(request);
  const respondWithError = (
    message: string,
    status: number,
    fieldErrors?: Record<string, string>
  ) => {
    if (submittedAsForm) {
      const fieldMessage = Object.values(fieldErrors ?? {})[0];
      return formErrorRedirect(
        request,
        "/login",
        fieldMessage ? `${message}. ${fieldMessage}` : message
      );
    }
    return apiError(message, status, fieldErrors);
  };

  if (!hasValidOrigin(request)) {
    return respondWithError("Запрос отклонён", 403);
  }
  const rateLimit = await consumeRateLimit(request, {
    limit: 10,
    scope: "auth-login",
    windowMs: 15 * 60_000
  });
  if (!rateLimit.allowed) {
    return respondWithError("Слишком много попыток входа. Попробуйте позже", 429);
  }

  let body: unknown;
  if (submittedAsForm) {
    const form = await request.formData();
    body = {
      email: form.get("email"),
      password: form.get("password")
    };
  } else {
    body = await readJsonBody(request);
  }

  const validation = validateLoginInput(body);
  if (validation.errors) {
    return respondWithError("Проверьте заполненные поля", 422, validation.errors);
  }

  try {
    const user = await prisma.user.findUnique({
      include: { organization: true },
      where: { email: validation.data.email }
    });

    if (!user || !(await verifyPassword(validation.data.password, user.passwordHash))) {
      return respondWithError("Неверная почта или пароль", 401);
    }

    await prisma.authSession.deleteMany({
      where: {
        expiresAt: { lte: new Date() },
        userId: user.id
      }
    });
    await createAuthSession(user.id, request);

    return submittedAsForm
      ? NextResponse.redirect(new URL(`/profile/${user.id}`, request.url), 303)
      : NextResponse.json({ user: serializeCurrentUser(user) });
  } catch (error: unknown) {
    console.error("Не удалось выполнить вход", error);
    return respondWithError("Не удалось войти. Попробуйте ещё раз", 500);
  }
}
