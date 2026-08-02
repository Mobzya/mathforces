import type { Metadata } from "next";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Clock3,
  FileText,
  LockKeyhole,
  Send,
  Tag,
  UsersRound
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContestTabs } from "@/components/contest/ContestTabs";
import { ContestScoringOverview } from "@/components/contest/ContestScoringOverview";
import { RegisterContestButton } from "@/components/contest/RegisterContestButton";
import { Badge } from "@/components/ui/Badge";
import {
  contestStatusMeta,
  formatContestDate,
  problemTopicLabels
} from "@/lib/contests/presentation";
import { getCurrentUser } from "@/server/auth/session";
import { findContest } from "@/server/contests/queries";
import { isUuid } from "@/server/validation/primitives";
import {
  canRevealContestProblems,
  isContestAcceptingSubmissions,
  isContestRegistrationOpen
} from "@/server/contests/lifecycle";

export const metadata: Metadata = {
  title: "Контест"
};

export const dynamic = "force-dynamic";

export default async function ContestPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) {
    notFound();
  }

  const viewer = await getCurrentUser();
  const contest = await findContest(id, viewer);
  if (!contest) {
    notFound();
  }

  const status = contestStatusMeta[contest.status];
  const canRevealProblems = canRevealContestProblems(contest, viewer?.role === "ADMIN");
  const acceptsSubmissions = isContestAcceptingSubmissions(contest);
  const requestedError = (await searchParams).error;
  const registrationError = typeof requestedError === "string" ? requestedError.slice(0, 300) : "";

  return (
    <section className="page-section">
      <div className="page-shell">
        <Link
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
          href="/contests"
        >
          <ArrowLeft size={16} />
          Все контесты
        </Link>

        <div className="mt-7 grid gap-8 lg:grid-cols-[1fr_20rem]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={status.tone}>{status.label}</Badge>
              {!contest.isPublic && <Badge tone="amber">Для организации</Badge>}
            </div>
            <h1 className="mt-5 font-display text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
              {contest.title}
            </h1>
            {contest.description && (
              <p className="mt-4 max-w-2xl text-lg leading-8 text-[var(--muted)]">
                {contest.description}
              </p>
            )}

            <div className="mt-9">
              <ContestTabs active="problems" contestId={contest.id} />
            </div>

            <div className="mt-6 space-y-4">
              {contest.problems.length === 0 ? (
                <div className="card grid min-h-52 place-items-center p-8 text-center">
                  <div>
                    <FileText
                      className="mx-auto text-[var(--line-strong)]"
                      size={34}
                      strokeWidth={1.5}
                    />
                    <p className="mt-4 font-semibold">Задачи ещё готовятся</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Организатор опубликует комплект до начала тура.
                    </p>
                  </div>
                </div>
              ) : (
                contest.problems.map((problem) => (
                  <article className="card overflow-hidden" key={problem.id}>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--surface-muted)] px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 place-items-center rounded-xl bg-[var(--strong)] font-display text-lg font-semibold text-white">
                          {String.fromCharCode(64 + problem.orderIndex)}
                        </span>
                        <div>
                          <h2 className="font-display text-xl font-semibold">{problem.title}</h2>
                          {contest.status === "FINISHED" && (
                            <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-[var(--muted)]">
                              <Tag size={12} />
                              {problemTopicLabels[problem.topic]}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm font-bold">{problem.maxScore} баллов</p>
                        <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                          −{problem.scoreDecayPer5Min} каждые 5 мин.
                        </p>
                      </div>
                    </div>

                    {canRevealProblems ? (
                      <>
                        <div className="whitespace-pre-wrap px-5 py-6 leading-8 text-[var(--ink)] sm:px-6">
                          {problem.statement}
                        </div>
                        {acceptsSubmissions &&
                          (contest.isRegistered || viewer?.role === "ADMIN") && (
                            <div className="border-t border-[var(--line)] px-5 py-4 sm:px-6">
                              <Link
                                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[var(--strong)] px-4 text-sm font-semibold text-white"
                                href={`/contests/${contest.id}/submit?problem=${problem.id}`}
                              >
                                <Send size={15} />
                                Отправить решение
                              </Link>
                            </div>
                          )}
                      </>
                    ) : (
                      <div className="flex items-center gap-3 px-5 py-6 text-sm text-[var(--muted)]">
                        <LockKeyhole size={18} />
                        Условие откроется после начала контеста
                      </div>
                    )}
                  </article>
                ))
              )}
            </div>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <ContestScoringOverview
              endAt={contest.endAt}
              problems={contest.problems}
              serverNow={new Date().toISOString()}
              startAt={contest.startAt}
              status={contest.status}
            />
            <div className="card p-5">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
                Расписание
              </p>
              <div className="mt-4 flex items-center gap-2 font-display text-2xl font-semibold">
                <Clock3 className="text-[var(--accent)]" size={22} />
                {contest.durationMinutes} минут
              </div>
              <div className="mt-5 space-y-4 border-t border-[var(--line)] pt-5 text-sm">
                <div className="flex gap-2">
                  <CalendarDays className="mt-0.5 shrink-0 text-[var(--muted)]" size={16} />
                  <div>
                    <p className="text-[var(--muted)]">Начало</p>
                    <p className="mt-1 font-semibold">{formatContestDate(contest.startAt)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <UsersRound className="mt-0.5 shrink-0 text-[var(--muted)]" size={16} />
                  <div>
                    <p className="text-[var(--muted)]">Регистрация до</p>
                    <p className="mt-1 font-semibold">
                      {formatContestDate(contest.registrationClosesAt ?? contest.startAt)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <UsersRound className="mt-0.5 shrink-0 text-[var(--muted)]" size={16} />
                  <div>
                    <p className="text-[var(--muted)]">Участники</p>
                    <p className="mt-1 font-semibold">
                      {contest.registrationCount} зарегистрировано
                    </p>
                  </div>
                </div>
                {contest.organization && (
                  <div className="flex gap-2">
                    <Building2 className="mt-0.5 shrink-0 text-[var(--muted)]" size={16} />
                    <div>
                      <p className="text-[var(--muted)]">Организация</p>
                      <p className="mt-1 font-semibold">{contest.organization.name}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {(isContestRegistrationOpen(contest) || contest.isRegistered) && (
              <RegisterContestButton
                contestId={contest.id}
                initialError={registrationError}
                initialRegistered={contest.isRegistered}
                isAuthenticated={Boolean(viewer)}
              />
            )}

            <div className="rounded-2xl bg-[var(--strong)] p-5 text-white">
              <FileText size={19} />
              <h2 className="mt-4 font-display text-xl font-semibold">Правила</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/65">
                {contest.rules ||
                  "Полное доказательство и итоговый ответ. Частичные баллы учитываются."}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
