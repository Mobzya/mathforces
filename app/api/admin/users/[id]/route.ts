import { NextResponse } from "next/server";
import { recordAdminAction } from "@/server/admin/audit";
import { getAdminUser } from "@/server/auth/authorization";
import { prisma } from "@/server/db/client";
import { apiError, hasValidOrigin, readJsonBody } from "@/server/http/responses";
import { isRecord, isUuid } from "@/server/validation/primitives";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasValidOrigin(request)) {
    return apiError("Запрос отклонён", 403);
  }
  const { id } = await params;
  if (!isUuid(id)) {
    return apiError("Пользователь не найден", 404);
  }
  const body = await readJsonBody(request);
  if (!isRecord(body)) {
    return apiError("Некорректный формат запроса", 422);
  }
  const role = body.role === "ADMIN" || body.role === "PARTICIPANT" ? body.role : undefined;
  const organizationId =
    typeof body.organizationId === "string" && isUuid(body.organizationId)
      ? body.organizationId
      : undefined;
  if (!role && !organizationId) {
    return apiError("Нет корректных изменений", 422);
  }

  try {
    const admin = await getAdminUser();
    if (!admin) {
      return apiError("Требуются права администратора", 403);
    }
    if (admin.id === id && role === "PARTICIPANT") {
      return apiError("Нельзя снять права администратора у текущего аккаунта", 409);
    }
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return apiError("Пользователь не найден", 404);
    }
    if (organizationId) {
      const organization = await prisma.organization.findUnique({
        select: { id: true },
        where: { id: organizationId }
      });
      if (!organization) {
        return apiError("Организация не найдена", 404);
      }
    }

    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        data: {
          ...(organizationId ? { organizationId } : {}),
          ...(role ? { role } : {})
        },
        include: { organization: { select: { id: true, name: true } } },
        where: { id }
      });
      if (organizationId && organizationId !== existing.organizationId) {
        await tx.userOrganizationHistory.create({
          data: {
            fromOrganizationId: existing.organizationId,
            toOrganizationId: organizationId,
            userId: id
          }
        });
      }
      await recordAdminAction(tx, {
        action: "USER_UPDATED",
        adminId: admin.id,
        details: {
          organizationId: organizationId ?? existing.organizationId,
          previousOrganizationId: existing.organizationId,
          previousRole: existing.role,
          role: role ?? existing.role
        },
        entityId: id,
        entityType: "USER",
        summary: `Обновлён пользователь ${updated.nickname}`
      });
      return updated;
    });

    return NextResponse.json({
      user: {
        id: user.id,
        organization: user.organization,
        role: user.role
      }
    });
  } catch (error: unknown) {
    console.error("Не удалось изменить пользователя", error);
    return apiError("Не удалось изменить пользователя", 500);
  }
}
