import { NextResponse } from "next/server";
import { recordAdminAction } from "@/server/admin/audit";
import { getAdminUser } from "@/server/auth/authorization";
import { prisma } from "@/server/db/client";
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
    const admin = await getAdminUser();
    if (!admin) {
      return apiError("Требуются права администратора", 403);
    }
    const existing = await prisma.organization.findUnique({ where: { id } });
    if (!existing) {
      return apiError("Организация не найдена", 404);
    }
    const organization = await prisma.$transaction(async (tx) => {
      const updated = await tx.organization.update({
        data: {
          name: validation.data.name,
          normalizedName: normalizeOrganizationName(validation.data.name)
        },
        where: { id }
      });
      await recordAdminAction(tx, {
        action: "ORGANIZATION_UPDATED",
        adminId: admin.id,
        details: { previousName: existing.name },
        entityId: id,
        entityType: "ORGANIZATION",
        summary: `Организация «${existing.name}» переименована в «${updated.name}»`
      });
      return updated;
    });
    return NextResponse.json({ organization });
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) {
      return apiError("Организация с таким названием уже существует", 409);
    }
    console.error("Не удалось изменить организацию", error);
    return apiError("Не удалось изменить организацию", 500);
  }
}
