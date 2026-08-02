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

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return apiError("Требуются права администратора", 403);
    }
    const organizations = await prisma.organization.findMany({
      include: {
        _count: { select: { members: true, scopedContests: true } },
        createdBy: { select: { id: true, nickname: true } }
      },
      orderBy: { name: "asc" }
    });
    return NextResponse.json({
      organizations: organizations.map((organization) => ({
        contestCount: organization._count.scopedContests,
        createdAt: organization.createdAt.toISOString(),
        createdBy: organization.createdBy,
        id: organization.id,
        memberCount: organization._count.members,
        name: organization.name
      }))
    });
  } catch (error: unknown) {
    console.error("Не удалось загрузить организации для админки", error);
    return apiError("Не удалось загрузить организации", 500);
  }
}

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) {
    return apiError("Запрос отклонён", 403);
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
    const organization = await prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: {
          createdById: admin.id,
          name: validation.data.name,
          normalizedName: normalizeOrganizationName(validation.data.name)
        }
      });
      await recordAdminAction(tx, {
        action: "ORGANIZATION_CREATED",
        adminId: admin.id,
        entityId: created.id,
        entityType: "ORGANIZATION",
        summary: `Создана организация «${created.name}»`
      });
      return created;
    });
    return NextResponse.json({ organization }, { status: 201 });
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) {
      return apiError("Организация с таким названием уже существует", 409);
    }
    console.error("Не удалось создать организацию", error);
    return apiError("Не удалось создать организацию", 500);
  }
}
