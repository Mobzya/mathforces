-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('QUEUED', 'PROCESSING', 'PRELIMINARY_READY', 'NEEDS_REVIEW', 'FINALIZED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SubmissionCommentKind" AS ENUM ('SYSTEM', 'AI', 'ADMIN');

-- CreateTable
CREATE TABLE "Submission" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "contestId" UUID NOT NULL,
    "problemId" UUID NOT NULL,
    "imageUrl" VARCHAR(500) NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'QUEUED',
    "preliminaryScore" INTEGER,
    "finalScore" INTEGER,
    "aiComment" TEXT NOT NULL DEFAULT '',
    "adminComment" TEXT NOT NULL DEFAULT '',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionFile" (
    "id" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "storageKey" VARCHAR(180) NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(80) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionComment" (
    "id" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "kind" "SubmissionCommentKind" NOT NULL,
    "body" TEXT NOT NULL,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Submission_contestId_createdAt_idx" ON "Submission"("contestId", "createdAt");

-- CreateIndex
CREATE INDEX "Submission_userId_createdAt_idx" ON "Submission"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Submission_problemId_createdAt_idx" ON "Submission"("problemId", "createdAt");

-- CreateIndex
CREATE INDEX "Submission_status_createdAt_idx" ON "Submission"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionFile_submissionId_key" ON "SubmissionFile"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionFile_storageKey_key" ON "SubmissionFile"("storageKey");

-- CreateIndex
CREATE INDEX "SubmissionComment_submissionId_createdAt_idx" ON "SubmissionComment"("submissionId", "createdAt");

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionFile" ADD CONSTRAINT "SubmissionFile_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionComment" ADD CONSTRAINT "SubmissionComment_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
