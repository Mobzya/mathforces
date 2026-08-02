import { NextResponse } from "next/server";
import { getAdminUser } from "@/server/auth/authorization";
import { prisma } from "@/server/db/client";
import { apiError } from "@/server/http/responses";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return apiError("Требуются права администратора", 403);
    }
    const actions = await prisma.adminAction.findMany({
      include: {
        admin: { select: { id: true, nickname: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 300
    });
    return NextResponse.json({
      actions: actions.map((action) => ({
        ...action,
        createdAt: action.createdAt.toISOString()
      }))
    });
  } catch (error: unknown) {
    console.error("Не удалось загрузить журнал действий", error);
    return apiError("Не удалось загрузить журнал действий", 500);
  }
}
