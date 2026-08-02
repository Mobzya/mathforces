CREATE TYPE "QueueJobStatus" AS ENUM (
    'QUEUED',
    'PROCESSING',
    'COMPLETED',
    'FAILED'
);

CREATE TYPE "ContestFinalizationStatus" AS ENUM (
    'QUEUED',
    'PROCESSING',
    'COMPLETED',
    'FAILED'
);

CREATE TABLE "ContestFinalization" (
    "id" UUID NOT NULL,
    "contestId" UUID NOT NULL,
    "requestedById" UUID,
    "status" "ContestFinalizationStatus" NOT NULL DEFAULT 'QUEUED',
    "queuedCount" INTEGER NOT NULL DEFAULT 0,
    "completedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContestFinalization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EvaluationJob" (
    "id" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "finalizationId" UUID,
    "mode" "EvaluationMode" NOT NULL,
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

    CONSTRAINT "EvaluationJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RateLimitWindow" (
    "key" VARCHAR(200) NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitWindow_pkey" PRIMARY KEY ("key")
);

CREATE UNIQUE INDEX "ContestFinalization_contestId_key"
ON "ContestFinalization"("contestId");

CREATE INDEX "ContestFinalization_status_createdAt_idx"
ON "ContestFinalization"("status", "createdAt");

CREATE INDEX "ContestFinalization_requestedById_createdAt_idx"
ON "ContestFinalization"("requestedById", "createdAt");

CREATE INDEX "EvaluationJob_status_availableAt_createdAt_idx"
ON "EvaluationJob"("status", "availableAt", "createdAt");

CREATE INDEX "EvaluationJob_finalizationId_status_idx"
ON "EvaluationJob"("finalizationId", "status");

CREATE INDEX "EvaluationJob_submissionId_createdAt_idx"
ON "EvaluationJob"("submissionId", "createdAt");

CREATE INDEX "RateLimitWindow_resetAt_idx"
ON "RateLimitWindow"("resetAt");

CREATE INDEX "Submission_contestId_userId_problemId_createdAt_idx"
ON "Submission"("contestId", "userId", "problemId", "createdAt");

CREATE INDEX "ContestRegistration_contestId_registeredAt_idx"
ON "ContestRegistration"("contestId", "registeredAt");

ALTER TABLE "ContestFinalization"
ADD CONSTRAINT "ContestFinalization_contestId_fkey"
FOREIGN KEY ("contestId") REFERENCES "Contest"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContestFinalization"
ADD CONSTRAINT "ContestFinalization_requestedById_fkey"
FOREIGN KEY ("requestedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EvaluationJob"
ADD CONSTRAINT "EvaluationJob_submissionId_fkey"
FOREIGN KEY ("submissionId") REFERENCES "Submission"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EvaluationJob"
ADD CONSTRAINT "EvaluationJob_finalizationId_fkey"
FOREIGN KEY ("finalizationId") REFERENCES "ContestFinalization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "EvaluationJob" (
    "id", "submissionId", "mode", "status", "updatedAt"
)
SELECT
    gen_random_uuid(), s.id, 'PRELIMINARY', 'QUEUED', CURRENT_TIMESTAMP
FROM "Submission" s
WHERE s.status = 'QUEUED'
  AND NOT EXISTS (
      SELECT 1 FROM "EvaluationJob" j WHERE j."submissionId" = s.id
  );
