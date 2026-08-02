import type { Metadata } from "next";
import { OrganizationManager } from "@/components/admin/OrganizationManager";
import { prisma } from "@/server/db/client";
import type { AdminOrganization } from "@/types/admin";

export const metadata: Metadata = { title: "Управление организациями" };

export default async function AdminOrganizationsPage() {
  const records = await prisma.organization.findMany({
    include: {
      _count: { select: { members: true, scopedContests: true } },
      createdBy: { select: { id: true, nickname: true } }
    },
    orderBy: { name: "asc" }
  });
  const organizations: AdminOrganization[] = records.map((organization) => ({
    contestCount: organization._count.scopedContests,
    createdAt: organization.createdAt.toISOString(),
    createdBy: organization.createdBy,
    id: organization.id,
    memberCount: organization._count.members,
    name: organization.name
  }));

  return (
    <section className="page-section">
      <div className="page-shell max-w-4xl">
        <h1 className="font-display text-4xl font-semibold">Организации</h1>
        <p className="mt-2 text-[var(--muted)]">
          Создание и переименование школ, кружков и команд.
        </p>
        <div className="mt-8">
          <OrganizationManager organizations={organizations} />
        </div>
      </div>
    </section>
  );
}
