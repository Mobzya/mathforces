import { NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { apiError } from "@/server/http/responses";
import { serializePublicUser } from "@/server/users/serialize";
import { isUuid } from "@/server/validation/primitives";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) {
    return apiError("Пользователь не найден", 404);
  }

  try {
    const user = await prisma.user.findUnique({
      include: { organization: true },
      where: { id }
    });
    if (!user) {
      return apiError("Пользователь не найден", 404);
    }
    return NextResponse.json({ user: serializePublicUser(user) });
  } catch (error: unknown) {
    console.error("Не удалось загрузить публичный профиль", error);
    return apiError("Не удалось загрузить профиль", 500);
  }
}
