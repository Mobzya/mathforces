"use client";

import { Clock3, TrendingDown } from "lucide-react";
import { useEffect, useState } from "react";

type ScoringProblem = {
  baseScore: number;
  maxScore: number;
  scoreDecayPer5Min: number;
};

export function ContestScoringOverview({
  endAt,
  problems,
  serverNow,
  startAt,
  status
}: {
  endAt: string;
  problems: ScoringProblem[];
  serverNow: string;
  startAt: string;
  status: "ANNOUNCED" | "RUNNING" | "FINISHED";
}) {
  const [now, setNow] = useState(() => new Date(serverNow).getTime());

  useEffect(() => {
    const offset = new Date(serverNow).getTime() - Date.now();
    const interval = window.setInterval(() => setNow(Date.now() + offset), 1_000);
    return () => window.clearInterval(interval);
  }, [serverNow]);

  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  const scoringAt = Math.min(Math.max(now, start), end);
  const intervals = Math.max(0, Math.floor((scoringAt - start) / (5 * 60_000)));
  const available = problems.reduce(
    (total, problem) =>
      total +
      Math.max(
        0,
        Math.min(problem.maxScore, problem.baseScore - intervals * problem.scoreDecayPer5Min)
      ),
    0
  );
  const maximum = problems.reduce((total, problem) => total + problem.maxScore, 0);
  const remaining = Math.max(0, end - now);

  return (
    <div className="card p-5">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
        <TrendingDown size={15} />
        Баллы контеста
      </p>
      <p className="mt-3 font-display text-3xl font-semibold">
        {available}
        <span className="ml-1 text-base font-normal text-[var(--muted)]">/ {maximum}</span>
      </p>
      <p className="mt-1 text-xs text-[var(--muted)]">максимум, доступный сейчас</p>
      <div className="mt-4 flex items-center gap-2 border-t border-[var(--line)] pt-4">
        <Clock3 className="text-[var(--accent)]" size={17} />
        <div>
          <p className="text-xs text-[var(--muted)]">
            {status === "ANNOUNCED"
              ? "До начала"
              : status === "FINISHED"
                ? "Контест завершён"
                : "До конца"}
          </p>
          <p className="mt-0.5 font-mono font-bold">
            {status === "FINISHED"
              ? "00:00:00"
              : formatDuration(status === "ANNOUNCED" ? Math.max(0, start - now) : remaining)}
          </p>
        </div>
      </div>
    </div>
  );
}

function formatDuration(milliseconds: number) {
  const totalSeconds = Math.floor(milliseconds / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}
