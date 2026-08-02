-- CreateEnum
CREATE TYPE "PracticeAttemptStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'NEEDS_REVIEW', 'FAILED');

-- CreateEnum
CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProblemTopic" ADD VALUE 'ARITHMETIC';
ALTER TYPE "ProblemTopic" ADD VALUE 'PROBABILITY';
ALTER TYPE "ProblemTopic" ADD VALUE 'CALCULUS';
ALTER TYPE "ProblemTopic" ADD VALUE 'LOGIC';
ALTER TYPE "ProblemTopic" ADD VALUE 'GRAPH_THEORY';
ALTER TYPE "ProblemTopic" ADD VALUE 'SET_THEORY';
ALTER TYPE "ProblemTopic" ADD VALUE 'STATISTICS';
ALTER TYPE "ProblemTopic" ADD VALUE 'APPLIED_MATH';

-- AlterTable
ALTER TABLE "Problem" ADD COLUMN     "archiveEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "archiveIntro" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "difficultyConfidence" DOUBLE PRECISION,
ADD COLUMN     "difficultyIndexedAt" TIMESTAMP(3),
ADD COLUMN     "difficultyRating" INTEGER,
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "officialSolution" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "subtopic" VARCHAR(80) NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "PracticeAttempt" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "problemId" UUID NOT NULL,
    "storageKey" VARCHAR(180) NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(80) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "status" "PracticeAttemptStatus" NOT NULL DEFAULT 'QUEUED',
    "score" INTEGER,
    "feedback" TEXT NOT NULL DEFAULT '',
    "recognizedText" TEXT NOT NULL DEFAULT '',
    "error" TEXT NOT NULL DEFAULT '',
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeAttemptJob" (
    "id" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "status" "QueueJobStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "workerId" VARCHAR(120),
    "error" TEXT NOT NULL DEFAULT '',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeAttemptJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProblemStar" (
    "userId" UUID NOT NULL,
    "problemId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProblemStar_pkey" PRIMARY KEY ("userId","problemId")
);

-- CreateTable
CREATE TABLE "ProblemComment" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "problemId" UUID NOT NULL,
    "body" VARCHAR(1200) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProblemComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProblemCommentVote" (
    "userId" UUID NOT NULL,
    "commentId" UUID NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProblemCommentVote_pkey" PRIMARY KEY ("userId","commentId")
);

-- CreateTable
CREATE TABLE "Friendship" (
    "id" UUID NOT NULL,
    "userAId" UUID NOT NULL,
    "userBId" UUID NOT NULL,
    "requestedById" UUID NOT NULL,
    "status" "FriendshipStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchiveRatingIndex" (
    "id" UUID NOT NULL,
    "month" CHAR(7) NOT NULL,
    "problemCount" INTEGER NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArchiveRatingIndex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaqSection" (
    "id" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500) NOT NULL DEFAULT '',
    "orderIndex" INTEGER NOT NULL DEFAULT 1,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FaqSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaqItem" (
    "id" UUID NOT NULL,
    "sectionId" UUID NOT NULL,
    "question" VARCHAR(240) NOT NULL,
    "answer" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 1,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FaqItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsPost" (
    "id" UUID NOT NULL,
    "authorId" UUID,
    "title" VARCHAR(160) NOT NULL,
    "excerpt" VARCHAR(500) NOT NULL DEFAULT '',
    "body" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsComment" (
    "id" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "body" VARCHAR(1200) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),

    CONSTRAINT "NewsComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PracticeAttempt_storageKey_key" ON "PracticeAttempt"("storageKey");

-- CreateIndex
CREATE INDEX "PracticeAttempt_userId_createdAt_idx" ON "PracticeAttempt"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PracticeAttempt_userId_problemId_score_idx" ON "PracticeAttempt"("userId", "problemId", "score");

-- CreateIndex
CREATE INDEX "PracticeAttempt_problemId_score_createdAt_idx" ON "PracticeAttempt"("problemId", "score", "createdAt");

-- CreateIndex
CREATE INDEX "PracticeAttempt_status_createdAt_idx" ON "PracticeAttempt"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PracticeAttemptJob_status_availableAt_createdAt_idx" ON "PracticeAttemptJob"("status", "availableAt", "createdAt");

