import type { Metadata } from "next";
import { ArrowLeft, BarChart3, BookOpenCheck, Gauge, UsersRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PracticeAttemptForm } from "@/components/archive/PracticeAttemptForm";
import { ProblemComments } from "@/components/archive/ProblemComments";
import { StarButton } from "@/components/archive/StarButton";
import { Badge } from "@/components/ui/Badge";
import { ARCHIVE_AREA_BY_KEY } from "@/lib/archive/taxonomy";
import { getArchiveProblem } from "@/server/archive/queries";
import { getCurrentUser } from "@/server/auth/session";
import { isUuid } from "@/server/validation/primitives";

export const metadata: Metadata = { title: "Задача из архива" };
export const dynamic = "force-dynamic";

export default async function ArchiveProblemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const viewer = await getCurrentUser();
  const problem = await getArchiveProblem(id, viewer?.id);
  if (!problem) notFound();
  const area = ARCHIVE_AREA_BY_KEY[problem.topic];

  return (
    <section className="page-section">
      <div className="page-shell">
        <Link
          className="inline-flex items-center gap-2 text-sm font-bold text-[var(--muted)] hover:text-[var(--ink)]"
          href="/archive"
        >
          <ArrowLeft size={16} />
          Вернуться в архив
        </Link>
        <div className="mt-7 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <main className="min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="blue">{area.label}</Badge>
                  {problem.subtopic && <Badge>{problem.subtopic}</Badge>}
                </div>
                <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
                  {problem.title}
                </h1>
                <p className="mt-3 text-sm text-[var(--muted)]">
                  {problem.contest.title} · задача {String.fromCharCode(64 + problem.orderIndex)}
                </p>
              </div>
              {viewer && <StarButton initialStarred={problem.isStarred} problemId={problem.id} />}
            </div>

            {problem.archiveIntro && (
              <div className="mt-7 rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-5 text-sm leading-7 text-[var(--muted)]">
                {problem.archiveIntro}
              </div>
            )}
            <article className="card mt-6 whitespace-pre-wrap p-5 text-[1.03rem] leading-8 sm:p-8">
              {problem.statement}
            </article>

            <section className="card mt-6 overflow-hidden">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-display text-xl font-semibold sm:p-6">
                  <span className="flex items-center gap-2">
                    <BookOpenCheck size={20} />
                    Официальное решение
                  </span>
                  <span className="text-sm font-sans text-[var(--muted)] group-open:hidden">
                    Открыть
                  </span>
                </summary>
                <div className="border-t border-[var(--line)] p-5 sm:p-6">
                  {problem.officialSolution ? (
                    <div className="whitespace-pre-wrap leading-8">{problem.officialSolution}</div>
                  ) : (
                    <p className="text-sm text-[var(--muted)]">
                      Редакция ещё не опубликовала разбор.
                    </p>
                  )}
                </div>
              </details>
            </section>

            <section className="card mt-6 p-5 sm:p-6">
              <h2 className="font-display text-2xl font-semibold">Отправить решение</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Балл от 90 засчитывает задачу в профиль. Все попытки сохраняются.
              </p>
              <div className="mt-5">
                <PracticeAttemptForm
                  initialAttempts={problem.attempts}
                  isAuthenticated={Boolean(viewer)}
                  problemId={problem.id}
                />
              </div>
            </section>
            <div className="mt-6">
              <ProblemComments
                comments={problem.comments}
                isAuthenticated={Boolean(viewer)}
                problemId={problem.id}
              />
            </div>
          </main>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl p-5 text-white" style={{ background: area.color }}>
              <Gauge size={22} />
              <p className="mt-5 text-xs font-bold uppercase tracking-[0.15em] text-white/70">
                Рейтинг задачи
              </p>
              <p className="mt-1 font-mono text-4xl font-bold">{problem.difficultyRating ?? "—"}</p>
              <p className="mt-3 text-xs leading-5 text-white/75">
                Рейтинг, при котором шанс набрать 90+ баллов оценивается в 70%.
              </p>
            </div>
            <div className="card p-5">
              <p className="text-xs font-bold uppercase tracking-[0.13em] text-[var(--muted)]">
                Статистика
              </p>
              <div className="mt-4 space-y-4">
                <Stat
                  icon={<UsersRound size={17} />}
                  label="Решили на 90+"
                  value={String(problem.solverCount)}
                />
                <Stat
                  icon={<BarChart3 size={17} />}
                  label="Средний балл"
                  value={problem.overallAverage === null ? "—" : `${problem.overallAverage}/100`}
                />
                {viewer && (
                  <Stat
                    icon={<UsersRound size={17} />}
                    label="Средний у друзей"
                    value={problem.friendAverage === null ? "—" : `${problem.friendAverage}/100`}
                  />
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-sm text-[var(--muted)]">
        {icon}
        {label}
      </span>
      <strong className="font-mono text-sm">{value}</strong>
    </div>
  );
}
