import type { Metadata } from "next";
import {
  ArrowUpRight,
  ClipboardList,
  FileCheck2,
  Plus,
  ScrollText,
  ShieldCheck,
  UsersRound
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { contestStatusMeta, formatContestDate } from "@/lib/contests/presentation";
import { prisma } from "@/server/db/client";

export const metadata: Metadata = {
  title: "Админ-панель"
};

export default async function AdminPage() {
  const [userCount, contestCount, queuedCount, latestContests, latestActions] = await Promise.all([
    prisma.user.count(),
    prisma.contest.count(),
    prisma.submission.count({
      where: { status: { in: ["QUEUED", "PROCESSING", "NEEDS_REVIEW"] } }
    }),
    prisma.contest.findMany({
      include: { _count: { select: { problems: true, registrations: true } } },
      orderBy: { startAt: "desc" },
      take: 5
    }),
    prisma.adminAction.findMany({
      include: { admin: { select: { nickname: true } } },
      orderBy: { createdAt: "desc" },
      take: 5
    })
  ]);

  const stats = [
    { href: "/admin/users", icon: UsersRound, label: "Пользователей", value: userCount },
    { href: "/admin/contests", icon: ClipboardList, label: "Контестов", value: contestCount },
    { href: "/admin/submissions", icon: FileCheck2, label: "Требуют внимания", value: queuedCount }
  ];

  return (
    <section className="page-section">
      <div className="page-shell">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Badge tone="red">
              <ShieldCheck size={12} />
              Администратор
            </Badge>
            <h1 className="mt-5 font-display text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
              Центр управления
            </h1>
            <p className="mt-3 text-[var(--muted)]">
              Контесты, проверки, пользователи и журнал изменений.
            </p>
          </div>
          <Link
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--strong)] px-4 text-sm font-semibold text-white"
            href="/admin/contests?create=1"
          >
            <Plus size={17} />
            Создать контест
          </Link>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {stats.map(({ href, icon: Icon, label, value }) => (
            <Link className="card p-5 transition hover:-translate-y-0.5" href={href} key={label}>
              <div className="flex items-start justify-between">
                <span className="grid size-10 place-items-center rounded-xl bg-[var(--surface-muted)]">
                  <Icon size={19} />
                </span>
                <ArrowUpRight className="text-[var(--line-strong)]" size={18} />
              </div>
              <p className="mt-7 text-sm text-[var(--muted)]">{label}</p>
              <p className="mt-1 font-display text-3xl font-semibold">{value}</p>
            </Link>
          ))}
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_22rem]">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--line)] p-5 sm:p-6">
              <div>
                <h2 className="font-display text-2xl font-semibold">Последние контесты</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">Быстрый переход к конструктору</p>
              </div>
              <Link className="text-sm font-semibold text-[var(--accent)]" href="/admin/contests">
                Все
              </Link>
            </div>
            <div className="divide-y divide-[var(--line)]">
              {latestContests.map((contest) => {
                const status = contestStatusMeta[contest.status];
                return (
                  <Link
                    className="flex items-center justify-between gap-4 p-5 transition hover:bg-[var(--surface-muted)]"
                    href={`/admin/contests/${contest.id}`}
                    key={contest.id}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{contest.title}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {formatContestDate(contest.startAt.toISOString())} ·{" "}
                        {contest._count.problems}/{contest.requiredProblemCount} задач
                      </p>
                    </div>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </Link>
                );
              })}
              {latestContests.length === 0 && (
                <p className="p-8 text-center text-sm text-[var(--muted)]">
                  Создайте первый контест.
                </p>
              )}
            </div>
          </div>

          <aside className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Последние действия</h2>
              <ScrollText size={18} className="text-[var(--muted)]" />
            </div>
            <div className="mt-5 space-y-4">
              {latestActions.map((action) => (
                <div className="border-l-2 border-[var(--line)] pl-3" key={action.id}>
                  <p className="text-sm font-medium leading-5">{action.summary}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {action.admin?.nickname ?? "Удалённый администратор"}
                  </p>
                </div>
              ))}
              {latestActions.length === 0 && (
                <p className="text-sm text-[var(--muted)]">Журнал пока пуст.</p>
              )}
            </div>
            <Link
              className="mt-6 inline-flex text-sm font-semibold text-[var(--accent)]"
              href="/admin/logs"
            >
              Открыть аудит
            </Link>
          </aside>
        </div>
      </div>
    </section>
  );
}
