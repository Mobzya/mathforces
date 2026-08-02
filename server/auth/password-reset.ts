import { createHash, randomBytes } from "node:crypto";

export const PASSWORD_RESET_LIFETIME_MS = 30 * 60_000;

export function createPasswordResetSecret() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashPasswordResetToken(token) };
}

export function hashPasswordResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
