CREATE TYPE "EvaluationMode" AS ENUM ('PRELIMINARY', 'REJUDGE');
CREATE TYPE "EvaluationStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'NEEDS_REVIEW', 'FAILED');
CREATE TYPE "EvaluationConfidence" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "JudgeRunStage" AS ENUM ('OCR', 'STRUCTURE', 'SCORING', 'REVIEW');

CREATE TABLE "Evaluation" (
    "id" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "mode" "EvaluationMode" NOT NULL DEFAULT 'PRELIMINARY',
    "status" "EvaluationStatus" NOT NULL DEFAULT 'PROCESSING',
    "score" INTEGER,
    "maxScore" INTEGER NOT NULL,
    "confidence" "EvaluationConfidence",
    "confidenceValue" DOUBLE PRECISION,
    "recognizedText" TEXT NOT NULL DEFAULT '',
    "comment" TEXT NOT NULL DEFAULT '',
    "geometryDetected" BOOLEAN NOT NULL DEFAULT false,
    "rubricSnapshot" TEXT NOT NULL DEFAULT '',
    "error" TEXT NOT NULL DEFAULT '',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JudgeModelRun" (
    "id" UUID NOT NULL,
    "evaluationId" UUID NOT NULL,
    "stage" "JudgeRunStage" NOT NULL,
    "provider" VARCHAR(80) NOT NULL,
    "success" BOOLEAN NOT NULL,
    "confidence" DOUBLE PRECISION,
    "inputChars" INTEGER NOT NULL DEFAULT 0,
    "output" JSONB,
    "latencyMs" INTEGER NOT NULL,
    "error" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JudgeModelRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Evaluation_submissionId_createdAt_idx" ON "Evaluation"("submissionId", "createdAt");
CREATE INDEX "Evaluation_status_createdAt_idx" ON "Evaluation"("status", "createdAt");
CREATE INDEX "JudgeModelRun_evaluationId_createdAt_idx" ON "JudgeModelRun"("evaluationId", "createdAt");
CREATE INDEX "JudgeModelRun_stage_createdAt_idx" ON "JudgeModelRun"("stage", "createdAt");

ALTER TABLE "Evaluation"
ADD CONSTRAINT "Evaluation_submissionId_fkey"
FOREIGN KEY ("submissionId") REFERENCES "Submission"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JudgeModelRun"
ADD CONSTRAINT "JudgeModelRun_evaluationId_fkey"
FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
