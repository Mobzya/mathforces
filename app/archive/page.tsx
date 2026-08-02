import type { Metadata } from "next";
import { CheckCircle2, Search, Star, UsersRound } from "lucide-react";
import Link from "next/link";
import { ArchiveWheel } from "@/components/archive/ArchiveWheel";
import { ARCHIVE_AREA_BY_KEY, ARCHIVE_AREAS } from "@/lib/archive/taxonomy";
import { problemTopicLabels } from "@/lib/contests/presentation";
import { getCurrentUser } from "@/server/auth/session";
import { listArchiveProblems, listArchiveWheelProblems } from "@/server/archive/queries";
import type { ProblemTopicValue } from "@/types/contest";

export const metadata: Metadata = { title: "Архив задач" };
export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

export default async function ArchivePage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const topicValue = first(params.topic) as ProblemTopicValue;
  const topic = ARCHIVE_AREAS.some((area) => area.key === topicValue) ? topicValue : null;
  const sortValue = first(params.sort);
  const sort =
    (["featured", "rating", "solved", "newest"] as const).find((value) => value === sortValue) ??
    "featured";
  const minRating = Number(first(params.minRating));
  const maxRating = Number(first(params.maxRating));
  const viewer = await getCurrentUser();
  const [result, allWheelProblems] = await Promise.all([
    listArchiveProblems({
      maxRating: Number.isFinite(maxRating) && maxRating > 0 ? Math.min(3000, maxRating) : null,
      minRating:
        Number.isFinite(minRating) && minRating >= 0 && first(params.minRating)
          ? Math.min(3000, minRating)
          : null,
      page: Number(first(params.page)) || 1,
      query: first(params.q),
      sort,
      subtopic: first(params.subtopic) || null,
      topic,
      viewerId: viewer?.id
    }),
    listArchiveWheelProblems()
  ]);

  return (
    <section className="page-section overflow-hidden">
      <div className="page-shell">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
            Архив Mathforces
          </p>
          <h1 className="mt-4 font-display text-5xl font-semibold tracking-[-0.05em] sm:text-6xl">
            Карта математики
          </h1>
          <p className="mt-5 text-lg leading-8 text-[var(--muted)]">
            Задачи завершённых контестов, связанные в единую карту. Сложность пересчитывается по
            реальным результатам.
          </p>
        </div>

        <div className="mt-10 rounded-[2rem] border border-[var(--line)] bg-[color-mix(in_srgb,var(--surface)_82%,transparent)] p-4 shadow-[var(--shadow-card)] sm:p-8">
          <ArchiveWheel
            problems={allWheelProblems}
            selectedSubtopic={first(params.subtopic) || null}
            selectedTopic={topic}
          />
        </div>

        <div className="scroll-mt-24 pt-16" id="archive-list">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                {result.pagination.total} задач
              </p>
              <h2 className="mt-2 font-display text-3xl font-semibold">
                {topic ? ARCHIVE_AREA_BY_KEY[topic].label : "Весь архив"}
              </h2>
            </div>
          </div>

          <form
            className="card mt-6 grid gap-3 p-4 md:grid-cols-[minmax(12rem,1fr)_repeat(3,auto)]"
            method="get"
          >
            {topic && <input name="topic" type="hidden" value={topic} />}
            {first(params.subtopic) && (
              <input name="subtopic" type="hidden" value={first(params.subtopic)} />
            )}
            <label className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                size={17}
              />
              <input
                className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] pl-10 pr-3"
                defaultValue={first(params.q)}
                name="q"
                placeholder="Название, подтема, контест"
              />
            </label>
            <input
              aria-label="Рейтинг от"
              className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 md:w-28"
              defaultValue={first(params.minRating)}
              max="3000"
              min="0"
              name="minRating"
              placeholder="От"
              step="10"
              type="number"
            />
            <input
              aria-label="Рейтинг до"
              className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 md:w-28"
              defaultValue={first(params.maxRating)}
              max="3000"
              min="0"
              name="maxRating"
              placeholder="До"
              step="10"
              type="number"
            />
            <select
              className="min-h-11 rounded-xl border border-[var(--line)] bg-[var(--background)] px-3"
              defaultValue={sort}
              name="sort"
            >
              <option value="featured">По звёздам</option>
              <option value="rating">По рейтингу</option>
              <option value="solved">По решениям</option>
              <option value="newest">Сначала новые</option>
            </select>
            <button
              className="button-primary min-h-11 rounded-xl px-5 text-sm font-bold md:col-start-4"
              type="submit"
            >
              Применить
            </button>
          </form>

          <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
            {result.problems.length === 0 ? (
              <div className="p-12 text-center text-[var(--muted)]">
                По этим фильтрам задач пока нет.
              </div>
            ) : (
              result.problems.map((problem) => (
                <Link
                  className="group grid gap-3 border-b border-[var(--line)] p-4 transition last:border-b-0 hover:bg-[var(--surface-muted)] sm:grid-cols-[5rem_minmax(0,1fr)_7rem_8rem] sm:items-center"
                  href={`/archive/${problem.id}`}
                  key={problem.id}
                >
                  <div className="truncate font-mono text-xs font-bold text-[var(--muted)]">
                    {problem.number}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {problem.isSolved && (
                        <CheckCircle2 className="shrink-0 text-emerald-500" size={17} />
                      )}
                      <p className="truncate font-semibold group-hover:text-[var(--accent)]">
                        {problem.title}
                      </p>
                      {problem.isStarred && (
                        <Star className="shrink-0 text-amber-500" fill="currentColor" size={14} />
                      )}
                    </div>
                    <p className="mt-1 truncate text-xs text-[var(--muted)]">
                      {problemTopicLabels[problem.topic]}
                      {problem.subtopic ? ` · ${problem.subtopic}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-[var(--muted)]">
                    <UsersRound size={15} /> {problem.fullSolverCount}{" "}
                    <span className="sm:hidden">на 90+</span>
                  </div>
                  <div className="sm:text-right">
                    <p className="font-mono text-base font-bold">
                      {problem.difficultyRating ?? "—"}
                    </p>
                    <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                      рейтинг
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>

          {result.pagination.totalPages > 1 && (
            <div className="mt-6 flex justify-center gap-2">
              {Array.from({ length: result.pagination.totalPages }, (_, index) => index + 1)
                .slice(0, 12)
                .map((page) => {
                  const query = new URLSearchParams();
                  for (const [key, value] of Object.entries(params))
                    if (typeof value === "string") query.set(key, value);
                  query.set("page", String(page));
                  return (
                    <Link
                      className={`grid size-10 place-items-center rounded-xl border text-sm font-bold ${page === result.pagination.page ? "border-[var(--strong)] bg-[var(--strong)] text-white" : "border-[var(--line)] bg-[var(--surface)]"}`}
                      href={`/archive?${query}`}
                      key={page}
                    >
                      {page}
                    </Link>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
