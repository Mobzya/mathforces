import { createHash } from "node:crypto";
import { prisma } from "@/server/db/client";

type RateLimitRow = {
  count: number;
  resetAt: Date;
};

export async function consumeRateLimit(
  request: Request,
  options: {
    identity?: string;
    limit: number;
    scope: string;
    windowMs: number;
  }
) {
  const now = new Date();
  const resetAt = new Date(now.getTime() + options.windowMs);
  const identity = options.identity ? hashValue(options.identity) : hashClient(request);
  const key = `${options.scope}:${identity}`.slice(0, 200);
  const rows = await prisma.$queryRaw<RateLimitRow[]>`
    INSERT INTO "RateLimitWindow" ("key", "count", "resetAt", "updatedAt")
    VALUES (${key}, 1, ${resetAt}, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitWindow"."resetAt" <= ${now} THEN 1
        ELSE "RateLimitWindow"."count" + 1
      END,
      "resetAt" = CASE
        WHEN "RateLimitWindow"."resetAt" <= ${now} THEN ${resetAt}
        ELSE "RateLimitWindow"."resetAt"
      END,
      "updatedAt" = ${now}
    RETURNING "count", "resetAt"
  `;
  const row = rows[0] ?? { count: options.limit + 1, resetAt };
  return {
    allowed: row.count <= options.limit,
    limit: options.limit,
    remaining: Math.max(0, options.limit - row.count),
    resetAt: row.resetAt
  };
}

export async function cleanupRateLimits() {
  return prisma.rateLimitWindow.deleteMany({
    where: { resetAt: { lt: new Date(Date.now() - 24 * 60 * 60_000) } }
  });
}

function hashClient(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const address = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  const userAgent = request.headers.get("user-agent") ?? "unknown";
  return hashValue(`${address}\0${userAgent}`);
}

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}
