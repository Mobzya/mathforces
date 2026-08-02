import { detectImageFormat, validateImageDimensions } from "@/server/submissions/validation";

export const MAX_AVATAR_FILE_BYTES = 5 * 1024 * 1024;

export async function readAndValidateAvatar(file: File) {
  if (file.size === 0) {
    return { error: "Выберите непустое изображение" } as const;
  }
  if (file.size > MAX_AVATAR_FILE_BYTES) {
    return { error: "Размер аватара не должен превышать 5 МБ" } as const;
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = detectImageFormat(bytes);
  if (!format) {
    return {
      error: "Поддерживаются только изображения JPEG, PNG и WebP"
    } as const;
  }
  const dimensionError = validateImageDimensions(bytes, format);
  if (dimensionError) {
    return { error: dimensionError } as const;
  }
  return {
    data: {
      bytes,
      extension: format.extension,
      mimeType: format.mimeType
    }
  } as const;
}
