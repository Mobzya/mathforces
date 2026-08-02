import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import { apiError } from "@/server/http/responses";
import { isUuid } from "@/server/validation/primitives";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return apiError("Войдите в аккаунт", 401);
  const { id } = await context.params;
  if (!isUuid(id)) return apiError("Попытка не найдена", 404);
  const attempt = await prisma.practiceAttempt.findFirst({
    select: {
      createdAt: true,
      feedback: true,
      id: true,
      score: true,
      status: true,
      updatedAt: true
    },
    where: { id, ...(user.role === "ADMIN" ? {} : { userId: user.id }) }
  });
  if (!attempt) return apiError("Попытка не найдена", 404);
  return NextResponse.json({ attempt });
}
