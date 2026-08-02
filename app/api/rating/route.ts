import { NextResponse } from "next/server";
import { apiError } from "@/server/http/responses";
import { getRatingLeaderboard } from "@/server/rating/leaderboard";
import { isUuid } from "@/server/validation/primitives";
import { getCurrentUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organization");
  if (organizationId && !isUuid(organizationId)) {
    return apiError("Организация не найдена", 404);
  }

  try {
    const viewer = await getCurrentUser();
    const friendsOnly = url.searchParams.get("scope") === "friends" && Boolean(viewer);
    const leaderboard = await getRatingLeaderboard({
      friendsOnly,
      organizationId,
      page: parsePage(url.searchParams.get("page")),
      viewerId: viewer?.id
    });
    return NextResponse.json({ leaderboard }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    console.error("Не удалось загрузить таблицу рейтинга", error);
    return apiError("Не удалось загрузить таблицу рейтинга", 500);
  }
}

function parsePage(value: string | null) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}
