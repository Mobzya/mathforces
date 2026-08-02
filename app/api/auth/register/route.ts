import { NextResponse } from "next/server";
import { normalizeOrganizationName } from "@/server/organizations/normalization";
import { prisma } from "@/server/db/client";
import { hashPassword } from "@/server/auth/password";
import { createAuthSession } from "@/server/auth/session";
import { normalizeNickname, validateRegisterInput } from "@/server/auth/validation";
import {
  apiError,
  formErrorRedirect,
  hasValidOrigin,
  isFormSubmission,
  isUniqueConstraintError,
  readJsonBody,
  uniqueConstraintFields
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
        "/register",
        fieldMessage ? `${message}. ${fieldMessage}` : message
      );
    }
    return apiError(message, status, fieldErrors);
  };

  if (!hasValidOrigin(request)) {
    return respondWithError("Запрос отклонён", 403);
  }
  const rateLimit = await consumeRateLimit(request, {
    limit: 5,
    scope: "auth-register",
    windowMs: 60 * 60_000
  });
  if (!rateLimit.allowed) {
    return respondWithError("Слишком много регистраций. Попробуйте позже", 429);
  }

  let body: unknown;
  if (submittedAsForm) {
    const form = await request.formData();
    const organizationMode = form.get("organizationMode");
    const password = String(form.get("password") ?? "");
    const passwordConfirmation = String(form.get("passwordConfirmation") ?? "");

    if (password !== passwordConfirmation) {
      return respondWithError("Проверьте заполненные поля", 422, {
        passwordConfirmation: "Пароли не совпадают"
      });
    }

    body = {
      email: form.get("email"),
      grade: form.get("grade"),
      nickname: form.get("nickname"),
      ...(organizationMode
        ? {
            organization:
              organizationMode === "existing"
                ? {
                    id: form.get("organizationId"),
                    mode: "existing"
                  }
                : {
                    mode: "new",
                    name: form.get("organizationName")
                  }
          }
        : {}),
      password
    };
  } else {
    body = await readJsonBody(request);
  }

  const validation = validateRegisterInput(body);
  if (validation.errors) {
    return respondWithError("Проверьте заполненные поля", 422, validation.errors);
  }

  const input = validation.data;

  let createdUserId: string | null = null;
  try {
    const duplicate = await prisma.user.findFirst({
      select: {
        email: true,
        nicknameNormalized: true
      },
      where: {
        OR: [{ email: input.email }, { nicknameNormalized: normalizeNickname(input.nickname) }]
      }
    });

    if (duplicate) {
      const fieldErrors: Record<string, string> =
        duplicate.email === input.email
          ? { email: "Аккаунт с такой почтой уже существует" }
          : { nickname: "Этот ник уже занят" };
      return respondWithError("Аккаунт уже существует", 409, fieldErrors);
    }

    const passwordHash = await hashPassword(input.password);
    const user = await prisma.$transaction(async (tx) => {
      let organization: { id: string };
      let createdOrganization = false;

      if (!input.organization) {
        organization = await tx.organization.upsert({
          create: {
            name: "Без организации",
            normalizedName: normalizeOrganizationName("Без организации")
          },
          select: { id: true },
          update: {},
          where: { normalizedName: normalizeOrganizationName("Без организации") }
        });
      } else if (input.organization.mode === "existing") {
        const existing = await tx.organization.findUnique({
          select: { id: true },
          where: { id: input.organization.id }
        });
        if (!existing) {
          throw new Error("ORGANIZATION_NOT_FOUND");
        }
        organization = existing;
      } else {
        organization = await tx.organization.create({
          data: {
            name: input.organization.name,
            normalizedName: normalizeOrganizationName(input.organization.name)
          },
          select: { id: true }
        });
        createdOrganization = true;
      }

      const createdUser = await tx.user.create({
        data: {
          email: input.email,
          grade: input.grade,
          nickname: input.nickname,
          nicknameNormalized: normalizeNickname(input.nickname),
          organizationId: organization.id,
          passwordHash
        }
      });

      if (createdOrganization) {
        await tx.organization.update({
          data: { createdById: createdUser.id },
          where: { id: organization.id }
        });
      }

      await tx.userOrganizationHistory.create({
        data: {
          toOrganizationId: organization.id,
          userId: createdUser.id
        }
      });

      return tx.user.findUniqueOrThrow({
        include: { organization: true },
        where: { id: createdUser.id }
      });
    });
    createdUserId = user.id;

    await createAuthSession(user.id, request);

    return submittedAsForm
      ? NextResponse.redirect(new URL(`/profile/${user.id}`, request.url), 303)
      : NextResponse.json({ user: serializeCurrentUser(user) }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "ORGANIZATION_NOT_FOUND") {
      return respondWithError("Организация больше не существует", 404, {
        organization: "Обновите список и выберите организацию снова"
      });
    }
    if (createdUserId) {
      const message =
        "Аккаунт создан, но автоматический вход не завершился. Войдите с указанной почтой и паролем";
      return submittedAsForm
        ? formErrorRedirect(request, "/login", message)
        : apiError(message, 503);
    }
    if (isUniqueConstraintError(error)) {
      const fields = uniqueConstraintFields(error);
      if (fields.includes("email")) {
        return respondWithError("Аккаунт уже существует", 409, {
          email: "Аккаунт с такой почтой уже существует"
        });
      }
      if (fields.includes("nicknameNormalized")) {
        return respondWithError("Аккаунт уже существует", 409, {
          nickname: "Этот ник уже занят"
        });
      }
      return respondWithError("Такая организация уже существует", 409, {
        organization: "Выберите существующую организацию из списка или укажите другое название"
      });
    }

    console.error("Не удалось зарегистрировать пользователя", error);
    return respondWithError("Не удалось создать аккаунт. Попробуйте ещё раз", 500);
  }
}
