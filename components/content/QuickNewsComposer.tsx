"use client";

import { LoaderCircle, PenLine, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { fetchWithTimeout, isTimeoutError, readApiError } from "@/components/auth/form-utils";

export function QuickNewsComposer() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setError("");
    try {
      const response = await fetchWithTimeout("/api/admin/news", {
        body: JSON.stringify({
          body: data.get("body"),
          excerpt: data.get("excerpt"),
          isPublished: true,
          title: data.get("title")
        }),
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      if (!response.ok) {
        setError((await readApiError(response)).message);
        return;
      }
      form.reset();
      setOpen(false);
      router.refresh();
    } catch (requestError: unknown) {
      setError(isTimeoutError(requestError) ? "Сервер долго не отвечает" : "Нет связи с сервером");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        className="card group mb-5 flex min-h-16 w-full items-center gap-3 p-4 text-left transition hover:border-[var(--line-strong)] hover:shadow-[var(--shadow-card)]"
        onClick={() => setOpen(true)}
        type="button"
      >
        <span className="grid size-10 place-items-center rounded-xl bg-[var(--strong)] text-white">
          <PenLine size={18} />
        </span>
        <span>
          <strong className="block text-sm">Написать новость</strong>
          <span className="mt-0.5 block text-xs text-[var(--muted)]">
            Публикация сразу появится в «Главном».
          </span>
        </span>
      </button>
    );
  }

  return (
    <form className="card mb-5 p-5 sm:p-6" onSubmit={submit}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-display text-2xl font-semibold">Новая публикация</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Видна всем сразу после отправки.</p>
        </div>
        <button
          aria-label="Закрыть"
          className="grid size-9 place-items-center rounded-lg hover:bg-[var(--surface-muted)]"
          disabled={pending}
          onClick={() => setOpen(false)}
          type="button"
        >
          <X size={17} />
        </button>
      </div>
      <input
        className="field mt-5"
        maxLength={160}
        minLength={3}
        name="title"
        placeholder="Заголовок"
        required
      />
      <input
        className="field mt-3"
        maxLength={500}
        name="excerpt"
        placeholder="Короткая подводка (необязательно)"
      />
      <textarea
        className="field mt-3 min-h-40 resize-y"
        maxLength={50000}
        minLength={3}
        name="body"
        placeholder="Текст новости…"
        required
      />
      {error && <p className="mt-3 text-sm font-semibold text-[var(--accent)]">{error}</p>}
      <button
        className="button-primary mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-sm font-bold"
        disabled={pending}
        type="submit"
      >
        {pending ? <LoaderCircle className="animate-spin" size={16} /> : <Send size={16} />}
        Опубликовать
      </button>
    </form>
  );
}
