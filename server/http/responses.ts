import { NextResponse } from "next/server";

export type FieldErrors = Record<string, string>;

export function apiError(message: string, status: number, fieldErrors?: FieldErrors) {
  return NextResponse.json(
    {
      error: {
        fieldErrors,
        message
      }
    },
    { status }
  );
}

export function isFormSubmission(request: Request): boolean {
  const contentType = request.headers.get("content-type") ?? "";
  return (
    contentType.startsWith("application/x-www-form-urlencoded") ||
    contentType.startsWith("multipart/form-data")
  );
}

export function formErrorRedirect(request: Request, pathname: string, message: string) {
  const url = new URL(pathname, request.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url, 303);
}

export async function readJsonBody(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function hasValidOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  const requestOrigin = new URL(request.url).origin;
  if (origin === requestOrigin) return true;

  // Next.js can keep its internal bind origin in request.url while the browser
  // uses the public Host (local port, reverse proxy or school LAN address).
  // Validate that public origin explicitly instead of rejecting a legitimate
  // same-origin form such as logout.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost?.split(",", 1)[0]?.trim() || request.headers.get("host");
  if (!host) return false;
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim();
  const protocol = forwardedProtocol || new URL(request.url).protocol.slice(0, -1);
  return origin === `${protocol}://${host}`;
}

export function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export function uniqueConstraintFields(error: unknown): string[] {
  if (!isUniqueConstraintError(error)) {
    return [];
  }
  const meta = (error as { meta?: unknown }).meta;
  if (typeof meta !== "object" || meta === null || !("target" in meta)) {
    return [];
  }
  const target = meta.target;
  if (Array.isArray(target)) {
    return target.filter((field): field is string => typeof field === "string");
  }
  return typeof target === "string" ? [target] : [];
}
