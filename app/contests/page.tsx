import type { Metadata } from "next";
import { CalendarX2 } from "lucide-react";
import Link from "next/link";
import { ContestCard } from "@/components/contest/ContestCard";
import { Badge } from "@/components/ui/Badge";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getCurrentUser } from "@/server/auth/session";
import { listContests } from "@/server/contests/queries";
import type { ContestStatusValue, ContestSummary } from "@/types/contest";

export const metadata: Metadata = {
  title: "Контесты"
};

export const dynamic = "force-dynamic";

const sections: Array<{
  status: ContestStatusValue;
  title: string;
}> = [
  {
    status: "RUNNING",
    title: "Идут сейчас"
  },
  {
    status: "ANNOUNCED",
    title: "Предстоящие"
  },
  {
    status: "FINISHED",
    title: "Завершённые"
  }
];

export default async function ContestsPage({
  searchParams
}: {
  searchParams: Promise<{
    page?: string | string[];
    query?: string | string[];
    status?: string | string[];
  }>;
}) {
  const requested = await searchParams;
  const query = typeof requested.query === "string" ? requested.query.trim().slice(0, 80) : "";
  const statusValues = new Set(["ANNOUNCED", "RUNNING", "FINISHED"]);
  const status =
    typeof requested.status === "string" && statusValues.has(requested.status)
      ? (requested.status as ContestStatusValue)
      : null;
  const pageValue = typeof requested.page === "string" ? Number(requested.page) : 1;
  const requestedPage = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const viewer = await getCurrentUser();
  const { contests, pagination } = await listContests(viewer, {
    page: requestedPage,
    query,
    status
  });

  return (
    <section className="page-section">
      <div className="page-shell">
        <div className="max-w-2xl">
          <Badge tone="red">Контестный сезон</Badge>
          <h1 className="mt-5 font-display text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
            Выберите следующий тур
          </h1>
          <p className="mt-4 text-lg leading-8 text-[var(--muted)]">
            Пять задач, девяносто минут и полный простор для красивых идей.
          </p>
        </div>

        <form className="card mt-8 grid gap-4 p-4 sm:grid-cols-[1fr_14rem_auto]" method="get">
          <label className="form-label">
            Поиск
            <input
              className="field"
              defaultValue={query}
              name="query"
              placeholder="Название контеста"
            />
          </label>
          <label className="form-label">
            Состояние
            <select className="field" defaultValue={status ?? ""} name="status">
              <option value="">Все</option>
              <option value="RUNNING">Идут сейчас</option>
              <option value="ANNOUNCED">Предстоящие</option>
              <option value="FINISHED">Завершённые</option>
            </select>
          </label>
          <button
            className="min-h-12 self-end rounded-xl bg-[var(--strong)] px-5 text-sm font-semibold text-white"
            type="submit"
          >
            Найти
          </button>
        </form>

        {contests.length === 0 ? (
          <div className="card mt-12 grid min-h-72 place-items-center p-8 text-center">
            <div>
              <CalendarX2
                className="mx-auto text-[var(--line-strong)]"
                size={40}
                strokeWidth={1.4}
              />
              <h2 className="mt-5 font-display text-2xl font-semibold">Контестов пока нет</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
                Первый анонс появится здесь сразу после публикации организатором.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-14 space-y-14">
            {sections.map((section) => {
              const sectionContests = contests.filter(
                (contest) => contest.status === section.status
              );
              if (sectionContests.length === 0) return null;

              return (
                <section key={section.status}>
                  <SectionHeading title={section.title} />
                  <div className="mt-6 grid gap-4">
                    {sortSection(sectionContests, section.status).map((contest) => (
                      <ContestCard contest={contest} key={contest.id} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
        {pagination.totalPages > 1 && (
          <nav
            className="mt-8 flex items-center justify-center gap-3"
            aria-label="Страницы контестов"
          >
            <ContestPageLink
              disabled={pagination.page <= 1}
              label="Назад"
              page={pagination.page - 1}
              query={query}
              status={status}
            />
            <span className="text-sm text-[var(--muted)]">
              {pagination.page} / {pagination.totalPages}
            </span>
            <ContestPageLink
              disabled={pagination.page >= pagination.totalPages}
              label="Дальше"
              page={pagination.page + 1}
              query={query}
              status={status}
            />
          </nav>
        )}
      </div>
    </section>
  );
}

function ContestPageLink({
  disabled,
  label,
  page,
  query,
  status
}: {
  disabled: boolean;
  label: string;
  page: number;
  query: string;
  status: ContestStatusValue | null;
}) {
  const params = new URLSearchParams({ page: String(page) });
  if (query) params.set("query", query);
  if (status) params.set("status", status);
  return disabled ? (
    <span className="rounded-xl border border-[var(--line)] px-4 py-2 text-sm font-semibold opacity-40">
      {label}
    </span>
  ) : (
    <Link
      className="rounded-xl border border-[var(--line-strong)] px-4 py-2 text-sm font-semibold"
      href={`/contests?${params.toString()}`}
    >
      {label}
    </Link>
  );
}

function sortSection(contests: ContestSummary[], status: ContestStatusValue): ContestSummary[] {
  return [...contests].sort((left, right) => {
    const direction = status === "FINISHED" ? -1 : 1;
    return direction * (new Date(left.startAt).getTime() - new Date(right.startAt).getTime());
  });
}
