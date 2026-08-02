CREATE TABLE "ContestRatingSnapshot" (
    "id" UUID NOT NULL,
    "contestId" UUID NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "maxScore" INTEGER NOT NULL,
    "participantCount" INTEGER NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContestRatingSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContestRatingSeed" (
    "id" UUID NOT NULL,
    "snapshotId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "ratingAtStart" INTEGER NOT NULL,
    "seedPlace" INTEGER NOT NULL,
    "expectedPlace" DOUBLE PRECISION NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContestRatingSeed_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "RatingChange"
ADD COLUMN "ratingAtStart" INTEGER,
ADD COLUMN "seedPlace" INTEGER,
ADD COLUMN "expectedPlace" DOUBLE PRECISION,
ADD COLUMN "performance" DOUBLE PRECISION,
ADD COLUMN "contestWeight" DOUBLE PRECISION;

CREATE UNIQUE INDEX "ContestRatingSnapshot_contestId_key"
ON "ContestRatingSnapshot"("contestId");

CREATE INDEX "ContestRatingSnapshot_capturedAt_idx"
ON "ContestRatingSnapshot"("capturedAt");

CREATE UNIQUE INDEX "ContestRatingSeed_snapshotId_userId_key"
ON "ContestRatingSeed"("snapshotId", "userId");

CREATE INDEX "ContestRatingSeed_snapshotId_seedPlace_idx"
ON "ContestRatingSeed"("snapshotId", "seedPlace");

CREATE INDEX "ContestRatingSeed_userId_createdAt_idx"
ON "ContestRatingSeed"("userId", "createdAt");

ALTER TABLE "ContestRatingSnapshot"
ADD CONSTRAINT "ContestRatingSnapshot_contestId_fkey"
FOREIGN KEY ("contestId") REFERENCES "Contest"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContestRatingSeed"
ADD CONSTRAINT "ContestRatingSeed_snapshotId_fkey"
FOREIGN KEY ("snapshotId") REFERENCES "ContestRatingSnapshot"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContestRatingSeed"
ADD CONSTRAINT "ContestRatingSeed_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
