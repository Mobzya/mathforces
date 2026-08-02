import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { shouldUseSecureSessionCookie } from "@/server/auth/cookie-policy";
import { prisma } from "@/server/db/client";

const SESSION_COOKIE = "mathforces_session";
const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createAuthSession(userId: string, request?: Request): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);

  await prisma.authSession.create({
    data: {
      expiresAt,
      tokenHash: hashToken(token),
      userId
    }
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    expires: expiresAt,
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: shouldUseSecureSessionCookie(request)
  });
}

export async function deleteAuthSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.authSession.deleteMany({
      where: {
        tokenHash: hashToken(token)
      }
    });
  }

  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  const session = await prisma.authSession.findUnique({
    include: {
      user: {
        include: {
          organization: true
        }
      }
    },
    where: {
      tokenHash: hashToken(token)
    }
  });

  if (!session || session.expiresAt <= new Date()) {
    return null;
  }

  return session.user;
}
