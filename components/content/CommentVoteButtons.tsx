"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { fetchWithTimeout, isTimeoutError, readApiError } from "@/components/auth/form-utils";

export function CommentVoteButtons({
  endpoint,
  initialScore,
  initialVote,
  isAuthenticated
}: {
  endpoint: string;
  initialScore: number;
  initialVote: number;
  isAuthenticated: boolean;
}) {
  const [score, setScore] = useState(initialScore);
  const [vote, setVote] = useState(initialVote);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function choose(value: -1 | 1) {
    if (!isAuthenticated || pending) return;
    const previousScore = score;
    const previousVote = vote;
    const nextVote = vote === value ? 0 : value;
    setVote(nextVote);
    setScore(score - vote + nextVote);
    setPending(true);
    setError("");
    try {
      const response = await fetchWithTimeout(
        endpoint,
        nextVote === 0
          ? { credentials: "same-origin", method: "DELETE" }
          : {
              body: JSON.stringify({ value: nextVote }),
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              method: "PUT"
            }
      );
      if (!response.ok) {
        setScore(previousScore);
        setVote(previousVote);
        setError((await readApiError(response)).message);
      }
    } catch (requestError: unknown) {
      setScore(previousScore);
      setVote(previousVote);
      setError(isTimeoutError(requestError) ? "Сервер долго не отвечает" : "Нет связи с сервером");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <div className="inline-flex items-center rounded-full border border-[var(--line)] bg-[var(--surface)] p-1 shadow-sm">
        <button
          aria-label="Полезный комментарий"
          aria-pressed={vote === 1}
          className={`grid size-8 place-items-center rounded-full transition ${vote === 1 ? "bg-emerald-100 text-emerald-700" : "text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]"}`}
          disabled={!isAuthenticated || pending}
          onClick={() => void choose(1)}
          title={isAuthenticated ? "Полезно" : "Войдите, чтобы оценить"}
          type="button"
        >
          <ThumbsUp fill={vote === 1 ? "currentColor" : "none"} size={15} />
        </button>
        <span className="min-w-8 text-center font-mono text-xs font-bold" title="Общая оценка">
          {score}
        </span>
        <button
          aria-label="Неполезный комментарий"
          aria-pressed={vote === -1}
          className={`grid size-8 place-items-center rounded-full transition ${vote === -1 ? "bg-red-100 text-[var(--accent)]" : "text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]"}`}
          disabled={!isAuthenticated || pending}
          onClick={() => void choose(-1)}
          title={isAuthenticated ? "Неполезно" : "Войдите, чтобы оценить"}
          type="button"
        >
          <ThumbsDown fill={vote === -1 ? "currentColor" : "none"} size={15} />
        </button>
      </div>
      {error && (
        <p className="mt-1 max-w-48 text-[10px] font-semibold text-[var(--accent)]">{error}</p>
      )}
    </div>
  );
}
