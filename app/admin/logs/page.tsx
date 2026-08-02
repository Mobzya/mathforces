import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { prisma } from "@/server/db/client";

export const metadata: Metadata = { title: "Журнал действий" };

export default async function AdminLogsPage() {
  const actions = await prisma.adminAction.findMany({
    include: { admin: { select: { id: true, nickname: true } } },
    orderBy: { createdAt: "desc" },
    take: 300
  });

  return (
    <section className="page-section">
      <div className="page-shell">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-[var(--strong)] text-white">
            <ScrollText size={20} />
          </span>
          <div>
            <h1 className="font-display text-4xl font-semibold">Аудит действий</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Неизменяемая хронология административных операций.
            </p>
          </div>
        </div>
        <div className="card mt-8 overflow-hidden">
          <div className="divide-y divide-[var(--line)]">
            {actions.map((action) => (
              <article
                className="grid gap-3 p-5 md:grid-cols-[11rem_1fr_14rem] md:items-center"
                key={action.id}
              >
                <div>
                  <Badge tone="gray">{action.entityType}</Badge>
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    {new Intl.DateTimeFormat("ru-RU", {
                      dateStyle: "short",
                      timeStyle: "medium",
                      timeZone: "Europe/Moscow"
                    }).format(action.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="font-semibold">{action.summary}</p>
                  <p className="mt-1 font-mono text-[11px] text-[var(--muted)]">
                    {action.action} · {action.entityId}
                  </p>
                </div>
                <p className="text-sm text-[var(--muted)] md:text-right">
                  {action.admin?.nickname ??
                    (action.action === "CONTEST_AUTOMATICALLY_STARTED"
                      ? "Система"
                      : "Удалённый администратор")}
                </p>
              </article>
            ))}
            {actions.length === 0 && (
              <p className="p-10 text-center text-[var(--muted)]">Действий пока нет.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