-- CreateIndex
CREATE INDEX "PracticeAttemptJob_attemptId_createdAt_idx" ON "PracticeAttemptJob"("attemptId", "createdAt");

-- CreateIndex
CREATE INDEX "ProblemStar_problemId_createdAt_idx" ON "ProblemStar"("problemId", "createdAt");

-- CreateIndex
CREATE INDEX "ProblemComment_problemId_createdAt_idx" ON "ProblemComment"("problemId", "createdAt");

-- CreateIndex
CREATE INDEX "ProblemComment_userId_createdAt_idx" ON "ProblemComment"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ProblemCommentVote_commentId_value_idx" ON "ProblemCommentVote"("commentId", "value");

-- CreateIndex
CREATE INDEX "Friendship_userAId_status_idx" ON "Friendship"("userAId", "status");

-- CreateIndex
CREATE INDEX "Friendship_userBId_status_idx" ON "Friendship"("userBId", "status");

-- CreateIndex
CREATE INDEX "Friendship_requestedById_status_idx" ON "Friendship"("requestedById", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_userAId_userBId_key" ON "Friendship"("userAId", "userBId");

-- CreateIndex
CREATE UNIQUE INDEX "ArchiveRatingIndex_month_key" ON "ArchiveRatingIndex"("month");

-- CreateIndex
CREATE UNIQUE INDEX "FaqSection_slug_key" ON "FaqSection"("slug");

-- CreateIndex
CREATE INDEX "FaqSection_isPublished_orderIndex_idx" ON "FaqSection"("isPublished", "orderIndex");

-- CreateIndex
CREATE INDEX "FaqItem_sectionId_isPublished_orderIndex_idx" ON "FaqItem"("sectionId", "isPublished", "orderIndex");

-- CreateIndex
CREATE INDEX "NewsPost_isPublished_publishedAt_idx" ON "NewsPost"("isPublished", "publishedAt");

-- CreateIndex
CREATE INDEX "NewsPost_authorId_createdAt_idx" ON "NewsPost"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "NewsComment_postId_createdAt_idx" ON "NewsComment"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "NewsComment_userId_createdAt_idx" ON "NewsComment"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Problem_archivedAt_isFeatured_difficultyRating_idx" ON "Problem"("archivedAt", "isFeatured", "difficultyRating");

-- CreateIndex
CREATE INDEX "Problem_topic_subtopic_difficultyRating_idx" ON "Problem"("topic", "subtopic", "difficultyRating");

-- CheckConstraint
ALTER TABLE "ProblemCommentVote" ADD CONSTRAINT "ProblemCommentVote_value_check" CHECK ("value" IN (-1, 1));
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_distinct_users_check" CHECK ("userAId" < "userBId");
ALTER TABLE "Problem" ADD CONSTRAINT "Problem_difficultyRating_check" CHECK ("difficultyRating" IS NULL OR ("difficultyRating" >= 0 AND "difficultyRating" <= 3000 AND "difficultyRating" % 10 = 0));
ALTER TABLE "PracticeAttempt" ADD CONSTRAINT "PracticeAttempt_score_check" CHECK ("score" IS NULL OR ("score" >= 0 AND "score" <= 10000));

-- AddForeignKey
ALTER TABLE "PracticeAttempt" ADD CONSTRAINT "PracticeAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeAttempt" ADD CONSTRAINT "PracticeAttempt_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeAttemptJob" ADD CONSTRAINT "PracticeAttemptJob_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "PracticeAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemStar" ADD CONSTRAINT "ProblemStar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemStar" ADD CONSTRAINT "ProblemStar_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemComment" ADD CONSTRAINT "ProblemComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemComment" ADD CONSTRAINT "ProblemComment_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemCommentVote" ADD CONSTRAINT "ProblemCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemCommentVote" ADD CONSTRAINT "ProblemCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "ProblemComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaqItem" ADD CONSTRAINT "FaqItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "FaqSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsPost" ADD CONSTRAINT "NewsPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsComment" ADD CONSTRAINT "NewsComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "NewsPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsComment" ADD CONSTRAINT "NewsComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Publish eligible problems from already finished contests into the initial archive.
UPDATE "Problem" p
SET "archivedAt" = c."endAt"
FROM "Contest" c
WHERE p."contestId" = c."id"
  AND c."status" = 'FINISHED'
  AND p."archiveEnabled" = true
  AND p."archivedAt" IS NULL;

