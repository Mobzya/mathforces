-- CreateEnum
CREATE TYPE "ContestStatus" AS ENUM ('ANNOUNCED', 'RUNNING', 'FINISHED');

-- CreateEnum
CREATE TYPE "ProblemTopic" AS ENUM ('ALGEBRA', 'COMBINATORICS', 'NUMBER_THEORY', 'GEOMETRY');

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "currentRating" SET DEFAULT 0,
ALTER COLUMN "maxRating" SET DEFAULT 0;

-- CreateTable
CREATE TABLE "Contest" (
    "id" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "rules" TEXT NOT NULL DEFAULT '',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 90,
    "status" "ContestStatus" NOT NULL DEFAULT 'ANNOUNCED',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" UUID,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Problem" (
    "id" UUID NOT NULL,
    "contestId" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "statement" TEXT NOT NULL,
    "topic" "ProblemTopic" NOT NULL,
    "baseScore" INTEGER NOT NULL,
    "maxScore" INTEGER NOT NULL,
    "scoreDecayPer5Min" INTEGER NOT NULL DEFAULT 5,
    "orderIndex" INTEGER NOT NULL,
    "evaluationRubric" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Problem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContestRegistration" (
    "id" UUID NOT NULL,
    "contestId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContestRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contest_status_startAt_idx" ON "Contest"("status", "startAt");

-- CreateIndex
CREATE INDEX "Contest_organizationId_idx" ON "Contest"("organizationId");

-- CreateIndex
CREATE INDEX "Contest_createdById_idx" ON "Contest"("createdById");

-- CreateIndex
CREATE INDEX "Problem_contestId_idx" ON "Problem"("contestId");

-- CreateIndex
CREATE UNIQUE INDEX "Problem_contestId_orderIndex_key" ON "Problem"("contestId", "orderIndex");

-- CreateIndex
CREATE INDEX "ContestRegistration_userId_idx" ON "ContestRegistration"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ContestRegistration_contestId_userId_key" ON "ContestRegistration"("contestId", "userId");

-- AddForeignKey
ALTER TABLE "Contest" ADD CONSTRAINT "Contest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contest" ADD CONSTRAINT "Contest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Problem" ADD CONSTRAINT "Problem_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestRegistration" ADD CONSTRAINT "ContestRegistration_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestRegistration" ADD CONSTRAINT "ContestRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
