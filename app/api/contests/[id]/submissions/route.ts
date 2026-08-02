import { NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { canAccessContest } from "@/server/contests/access";
import { apiError } from "@/server/http/responses";
import { isUuid } from "@/server/validation/primitives";
import { decodeTimelineCursor } from "@/server/pagination/cursor";
import { listPublicContestSubmissions } from "@/server/submissions/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) {
    return apiError("Контест не найден", 404);
  }

  try {
    const viewer = await getCurrentUser();
    const contest = await prisma.contest.findUnique({
      select: {
        id: true,
        isPublic: true,
        organizationId: true
      },
      where: { id }
    });
    if (!contest || !canAccessContest(contest, viewer)) {
      return apiError("Контест не найден", 404);
    }

    const cursorValue = new URL(request.url).searchParams.get("cursor");
    const cursor = decodeTimelineCursor(cursorValue);
    if (cursorValue && !cursor) {
      return apiError("Некорректный курсор страницы", 422);
    }
    const page = await listPublicContestSubmissions({
      contestId: id,
      cursor,
      viewer
    });

    return NextResponse.json(
      {
        ...page
      },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error: unknown) {
    console.error("Не удалось получить посылки контеста", error);
    return apiError("Не удалось загрузить посылки", 500);
  }
}
