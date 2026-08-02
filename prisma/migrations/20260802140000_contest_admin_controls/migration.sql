ALTER TABLE "Contest"
  ADD COLUMN "registrationClosesAt" TIMESTAMP(3),
  ADD COLUMN "requiredProblemCount" INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN "showStandingsDuringContest" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "showOthersSubmissions" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "showSubmissionComments" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "showPreliminaryScores" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "reviewConfidenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.72,
  ADD COLUMN "autoFinalRejudge" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "autoCalculateRating" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "autoPublishArchive" BOOLEAN NOT NULL DEFAULT true;

UPDATE "Contest"
SET "registrationClosesAt" = "startAt"
WHERE "registrationClosesAt" IS NULL;

ALTER TABLE "Problem"
  ADD COLUMN "sourceProblemId" UUID;

CREATE INDEX "Problem_sourceProblemId_idx" ON "Problem"("sourceProblemId");

ALTER TABLE "Problem"
  ADD CONSTRAINT "Problem_sourceProblemId_fkey"
  FOREIGN KEY ("sourceProblemId") REFERENCES "Problem"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
