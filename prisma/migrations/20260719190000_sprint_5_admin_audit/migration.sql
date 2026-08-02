CREATE TABLE "AdminAction" (
    "id" UUID NOT NULL,
    "adminId" UUID,
    "action" VARCHAR(80) NOT NULL,
    "entityType" VARCHAR(50) NOT NULL,
    "entityId" VARCHAR(120) NOT NULL,
    "summary" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminAction_createdAt_idx" ON "AdminAction"("createdAt");
CREATE INDEX "AdminAction_entityType_entityId_idx" ON "AdminAction"("entityType", "entityId");
CREATE INDEX "AdminAction_adminId_createdAt_idx" ON "AdminAction"("adminId", "createdAt");

ALTER TABLE "AdminAction"
ADD CONSTRAINT "AdminAction_adminId_fkey"
FOREIGN KEY ("adminId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
