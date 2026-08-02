import { NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import {
  apiError,
  hasValidOrigin,
  isUniqueConstraintError,
  readJsonBody
} from "@/server/http/responses";
import { normalizeOrganizationName } from "@/server/organizations/normalization";
import { validateOrganizationInput } from "@/server/organizations/validation";
import { isUuid } from "@/server/validation/primitives";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasValidOrigin(request)) {
    return apiError("Запрос отклонён", 403);
  }

  const { id } = await params;
  if (!isUuid(id)) {
    return apiError("Организация не найдена", 404);
  }

  const validation = validateOrganizationInput(await readJsonBody(request));
  if (validation.errors) {
    return apiError("Проверьте название", 422, validation.errors);
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      return apiError("Требуется вход", 401);
    }

    const organization = await prisma.organization.findUnique({
      select: { createdById: true },
      where: { id }
    });
    if (!organization) {
      return apiError("Организация не найдена", 404);
    }
    if (user.role !== "ADMIN" && organization.createdById !== user.id) {
      return apiError("Недостаточно прав для изменения организации", 403);
    }

    const updated = await prisma.organization.update({
      data: {
        name: validation.data.name,
        normalizedName: normalizeOrganizationName(validation.data.name)
      },
      select: {
        _count: { select: { members: true } },
        id: true,
        name: true
      },
      where: { id }
    });

    return NextResponse.json({
      organization: {
        id: updated.id,
        memberCount: updated._count.members,
        name: updated.name
      }
    });
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) {
      return apiError("Организация с таким названием уже существует", 409);
    }
    console.error("Не удалось изменить организацию", error);
    return apiError("Не удалось изменить организацию", 500);
  }
}
