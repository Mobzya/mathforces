import { isUuid } from "@/server/validation/primitives";

export type TimelineCursor = { createdAt: Date; id: string };

export function encodeTimelineCursor(input: TimelineCursor) {
  return Buffer.from(
    JSON.stringify({ createdAt: input.createdAt.toISOString(), id: input.id })
  ).toString("base64url");
}

export function decodeTimelineCursor(value: string | null) {
  if (!value || value.length > 300) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      createdAt?: unknown;
      id?: unknown;
    };
    if (typeof parsed.createdAt !== "string" || typeof parsed.id !== "string") {
      return null;
    }
    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime()) || !isUuid(parsed.id)) return null;
    return { createdAt, id: parsed.id };
  } catch {
    return null;
  }
}
