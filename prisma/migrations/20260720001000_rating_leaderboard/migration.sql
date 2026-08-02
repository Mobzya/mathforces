CREATE INDEX "User_currentRating_nicknameNormalized_idx"
ON "User"("currentRating", "nicknameNormalized");

CREATE INDEX "User_organizationId_currentRating_nicknameNormalized_idx"
ON "User"("organizationId", "currentRating", "nicknameNormalized");
