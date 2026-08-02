ALTER TABLE "User"
ADD COLUMN "avatarStorageKey" VARCHAR(255),
ADD COLUMN "avatarMimeType" VARCHAR(40),
ADD COLUMN "avatarVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "profileAccent" VARCHAR(20) NOT NULL DEFAULT 'crimson',
ADD COLUMN "profilePattern" VARCHAR(20) NOT NULL DEFAULT 'grid',
ADD COLUMN "favoriteTopic" "ProblemTopic",
ADD COLUMN "showGrade" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "showOrganization" BOOLEAN NOT NULL DEFAULT true;
