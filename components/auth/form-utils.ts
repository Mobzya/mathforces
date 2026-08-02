export type ApiErrorPayload = {
  error?: {
    fieldErrors?: Record<string, string>;
    message?: string;
  };
};

export async function readApiError(response: Response): Promise<{
  fieldErrors: Record<string, string>;
  message: string;
}> {
  try {
    const payload = (await response.json()) as ApiErrorPayload;
    return {
      fieldErrors: payload.error?.fieldErrors ?? {},
      message: payload.error?.message ?? "Что-то пошло не так"
    };
  } catch {
    return {
      fieldErrors: {},
      message: "Сервер вернул некорректный ответ"
    };
  }
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = 15_000
): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

export function isTimeoutError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
