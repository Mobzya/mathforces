import type { Metadata } from "next";
import { Archive, ChevronRight, Clock3, FileCheck2, Trophy } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { getCurrentUser } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import { visibleSubmissionScore } from "@/server/scoring/result";

export const metadata: Metadata = { title: "Мои посылки" };
export const dynamic = "force-dynamic";

type SubmissionItem = {
  createdAt: Date;
  href: string;
  id: string;
  maxScore: number;
  score: number | null;
  source: "archive" | "contest";
  sourceTitle: string;
  status: string;
  title: string;
};

export default async function SubmissionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/submissions");
  const [contestSubmissions, practiceAttempts] = await Promise.all([
    prisma.submission.findMany({
      include: {
        contest: { select: { id: true, title: true } },
        problem: { select: { id: true, maxScore: true, title: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 60,
      where: { userId: user.id }
    }),
    prisma.practiceAttempt.findMany({
      include: { problem: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
      take: 60,
      where: { userId: user.id }
    })
  ]);
  const items: SubmissionItem[] = [
    ...contestSubmissions.map((submission) => ({
      createdAt: submission.createdAt,
      href: `/contests/${submission.contest.id}/submissions`,
      id: submission.id,
      maxScore: submission.problem.maxScore,
      score: visibleSubmissionScore(submission),
      source: "contest" as const,
      sourceTitle: submission.contest.title,
      status: submission.status,
      title: submission.problem.title
    })),
    ...practiceAttempts.map((attempt) => ({
      createdAt: attempt.createdAt,
      href: `/archive/${attempt.problem.id}`,
      id: attempt.id,
      maxScore: 100,
      score: attempt.score,
      source: "archive" as const,
      sourceTitle: "Архив задач",
      status: attempt.status,
      title: attempt.problem.title
    }))
  ]
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, 80);

  return (
    <section className="page-section">
      <div className="page-shell max-w-5xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
              <FileCheck2 size={15} />
              Личная история
            </p>
            <h1 className="mt-3 font-display text-5xl font-semibold tracking-[-0.045em]">
              Мои посылки
            </h1>
            <p className="mt-4 max-w-2xl leading-7 text-[var(--muted)]">
              Контестные и архивные решения в одной ленте.
            </p>
          </div>
          <Badge tone="gray">{items.length} последних</Badge>
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
          {items.length === 0 ? (
            <div className="grid min-h-64 place-items-center p-8 text-center">
              <div>
                <Clock3 className="mx-auto text-[var(--line-strong)]" size={34} />
                <h2 className="mt-4 font-display text-2xl font-semibold">Посылок пока нет</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Отправьте решение в контесте или архиве.
                </p>
              </div>
            </div>
          ) : (
            items.map((item) => {
              const status = submissionStatus(item.status);
              return (
                <Link
                  className="group grid gap-3 border-b border-[var(--line)] p-4 transition last:border-b-0 hover:bg-[var(--surface-muted)] sm:grid-cols-[2.5rem_minmax(0,1fr)_10rem_7rem_1.5rem] sm:items-center"
                  href={item.href}
                  key={`${item.source}:${item.id}`}
                >
                  <span
                    className={`grid size-9 place-items-center rounded-xl ${item.source === "archive" ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700"}`}
                  >
                    {item.source === "archive" ? <Archive size={17} /> : <Trophy size={17} />}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold group-hover:text-[var(--accent)]">
                      {item.title}
                    </p>
                    <p className="mt-1 truncate text-xs text-[var(--muted)]">
                      {item.sourceTitle} · {item.createdAt.toLocaleString("ru-RU")}
                    </p>
                  </div>
                  <p className={`text-sm font-semibold ${status.className}`}>{status.label}</p>
                  <p className="font-mono text-xl font-bold sm:text-right">
                    {item.score === null ? "—" : `${item.score}/${item.maxScore}`}
                  </p>
                  <ChevronRight
                    className="hidden text-[var(--muted)] transition-transform group-hover:translate-x-0.5 sm:block"
                    size={17}
                  />
                </Link>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}

function submissionStatus(status: string) {
  if (status === "COMPLETED" || status === "FINALIZED")
    return { className: "text-emerald-700", label: "Проверено" };
  if (status === "FAILED" || status === "REJECTED")
    return { className: "text-[var(--accent)]", label: "Ошибка" };
  if (status === "NEEDS_REVIEW") return { className: "text-amber-700", label: "На подтверждении" };
  if (status === "PRELIMINARY_READY")
    return { className: "text-blue-700", label: "Предварительно" };
  if (status === "PROCESSING") return { className: "text-amber-700", label: "Проверяется" };
  return { className: "text-[var(--muted)]", label: "В очереди" };
}
