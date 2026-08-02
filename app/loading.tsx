export default function Loading() {
  return (
    <section
      aria-label="Загрузка страницы"
      aria-live="polite"
      className="page-shell page-section animate-pulse"
    >
      <span className="sr-only">Загружаем страницу…</span>
      <div className="h-4 w-28 rounded-full bg-[var(--line)]" />
      <div className="mt-5 h-12 max-w-xl rounded-2xl bg-[var(--line)]" />
      <div className="mt-3 h-5 max-w-2xl rounded-full bg-[var(--line)]" />
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div className="card min-h-52 p-6" key={item}>
            <div className="size-11 rounded-xl bg-[var(--line)]" />
            <div className="mt-12 h-6 w-2/3 rounded-full bg-[var(--line)]" />
            <div className="mt-4 h-4 rounded-full bg-[var(--line)]" />
            <div className="mt-2 h-4 w-4/5 rounded-full bg-[var(--line)]" />
          </div>
        ))}
      </div>
    </section>
  );
}
