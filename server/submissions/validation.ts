import { isRecord, isUuid } from "@/server/validation/primitives";

type ManualSubmissionStatus = "PRELIMINARY_READY" | "NEEDS_REVIEW" | "FINALIZED" | "REJECTED";

export type SubmissionAdminPatch = {
  adminComment?: string;
  finalScore?: number | null;
  isPublic?: boolean;
  preliminaryScore?: number | null;
  status?: ManualSubmissionStatus;
};

export const MAX_SUBMISSION_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_IMAGE_DIMENSION = 12_000;
export const MAX_IMAGE_PIXELS = 40_000_000;

type ImageFormat = {
  extension: "jpg" | "png" | "webp";
  mimeType: "image/jpeg" | "image/png" | "image/webp";
};

export function detectImageFormat(bytes: Uint8Array): ImageFormat | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { extension: "jpg", mimeType: "image/jpeg" };
  }

  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (
    bytes.length >= pngSignature.length &&
    pngSignature.every((value, index) => bytes[index] === value)
  ) {
    return { extension: "png", mimeType: "image/png" };
  }

  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return { extension: "webp", mimeType: "image/webp" };
  }

  return null;
}

export function validateImageDimensions(bytes: Uint8Array, format: ImageFormat): string | null {
  const dimensions = readImageDimensions(bytes, format.extension);
  if (!dimensions) {
    return "Файл изображения повреждён или имеет неполный заголовок";
  }
  if (dimensions.width < 1 || dimensions.height < 1) {
    return "Файл изображения содержит некорректное разрешение";
  }
  if (
    dimensions.width > MAX_IMAGE_DIMENSION ||
    dimensions.height > MAX_IMAGE_DIMENSION ||
    dimensions.width * dimensions.height > MAX_IMAGE_PIXELS
  ) {
    return "Изображение слишком большое по разрешению. Максимум — 40 мегапикселей и 12000 px по стороне";
  }
  return null;
}

function readImageDimensions(bytes: Uint8Array, extension: ImageFormat["extension"]) {
  if (extension === "png") {
    if (bytes.length < 24) return null;
    return {
      height: readUint32BigEndian(bytes, 20),
      width: readUint32BigEndian(bytes, 16)
    };
  }

  if (extension === "jpg") {
    let offset = 2;
    while (offset + 8 < bytes.length) {
      while (bytes[offset] === 0xff) offset += 1;
      const marker = bytes[offset];
      offset += 1;
      if (marker === undefined || marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
      if (offset + 1 >= bytes.length) return null;
      const segmentLength = (bytes[offset]! << 8) | bytes[offset + 1]!;
      if (segmentLength < 2 || offset + segmentLength > bytes.length) {
        return null;
      }
      if (isJpegStartOfFrame(marker) && segmentLength >= 7) {
        return {
          height: (bytes[offset + 3]! << 8) | bytes[offset + 4]!,
          width: (bytes[offset + 5]! << 8) | bytes[offset + 6]!
        };
      }
      offset += segmentLength;
    }
    return null;
  }

  if (bytes.length < 30) return null;
  const chunk = String.fromCharCode(...bytes.slice(12, 16));
  if (chunk === "VP8X") {
    return {
      height: 1 + readUint24LittleEndian(bytes, 27),
      width: 1 + readUint24LittleEndian(bytes, 24)
    };
  }
  if (chunk === "VP8 " && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return {
      height: ((bytes[29]! << 8) | bytes[28]!) & 0x3fff,
      width: ((bytes[27]! << 8) | bytes[26]!) & 0x3fff
    };
  }
  if (chunk === "VP8L" && bytes[20] === 0x2f) {
    return {
      height: 1 + ((bytes[22]! >> 6) | (bytes[23]! << 2) | ((bytes[24]! & 0x0f) << 10)),
      width: 1 + (bytes[21]! | ((bytes[22]! & 0x3f) << 8))
    };
  }
  return null;
}

function isJpegStartOfFrame(marker: number) {
  return (
    (marker >= 0xc0 && marker <= 0xc3) ||
    (marker >= 0xc5 && marker <= 0xc7) ||
    (marker >= 0xc9 && marker <= 0xcb) ||
    (marker >= 0xcd && marker <= 0xcf)
  );
}

function readUint32BigEndian(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset]! * 0x1000000 +
    (bytes[offset + 1]! << 16) +
    (bytes[offset + 2]! << 8) +
    bytes[offset + 3]!
  );
}

function readUint24LittleEndian(bytes: Uint8Array, offset: number) {
  return bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16);
}

export function validateSubmissionFile(file: File): string | null {
  if (file.size === 0) {
    return "Выберите непустое изображение решения";
  }
  if (file.size > MAX_SUBMISSION_FILE_BYTES) {
    return "Размер изображения не должен превышать 15 МБ";
  }
  return null;
}

