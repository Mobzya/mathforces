import { NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { apiError, hasValidOrigin } from "@/server/http/responses";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { readAndValidateAvatar } from "@/server/users/avatar";
import { objectStorage } from "@/services/storage";
import { publicAvatarUrl } from "@/lib/profile/customization";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) {
    return apiError("Запрос отклонён", 403);
  }
  const user = await getCurrentUser();
  if (!user) {
    return apiError("Требуется вход", 401);
  }
  const rateLimit = await consumeRateLimit(request, {
    identity: user.id,
    limit: 10,
    scope: "avatar-upload",
    windowMs: 60 * 60_000
  });
  if (!rateLimit.allowed) {
    return apiError("Слишком много загрузок. Попробуйте позже", 429);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return apiError("Не удалось прочитать изображение", 400);
  }
  const image = form.get("avatar");
  if (!(image instanceof File)) {
    return apiError("Выберите изображение", 422, {
      avatar: "Нужно прикрепить файл"
    });
  }
  const validation = await readAndValidateAvatar(image);
  if (!validation.data) {
    return apiError("Не удалось загрузить аватар", 422, {
      avatar: validation.error
    });
  }

  let newKey: string | null = null;
  try {
    const stored = await objectStorage.store({
      bytes: validation.data.bytes,
      extension: validation.data.extension
    });
    newKey = stored.key;
    const oldKey = user.avatarStorageKey;
    const updated = await prisma.user.update({
      data: {
        avatarMimeType: validation.data.mimeType,
        avatarStorageKey: stored.key,
        avatarVersion: { increment: 1 }
      },
      select: {
        avatarStorageKey: true,
        avatarVersion: true,
        id: true
      },
      where: { id: user.id }
    });
    newKey = null;
    if (oldKey && oldKey !== stored.key) {
      await objectStorage.delete(oldKey).catch((error) => {
        console.error("Не удалось удалить предыдущий аватар", error);
      });
    }
    return NextResponse.json({ avatarUrl: publicAvatarUrl(updated) });
  } catch (error: unknown) {
    if (newKey) {
      await objectStorage.delete(newKey).catch(() => undefined);
    }
    console.error("Не удалось сохранить аватар", error);
    return apiError("Не удалось сохранить аватар", 500);
  }
}

export async function DELETE(request: Request) {
  if (!hasValidOrigin(request)) {
    return apiError("Запрос отклонён", 403);
  }
  const user = await getCurrentUser();
  if (!user) {
    return apiError("Требуется вход", 401);
  }

  try {
    const oldKey = user.avatarStorageKey;
    await prisma.user.update({
      data: {
        avatarMimeType: null,
        avatarStorageKey: null,
        avatarVersion: { increment: 1 }
      },
      where: { id: user.id }
    });
    if (oldKey) {
      await objectStorage.delete(oldKey).catch((error) => {
        console.error("Не удалось удалить файл аватара", error);
      });
    }
    return NextResponse.json({ avatarUrl: null });
  } catch (error: unknown) {
    console.error("Не удалось удалить аватар", error);
    return apiError("Не удалось удалить аватар", 500);
  }
}
