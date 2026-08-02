CREATE TABLE "PasswordResetToken" (
  "id" UUID NOT NULL,
  "tokenHash" CHAR(64) NOT NULL,
  "userId" UUID NOT NULL,
  "createdById" UUID,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key"
ON "PasswordResetToken"("tokenHash");
CREATE INDEX "PasswordResetToken_userId_createdAt_idx"
ON "PasswordResetToken"("userId", "createdAt");
CREATE INDEX "PasswordResetToken_expiresAt_idx"
ON "PasswordResetToken"("expiresAt");
CREATE INDEX "PasswordResetToken_createdById_createdAt_idx"
ON "PasswordResetToken"("createdById", "createdAt");

ALTER TABLE "PasswordResetToken"
ADD CONSTRAINT "PasswordResetToken_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PasswordResetToken"
ADD CONSTRAINT "PasswordResetToken_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
