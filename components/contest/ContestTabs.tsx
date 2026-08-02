import Link from "next/link";

export function ContestTabs({
  active,
  contestId
}: {
  active: "problems" | "standings" | "submissions";
  contestId: string;
}) {
  const tabClass = "whitespace-nowrap border-b-2 px-4 py-3 text-sm transition";

  return (
    <nav
      aria-label="Разделы контеста"
      className="flex gap-1 overflow-x-auto border-b border-[var(--line)]"
    >
      <Link
        className={`${tabClass} ${
          active === "problems"
            ? "border-[var(--accent)] font-semibold text-[var(--ink)]"
            : "border-transparent font-medium text-[var(--muted)] hover:text-[var(--ink)]"
        }`}
        href={`/contests/${contestId}`}
      >
        Задачи
      </Link>
      <Link
        className={`${tabClass} ${
          active === "standings"
            ? "border-[var(--accent)] font-semibold text-[var(--ink)]"
            : "border-transparent font-medium text-[var(--muted)] hover:text-[var(--ink)]"
        }`}
        href={`/contests/${contestId}/standings`}
      >
        Результаты
      </Link>
      <Link
        className={`${tabClass} ${
          active === "submissions"
            ? "border-[var(--accent)] font-semibold text-[var(--ink)]"
            : "border-transparent font-medium text-[var(--muted)] hover:text-[var(--ink)]"
        }`}
        href={`/contests/${contestId}/submissions`}
      >
        Посылки
      </Link>
    </nav>
  );
}
