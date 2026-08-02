import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import { apiError, hasValidOrigin } from "@/server/http/responses";
import { consumeRateLimit } from "@/server/security/rate-limit";
import {
  MAX_SUBMISSION_FILE_BYTES,
  readAndValidateSubmissionFile
} from "@/server/submissions/validation";
import { isUuid } from "@/server/validation/primitives";
import { objectStorage } from "@/services/storage";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return apiError("Войдите, чтобы увидеть попытки", 401);
  const { id } = await context.params;
  if (!isUuid(id)) return apiError("Задача не найдена", 404);

  const attempts = await prisma.practiceAttempt.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      feedback: true,
      id: true,
      score: true,
      status: true
    },
    take: 30,
    where: { problemId: id, userId: user.id }
  });
  return NextResponse.json({ attempts });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!hasValidOrigin(request)) return apiError("Запрос отклонён", 403);
  const user = await getCurrentUser();
  if (!user) return apiError("Для отправки решения войдите в аккаунт", 401);
  const { id } = await context.params;
  if (!isUuid(id)) return apiError("Задача не найдена", 404);

  const limit = await consumeRateLimit(request, {
    identity: user.id,
    limit: 20,
    scope: "archive-attempt",
    windowMs: 60 * 60_000
  });
  if (!limit.allowed) {
    return apiError("Слишком много попыток. Подождите и отправьте ещё раз", 429);
  }
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_SUBMISSION_FILE_BYTES + 1024 * 1024) {
    return apiError("Файл слишком большой", 422, {
      image: "Размер изображения не должен превышать 15 МБ"
    });
  }

  const problem = await prisma.problem.findFirst({
    select: { id: true },
    where: {
      archiveEnabled: true,
      archivedAt: { not: null },
      contest: { isPublic: true },
      id
    }
  });
  if (!problem) return apiError("Задача не найдена в архиве", 404);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return apiError("Не удалось прочитать форму", 400);
  }
  const image = form.get("image");
  if (!(image instanceof File)) {
    return apiError("Прикрепите фотографию решения", 422, {
      image: "Нужен JPEG, PNG или WebP"
    });
  }
  const validation = await readAndValidateSubmissionFile(image);
  if (!validation.data) {
    return apiError("Не удалось принять фото", 422, { image: validation.error });
  }

  let storageKey: string | null = null;
  try {
    const stored = await objectStorage.store({
      bytes: validation.data.bytes,
      extension: validation.data.extension
    });
    storageKey = stored.key;
    const attempt = await prisma.practiceAttempt.create({
      data: {
        jobs: { create: {} },
        mimeType: validation.data.mimeType,
        originalName: validation.data.originalName,
        problemId: id,
        sha256: createHash("sha256").update(validation.data.bytes).digest("hex"),
        sizeBytes: stored.sizeBytes,
        storageKey: stored.key,
        userId: user.id
      },
      select: { createdAt: true, id: true, status: true }
    });
    return NextResponse.json({ attempt }, { status: 202 });
  } catch (error: unknown) {
    if (storageKey) await objectStorage.delete(storageKey).catch(() => undefined);
    console.error("Не удалось создать архивную попытку", error);
    return apiError("Не удалось поставить решение в очередь", 503);
  }
}
