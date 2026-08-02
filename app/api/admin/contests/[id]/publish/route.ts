import { NextResponse } from "next/server";
import { getAdminUser } from "@/server/auth/authorization";
import {
  apiError,
  formErrorRedirect,
  hasValidOrigin,
  isFormSubmission
} from "@/server/http/responses";
import { isUuid } from "@/server/validation/primitives";
import { ContestStartError, startContest } from "@/server/contests/start";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const submittedAsForm = isFormSubmission(request);
  const fail = (message: string, status: number) =>
    submittedAsForm
      ? formErrorRedirect(request, `/admin/contests/${id}`, message)
      : apiError(message, status);

  if (!hasValidOrigin(request)) {
    return fail("Запрос отклонён", 403);
  }

  if (!isUuid(id)) {
    return fail("Контест не найден", 404);
  }

  try {
    const admin = await getAdminUser();
    if (!admin) {
      return fail("Требуются права администратора", 403);
    }

    const { contest } = await startContest(id, { actorId: admin.id });

    return submittedAsForm
      ? NextResponse.redirect(new URL(`/admin/contests/${id}`, request.url), 303)
      : NextResponse.json({
          contest: { id: contest.id, status: contest.status }
        });
  } catch (error: unknown) {
    if (error instanceof ContestStartError) {
      return fail(error.message, error.code === "NOT_FOUND" ? 404 : 409);
    }
    console.error("Не удалось запустить контест", error);
    return fail("Не удалось запустить контест", 500);
  }
}
