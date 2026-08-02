import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { canAccessContest } from "@/server/contests/access";
import { apiError, formErrorRedirect, hasValidOrigin } from "@/server/http/responses";
import { serializeSubmissionDetail } from "@/server/submissions/serialize";
import {
  MAX_SUBMISSION_FILE_BYTES,
  readAndValidateSubmissionFile,
  validateSubmissionBytes,
  validateSubmissionIds
} from "@/server/submissions/validation";
import { submissionStorage } from "@/services/storage";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { isContestAcceptingSubmissions } from "@/server/contests/lifecycle";
import { readRequestBodyWithLimit } from "@/server/http/body";

export const dynamic = "force-dynamic";

function submissionErrorRedirect(
  request: Request,
  contestId: string,
  problemId: string,
  message: string
) {
  const pathname = `/contests/${contestId}/submit`;
  const response = formErrorRedirect(request, pathname, message);
  const location = response.headers.get("location");
  if (location) {
    const url = new URL(location);
    if (problemId) {
      url.searchParams.set("problem", problemId);
    }
    response.headers.set("location", url.toString());
  }
  return response;
}

export async function POST(request: Request) {
  const isRawUpload = request.headers.get("x-mathforces-upload") === "raw-image";
  const wantsJson = isRawUpload || request.headers.get("x-mathforces-client") === "fetch";
  let contestId = "";
  let problemId = "";
  let isPublic = true;

  const respondWithError = (
    message: string,
    status: number,
    fieldErrors?: Record<string, string>
  ) =>
    wantsJson
      ? apiError(message, status, fieldErrors)
      : submissionErrorRedirect(
          request,
          contestId,
          problemId,
          Object.values(fieldErrors ?? {})[0] ?? message
        );

  if (!hasValidOrigin(request)) {
    return respondWithError("Запрос отклонён", 403);
  }

  let user: Awaited<ReturnType<typeof getCurrentUser>>;
  try {
    user = await getCurrentUser();
  } catch (error: unknown) {
    console.error("Не удалось проверить сессию перед загрузкой", error);
    return respondWithError("Не удалось проверить сессию. Попробуйте ещё раз", 503);
  }
  if (!user) {
    return wantsJson
      ? apiError("Для отправки решения войдите в аккаунт", 401)
      : formErrorRedirect(request, "/login", "Для отправки решения войдите в аккаунт");
  }
  const rateLimit = await consumeRateLimit(request, {
    identity: user.id,
    limit: 30,
    scope: "submission-upload",
    windowMs: 10 * 60_000
  });
  if (!rateLimit.allowed) {
    return respondWithError("Слишком много отправок. Подождите несколько минут", 429);
  }

  let fileData:
    | {
        bytes: Uint8Array;
        extension: "jpg" | "png" | "webp";
        mimeType: "image/jpeg" | "image/png" | "image/webp";
        originalName: string;
      }
    | undefined;

  if (isRawUpload) {
    const url = new URL(request.url);
    contestId = url.searchParams.get("contestId") ?? "";
    problemId = url.searchParams.get("problemId") ?? "";
    isPublic = url.searchParams.get("isPublic") !== "false";

    const body = await readRequestBodyWithLimit(request, MAX_SUBMISSION_FILE_BYTES);
    if (body.exceeded) {
      return respondWithError("Не удалось принять фотографию", 422, {
        image: "Размер изображения не должен превышать 15 МБ"
      });
    }

    const bytes = body.bytes;
    const encodedName = request.headers.get("x-mathforces-file-name") ?? "solution";
    let originalName = "solution";
    try {
      originalName = decodeURIComponent(encodedName);
    } catch {
      originalName = "solution";
    }
    const validation = validateSubmissionBytes(bytes, originalName);
    if (!validation.data) {
      return respondWithError("Не удалось принять фотографию", 422, {
        image: validation.error
      });
    }
    fileData = validation.data;
  } else {
    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_SUBMISSION_FILE_BYTES + 1024 * 1024) {
      return respondWithError("Не удалось принять фотографию", 422, {
        image: "Размер изображения не должен превышать 15 МБ"
      });
    }
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return respondWithError("Не удалось прочитать форму", 400);
    }

    contestId = String(form.get("contestId") ?? "");
    problemId = String(form.get("problemId") ?? "");
    isPublic = form.get("isPublic") !== "false";
    const image = form.get("image");
    if (!(image instanceof File)) {
      return respondWithError("Выберите фотографию решения", 422, {
        image: "Нужно прикрепить изображение"
      });
    }

    const fileValidation = await readAndValidateSubmissionFile(image);
    if (!fileValidation.data) {
      return respondWithError("Не удалось принять фотографию", 422, {
        image: fileValidation.error
      });
    }
    fileData = fileValidation.data;
  }

  const idErrors = validateSubmissionIds(contestId, problemId);
  if (Object.keys(idErrors).length > 0) {
    return respondWithError("Проверьте параметры посылки", 422, idErrors);
  }

  if (!fileData) {
    return respondWithError("Выберите фотографию решения", 422);
  }

  let storedKey: string | null = null;

  try {
    const contest = await prisma.contest.findUnique({
      include: {
        problems: {
          select: {
            id: true,
            maxScore: true
          },
          where: { id: problemId }
        },
        registrations: {
          select: { id: true },
          where: { userId: user.id }
        }
      },
      where: { id: contestId }
    });
    if (!contest || !canAccessContest(contest, user)) {
      return respondWithError("Контест не найден", 404);
    }
    if (contest.problems.length === 0) {
      return respondWithError("Задача не относится к этому контесту", 404);
    }

    if (!isContestAcceptingSubmissions(contest)) {
      return respondWithError("Посылки принимаются только во время активного контеста", 409);
    }
    if (user.role !== "ADMIN" && contest.registrations.length === 0) {
      return respondWithError("Сначала зарегистрируйтесь на контест", 403);
    }

    const stored = await submissionStorage.store({
      bytes: fileData.bytes,
      extension: fileData.extension
    });
    storedKey = stored.key;
    const sha256 = createHash("sha256").update(fileData.bytes).digest("hex");

    const submission = await prisma.submission.create({
      data: {
        comments: {
          create: {
            body: "Посылка принята и поставлена в очередь на предварительную проверку.",
            kind: "SYSTEM"
          }
        },
        evaluationJobs: {
          create: { mode: "PRELIMINARY" }
        },
        contestId,
        file: {
          create: {
            mimeType: fileData.mimeType,
            originalName: fileData.originalName,
            sha256,
            sizeBytes: stored.sizeBytes,
            storageKey: stored.key
          }
        },
        imageUrl: `local://${stored.key}`,
        isPublic,
        problemId,
        status: "QUEUED",
        userId: user.id
      },
      include: {
        problem: {
          select: {
            id: true,
            orderIndex: true,
            title: true
          }
        },
        user: {
          select: {
            currentRating: true,
            id: true,
            nickname: true
          }
        }
      }
    });
    storedKey = null;
    return wantsJson
      ? NextResponse.json(
          {
            submission: serializeSubmissionDetail(submission, user)
          },
          { status: 201 }
        )
      : NextResponse.redirect(new URL(`/contests/${contestId}/submissions`, request.url), 303);
  } catch (error: unknown) {
    if (storedKey) {
      await submissionStorage.delete(storedKey).catch(() => undefined);
    }
    console.error("Не удалось создать посылку", error);
    return respondWithError("Не удалось отправить решение. Попробуйте ещё раз", 500);
  }
}
