-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PARTICIPANT', 'ADMIN');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "nickname" VARCHAR(24) NOT NULL,
    "nicknameNormalized" VARCHAR(24) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "description" VARCHAR(400) NOT NULL DEFAULT '',
    "grade" INTEGER,
    "currentRating" INTEGER NOT NULL DEFAULT 500,
    "maxRating" INTEGER NOT NULL DEFAULT 500,
    "role" "UserRole" NOT NULL DEFAULT 'PARTICIPANT',
    "organizationId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "normalizedName" VARCHAR(80) NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserOrganizationHistory" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "fromOrganizationId" UUID,
    "toOrganizationId" UUID NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserOrganizationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_nicknameNormalized_key" ON "User"("nicknameNormalized");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE INDEX "User_currentRating_idx" ON "User"("currentRating");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_normalizedName_key" ON "Organization"("normalizedName");

-- CreateIndex
CREATE INDEX "UserOrganizationHistory_userId_changedAt_idx" ON "UserOrganizationHistory"("userId", "changedAt");

-- CreateIndex
CREATE INDEX "UserOrganizationHistory_fromOrganizationId_idx" ON "UserOrganizationHistory"("fromOrganizationId");

-- CreateIndex
CREATE INDEX "UserOrganizationHistory_toOrganizationId_idx" ON "UserOrganizationHistory"("toOrganizationId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOrganizationHistory" ADD CONSTRAINT "UserOrganizationHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOrganizationHistory" ADD CONSTRAINT "UserOrganizationHistory_fromOrganizationId_fkey" FOREIGN KEY ("fromOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOrganizationHistory" ADD CONSTRAINT "UserOrganizationHistory_toOrganizationId_fkey" FOREIGN KEY ("toOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
