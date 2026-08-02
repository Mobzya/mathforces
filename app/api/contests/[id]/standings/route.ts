import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { apiError } from "@/server/http/responses";
import { getContestStandings } from "@/server/standings/queries";
import { isUuid } from "@/server/validation/primitives";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) {
    return apiError("Контест не найден", 404);
  }

  try {
    const viewer = await getCurrentUser();
    const standings = await getContestStandings(id, viewer);
    if (!standings) {
      return apiError("Контест не найден", 404);
    }

    return NextResponse.json(
      { standings },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error: unknown) {
    console.error("Не удалось построить таблицу результатов", error);
    return apiError("Не удалось загрузить результаты", 500);
  }
}
