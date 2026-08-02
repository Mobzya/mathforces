import { NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { apiError } from "@/server/http/responses";
import { isUuid } from "@/server/validation/primitives";
import { submissionStorage } from "@/services/storage";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) {
    return apiError("Изображение не найдено", 404);
  }

  try {
    const viewer = await getCurrentUser();
    if (!viewer) {
      return apiError("Требуется вход", 401);
    }

    const submission = await prisma.submission.findUnique({
      include: {
        file: true
      },
      where: { id }
    });
    if (!submission?.file || (viewer.role !== "ADMIN" && submission.userId !== viewer.id)) {
      return apiError("Изображение не найдено", 404);
    }

    const bytes = await submissionStorage.read(submission.file.storageKey);
    const responseBody = Uint8Array.from(bytes).buffer;
    return new Response(responseBody, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="solution.${extensionForMime(
          submission.file.mimeType
        )}"`,
        "Content-Length": String(bytes.byteLength),
        "Content-Type": submission.file.mimeType,
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error: unknown) {
    console.error("Не удалось получить изображение посылки", error);
    return NextResponse.json(
      {
        error: {
          message: "Не удалось загрузить изображение"
        }
      },
      { status: 500 }
    );
  }
}

function extensionForMime(mimeType: string): string {
  if (mimeType === "image/png") {
    return "png";
  }
  if (mimeType === "image/webp") {
    return "webp";
  }
  return "jpg";
}
