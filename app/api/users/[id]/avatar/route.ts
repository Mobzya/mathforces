import { prisma } from "@/server/db/client";
import { apiError } from "@/server/http/responses";
import { isUuid } from "@/server/validation/primitives";
import { objectStorage } from "@/services/storage";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) {
    return apiError("Аватар не найден", 404);
  }

  try {
    const user = await prisma.user.findUnique({
      select: {
        avatarMimeType: true,
        avatarStorageKey: true,
        avatarVersion: true
      },
      where: { id }
    });
    if (!user?.avatarStorageKey || !user.avatarMimeType) {
      return apiError("Аватар не найден", 404);
    }

    const bytes = await objectStorage.read(user.avatarStorageKey);
    const requestedVersion = Number(new URL(request.url).searchParams.get("v"));
    const immutable = Number.isInteger(requestedVersion) && requestedVersion === user.avatarVersion;
    return new Response(Uint8Array.from(bytes).buffer, {
      headers: {
        "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "public, max-age=300",
        "Content-Length": String(bytes.byteLength),
        "Content-Type": user.avatarMimeType,
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error: unknown) {
    console.error("Не удалось получить аватар", error);
    return apiError("Не удалось загрузить аватар", 500);
  }
}
