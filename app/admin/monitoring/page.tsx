import type { Metadata } from "next";
import { Activity, Clock3, Database, HardDrive, ListChecks } from "lucide-react";
import { prisma } from "@/server/db/client";
import { getSystemMetrics } from "@/server/monitoring/metrics";

export const metadata: Metadata = { title: "Мониторинг" };
export const dynamic = "force-dynamic";

export default async function MonitoringPage() {
  const [metrics, failedJobs] = await Promise.all([
    getSystemMetrics(),
    prisma.evaluationJob.findMany({
      include: {
        submission: {
          select: {
            contestId: true,
            id: true,
            problem: { select: { orderIndex: true } },
            user: { select: { nickname: true } }
          }
        }
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
      where: { status: "FAILED" }
    })
  ]);
  const queued = Number(metrics.queue.QUEUED ?? 0);
  const processing = Number(metrics.queue.PROCESSING ?? 0);

  return (
    <section className="page-section">
      <div className="page-shell">
        <h1 className="font-display text-4xl font-semibold">Мониторинг</h1>
        <p className="mt-2 text-[var(--muted)]">
          Очереди проверки, задержки и готовность инфраструктуры.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard icon={ListChecks} label="В очереди" value={queued} />
          <MetricCard icon={Activity} label="Обрабатывается" value={processing} />
          <MetricCard
            icon={Clock3}
            label="Возраст очереди"
            value={`${metrics.oldestQueuedAgeSeconds} с`}
          />
          <MetricCard
            icon={HardDrive}
            label="Хранилище"
            value={metrics.storage.status === "up" ? "Работает" : "Ошибка"}
          />
        </div>

        <div className="card mt-5 p-5">
          <div className="flex items-center gap-3">
            <Database size={20} />
            <div>
              <p className="font-semibold">PostgreSQL</p>
              <p className="text-sm text-[var(--muted)]">
                Ответ мониторинга за {metrics.databaseLatencyMs} мс · ручной проверки требуют{" "}
                {metrics.needsReview} посылок · просроченных активных контестов:{" "}
                {metrics.expiredContests} · пропущенных стартов: {metrics.missedStarts}
              </p>
            </div>
          </div>
        </div>

        <div className="card mt-5 overflow-hidden">
          <div className="border-b border-[var(--line)] p-5">
            <h2 className="font-display text-2xl font-semibold">Последние ошибки worker</h2>
          </div>
          {failedJobs.length === 0 ? (
            <p className="p-8 text-center text-sm text-[var(--muted)]">Ошибок в очереди нет.</p>
          ) : (
            <div className="divide-y divide-[var(--line)]">
              {failedJobs.map((job) => (
                <div className="p-5" key={job.id}>
                  <p className="font-semibold">
                    {job.submission.user.nickname} · задача {job.submission.problem.orderIndex}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {job.mode} · попыток {job.attempts}/{job.maxAttempts}
                  </p>
                  <p className="mt-2 break-words text-sm text-red-700">
                    {job.error || "Неизвестная ошибка"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Activity;
  label: string;
  value: number | string;
}) {
  return (
    <div className="card p-5">
      <Icon className="text-[var(--accent)]" size={20} />
      <p className="mt-5 text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold">{value}</p>
    </div>
  );
}
