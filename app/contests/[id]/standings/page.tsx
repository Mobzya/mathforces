import type { Metadata } from "next";
import { ArrowLeft, Info } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContestTabs } from "@/components/contest/ContestTabs";
import { StandingsTable } from "@/components/standings/StandingsTable";
import { getCurrentUser } from "@/server/auth/session";
import { findContest } from "@/server/contests/queries";
import { getContestStandings } from "@/server/standings/queries";
import { isUuid } from "@/server/validation/primitives";
import { listFriendIds } from "@/server/friends/queries";

export const metadata: Metadata = {
  title: "Результаты"
};

export const dynamic = "force-dynamic";

export default async function ContestStandingsPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) {
    notFound();
  }

  const viewer = await getCurrentUser();
  const [contest, standings] = await Promise.all([
    findContest(id, viewer),
    getContestStandings(id, viewer)
  ]);
  if (!contest || !standings) {
    notFound();
  }
  const friendIds = viewer ? await listFriendIds(viewer.id) : [];

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

        <div className="mt-7">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--accent)]">
            {contest.title}
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em]">
            {contest.status === "ANNOUNCED" ? "Предварительное ранжирование" : "Результаты"}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            {contest.status === "ANNOUNCED"
              ? "Участники расположены по текущему рейтингу. При запуске контеста этот посев и стартовые рейтинги будут зафиксированы."
              : "Таблица обновляется без перезагрузки при появлении посылок и изменении оценок."}
          </p>
        </div>

        <div className="mt-7">
          <ContestTabs active="standings" contestId={contest.id} />
        </div>

        <div className="mt-5 flex gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <Info className="mt-0.5 shrink-0" size={17} />
          <p>
            {contest.status === "ANNOUNCED"
              ? "Ожидаемое место рассчитывается вероятностно относительно рейтингов всех зарегистрированных игроков."
              : contest.status === "RUNNING" && !contest.showStandingsDuringContest
                ? "До финиша организатор показывает каждому участнику только его строку. Полная таблица откроется после завершения."
                : "В сумму входит утверждённый финальный балл, а до него — предварительный. Повторная отправка сразу заменяет предыдущую по той же задаче."}
          </p>
        </div>

        <div className="mt-6">
          <StandingsTable
            canAdminister={viewer?.role === "ADMIN"}
            friendIds={friendIds}
            initialStandings={standings}
          />
        </div>
      </div>
    </section>
  );
}
