"use client";

import { RefreshCw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { formatSubmissionTime, submissionStatusMeta } from "@/lib/submissions/presentation";
import type { PublicSubmission } from "@/types/submission";

export function SubmissionFeed({
  contestId,
  initialNextCursor,
  initialSubmissions
}: {
  contestId: string;
  initialNextCursor: string | null;
  initialSubmissions: PublicSubmission[];
}) {
  const [submissions, setSubmissions] = useState<PublicSubmission[]>(initialSubmissions);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [refreshError, setRefreshError] = useState("");

  useEffect(() => {
    let isActive = true;
    let timeout: number | undefined;
    let controller: AbortController | undefined;

    const schedule = (delay = 15_000) => {
      if (!isActive) return;
      if (timeout) window.clearTimeout(timeout);
      timeout = window.setTimeout(() => void refresh(), delay);
    };

    async function refresh() {
      if (!isActive) return;
      if (document.visibilityState === "hidden") {
        schedule();
        return;
      }
      controller?.abort();
      controller = new AbortController();
      setIsRefreshing(true);
      try {
        const response = await fetch(`/api/contests/${contestId}/submissions`, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal
        });
        if (!response.ok) {
          throw new Error("SUBMISSIONS_FETCH_FAILED");
        }
        const payload = (await response.json()) as {
          nextCursor: string | null;
          submissions: PublicSubmission[];
        };
        if (isActive) {
          setSubmissions((current) => mergeSubmissions(payload.submissions, current));
          setNextCursor((current) => current ?? payload.nextCursor);
          setRefreshError("");
        }
      } catch {
        if (isActive && !controller.signal.aborted) {
          setRefreshError("Автообновление временно недоступно");
        }
      } finally {
        if (isActive) {
          setIsRefreshing(false);
          schedule();
        }
      }
    }

    const handleVisibility = () => {
      if (document.visibilityState === "visible") schedule(250);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    schedule();
    return () => {
      isActive = false;
      controller?.abort();
      if (timeout) window.clearTimeout(timeout);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [contestId]);

  async function loadMore() {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    setRefreshError("");
    try {
      const response = await fetch(
        `/api/contests/${contestId}/submissions?cursor=${encodeURIComponent(nextCursor)}`,
        { cache: "no-store", credentials: "same-origin" }
      );
      if (!response.ok) throw new Error("SUBMISSIONS_FETCH_FAILED");
      const payload = (await response.json()) as {
        nextCursor: string | null;
        submissions: PublicSubmission[];
      };
      setSubmissions((current) => mergeSubmissions(current, payload.submissions));
      setNextCursor(payload.nextCursor);
    } catch {
      setRefreshError("Не удалось загрузить более ранние посылки");
    } finally {
      setIsLoadingMore(false);
    }
  }

  if (submissions.length === 0) {
    return (
      <div className="card grid min-h-64 place-items-center p-8 text-center">
        <div>
          <ShieldCheck className="mx-auto text-[var(--line-strong)]" size={38} strokeWidth={1.5} />
          <h2 className="mt-4 font-display text-2xl font-semibold">Посылок пока нет</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
            Новые отправки появятся здесь автоматически. Фотографии решений останутся приватными.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex min-h-6 items-center justify-end gap-2 text-xs text-[var(--muted)]">
        <RefreshCw className={isRefreshing ? "animate-spin" : ""} size={13} />
        {refreshError || "Лента обновляется без параллельных запросов"}
      </div>

      <div className="card overflow-hidden">
        <div className="hidden grid-cols-[7rem_1fr_1fr_10rem_6rem] gap-4 border-b border-[var(--line)] bg-[var(--surface-muted)] px-5 py-3 text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)] md:grid">
          <span>Время</span>
          <span>Участник</span>
          <span>Задача</span>
          <span>Статус</span>
          <span className="text-right">Балл</span>
        </div>

        <div className="divide-y divide-[var(--line)]">
          {submissions.map((submission) => {
            const status = submissionStatusMeta[submission.status];
            const score =
              submission.status === "REJECTED"
                ? 0
                : submission.status === "FINALIZED"
                  ? (submission.finalScore ?? submission.preliminaryScore)
                  : submission.preliminaryScore;

            return (
              <article
                className="grid gap-3 px-4 py-4 md:grid-cols-[7rem_1fr_1fr_10rem_6rem] md:items-center md:gap-4 md:px-5"
                key={submission.id}
              >
                <time className="text-xs text-[var(--muted)]">
                  {formatSubmissionTime(submission.createdAt)}
                </time>
                <div className="min-w-0">
                  <Link
                    className="truncate font-mono text-sm font-bold hover:text-[var(--accent)]"
                    href={`/profile/${submission.user.id}`}
                    style={{ color: submission.user.rankColor }}
                  >
                    {submission.user.nickname}
                  </Link>
                  {submission.isOwn && (
                    <>
                      <span className="ml-2 text-[11px] font-semibold text-[var(--accent)]">
                        ваша
                      </span>
                      <a
                        className="ml-2 text-[11px] font-semibold text-[var(--muted)] underline hover:text-[var(--ink)]"
                        href={`/api/submissions/${submission.id}/image`}
                        rel="noreferrer"
                        target="_blank"
                      >
                        фото
                      </a>
                    </>
                  )}
                </div>
                <p className="truncate text-sm">
                  <span className="mr-2 font-display font-bold">
                    {String.fromCharCode(64 + submission.problem.orderIndex)}
                  </span>
                  {submission.problem.title}
                </p>
                <div>
                  <Badge tone={status.tone}>{status.label}</Badge>
                  {submission.evaluationConfidence && (
                    <p className="mt-1 text-[10px] font-semibold text-[var(--muted)]">
                      Уверенность:{" "}
                      {submission.evaluationConfidence === "HIGH"
                        ? "высокая"
                        : submission.evaluationConfidence === "MEDIUM"
                          ? "средняя"
                          : "низкая"}
                    </p>
                  )}
                </div>
                <p className="text-right font-mono text-lg font-bold">{score ?? "—"}</p>
              </article>
            );
          })}
        </div>
      </div>
      {nextCursor && (
        <button
          className="mx-auto mt-4 flex min-h-11 items-center gap-2 rounded-xl border border-[var(--line-strong)] px-4 text-sm font-semibold disabled:opacity-60"
          disabled={isLoadingMore}
          onClick={() => void loadMore()}
          type="button"
        >
          <RefreshCw className={isLoadingMore ? "animate-spin" : ""} size={15} />
          Показать более ранние
        </button>
      )}
    </div>
  );
}

function mergeSubmissions(first: PublicSubmission[], second: PublicSubmission[]) {
  const unique = new Map([...first, ...second].map((submission) => [submission.id, submission]));
  return [...unique.values()].sort(
    (left, right) =>
      right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id)
  );
}
