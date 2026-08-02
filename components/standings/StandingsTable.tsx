"use client";

import { CircleAlert, Clock3, LoaderCircle, Radio, Save, Timer, Trophy, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { readApiError } from "@/components/auth/form-utils";
import { Badge } from "@/components/ui/Badge";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { shouldReduceMotion } from "@/lib/preferences";
import { formatSubmissionTime, submissionStatusMeta } from "@/lib/submissions/presentation";
import type { ContestStandings, StandingCell, StandingRow } from "@/types/standing";

type LiveStatus = "connecting" | "live" | "offline";

export function StandingsTable({
  canAdminister,
  friendIds = [],
  initialStandings
}: {
  canAdminister: boolean;
  initialStandings: ContestStandings;
  friendIds?: string[];
}) {
  const [standings, setStandings] = useState<ContestStandings>(initialStandings);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>("connecting");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [friendsOnly, setFriendsOnly] = useState(false);
  const standingsRef = useRef(initialStandings);
  const rowElements = useRef(new Map<string, HTMLElement>());
  const previousPositions = useRef(new Map<string, DOMRect>());
  const previousScores = useRef(new Map<string, number>());
  const selectedRow = standings.rows.find((row) => row.user.id === selectedUserId) ?? null;
  const friendSet = new Set(friendIds);
  const visibleStandings = friendsOnly
    ? {
        ...standings,
        rows: standings.rows.filter((row) => row.isOwn || friendSet.has(row.user.id))
      }
    : standings;

  const applyStandings = useCallback((next: ContestStandings) => {
    previousPositions.current = new Map(
      [...rowElements.current].map(([key, element]) => [key, element.getBoundingClientRect()])
    );
    previousScores.current = new Map(
      standingsRef.current.rows.map((row) => [row.user.id, row.totalScore])
    );
    standingsRef.current = next;
    setStandings(next);
  }, []);

  useLayoutEffect(() => {
    const reduceMotion = shouldReduceMotion();
    if (reduceMotion) {
      previousPositions.current.clear();
      previousScores.current.clear();
      return;
    }

    for (const [key, element] of rowElements.current) {
      const previous = previousPositions.current.get(key);
      const current = element.getBoundingClientRect();
      if (previous) {
        const deltaY = previous.top - current.top;
        if (Math.abs(deltaY) > 1) {
          element.animate(
            [
              { transform: `translateY(${deltaY}px)`, zIndex: 2 },
              { transform: "translateY(0)", zIndex: 2 }
            ],
            { duration: 650, easing: "cubic-bezier(.2,.8,.2,1)" }
          );
        }
      }
      const userId = key.slice(key.indexOf(":") + 1);
      const oldScore = previousScores.current.get(userId);
      const newScore = standings.rows.find((row) => row.user.id === userId)?.totalScore;
      if (oldScore !== undefined && newScore !== undefined && oldScore !== newScore) {
        element.animate(
          [
            {
              backgroundColor:
                newScore > oldScore ? "rgba(16, 185, 129, 0.14)" : "rgba(198, 62, 70, 0.12)"
            },
            { backgroundColor: "transparent" }
          ],
          { duration: 1_100, easing: "ease-out" }
        );
      }
    }
    previousPositions.current.clear();
    previousScores.current.clear();
  }, [standings]);

  useEffect(() => {
    let source: EventSource | null = null;

    const connect = () => {
      if (source || document.visibilityState === "hidden") return;
      source = new EventSource(`/api/contests/${initialStandings.contestId}/standings/stream`);
      source.addEventListener("open", () => setLiveStatus("live"));
      source.addEventListener("standings", (event) => {
        const message = event as MessageEvent<string>;
        try {
          applyStandings(JSON.parse(message.data) as ContestStandings);
          setLiveStatus("live");
        } catch {
          setLiveStatus("offline");
        }
      });
      source.addEventListener("warning", () => setLiveStatus("offline"));
      source.addEventListener("error", () => setLiveStatus("offline"));
    };
    const disconnect = () => {
      source?.close();
      source = null;
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") disconnect();
      else {
        setLiveStatus("connecting");
        connect();
      }
    };

    connect();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [applyStandings, initialStandings.contestId]);

  async function refreshOnce() {
    const response = await fetch(`/api/contests/${standings.contestId}/standings`, {
      cache: "no-store",
      credentials: "same-origin"
    });
    if (!response.ok) return;
    const payload = (await response.json()) as {
      standings: ContestStandings;
    };
    applyStandings(payload.standings);
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--muted)]">
          Учитывается последняя посылка по каждой задаче.
        </p>
        <div className="flex items-center gap-2">
          {friendIds.length > 0 && (
            <button
              className={`min-h-9 rounded-full border px-3 text-xs font-bold transition ${friendsOnly ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]"}`}
              onClick={() => setFriendsOnly((value) => !value)}
              type="button"
            >
              🟢 {friendsOnly ? "Только друзья" : "Показать друзей"}
            </button>
          )}
          <LiveIndicator status={liveStatus} />
        </div>
      </div>

      {standings.status !== "ANNOUNCED" && <ContestScoreOverview standings={standings} />}

      {standings.status === "ANNOUNCED" ? (
        <PreContestRanking standings={visibleStandings} />
      ) : visibleStandings.rows.length === 0 ? (
        <div className="card grid min-h-64 place-items-center p-8 text-center">
          <div>
            <Trophy className="mx-auto text-[var(--line-strong)]" size={38} strokeWidth={1.5} />
            <h2 className="mt-4 font-display text-2xl font-semibold">Таблица пока пуста</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
              Зарегистрированные участники и их результаты появятся здесь автоматически.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {visibleStandings.rows.map((row) => (
              <button
                className={`card w-full p-4 text-left ${
                  row.isOwn ? "border-red-200 bg-red-50/30" : ""
                }`}
                key={row.user.id}
                onClick={() => setSelectedUserId(row.user.id)}
                ref={(element) => {
                  const key = `mobile:${row.user.id}`;
                  if (element) rowElements.current.set(key, element);
                  else rowElements.current.delete(key);
                }}
                type="button"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] font-display text-lg font-bold">
                      <AnimatedNumber value={row.place} />
                    </span>
                    <div className="min-w-0">
                      <p
                        className="truncate font-mono text-sm font-bold"
                        style={{ color: row.user.rankColor }}
                      >
                        {row.user.nickname}
                        {row.isOwn && (
                          <span className="ml-2 text-[10px] text-[var(--accent)]">вы</span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--muted)]">{row.user.rankTitle}</p>
                      {row.preContest && (
                        <p className="mt-1 text-[11px] text-[var(--muted)]">
                          Посев №{row.preContest.seedPlace} · ожидание{" "}
                          {formatExpectedPlace(row.preContest.expectedPlace)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-3xl font-semibold">
                      <AnimatedNumber value={row.totalScore} />
                    </p>
                    <p className="text-[10px] text-[var(--muted)]">
                      из {standings.scoring.maxScore}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-5 gap-1.5">
                  {row.cells.map((cell, index) => (
                    <div
                      className="rounded-lg bg-[var(--surface-muted)] px-1 py-2 text-center"
                      key={cell.problemId}
                    >
                      <p className="text-[10px] font-bold text-[var(--muted)]">
                        {standings.problems[index]?.label}
                      </p>
                      <ScoreValue
                        cell={cell}
                        fallbackMax={standings.problems[index]?.currentMaxScore ?? 0}
                      />
                    </div>
                  ))}
                </div>
              </button>
            ))}
          </div>

          <div className="card hidden overflow-x-auto md:block">
            <table className="w-full min-w-[46rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--surface-muted)] text-left text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
                  <th className="w-16 px-4 py-3 text-center">Место</th>
                  <th className="min-w-48 px-4 py-3">Участник</th>
                  {standings.problems.map((problem) => (
                    <th
                      className="min-w-20 px-3 py-3 text-center"
                      key={problem.id}
                      title={`${problem.title} · ${problem.maxScore} баллов`}
                    >
                      {problem.label}
                    </th>
                  ))}
                  <th className="min-w-24 px-4 py-3 text-right">Сумма</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {visibleStandings.rows.map((row) => (
                  <tr
                    className={
                      row.isOwn ? "bg-red-50/50" : "transition hover:bg-[var(--surface-muted)]/60"
                    }
                    key={row.user.id}
                    ref={(element) => {
                      const key = `desktop:${row.user.id}`;
                      if (element) rowElements.current.set(key, element);
                      else rowElements.current.delete(key);
                    }}
                  >
                    <td className="px-4 py-4 text-center font-display text-lg font-bold">
                      <AnimatedNumber value={row.place} />
                    </td>
                    <td className="px-4 py-4">
                      <button
                        className="text-left"
                        onClick={() => setSelectedUserId(row.user.id)}
                        type="button"
                      >
                        <span
                          className="font-mono font-bold hover:underline"
                          style={{ color: row.user.rankColor }}
                        >
                          {row.user.nickname}
                        </span>
                        {row.isOwn && (
                          <span className="ml-2 text-[10px] font-bold uppercase text-[var(--accent)]">
                            вы
                          </span>
                        )}
                        <span className="mt-0.5 block text-xs text-[var(--muted)]">
                          {row.user.rankTitle}
                        </span>
                        {row.preContest && (
                          <span className="mt-1 block text-[11px] text-[var(--muted)]">
                            Посев №{row.preContest.seedPlace} · ожидание{" "}
                            {formatExpectedPlace(row.preContest.expectedPlace)}
                          </span>
                        )}
                      </button>
                    </td>
                    {row.cells.map((cell) => (
                      <td className="px-3 py-4 text-center" key={cell.problemId}>
                        <button
                          className={`min-w-10 rounded-lg px-2 py-1.5 font-mono font-bold transition hover:bg-white ${
                            cell.finalScore !== null
                              ? "text-emerald-700"
                              : cell.preliminaryScore !== null
                                ? "text-blue-700"
                                : "text-[var(--muted)]"
                          }`}
                          onClick={() => setSelectedUserId(row.user.id)}
                          title={scoreChangeTitle(cell)}
                          type="button"
                        >
                          <span>
                            {cell.score === null ? "—" : <AnimatedNumber value={cell.score} />}
                          </span>
                          {cell.scoreDelta !== null && cell.scoreDelta !== 0 && (
                            <span
                              className={`ml-1 text-[10px] ${
                                cell.scoreDelta > 0 ? "text-emerald-700" : "text-red-700"
                              }`}
                            >
                              {formatScoreDelta(cell.scoreDelta)}
                            </span>
                          )}
                          <span className="mt-0.5 block text-[9px] font-normal text-[var(--muted)]">
                            /{" "}
                            {cell.maxScoreAtSubmission ??
                              standings.problems.find((problem) => problem.id === cell.problemId)
                                ?.currentMaxScore ??
                              "—"}
                          </span>
                        </button>
                      </td>
                    ))}
                    <td className="px-4 py-4 text-right font-display text-2xl font-semibold">
                      <AnimatedNumber value={row.totalScore} />
                      <span className="ml-1 text-xs font-normal text-[var(--muted)]">
                        / {standings.scoring.maxScore}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {selectedRow && (
        <StandingDetails
          canAdminister={canAdminister}
          onClose={() => setSelectedUserId(null)}
          onScoreSaved={refreshOnce}
          problems={standings.problems}
          row={selectedRow}
        />
      )}
    </>
  );
}

function ContestScoreOverview({ standings }: { standings: ContestStandings }) {
  const [now, setNow] = useState(() => {
    const serverOffset = new Date(standings.scoring.serverNow).getTime() - Date.now();
    return Date.now() + serverOffset;
  });

  useEffect(() => {
    const serverOffset = new Date(standings.scoring.serverNow).getTime() - Date.now();
    const interval = window.setInterval(() => setNow(Date.now() + serverOffset), 1_000);
    return () => window.clearInterval(interval);
  }, [standings.scoring.serverNow]);

  const remainingMs = Math.max(0, new Date(standings.scoring.endAt).getTime() - now);
  const finalReview = standings.scoring.finalReview;
  const reviewed = finalReview ? finalReview.completed + finalReview.failed : 0;

  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl bg-[var(--strong)] p-4 text-white">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-white/55">
          Максимум сейчас
        </p>
        <p className="mt-2 font-display text-3xl font-semibold">
          <AnimatedNumber value={standings.scoring.currentMaxScore} />
          <span className="ml-1 text-base font-normal text-white/45">
            / {standings.scoring.maxScore}
          </span>
        </p>
      </div>
      <div className="card p-4">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
          <Timer size={14} />
          {standings.status === "FINISHED" ? "Контест завершён" : "До конца"}
        </p>
        <p className="mt-2 font-mono text-2xl font-bold">
          {standings.status === "FINISHED" ? "00:00:00" : formatRemainingTime(remainingMs)}
        </p>
      </div>
      <div className="card p-4">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
          {finalReview ? "Финальная перепроверка" : "Система баллов"}
        </p>
        <p className="mt-2 font-display text-2xl font-semibold">
          {finalReview
            ? `${reviewed} / ${finalReview.queued}`
            : `${standings.problems.length} задач`}
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          {finalReview
            ? finalReview.status === "COMPLETED"
              ? "Все последние посылки проверены"
              : finalReview.status === "NEEDS_REVIEW"
                ? "Спорные решения ожидают подтверждения администратора"
                : finalReview.status === "FAILED"
                  ? `Ошибок: ${finalReview.failed}`
                  : "Результаты обновляются автоматически"
            : "Стоимость уменьшается каждые 5 минут"}
        </p>
      </div>
    </div>
  );
}

function ScoreValue({ cell, fallbackMax }: { cell: StandingCell; fallbackMax: number }) {
  return (
    <>
      <p className="mt-0.5 font-mono text-sm font-bold" title={scoreChangeTitle(cell)}>
        {cell.score === null ? "—" : <AnimatedNumber value={cell.score} />}
        {cell.scoreDelta !== null && cell.scoreDelta !== 0 && (
          <span
            className={`ml-1 text-[9px] ${
              cell.scoreDelta > 0 ? "text-emerald-700" : "text-red-700"
            }`}
          >
            {formatScoreDelta(cell.scoreDelta)}
          </span>
        )}
      </p>
      <p className="mt-0.5 text-[9px] text-[var(--muted)]">
        / {cell.maxScoreAtSubmission ?? fallbackMax}
      </p>
    </>
  );
}

function scoreChangeTitle(cell: StandingCell) {
  if (cell.preliminaryScore === null || cell.finalScore === null) {
    return undefined;
  }
  return `Предварительно ${cell.preliminaryScore}, финально ${cell.finalScore}, изменение ${formatScoreDelta(
    cell.finalScore - cell.preliminaryScore
  )}`;
}

function formatScoreDelta(delta: number) {
  return delta > 0 ? `+${delta}` : String(delta);
}

function formatRemainingTime(milliseconds: number) {
  const totalSeconds = Math.floor(milliseconds / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function PreContestRanking({ standings }: { standings: ContestStandings }) {
  if (standings.rows.length === 0) {
    return (
      <div className="card grid min-h-64 place-items-center p-8 text-center">
        <div>
          <Trophy className="mx-auto text-[var(--line-strong)]" size={38} strokeWidth={1.5} />
          <h2 className="mt-4 font-display text-2xl font-semibold">
            Пока никто не зарегистрирован
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Предварительный посев появится после первой регистрации.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[38rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--line)] bg-[var(--surface-muted)] text-left text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
              <th className="w-24 px-4 py-3 text-center">Посев</th>
              <th className="min-w-48 px-4 py-3">Участник</th>
              <th className="px-4 py-3 text-center">Рейтинг сейчас</th>
              <th className="px-4 py-3 text-right">Ожидаемое место</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {standings.rows.map((row) => (
              <tr
                className={
                  row.isOwn ? "bg-red-50/50" : "transition hover:bg-[var(--surface-muted)]/60"
                }
                key={row.user.id}
              >
                <td className="px-4 py-4 text-center font-display text-xl font-bold">
                  {row.preContest?.seedPlace ?? "—"}
                </td>
                <td className="px-4 py-4">
                  <Link
                    className="font-mono font-bold hover:underline"
                    href={`/profile/${row.user.id}`}
                    style={{ color: row.user.rankColor }}
                  >
                    {row.user.nickname}
                  </Link>
                  {row.isOwn && (
                    <span className="ml-2 text-[10px] font-bold uppercase text-[var(--accent)]">
                      вы
                    </span>
                  )}
                  <span className="mt-0.5 block text-xs text-[var(--muted)]">
                    {row.user.rankTitle}
                  </span>
                </td>
                <td className="px-4 py-4 text-center font-mono font-bold">
                  {row.preContest && row.preContest.ratingAtStart > 0
                    ? row.preContest.ratingAtStart
                    : "—"}
                </td>
                <td className="px-4 py-4 text-right font-display text-xl font-semibold">
                  {row.preContest ? formatExpectedPlace(row.preContest.expectedPlace) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-[var(--line)] bg-[var(--surface-muted)] px-5 py-3 text-xs leading-5 text-[var(--muted)]">
        До запуска список динамический. В момент старта рейтинг, посев, ожидаемое место,
        длительность и максимальный балл фиксируются.
      </div>
    </div>
  );
}

function formatExpectedPlace(place: number) {
  return place.toLocaleString("ru-RU", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1
  });
}

function LiveIndicator({ status }: { status: LiveStatus }) {
  const label =
    status === "live" ? "Live" : status === "connecting" ? "Подключаемся…" : "Переподключаемся…";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
        status === "live" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
      }`}
    >
      <Radio className={status === "connecting" ? "animate-pulse" : ""} size={13} />
      {label}
    </span>
  );
}

function StandingDetails({
  canAdminister,
  onClose,
  onScoreSaved,
  problems,
  row
}: {
  canAdminister: boolean;
  onClose: () => void;
  onScoreSaved: () => Promise<void>;
  problems: ContestStandings["problems"];
  row: StandingRow;
}) {
  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto bg-[var(--strong)]/45 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
    >
      <button
        aria-label="Закрыть подробности"
        className="fixed inset-0 cursor-default"
        onClick={onClose}
        type="button"
      />
      <div className="relative mx-auto my-4 w-full max-w-3xl overflow-hidden rounded-2xl bg-[var(--background)] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--line)] bg-white px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
              Место {row.place} · {row.totalScore} баллов
            </p>
            <Link
              className="mt-1 block font-mono text-xl font-bold hover:underline"
              href={`/profile/${row.user.id}`}
              style={{ color: row.user.rankColor }}
            >
              {row.user.nickname}
            </Link>
          </div>
          <button
            className="grid size-10 place-items-center rounded-xl border border-[var(--line)] bg-white"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-4 sm:p-6">
          {row.cells.map((cell, index) => (
            <ProblemResultCard
              canAdminister={canAdminister}
              cell={cell}
              key={cell.problemId}
              onScoreSaved={onScoreSaved}
              problem={problems[index]}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ProblemResultCard({
  canAdminister,
  cell,
  onScoreSaved,
  problem
}: {
  canAdminister: boolean;
  cell: StandingCell;
  onScoreSaved: () => Promise<void>;
  problem: ContestStandings["problems"][number] | undefined;
}) {
  const status = cell.status ? submissionStatusMeta[cell.status] : null;

  return (
    <article className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-white px-4 py-3 sm:px-5">
        <div>
          <p className="font-display text-lg font-semibold">
            {problem?.label}. {problem?.title}
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Получено: {cell.score ?? "—"} /{" "}
            {cell.maxScoreAtSubmission ?? problem?.currentMaxScore ?? "—"} · абсолютный максимум:{" "}
            {problem?.maxScore ?? "—"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {status && <Badge tone={status.tone}>{status.label}</Badge>}
          <span className="font-display text-2xl font-semibold">
            {cell.score ?? "—"}
            {cell.scoreDelta !== null && cell.scoreDelta !== 0 && (
              <span
                className={`ml-2 text-sm ${
                  cell.scoreDelta > 0 ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {formatScoreDelta(cell.scoreDelta)}
              </span>
            )}
          </span>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {cell.submissionId ? (
          <>
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <ScoreMeta label="Предварительно" value={cell.preliminaryScore} />
              <ScoreMeta label="Финально" value={cell.finalScore} />
              <ScoreMeta
                label="Отправлено"
                value={cell.submittedAt ? formatSubmissionTime(cell.submittedAt) : null}
              />
            </div>

            {(cell.aiComment || cell.adminComment) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {cell.aiComment && (
                  <CommentBox label="Комментарий проверки" text={cell.aiComment} />
                )}
                {cell.adminComment && (
                  <CommentBox label="Комментарий администратора" text={cell.adminComment} />
                )}
              </div>
            )}

            {cell.history.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
                  История
                </p>
                <div className="mt-2 space-y-2">
                  {cell.history.map((entry, index) => (
                    <div
                      className="flex gap-3 rounded-xl bg-[var(--surface-muted)] px-3 py-2 text-xs"
                      key={`${entry.createdAt}-${index}`}
                    >
                      <Clock3 className="mt-0.5 shrink-0 text-[var(--muted)]" size={13} />
                      <div>
                        <p>{entry.body}</p>
                        <time className="mt-1 block text-[var(--muted)]">
                          {formatSubmissionTime(entry.createdAt)}
                        </time>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {canAdminister && problem && (
              <AdminScoreEditor
                cell={cell}
                maxScore={cell.maxScoreAtSubmission ?? problem.maxScore}
                onSaved={onScoreSaved}
              />
            )}
          </>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            Участник ещё не отправлял решение этой задачи.
          </p>
        )}
      </div>
    </article>
  );
}

function AdminScoreEditor({
  cell,
  maxScore,
  onSaved
}: {
  cell: StandingCell;
  maxScore: number;
  onSaved: () => Promise<void>;
}) {
  const [score, setScore] = useState(String(cell.finalScore ?? cell.score ?? 0));
  const [comment, setComment] = useState(cell.adminComment);
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cell.submissionId) return;

    const numericScore = Number(score);
    if (!Number.isInteger(numericScore) || numericScore < 0 || numericScore > maxScore) {
      setMessage(`Введите целый балл от 0 до ${maxScore}`);
      return;
    }

    setIsPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/standings/${cell.submissionId}`, {
        body: JSON.stringify({
          adminComment: comment,
          finalScore: numericScore,
          status: "FINALIZED"
        }),
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json"
        },
        method: "PATCH"
      });
      if (!response.ok) {
        const error = await readApiError(response);
        setMessage(error.message);
        return;
      }
      setMessage("Итоговый балл сохранён");
      await onSaved();
    } catch {
      setMessage("Нет связи с сервером");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form className="rounded-xl border border-amber-200 bg-amber-50 p-4" onSubmit={handleSubmit}>
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-amber-800">
        Коррекция администратора
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[8rem_1fr_auto] sm:items-end">
        <label className="form-label">
          Итоговый балл
          <input
            className="field"
            max={maxScore}
            min={0}
            onChange={(event) => setScore(event.target.value)}
            required
            type="number"
            value={score}
          />
        </label>
        <label className="form-label">
          Комментарий
          <input
            className="field"
            maxLength={2_000}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Причина изменения"
            value={comment}
          />
        </label>
        <button
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-900 px-4 text-sm font-semibold text-white disabled:opacity-60"
          disabled={isPending}
          type="submit"
        >
          {isPending ? <LoaderCircle className="animate-spin" size={16} /> : <Save size={16} />}
          Сохранить
        </button>
      </div>
      {message && (
        <p
          className={`mt-2 flex items-center gap-2 text-xs ${
            message === "Итоговый балл сохранён" ? "text-emerald-700" : "text-red-700"
          }`}
        >
          {message !== "Итоговый балл сохранён" && <CircleAlert size={13} />}
          {message}
        </p>
      )}
    </form>
  );
}

function ScoreMeta({ label, value }: { label: string; value: number | string | null }) {
  return (
    <div className="rounded-xl bg-[var(--surface-muted)] px-3 py-2">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-1 font-mono font-bold">{value ?? "—"}</p>
    </div>
  );
}

function CommentBox({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-white p-3">
      <p className="text-xs font-bold text-[var(--muted)]">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{text}</p>
    </div>
  );
}
