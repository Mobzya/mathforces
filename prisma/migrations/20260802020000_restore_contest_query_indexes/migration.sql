-- These indexes were added for Sprint 9 queue/standings queries and were
-- accidentally removed by the following development migration. Restore them
-- explicitly and keep the declarations in schema.prisma to prevent drift.
CREATE INDEX "ContestRegistration_contestId_registeredAt_idx"
ON "ContestRegistration"("contestId", "registeredAt");

CREATE INDEX "Submission_contestId_userId_problemId_createdAt_idx"
ON "Submission"("contestId", "userId", "problemId", "createdAt");
