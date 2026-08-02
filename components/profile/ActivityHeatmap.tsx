import { Flame } from "lucide-react";

type ActivityDay = { count: number; date: string };

export function ActivityHeatmap({
  days,
  solvedCount
}: {
  days: ActivityDay[];
  solvedCount: number;
}) {
  const byDate = new Map(days.map((day) => [day.date, day.count]));
  const today = startOfDay(new Date());
  const start = new Date(today);
  start.setDate(start.getDate() - 370);
  start.setDate(start.getDate() - start.getDay());
  const cells = Array.from({ length: 371 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = localDateKey(date);
    return { count: byDate.get(key) ?? 0, date, key, future: date > today };
  });

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] p-5 sm:p-6">
        <div>
          <h2 className="font-display text-2xl font-semibold">Карта решений</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {solvedCount} {plural(solvedCount, "задача", "задачи", "задач")} засчитано на 90+ баллов
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
          <Flame size={14} />
          Активность за год
        </div>
      </div>
      <div className="overflow-x-auto p-5 sm:p-6">
        <div
          className="grid min-w-[50rem] grid-flow-col grid-rows-7 gap-1.5"
          aria-label="Календарь решённых задач"
        >
          {cells.map((cell) => (
            <span
              aria-label={`${cell.date.toLocaleDateString("ru-RU")}: ${cell.count} решено`}
              className={`aspect-square min-w-3 rounded-[3px] border ${cell.future ? "border-transparent bg-transparent" : heatClass(cell.count)}`}
              key={cell.key}
              title={`${cell.date.toLocaleDateString("ru-RU")}: ${cell.count} решено`}
            />
          ))}
        </div>
        <div className="mt-4 flex items-center justify-end gap-1.5 text-[11px] text-[var(--muted)]">
          <span>Меньше</span>
          {[0, 1, 2, 4].map((count) => (
            <span className={`size-3 rounded-[3px] border ${heatClass(count)}`} key={count} />
          ))}
          <span>Больше</span>
        </div>
      </div>
    </section>
  );
}

function heatClass(count: number) {
  if (count <= 0) return "border-[var(--line)] bg-[var(--surface-muted)]";
  if (count === 1) return "border-emerald-200 bg-emerald-200";
  if (count <= 3) return "border-emerald-400 bg-emerald-400";
  return "border-emerald-700 bg-emerald-700";
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function localDateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function plural(value: number, one: string, few: string, many: string) {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
