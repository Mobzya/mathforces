import { NextResponse } from "next/server";
import { getAdminUser } from "@/server/auth/authorization";
import { prisma } from "@/server/db/client";
import { apiError } from "@/server/http/responses";
import { isUuid } from "@/server/validation/primitives";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return apiError("Требуются права администратора", 403);
    }

    const url = new URL(request.url);
    const contestId = url.searchParams.get("contestId");
    const status = url.searchParams.get("status");
    const query = url.searchParams.get("query")?.trim();
    const requestedPage = Number(url.searchParams.get("page"));
    const requestedPageNormalized =
      Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const pageSize = 50;
    const validStatuses = new Set([
      "QUEUED",
      "PROCESSING",
      "PRELIMINARY_READY",
      "NEEDS_REVIEW",
      "FINALIZED",
      "REJECTED"
    ]);

    if (contestId && !isUuid(contestId)) {
      return apiError("Контест не найден", 404);
    }
    if (status && !validStatuses.has(status)) {
      return apiError("Неизвестный статус посылки", 422);
    }

    const where = {
      ...(contestId ? { contestId } : {}),
      ...(status ? { status: status as never } : {}),
      ...(query
        ? {
            OR: [
              { user: { nickname: { contains: query, mode: "insensitive" as const } } },
              { problem: { title: { contains: query, mode: "insensitive" as const } } }
            ]
          }
        : {})
    };
    const total = await prisma.submission.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requestedPageNormalized, totalPages);
    const submissions = await prisma.submission.findMany({
      include: {
        contest: { select: { id: true, title: true } },
        evaluations: {
          orderBy: { createdAt: "desc" },
          select: { confidence: true, status: true },
          take: 1
        },
        problem: {
          select: { id: true, maxScore: true, orderIndex: true, title: true }
        },
        user: { select: { id: true, nickname: true } }
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
      submissions: submissions.map((submission) => ({
        adminComment: submission.adminComment,
        aiComment: submission.aiComment,
        contest: submission.contest,
        createdAt: submission.createdAt.toISOString(),
        finalScore: submission.finalScore,
        id: submission.id,
        imageAccessUrl: `/api/submissions/${submission.id}/image`,
        isPublic: submission.isPublic,
        evaluationConfidence: submission.evaluations[0]?.confidence ?? null,
        evaluationStatus: submission.evaluations[0]?.status ?? null,
        preliminaryScore: submission.preliminaryScore,
        problem: submission.problem,
        status: submission.status,
        updatedAt: submission.updatedAt.toISOString(),
        user: submission.user
      }))
    });
  } catch (error: unknown) {
    console.error("Не удалось загрузить админский список посылок", error);
    return apiError("Не удалось загрузить посылки", 500);
  }
}
