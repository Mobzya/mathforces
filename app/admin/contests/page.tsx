import type { Metadata } from "next";
import { CalendarDays, ChevronRight, FileText } from "lucide-react";
import Link from "next/link";
import { CreateContestForm } from "@/components/admin/CreateContestForm";
import { Badge } from "@/components/ui/Badge";
import { contestStatusMeta, formatContestDate } from "@/lib/contests/presentation";
import { prisma } from "@/server/db/client";

export const metadata: Metadata = { title: "Управление контестами" };

export default async function AdminContestsPage({
  searchParams
}: {
  searchParams: Promise<{
    create?: string | string[];
    error?: string | string[];
  }>;
}) {
  const requestedParams = await searchParams;
  const [contests, organizations] = await Promise.all([
    prisma.contest.findMany({
      include: {
        _count: { select: { problems: true, registrations: true, submissions: true } },
        organization: { select: { id: true, name: true } }
      },
      orderBy: { startAt: "desc" }
    }),
    prisma.organization.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    })
  ]);
  const create = requestedParams.create === "1";
  const initialError =
    typeof requestedParams.error === "string" ? requestedParams.error.slice(0, 300) : "";

  return (
    <section className="page-section">
      <div className="page-shell">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--accent)]">
              Sprint 5
            </p>
            <h1 className="mt-3 font-display text-4xl font-semibold">Контесты</h1>
            <p className="mt-2 text-[var(--muted)]">
              Создание, задачи, публикация и завершение тура.
            </p>
          </div>
          <CreateContestForm initiallyOpen={false} organizations={organizations} />
        </div>

        {create && (
          <CreateContestForm
            initialError={initialError}
            initiallyOpen
            organizations={organizations}
          />
        )}

        <div className="mt-8 space-y-3">
          {contests.map((contest) => {
            const status = contestStatusMeta[contest.status];
            return (
              <Link
                className="card flex flex-col gap-4 p-5 transition hover:-translate-y-0.5 sm:flex-row sm:items-center sm:justify-between"
                href={`/admin/contests/${contest.id}`}
                key={contest.id}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={status.tone}>{status.label}</Badge>
                    {!contest.isPublic && (
                      <Badge tone="amber">{contest.organization?.name ?? "Организация"}</Badge>
                    )}
                  </div>
                  <h2 className="mt-3 truncate font-display text-2xl font-semibold">
                    {contest.title}
                  </h2>
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-[var(--muted)]">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays size={13} />
                      {formatContestDate(contest.startAt.toISOString())}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <FileText size={13} />
                      {contest._count.problems}/{contest.requiredProblemCount} задач ·{" "}
                      {contest._count.submissions} посылок
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">
                    {contest._count.registrations} участников
                  </span>
                  <ChevronRight size={19} className="text-[var(--muted)]" />
                </div>
              </Link>
            );
          })}
          {contests.length === 0 && (
            <div className="card p-10 text-center text-[var(--muted)]">Контестов пока нет.</div>
          )}
        </div>
      </div>
    </section>
  );
}
