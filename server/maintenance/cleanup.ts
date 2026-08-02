import { prisma } from "@/server/db/client";

export async function cleanupExpiredSecurityRecords() {
  const now = new Date();
  const [sessions, passwordResetTokens, rateLimitWindows] = await prisma.$transaction([
    prisma.authSession.deleteMany({ where: { expiresAt: { lte: now } } }),
    prisma.passwordResetToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lte: now } },
          { usedAt: { lte: new Date(Date.now() - 7 * 24 * 60 * 60_000) } }
        ]
      }
    }),
    prisma.rateLimitWindow.deleteMany({ where: { resetAt: { lte: now } } })
  ]);
  return {
    passwordResetTokens: passwordResetTokens.count,
    rateLimitWindows: rateLimitWindows.count,
    sessions: sessions.count
  };
}
