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
import { isRecord, isUuid } from "@/server/validation/primitives";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasValidOrigin(request)) return apiError("Запрос отклонён", 403);
  const { id } = await params;
  if (!isUuid(id)) return apiError("Контест не найден", 404);

  const body = await readJsonBody(request);
  if (!isRecord(body) || !isUuid(String(body.sourceProblemId ?? ""))) {
    return apiError("Выберите задачу из архива", 422);
  }

  try {
    const admin = await getAdminUser();
    if (!admin) return apiError("Требуются права администратора", 403);

    const problem = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(hashtext(${`contest-problems:${id}`}))::text AS "lock"
      `;
      const [contest, source] = await Promise.all([
        tx.contest.findUnique({
          include: {
            problems: { select: { orderIndex: true } },
            _count: { select: { problems: true } }
          },
          where: { id }
        }),
        tx.problem.findUnique({ where: { id: String(body.sourceProblemId) } })
      ]);
      if (!contest) throw new ImportProblemError("Контест не найден", 404);
      if (contest.status !== "ANNOUNCED") {
        throw new ImportProblemError("Состав задач зафиксирован после запуска контеста", 409);
      }
      if (contest._count.problems >= contest.requiredProblemCount) {
        throw new ImportProblemError("Комплект задач уже заполнен", 409);
      }
      if (!source || !source.archiveEnabled || !source.archivedAt) {
        throw new ImportProblemError("Задача недоступна в архиве", 404);
      }
      const occupied = new Set(contest.problems.map((item) => item.orderIndex));
      const orderIndex = Array.from(
        { length: contest.requiredProblemCount },
        (_, index) => index + 1
      ).find((index) => !occupied.has(index));
      if (!orderIndex) throw new ImportProblemError("Нет свободного номера", 409);

      const created = await tx.problem.create({
        data: {
          archiveEnabled: false,
          archiveIntro: source.archiveIntro,
          baseScore: source.baseScore,
          contestId: id,
          evaluationRubric: source.evaluationRubric,
          maxScore: source.maxScore,
          officialSolution: source.officialSolution,
          orderIndex,
          scoreDecayPer5Min: source.scoreDecayPer5Min,
          sourceProblemId: source.id,
          statement: source.statement,
          subtopic: source.subtopic,
          title: source.title,
          topic: source.topic
        }
      });
      await recordAdminAction(tx, {
        action: "PROBLEM_IMPORTED_FROM_ARCHIVE",
        adminId: admin.id,
        details: { orderIndex, sourceProblemId: source.id },
        entityId: created.id,
        entityType: "PROBLEM",
        summary: `Задача «${source.title}» добавлена из архива под номером ${orderIndex}`
      });
      return created;
    });

    return NextResponse.json({ problem: { id: problem.id } }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof ImportProblemError) {
      return apiError(error.message, error.status);
    }
    if (isUniqueConstraintError(error)) {
      return apiError("Не удалось занять свободный номер задачи", 409);
    }
    console.error("Не удалось импортировать задачу из архива", error);
    return apiError("Не удалось добавить задачу из архива", 500);
  }
}

class ImportProblemError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}
