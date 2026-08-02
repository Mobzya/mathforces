"use client";

import { LoaderCircle, MessageCircle } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { fetchWithTimeout, isTimeoutError, readApiError } from "@/components/auth/form-utils";
import { CommentVoteButtons } from "@/components/content/CommentVoteButtons";
import type { ArchiveComment } from "@/types/archive";

export function ProblemComments({
  comments,
  isAuthenticated,
  problemId
}: {
  comments: ArchiveComment[];
  isAuthenticated: boolean;
  problemId: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [optimistic, setOptimistic] = useState(comments);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = String(data.get("body") ?? "").trim();
    if (!body) return;
    setPending(true);
    setError("");
    try {
      const response = await fetchWithTimeout(`/api/archive/problems/${problemId}/comments`, {
        body: JSON.stringify({ body }),
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      if (!response.ok) {
        setError((await readApiError(response)).message);
        return;
      }
      const payload = (await response.json()) as { comment: ArchiveComment };
      setOptimistic((current) => [payload.comment, ...current]);
      form.reset();
    } catch (requestError: unknown) {
      setError(isTimeoutError(requestError) ? "Сервер долго не отвечает" : "Нет связи с сервером");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <MessageCircle size={20} />
        <h2 className="font-display text-2xl font-semibold">Обсуждение</h2>
      </div>
      {isAuthenticated ? (
        <form className="mt-5" onSubmit={submit}>
          <textarea
            className="field min-h-24 resize-y"
            maxLength={1200}
            name="body"
            placeholder="Обсудите идею или задайте вопрос без спойлеров…"
            required
          />
          <button
            className="button-primary mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold disabled:opacity-60"
            disabled={pending}
            type="submit"
          >
            {pending && <LoaderCircle className="animate-spin" size={15} />}Опубликовать
          </button>
          {error && <p className="mt-2 text-sm font-semibold text-[var(--accent)]">{error}</p>}
        </form>
      ) : (
        <p className="mt-4 text-sm text-[var(--muted)]">
          <Link
            className="font-bold text-[var(--accent)]"
            href={`/login?next=/archive/${problemId}`}
          >
            Войдите
          </Link>
          , чтобы оставить комментарий.
        </p>
      )}

      <div className="mt-6 divide-y divide-[var(--line)]">
        {optimistic.length === 0 && (
          <p className="py-8 text-center text-sm text-[var(--muted)]">
            Пока нет комментариев. Начните обсуждение.
          </p>
        )}
        {optimistic.map((comment) => (
          <article className="flex flex-col gap-3 py-5 sm:flex-row" key={comment.id}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Link
                  className="font-bold"
                  href={`/profile/${comment.author.id}`}
                  style={{ color: comment.author.rankColor }}
                >
                  {comment.author.nickname}
                </Link>
                <span className="text-[var(--muted)]">
                  {new Date(comment.createdAt).toLocaleString("ru-RU")}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{comment.body}</p>
            </div>
            <CommentVoteButtons
              endpoint={`/api/archive/comments/${comment.id}/vote`}
              initialScore={comment.score}
              initialVote={comment.viewerVote}
              isAuthenticated={isAuthenticated}
            />
          </article>
        ))}
      </div>
    </section>
  );
}
