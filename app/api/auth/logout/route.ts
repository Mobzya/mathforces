import { NextResponse } from "next/server";
import { deleteAuthSession } from "@/server/auth/session";
import { apiError, hasValidOrigin, isFormSubmission } from "@/server/http/responses";

export async function POST(request: Request) {
  const submittedAsForm = isFormSubmission(request);
  if (!hasValidOrigin(request)) {
    return apiError("Запрос отклонён", 403);
  }

  try {
    await deleteAuthSession();
    return submittedAsForm
      ? NextResponse.redirect(new URL("/", request.url), 303)
      : NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Не удалось завершить сессию", error);
    return apiError("Не удалось выйти из аккаунта", 500);
  }
}
