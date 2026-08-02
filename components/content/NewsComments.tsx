"use client";

import { LoaderCircle, MessageCircle } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { fetchWithTimeout, isTimeoutError, readApiError } from "@/components/auth/form-utils";
import { CommentVoteButtons } from "@/components/content/CommentVoteButtons";

export type NewsCommentView = {
  body: string;
  createdAt: string;
  id: string;
  score: number;
  user: { id: string; nickname: string };
  viewerVote: number;
};

export function NewsComments({
  comments,
  isAuthenticated,
  postId
}: {
  comments: NewsCommentView[];
  isAuthenticated: boolean;
  postId: string;
}) {
  const [items, setItems] = useState(comments);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = String(new FormData(form).get("body") ?? "").trim();
    if (body.length < 2) {
      setError("Напишите хотя бы два символа");
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await fetchWithTimeout(`/api/news/${postId}/comments`, {
        body: JSON.stringify({ body }),
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      if (!response.ok) {
        setError((await readApiError(response)).message);
        return;
      }
      const payload = (await response.json()) as { comment: NewsCommentView };
      setItems((current) => [...current, payload.comment]);
      form.reset();
    } catch (requestError: unknown) {
      setError(isTimeoutError(requestError) ? "Сервер долго не отвечает" : "Нет связи с сервером");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="border-t border-[var(--line)] px-5 py-4 sm:px-6">
      <button
        aria-expanded={open}
        className="inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[var(--muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <MessageCircle size={16} />
        {items.length} комментариев
      </button>
      {open && (
        <div className="mt-4">
          <div className="space-y-3">
            {items.map((comment) => (
              <article
                className="rounded-xl bg-[var(--surface-muted)] p-3 sm:flex sm:items-start sm:gap-3"
                key={comment.id}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Link className="font-bold" href={`/profile/${comment.user.id}`}>
                      {comment.user.nickname}
                    </Link>
                    <span className="text-[var(--muted)]">
                      {new Date(comment.createdAt).toLocaleString("ru-RU")}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{comment.body}</p>
                </div>
                <div className="mt-3 sm:mt-0">
                  <CommentVoteButtons
                    endpoint={`/api/news/comments/${comment.id}/vote`}
                    initialScore={comment.score}
                    initialVote={comment.viewerVote}
                    isAuthenticated={isAuthenticated}
                  />
                </div>
              </article>
            ))}
          </div>
          {isAuthenticated ? (
            <form className="mt-4" onSubmit={submit}>
              <textarea
                className="field min-h-20"
                maxLength={1200}
                name="body"
                placeholder="Комментарий…"
                required
              />
              <button
                className="button-primary mt-2 inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs font-bold"
                disabled={pending}
                type="submit"
              >
                {pending && <LoaderCircle className="animate-spin" size={14} />}
                Отправить
              </button>
              {error && <p className="mt-2 text-xs font-semibold text-[var(--accent)]">{error}</p>}
            </form>
          ) : (
            <p className="mt-4 text-sm text-[var(--muted)]">
              <Link className="font-bold text-[var(--accent)]" href="/login?next=/feed">
                Войдите
              </Link>
              , чтобы ответить.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
