CREATE TABLE "RatingCalculation" (
    "id" UUID NOT NULL,
    "contestId" UUID NOT NULL,
    "formulaVersion" VARCHAR(40) NOT NULL,
    "participantCount" INTEGER NOT NULL,
    "calculatedById" UUID,
    "metadata" JSONB,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RatingCalculation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RatingChange" (
    "id" UUID NOT NULL,
    "calculationId" UUID NOT NULL,
    "contestId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "previousRating" INTEGER,
    "newRating" INTEGER NOT NULL,
    "delta" INTEGER NOT NULL,
    "place" INTEGER NOT NULL,
    "totalScore" INTEGER NOT NULL,
    "expectedScore" DOUBLE PRECISION NOT NULL,
    "actualScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RatingChange_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RatingCalculation_contestId_key" ON "RatingCalculation"("contestId");
CREATE INDEX "RatingCalculation_calculatedAt_idx" ON "RatingCalculation"("calculatedAt");
CREATE INDEX "RatingCalculation_calculatedById_calculatedAt_idx" ON "RatingCalculation"("calculatedById", "calculatedAt");
CREATE UNIQUE INDEX "RatingChange_contestId_userId_key" ON "RatingChange"("contestId", "userId");
CREATE INDEX "RatingChange_userId_createdAt_idx" ON "RatingChange"("userId", "createdAt");
CREATE INDEX "RatingChange_calculationId_idx" ON "RatingChange"("calculationId");
CREATE INDEX "RatingChange_contestId_place_idx" ON "RatingChange"("contestId", "place");

ALTER TABLE "RatingCalculation" ADD CONSTRAINT "RatingCalculation_contestId_fkey"
FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RatingCalculation" ADD CONSTRAINT "RatingCalculation_calculatedById_fkey"
FOREIGN KEY ("calculatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RatingChange" ADD CONSTRAINT "RatingChange_calculationId_fkey"
FOREIGN KEY ("calculationId") REFERENCES "RatingCalculation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RatingChange" ADD CONSTRAINT "RatingChange_contestId_fkey"
FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RatingChange" ADD CONSTRAINT "RatingChange_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
