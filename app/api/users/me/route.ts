import { NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import {
  apiError,
  hasValidOrigin,
  isUniqueConstraintError,
  readJsonBody
} from "@/server/http/responses";
import { serializeCurrentUser } from "@/server/users/serialize";
import { validateProfileUpdate } from "@/server/users/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return apiError("Требуется вход", 401);
    }
    if (Date.now() - user.lastSeenAt.getTime() > 2 * 60_000) {
      await prisma.user.update({ data: { lastSeenAt: new Date() }, where: { id: user.id } });
    }
    return NextResponse.json({ user: serializeCurrentUser(user) });
  } catch (error: unknown) {
    console.error("Не удалось получить текущего пользователя", error);
    return apiError("Не удалось загрузить профиль", 500);
  }
}

export async function PATCH(request: Request) {
  if (!hasValidOrigin(request)) {
    return apiError("Запрос отклонён", 403);
  }

  const validation = validateProfileUpdate(await readJsonBody(request));
  if (validation.errors) {
    return apiError("Проверьте заполненные поля", 422, validation.errors);
  }

  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return apiError("Требуется вход", 401);
    }

    const input = validation.data;
    if (input.organizationId && input.organizationId !== currentUser.organizationId) {
      const targetOrganization = await prisma.organization.findUnique({
        select: { id: true },
        where: { id: input.organizationId }
      });
      if (!targetOrganization) {
        return apiError("Организация не найдена", 404);
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (input.organizationId && input.organizationId !== currentUser.organizationId) {
        await tx.userOrganizationHistory.create({
          data: {
            fromOrganizationId: currentUser.organizationId,
            toOrganizationId: input.organizationId,
            userId: currentUser.id
          }
        });
      }

      return tx.user.update({
        data: input,
        include: { organization: true },
        where: { id: currentUser.id }
      });
    });

    return NextResponse.json({ user: serializeCurrentUser(updated) });
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) {
      return apiError("Этот ник уже занят", 409, {
        nickname: "Выберите другой ник"
      });
    }
    console.error("Не удалось обновить профиль", error);
    return apiError("Не удалось сохранить изменения", 500);
  }
}
