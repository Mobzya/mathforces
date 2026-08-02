"use client";

import { ExternalLink, LoaderCircle, RefreshCw, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { readApiError } from "@/components/auth/form-utils";
import { problemTopicLabels } from "@/lib/contests/presentation";
import type { ProblemTopicValue } from "@/types/contest";

type ManagedProblem = {
  archiveEnabled: boolean;
  archiveIntro: string;
  contestTitle: string;
  difficultyRating: number | null;
  id: string;
  isFeatured: boolean;
  officialSolution: string;
  subtopic: string;
  title: string;
  topic: ProblemTopicValue;
};

type ReviewAttempt = {
  createdAt: string;
  feedback: string;
  id: string;
  problemTitle: string;
  score: number | null;
  userNickname: string;
};

export function ArchiveManager({
  attempts,
  problems
}: {
  attempts: ReviewAttempt[];
  problems: ManagedProblem[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState("");
  const [message, setMessage] = useState("");

  async function request(key: string, url: string, init: RequestInit) {
    setPending(key);
    setMessage("");
    try {
      const response = await fetch(url, init);
      if (!response.ok) {
        setMessage((await readApiError(response)).message);
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setMessage("Нет связи с сервером");
      return false;
    } finally {
      setPending("");
    }
  }

  async function reindex() {
    const ok = await request("reindex", "/api/admin/archive/reindex", { method: "POST" });
    if (ok) setMessage("Рейтинги задач пересчитаны");
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <button
          className="button-primary inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold disabled:opacity-60"
          disabled={Boolean(pending)}
          onClick={reindex}
          type="button"
        >
          {pending === "reindex" ? (
            <LoaderCircle className="animate-spin" size={16} />
          ) : (
            <RefreshCw size={16} />
          )}
          Пересчитать сложность
        </button>
        <Link
          className="inline-flex min-h-11 items-center rounded-xl border border-[var(--line-strong)] px-4 text-sm font-bold"
          href="/admin/contests"
        >
          Создать задачу в контесте
        </Link>
      </div>
      {message && (
        <p aria-live="polite" className="mt-3 text-sm font-semibold text-[var(--accent)]">
          {message}
        </p>
      )}

      <section className="mt-10">
        <h2 className="font-display text-3xl font-semibold">Ожидают подтверждения</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Автоматика даёт предварительный балл; до подключения математической LLM его подтверждает
          модератор.
        </p>
        <div className="mt-5 space-y-4">
          {attempts.length === 0 && (
            <div className="card p-8 text-center text-sm text-[var(--muted)]">
              Новых попыток на проверку нет.
            </div>
          )}
          {attempts.map((attempt) => (
            <AttemptReview attempt={attempt} key={attempt.id} pending={pending} request={request} />
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-3xl font-semibold">Задачи архива</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Удаление здесь мягкое: задача исчезнет из архива, но результаты прошлого контеста
          сохранятся.
        </p>
        <div className="mt-5 space-y-4">
          {problems.map((problem) => (
            <ProblemEditor key={problem.id} pending={pending} problem={problem} request={request} />
          ))}
        </div>
      </section>
    </div>
  );
}

function AttemptReview({
  attempt,
  pending,
  request
}: {
  attempt: ReviewAttempt;
  pending: string;
  request: (key: string, url: string, init: RequestInit) => Promise<boolean>;
}) {
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await request(`attempt-${attempt.id}`, `/api/admin/archive/attempts/${attempt.id}`, {
      body: JSON.stringify({ feedback: form.get("feedback"), score: Number(form.get("score")) }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH"
    });
  }
  return (
    <form className="card grid gap-4 p-5 lg:grid-cols-[1fr_7rem_auto] lg:items-end" onSubmit={save}>
      <div>
        <p className="font-semibold">
          {attempt.userNickname} · {attempt.problemTitle}
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          {new Date(attempt.createdAt).toLocaleString("ru-RU")}
        </p>
        <textarea
          className="field mt-3 min-h-20"
          defaultValue={attempt.feedback}
          name="feedback"
          placeholder="Комментарий без подсказок"
        />
      </div>
      <label className="form-label">
        Балл
        <input
          className="field"
          defaultValue={attempt.score ?? ""}
          max="100"
          min="0"
          name="score"
          required
          type="number"
        />
      </label>
      <div className="flex gap-2">
        <Link
          className="grid size-11 place-items-center rounded-xl border border-[var(--line)]"
          href={`/api/admin/archive/attempts/${attempt.id}/image`}
          target="_blank"
        >
          <ExternalLink size={16} />
        </Link>
        <button
          className="button-primary inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold"
          disabled={pending === `attempt-${attempt.id}`}
          type="submit"
        >
          {pending === `attempt-${attempt.id}` ? (
            <LoaderCircle className="animate-spin" size={16} />
          ) : (
            <Save size={16} />
          )}
          Принять
        </button>
      </div>
    </form>
  );
}

function ProblemEditor({
  pending,
  problem,
  request
}: {
  pending: string;
  problem: ManagedProblem;
  request: (key: string, url: string, init: RequestInit) => Promise<boolean>;
}) {
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await request(`problem-${problem.id}`, `/api/admin/archive/problems/${problem.id}`, {
      body: JSON.stringify({
        archiveEnabled: form.get("archiveEnabled") === "on",
        archiveIntro: form.get("archiveIntro"),
        difficultyRating: form.get("difficultyRating"),
        isFeatured: form.get("isFeatured") === "on",
        officialSolution: form.get("officialSolution"),
        subtopic: form.get("subtopic"),
        title: form.get("title"),
        topic: form.get("topic")
      }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH"
    });
  }
  return (
    <form className="card p-5" onSubmit={save}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">{problem.title}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">{problem.contestTitle}</p>
        </div>
        <Link
          className="inline-flex items-center gap-2 text-sm font-semibold"
          href={`/archive/${problem.id}`}
        >
          <ExternalLink size={15} />
          Открыть
        </Link>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <label className="form-label">
          Название
          <input className="field" defaultValue={problem.title} name="title" />
        </label>
        <label className="form-label">
          Тема
          <select className="field" defaultValue={problem.topic} name="topic">
            {Object.entries(problemTopicLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="form-label">
          Подтема
          <input className="field" defaultValue={problem.subtopic} name="subtopic" />
        </label>
        <label className="form-label">
          Рейтинг
          <input
            className="field"
            defaultValue={problem.difficultyRating ?? ""}
            max="3000"
            min="0"
            name="difficultyRating"
            step="10"
            type="number"
          />
        </label>
      </div>
      <label className="form-label mt-4">
        Дополнительные вводны
        <textarea
          className="field min-h-20"
          defaultValue={problem.archiveIntro}
          name="archiveIntro"
        />
      </label>
      <label className="form-label mt-4">
        Официальное решение
        <textarea
          className="field min-h-32"
          defaultValue={problem.officialSolution}
          name="officialSolution"
        />
      </label>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <label className="inline-flex items-center gap-2 text-sm font-semibold">
          <input defaultChecked={problem.archiveEnabled} name="archiveEnabled" type="checkbox" />
          Видна в архиве
        </label>
        <label className="inline-flex items-center gap-2 text-sm font-semibold">
          <input defaultChecked={problem.isFeatured} name="isFeatured" type="checkbox" />
          На витрине
        </label>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          className="button-primary inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold"
          disabled={pending === `problem-${problem.id}`}
          type="submit"
        >
          {pending === `problem-${problem.id}` ? (
            <LoaderCircle className="animate-spin" size={16} />
          ) : (
            <Save size={16} />
          )}
          Сохранить
        </button>
        <button
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-red-200 px-4 text-sm font-bold text-red-600"
          onClick={() => {
            if (window.confirm("Убрать задачу из архива?"))
              void request(`remove-${problem.id}`, `/api/admin/archive/problems/${problem.id}`, {
                method: "DELETE"
              });
          }}
          type="button"
        >
          <Trash2 size={16} />
          Убрать
        </button>
      </div>
    </form>
  );
}
