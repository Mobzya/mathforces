"use client";

import { ExternalLink, LoaderCircle, RefreshCw, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { fetchWithTimeout, readApiError } from "@/components/auth/form-utils";
import { Badge } from "@/components/ui/Badge";
import { formatSubmissionTime, submissionStatusMeta } from "@/lib/submissions/presentation";
import type { AdminSubmission } from "@/types/admin";

const statusOptions = ["PRELIMINARY_READY", "NEEDS_REVIEW", "FINALIZED", "REJECTED"] as const;

export function SubmissionReviewList({ submissions }: { submissions: AdminSubmission[] }) {
  if (submissions.length === 0) {
    return (
      <div className="card p-10 text-center">
        <h2 className="font-display text-2xl font-semibold">Посылок не найдено</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Измените фильтр или дождитесь новых решений.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {submissions.map((submission) => (
        <SubmissionReviewCard key={submission.id} submission={submission} />
      ))}
    </div>
  );
}

function SubmissionReviewCard({ submission }: { submission: AdminSubmission }) {
  const router = useRouter();
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const status = submissionStatusMeta[submission.status];

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending("save");
    setError("");
    setSuccess("");
    const form = new FormData(event.currentTarget);
    const nextStatus = form.get("status");
    const adminComment = String(form.get("adminComment") ?? "").trim();
    try {
      const response = await fetchWithTimeout(`/api/admin/submissions/${submission.id}/score`, {
        body: JSON.stringify({
          adminComment: adminComment || undefined,
          finalScore: form.get("finalScore") === "" ? null : Number(form.get("finalScore")),
          isPublic: form.get("isPublic") === "on",
          preliminaryScore:
            form.get("preliminaryScore") === "" ? null : Number(form.get("preliminaryScore")),
          status: typeof nextStatus === "string" ? nextStatus : undefined
        }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH"
      });
      if (!response.ok) {
        setError((await readApiError(response)).message);
        return;
      }
      setSuccess("Оценка сохранена");
      router.refresh();
    } catch {
      setError("Нет связи с сервером");
    } finally {
      setPending("");
    }
  }

  async function rejudge() {
    setPending("rejudge");
    setError("");
    setSuccess("");
    try {
      const response = await fetchWithTimeout(`/api/admin/submissions/${submission.id}/rejudge`, {
        method: "POST"
      });
      if (!response.ok) {
        setError((await readApiError(response)).message);
        return;
      }
      setSuccess("Посылка возвращена в очередь");
      router.refresh();
    } catch {
      setError("Нет связи с сервером");
    } finally {
      setPending("");
    }
  }

  return (
    <article className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[var(--line)] bg-[var(--surface-muted)] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            {submission.evaluationConfidence && (
              <Badge
                tone={
                  submission.evaluationConfidence === "HIGH"
                    ? "green"
                    : submission.evaluationConfidence === "MEDIUM"
                      ? "blue"
                      : "amber"
                }
              >
                Уверенность:{" "}
                {submission.evaluationConfidence === "HIGH"
                  ? "высокая"
                  : submission.evaluationConfidence === "MEDIUM"
                    ? "средняя"
                    : "низкая"}
              </Badge>
            )}
            {(submission.evaluationStatus === "NEEDS_REVIEW" ||
              submission.evaluationStatus === "FAILED") && (
              <Badge tone="amber">
                AI не уверен — нужна проверка
                {submission.evaluationConfidenceValue !== null
                  ? ` (${Math.round(submission.evaluationConfidenceValue * 100)}%)`
                  : ""}
              </Badge>
            )}
            <span className="text-xs text-[var(--muted)]">
              {formatSubmissionTime(submission.createdAt)}
            </span>
          </div>
          <h2 className="mt-2 font-semibold">
            {submission.user.nickname} · Задача{" "}
            {String.fromCharCode(64 + submission.problem.orderIndex)}
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {submission.contest.title} · {submission.problem.title}
          </p>
        </div>
        <Link
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[var(--line-strong)] bg-white px-3 text-sm font-semibold"
          href={submission.imageAccessUrl}
          target="_blank"
        >
          <ExternalLink size={15} />
          Открыть фото
        </Link>
      </div>

      <form className="grid gap-5 p-5 sm:p-6" onSubmit={save}>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="form-label">
            Предварительный балл
            <input
              className="field"
              defaultValue={submission.preliminaryScore ?? ""}
              max={submission.problem.maxScore}
              min="0"
              name="preliminaryScore"
              type="number"
            />
          </label>
          <label className="form-label">
            Итоговый балл
            <input
              className="field"
              defaultValue={submission.finalScore ?? ""}
              max={submission.problem.maxScore}
              min="0"
              name="finalScore"
              type="number"
            />
          </label>
          <label className="form-label">
            Статус
            {statusOptions.some((value) => value === submission.status) ? (
              <select className="field" defaultValue={submission.status} name="status">
                {statusOptions.map((value) => (
                  <option key={value} value={value}>
                    {submissionStatusMeta[value].label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="field"
                disabled
                value={submissionStatusMeta[submission.status].label}
              />
            )}
          </label>
        </div>
        {submission.aiComment && (
          <div className="rounded-xl bg-blue-50 p-4 text-sm leading-6 text-blue-900">
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.08em] text-blue-600">
              Комментарий проверки
            </p>
            {submission.aiComment}
          </div>
        )}
        {submission.adminComment && (
          <div className="rounded-xl bg-[var(--surface-muted)] p-4 text-sm leading-6">
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
              Последняя ручная причина
            </p>
            {submission.adminComment}
          </div>
        )}
        <label className="form-label">
          Причина текущего изменения
          <textarea
            className="field min-h-24 resize-y"
            name="adminComment"
            placeholder="Обязательна, если меняете балл или статус"
          />
        </label>
        <label className="inline-flex items-center gap-2 text-sm font-semibold">
          <input defaultChecked={submission.isPublic} name="isPublic" type="checkbox" />
          Посылка видна в публичной ленте
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--strong)] px-4 text-sm font-semibold text-white disabled:opacity-60"
            disabled={Boolean(pending)}
            type="submit"
          >
            {pending === "save" ? (
              <LoaderCircle className="animate-spin" size={16} />
            ) : (
              <Save size={16} />
            )}
            Сохранить оценку
          </button>
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--line-strong)] px-4 text-sm font-semibold disabled:opacity-60"
            disabled={Boolean(pending)}
            onClick={rejudge}
            type="button"
          >
            {pending === "rejudge" ? (
              <LoaderCircle className="animate-spin" size={16} />
            ) : (
              <RefreshCw size={16} />
            )}
            Перепроверить
          </button>
        </div>
        {(error || success) && (
          <p
            aria-live="polite"
            className={`text-sm font-semibold ${error ? "text-[var(--accent)]" : "text-emerald-700"}`}
          >
            {error || success}
          </p>
        )}
      </form>
    </article>
  );
}