export async function readAndValidateSubmissionFile(file: File): Promise<
  | {
      data: {
        bytes: Uint8Array;
        extension: ImageFormat["extension"];
        mimeType: ImageFormat["mimeType"];
        originalName: string;
      };
      error?: never;
    }
  | { data?: never; error: string }
> {
  const basicError = validateSubmissionFile(file);
  if (basicError) {
    return { error: basicError };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  return validateSubmissionBytes(bytes, file.name);
}

export function validateSubmissionBytes(
  bytes: Uint8Array,
  originalName: string
):
  | {
      data: {
        bytes: Uint8Array;
        extension: ImageFormat["extension"];
        mimeType: ImageFormat["mimeType"];
        originalName: string;
      };
      error?: never;
    }
  | { data?: never; error: string } {
  if (bytes.byteLength === 0) {
    return { error: "Выберите непустое изображение решения" };
  }
  if (bytes.byteLength > MAX_SUBMISSION_FILE_BYTES) {
    return { error: "Размер изображения не должен превышать 15 МБ" };
  }

  const format = detectImageFormat(bytes);
  if (!format) {
    return { error: "Поддерживаются только изображения JPEG, PNG и WebP" };
  }
  const dimensionError = validateImageDimensions(bytes, format);
  if (dimensionError) {
    return { error: dimensionError };
  }

  return {
    data: {
      bytes,
      extension: format.extension,
      mimeType: format.mimeType,
      originalName: originalName.trim().slice(0, 255) || "solution"
    }
  };
}

export function validateSubmissionAdminPatch(body: unknown):
  | {
      data: SubmissionAdminPatch;
      errors?: never;
    }
  | { data?: never; errors: Record<string, string> } {
  if (!isRecord(body)) {
    return { errors: { form: "Некорректный формат запроса" } };
  }

  const data: SubmissionAdminPatch = {};
  const errors: Record<string, string> = {};
  const statuses = new Set(["PRELIMINARY_READY", "NEEDS_REVIEW", "FINALIZED", "REJECTED"]);

  if ("status" in body) {
    if (typeof body.status !== "string" || !statuses.has(body.status)) {
      errors.status = "Неизвестный статус посылки";
    } else {
      data.status = body.status as typeof data.status;
    }
  }

  for (const field of ["preliminaryScore", "finalScore"] as const) {
    if (field in body) {
      const value = body[field];
      if (value !== null && (!Number.isInteger(value) || Number(value) < 0)) {
        errors[field] = "Балл должен быть целым неотрицательным числом";
      } else {
        data[field] = value === null ? null : Number(value);
      }
    }
  }

  if ("adminComment" in body) {
    if (typeof body.adminComment !== "string") {
      errors.adminComment = "Комментарий должен быть строкой";
    } else {
      data.adminComment = body.adminComment.trim().slice(0, 2_000);
    }
  }
  if ("isPublic" in body) {
    if (typeof body.isPublic !== "boolean") {
      errors.isPublic = "Некорректное значение публичности";
    } else {
      data.isPublic = body.isPublic;
    }
  }

  if (Object.keys(data).length === 0 && Object.keys(errors).length === 0) {
    errors.form = "Нет изменений для сохранения";
  }

  return Object.keys(errors).length > 0 ? { errors } : { data };
}

export function validateSubmissionAdminTransition(
  existing: {
    finalScore: number | null;
    preliminaryScore: number | null;
    status: string;
  },
  patch: SubmissionAdminPatch
) {
  const changesEvaluationState =
    (patch.preliminaryScore !== undefined &&
      patch.preliminaryScore !== existing.preliminaryScore) ||
    (patch.finalScore !== undefined && patch.finalScore !== existing.finalScore) ||
    (patch.status !== undefined && patch.status !== existing.status);
  const nextStatus = patch.status ?? existing.status;
  const nextPreliminaryScore =
    patch.preliminaryScore !== undefined ? patch.preliminaryScore : existing.preliminaryScore;
  const nextFinalScore = patch.finalScore !== undefined ? patch.finalScore : existing.finalScore;
  const errors: Record<string, string> = {};

  if (nextStatus === "FINALIZED" && nextFinalScore === null) {
    errors.finalScore = "Укажите итоговый балл";
  }
  if (nextStatus === "PRELIMINARY_READY" && nextPreliminaryScore === null) {
    errors.preliminaryScore = "Укажите предварительный балл";
  }
  if (changesEvaluationState && !patch.adminComment?.trim()) {
    errors.adminComment = "Причина обязательна при изменении балла или статуса";
  }

  return {
    changesEvaluationState,
    ...(Object.keys(errors).length > 0 ? { errors } : {})
  };
}

export function validateSubmissionIds(contestId: unknown, problemId: unknown) {
  const errors: Record<string, string> = {};
  if (typeof contestId !== "string" || !isUuid(contestId)) {
    errors.contest = "Контест не найден";
  }
  if (typeof problemId !== "string" || !isUuid(problemId)) {
    errors.problem = "Выберите задачу";
  }
  return errors;
}
