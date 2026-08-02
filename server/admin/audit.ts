import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";

type AuditClient = typeof prisma | Prisma.TransactionClient;

export type AdminActionInput = {
  action: string;
  adminId: string | null;
  details?: Prisma.InputJsonValue;
  entityId: string;
  entityType: string;
  summary: string;
};

export async function recordAdminAction(db: AuditClient, input: AdminActionInput) {
  return db.adminAction.create({
    data: {
      action: input.action.slice(0, 80),
      adminId: input.adminId,
      details: input.details,
      entityId: input.entityId.slice(0, 120),
      entityType: input.entityType.slice(0, 50),
      summary: input.summary
    }
  });
}
