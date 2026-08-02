import { getAdminUser } from "@/server/auth/authorization";
import { canAccessContest } from "@/server/contests/access";
import { prisma } from "@/server/db/client";
import { createCsv } from "@/server/export/csv";
import { apiError } from "@/server/http/responses";
import { getContestStandings } from "@/server/standings/queries";
import { isUuid } from "@/server/validation/primitives";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return apiError("Контест не найден", 404);

  try {
    const admin = await getAdminUser();
    if (!admin) return apiError("Требуются права администратора", 403);
    const type = new URL(request.url).searchParams.get("type") ?? "results";
    if (type !== "results" && type !== "rating") {
      return apiError("Неизвестный формат экспорта", 422);
    }

    const contest = await prisma.contest.findUnique({
      include: {
        ratingCalculation: {
          include: {
            changes: {
              include: {
                user: {
                  select: {
                    nickname: true,
                    organization: { select: { name: true } }
                  }
                }
              },
              orderBy: { place: "asc" }
            }
          }
        }
      },
      where: { id }
    });
    if (!contest || !canAccessContest(contest, admin)) {
      return apiError("Контест не найден", 404);
    }

    let csv: string;
    if (type === "rating") {
      if (!contest.ratingCalculation) {
        return apiError("Рейтинг этого контеста ещё не рассчитан", 409);
      }
      csv = createCsv([
        ["Место", "Участник", "Организация", "Рейтинг до", "Изменение", "Рейтинг после", "Баллы"],
        ...contest.ratingCalculation.changes.map((change) => [
          change.place,
          change.user.nickname,
          change.user.organization.name,
          change.previousRating,
          change.delta,
          change.newRating,
          change.totalScore
        ])
      ]);
    } else {
      const standings = await getContestStandings(id, admin);
      if (!standings) return apiError("Контест не найден", 404);
      csv = createCsv([
        [
          "Место",
          "Участник",
          ...standings.problems.map((problem) => `Задача ${problem.label}`),
          "Итого"
        ],
        ...standings.rows.map((row) => [
          row.place,
          row.user.nickname,
          ...row.cells.map((cell) => cell.score),
          row.totalScore
        ])
      ]);
    }

    return new Response(csv, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="mathforces-${id}-${type}.csv"`,
        "Content-Type": "text/csv; charset=utf-8",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error: unknown) {
    console.error("Не удалось экспортировать данные контеста", error);
    return apiError("Не удалось подготовить CSV", 500);
  }
}
