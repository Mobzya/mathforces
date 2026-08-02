"use client";

import { CheckCircle2, Clock3, ImagePlus, LoaderCircle, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useRef, useState } from "react";
import { fetchWithTimeout, isTimeoutError, readApiError } from "@/components/auth/form-utils";
import type { PracticeAttemptView } from "@/types/archive";

const statusText: Record<PracticeAttemptView["status"], string> = {
  COMPLETED: "Проверено",
  FAILED: "Ошибка проверки",
  NEEDS_REVIEW: "На подтверждении",
  PROCESSING: "Проверяем",
  QUEUED: "В очереди"
};

export function PracticeAttemptForm({
  initialAttempts,
  isAuthenticated,
  problemId
}: {
  initialAttempts: PracticeAttemptView[];
  isAuthenticated: boolean;
  problemId: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef(new Set<string>());
  const [attempts, setAttempts] = useState(initialAttempts);
  const [pending, setPending] = useState(false);
  const [pollingIds, setPollingIds] = useState<Set<string>>(() => new Set());
  const [delayedIds, setDelayedIds] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Выберите фотографию решения");
      return;
    }
    setPending(true);
    setError("");
    const form = new FormData();
    form.set("image", file);
    try {
      const response = await fetchWithTimeout(
        `/api/archive/problems/${problemId}/attempts`,
        { body: form, credentials: "same-origin", method: "POST" },
        60_000
      );
      if (!response.ok) {
        setError((await readApiError(response)).message);
        return;
      }
      const payload = (await response.json()) as {
        attempt: { createdAt: string; id: string; status: PracticeAttemptView["status"] };
      };
      const queued: PracticeAttemptView = { ...payload.attempt, feedback: "", score: null };
      setAttempts((current) => [queued, ...current]);
      if (fileRef.current) fileRef.current.value = "";
      void poll(payload.attempt.id);
    } catch (requestError: unknown) {
      setError(
        isTimeoutError(requestError)
          ? "Загрузка заняла слишком много времени. Повторите отправку"
          : "Нет связи с сервером"
      );
    } finally {
      setPending(false);
    }
  }

  async function poll(id: string) {
    if (pollingRef.current.has(id)) return;
    pollingRef.current.add(id);
    setPollingIds((current) => new Set(current).add(id));
    setDelayedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    let finished = false;
    for (let index = 0; index < 24; index += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 2500));
      try {
        const response = await fetchWithTimeout(
          `/api/archive/attempts/${id}`,
          {
            cache: "no-store",
            credentials: "same-origin"
          },
          10_000
        );
        if (!response.ok) break;
        const { attempt } = (await response.json()) as { attempt: PracticeAttemptView };
        setAttempts((current) => current.map((item) => (item.id === id ? attempt : item)));
        if (["COMPLETED", "NEEDS_REVIEW", "FAILED"].includes(attempt.status)) {
          finished = true;
          break;
        }
      } catch {
        break;
      }
    }
    setPollingIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    pollingRef.current.delete(id);
    if (!finished) setDelayedIds((current) => new Set(current).add(id));
  }

  if (!isAuthenticated) {
    return (
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-5 text-sm leading-6">
        <Link className="font-bold text-[var(--accent)]" href={`/login?next=/archive/${problemId}`}>
          Войдите в аккаунт
        </Link>
        , чтобы отправлять решения и сохранять прогресс.
      </div>
    );
  }

  return (
    <div>
      <form
        className="rounded-2xl border border-dashed border-[var(--line-strong)] bg-[var(--surface-muted)] p-5"
        onSubmit={submit}
      >
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--strong)] text-white">
            <ImagePlus size={20} />
          </div>
          <div>
            <p className="font-semibold">Загрузите фото или скан решения</p>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              JPEG, PNG или WebP до 15 МБ. Проверка оценивает полноту доказательства и не даёт
              подсказок.
            </p>
          </div>
        </div>
        <input
          accept="image/jpeg,image/png,image/webp"
          className="mt-4 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--surface)] file:px-3 file:py-2 file:font-semibold"
          ref={fileRef}
          type="file"
        />
        <button
          className="button-primary mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-sm font-bold disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? <LoaderCircle className="animate-spin" size={17} /> : <ImagePlus size={17} />}{" "}
          Отправить на проверку
        </button>
        {error && (
          <p aria-live="polite" className="mt-3 text-sm font-semibold text-[var(--accent)]">
            {error}
          </p>
        )}
      </form>

      {attempts.length > 0 && (
        <div className="mt-6 space-y-3">
          <h3 className="font-display text-xl font-semibold">Ваши попытки</h3>
          {attempts.map((attempt) => (
            <article
              className={`rounded-xl border p-4 ${attempt.status === "COMPLETED" && (attempt.score ?? 0) >= 90 ? "border-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/20" : "border-[var(--line)] bg-[var(--surface)]"}`}
              key={attempt.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {attempt.status === "COMPLETED" ? (
                    <CheckCircle2 className="text-emerald-500" size={17} />
                  ) : attempt.status === "FAILED" ? (
                    <ShieldAlert className="text-[var(--accent)]" size={17} />
                  ) : (
                    <Clock3 className="text-amber-500" size={17} />
                  )}
                  {delayedIds.has(attempt.id)
                    ? "Проверка задерживается"
                    : statusText[attempt.status]}
                </div>
                <div className="font-mono text-xl font-bold">
                  {attempt.score === null ? "—" : `${attempt.score}/100`}
                </div>
              </div>
              {(attempt.status === "QUEUED" || attempt.status === "PROCESSING") && (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <p className="flex-1 text-xs leading-5 text-[var(--muted)]">
                    Решение уже сохранено. Страницу можно закрыть и вернуться позже.
                  </p>
                  <button
                    className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[var(--line)] px-3 text-xs font-bold disabled:opacity-50"
                    disabled={pollingIds.has(attempt.id)}
                    onClick={() => void poll(attempt.id)}
                    type="button"
                  >
                    {pollingIds.has(attempt.id) && (
                      <LoaderCircle className="animate-spin" size={13} />
                    )}
                    {pollingIds.has(attempt.id) ? "Следим…" : "Обновить статус"}
                  </button>
                </div>
              )}
              {attempt.feedback && (
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{attempt.feedback}</p>
              )}
              <p className="mt-2 text-[11px] text-[var(--muted)]">
                {new Date(attempt.createdAt).toLocaleString("ru-RU")}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
