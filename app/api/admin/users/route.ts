import { NextResponse } from "next/server";
import { getAdminUser } from "@/server/auth/authorization";
import { prisma } from "@/server/db/client";
import { apiError } from "@/server/http/responses";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return apiError("Требуются права администратора", 403);
    }
    const url = new URL(request.url);
    const query = url.searchParams.get("query")?.trim().slice(0, 100);
    const pageValue = Number(url.searchParams.get("page"));
    const requestedPage = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1;
    const pageSize = 50;
    const where = query
      ? {
          OR: [
            { email: { contains: query, mode: "insensitive" as const } },
            { nickname: { contains: query, mode: "insensitive" as const } }
          ]
        }
      : undefined;
    const total = await prisma.user.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requestedPage, totalPages);
    const users = await prisma.user.findMany({
      include: {
        _count: {
          select: { contestRegistrations: true, submissions: true }
        },
        organization: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      where
    });
    return NextResponse.json({
      pagination: {
        page,
        pageSize,
        total,
        totalPages
      },
      users: users.map((user) => ({
        contestCount: user._count.contestRegistrations,
        createdAt: user.createdAt.toISOString(),
        currentRating: user.currentRating,
        email: user.email,
        grade: user.grade,
        id: user.id,
        nickname: user.nickname,
        organization: user.organization,
        role: user.role,
        submissionCount: user._count.submissions
      }))
    });
  } catch (error: unknown) {
    console.error("Не удалось загрузить пользователей для админки", error);
    return apiError("Не удалось загрузить пользователей", 500);
  }
}
