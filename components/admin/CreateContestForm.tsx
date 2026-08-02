"use client";

import { LoaderCircle, Plus, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { fetchWithTimeout, isTimeoutError, readApiError } from "@/components/auth/form-utils";

export function CreateContestForm({
  initiallyOpen,
  initialError = "",
  organizations
}: {
  initiallyOpen: boolean;
  initialError?: string;
  organizations: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(initialError);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const isPublic = form.get("isPublic") === "true";

    try {
      const response = await fetchWithTimeout("/api/admin/contests", {
        body: JSON.stringify({
          description: form.get("description"),
          durationMinutes: Number(form.get("durationMinutes")),
          isPublic,
          organizationId: isPublic ? null : form.get("organizationId"),
          rules: form.get("rules"),
          requiredProblemCount: Number(form.get("requiredProblemCount")),
          startAt: new Date(String(form.get("startAt"))).toISOString(),
          status: "ANNOUNCED",
          tags: String(form.get("tags"))
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          title: form.get("title")
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      if (!response.ok) {
        setError((await readApiError(response)).message);
        return;
      }
      const payload = (await response.json()) as { contest: { id: string } };
      window.location.replace(`/admin/contests/${payload.contest.id}`);
    } catch (requestError) {
      setError(
        isTimeoutError(requestError) ? "Сервер отвечает слишком долго" : "Нет связи с сервером"
      );
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--strong)] px-4 text-sm font-semibold text-white"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Plus size={17} />
        Создать контест
      </button>
    );
  }

  return (
    <div className="card mt-8 p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold">Новый контест</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            После создания откроется редактор задач и политики доступа.
          </p>
        </div>
        <button
          aria-label="Закрыть форму"
          className="grid size-10 place-items-center rounded-xl hover:bg-[var(--surface-muted)]"
          onClick={() => setOpen(false)}
          type="button"
        >
          <X size={18} />
        </button>
      </div>

      <form
        action="/api/admin/contests"
        className="mt-6 grid gap-5"
        method="post"
        onSubmit={submit}
      >
        <div className="grid gap-5 md:grid-cols-2">
          <label className="form-label">
            Название
            <input
              className="field"
              name="title"
              placeholder="Осенний математический тур"
              required
            />
          </label>
          <label className="form-label">
            Начало
            <input className="field" name="startAt" required type="datetime-local" />
          </label>
        </div>
        <label className="form-label">
          Описание
          <textarea className="field min-h-24 resize-y" name="description" />
        </label>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <label className="form-label">
            Длительность, минут
            <input
              className="field"
              defaultValue="90"
              max="360"
              min="15"
              name="durationMinutes"
              required
              type="number"
            />
          </label>
          <label className="form-label">
            Количество задач
            <input
              className="field"
              defaultValue="5"
              max="12"
              min="1"
              name="requiredProblemCount"
              required
              type="number"
            />
          </label>
          <label className="form-label">
            Видимость
            <select className="field" defaultValue="true" name="isPublic">
              <option value="true">Публичный</option>
              <option value="false">Для организации</option>
            </select>
          </label>
          <label className="form-label">
            Организация
            <select className="field" defaultValue={organizations[0]?.id} name="organizationId">
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="form-label">
          Теги через запятую
          <input className="field" name="tags" placeholder="алгебра, открытый тур" />
        </label>
        <label className="form-label">
          Правила
          <textarea
            className="field min-h-28 resize-y"
            name="rules"
            placeholder="Полное доказательство и итоговый ответ…"
          />
        </label>
        {error && (
          <p aria-live="polite" className="text-sm font-semibold text-[var(--accent)]">
            {error}
          </p>
        )}
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--strong)] px-5 text-sm font-semibold text-white disabled:opacity-60 sm:justify-self-start"
          disabled={pending}
          type="submit"
        >
          {pending ? <LoaderCircle className="animate-spin" size={17} /> : <Plus size={17} />}
          Создать и добавить задачи
        </button>
      </form>
    </div>
  );
}
