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
import { cached, invalidateCache } from "@/server/cache/ttl";
import { consumeRateLimit } from "@/server/security/rate-limit";

export async function GET() {
  try {
    const organizations = await cached("organizations:public", 30_000, () =>
      prisma.organization.findMany({
        orderBy: { name: "asc" },
        select: {
          _count: {
            select: { members: true }
          },
          id: true,
          name: true
        },
        take: 200
      })
    );

    return NextResponse.json({
      organizations: organizations.map((organization) => ({
        id: organization.id,
        memberCount: organization._count.members,
        name: organization.name
      }))
    });
  } catch (error: unknown) {
    console.error("Не удалось получить список организаций", error);
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
    const user = await getCurrentUser();
    if (!user) {
      return apiError("Требуется вход", 401);
    }
    const rateLimit = await consumeRateLimit(request, {
      identity: user.id,
      limit: 10,
      scope: "organization-create",
      windowMs: 24 * 60 * 60_000
    });
    if (!rateLimit.allowed) {
      return apiError("Слишком много созданных организаций. Попробуйте завтра", 429);
    }

    const organization = await prisma.organization.create({
      data: {
        createdById: user.id,
        name: validation.data.name,
        normalizedName: normalizeOrganizationName(validation.data.name)
      },
      select: {
        id: true,
        name: true
      }
    });
    invalidateCache("organizations:");

    return NextResponse.json(
      {
        organization: {
          ...organization,
          memberCount: 0
        }
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) {
      return apiError("Организация с таким названием уже существует", 409, {
        name: "Выберите существующую организацию"
      });
    }
    console.error("Не удалось создать организацию", error);
    return apiError("Не удалось создать организацию", 500);
  }
}
