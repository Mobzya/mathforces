-- Sprint 1 did not have rated contests, so every existing 500 value represented
-- the former registration default rather than an earned rating.
UPDATE "User"
SET "currentRating" = 0,
    "maxRating" = 0
WHERE "currentRating" = 500
  AND "maxRating" = 500;
