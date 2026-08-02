"use client";

import {
  Check,
  CircleStop,
  Download,
  ExternalLink,
  LoaderCircle,
  Play,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { fetchWithTimeout, isTimeoutError, readApiError } from "@/components/auth/form-utils";
import { Badge } from "@/components/ui/Badge";
import { problemTopicLabels } from "@/lib/contests/presentation";
import type { AdminArchiveProblem, AdminContest, AdminProblem } from "@/types/admin";

const defaultScores = [100, 120, 150, 180, 200];
const topics = Object.entries(problemTopicLabels);

export function ContestEditor({
  archiveProblems,
  contest,
  finalization,
  initialError = "",
  organizations,
  problems,
  ratingCalculation
}: {
  archiveProblems: AdminArchiveProblem[];
  contest: AdminContest;
  finalization: {
    completedCount: number;
    failedCount: number;
    queuedCount: number;
    status: "QUEUED" | "PROCESSING" | "NEEDS_REVIEW" | "COMPLETED" | "FAILED";
  } | null;
  initialError?: string;
  organizations: { id: string; name: string }[];
  problems: AdminProblem[];
  ratingCalculation: {
    calculatedAt: string;
    isStale: boolean;
    participantCount: number;
  } | null;
}) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(initialError);

  async function request(action: string, input: RequestInfo, init: RequestInit) {
    setPendingAction(action);
    setError("");
    setMessage("");
    try {
      const response = await fetchWithTimeout(input, init);
      if (!response.ok) {
        setError((await readApiError(response)).message);
        return false;
      }
      setMessage("Изменения сохранены");
      router.refresh();
      return true;
    } catch (requestError) {
      setError(
        isTimeoutError(requestError) ? "Сервер отвечает слишком долго" : "Нет связи с сервером"
      );
      return false;
    } finally {
      setPendingAction("");
    }
  }

  async function saveContest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const isPublic = form.get("isPublic") === "true";
    await request("contest", `/api/admin/contests/${contest.id}`, {
      body: JSON.stringify({
        description: form.get("description"),
        durationMinutes: Number(form.get("durationMinutes")),
        isPublic,
        organizationId: isPublic ? null : form.get("organizationId"),
        rules: form.get("rules"),
        requiredProblemCount: Number(form.get("requiredProblemCount")),
        startAt: new Date(String(form.get("startAt"))).toISOString(),
        tags: String(form.get("tags"))
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        title: form.get("title")
      }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH"
    });
  }

  async function savePolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await request("policy", `/api/admin/contests/${contest.id}`, {
      body: JSON.stringify({
        autoCalculateRating: form.get("autoCalculateRating") === "on",
        autoFinalRejudge: form.get("autoFinalRejudge") === "on",
        autoPublishArchive: form.get("autoPublishArchive") === "on",
        registrationClosesAt: new Date(String(form.get("registrationClosesAt"))).toISOString(),
        reviewConfidenceThreshold: Number(form.get("reviewConfidenceThreshold")) / 100,
        showOthersSubmissions: form.get("showOthersSubmissions") === "on",
        showPreliminaryScores: form.get("showPreliminaryScores") === "on",
        showStandingsDuringContest: form.get("showStandingsDuringContest") === "on",
        showSubmissionComments: form.get("showSubmissionComments") === "on"
      }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH"
    });
  }

  async function importArchiveProblem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await request("archive-import", `/api/admin/contests/${contest.id}/problems/import`, {
      body: JSON.stringify({ sourceProblemId: form.get("sourceProblemId") }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
  }

  async function changeStatus(status: "RUNNING" | "FINISHED") {
    const endpoint =
      status === "RUNNING"
        ? `/api/admin/contests/${contest.id}/publish`
        : `/api/admin/contests/${contest.id}`;
    await request(status, endpoint, {
      ...(status === "FINISHED"
        ? {
            body: JSON.stringify({ status }),
            headers: { "Content-Type": "application/json" }
          }
        : {}),
      method: status === "RUNNING" ? "POST" : "PATCH"
    });
  }

  async function calculateRating() {
    await request("rating", `/api/admin/contests/${contest.id}/rating`, { method: "POST" });
  }

  async function rejudgeFinalization(scope: "all" | "failed") {
    await request(
      `finalization-${scope}`,
      `/api/admin/contests/${contest.id}/finalization/rejudge`,
      {
        body: JSON.stringify({ scope }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      }
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        <form
          action={`/api/admin/contests/${contest.id}`}
          className="card p-5 sm:p-6"
          method="post"
          onSubmit={saveContest}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-semibold">Параметры тура</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Время, видимость, теги и правила.</p>
            </div>
            <Badge
              tone={
                contest.status === "RUNNING"
                  ? "green"
                  : contest.status === "FINISHED"
                    ? "gray"
                    : "blue"
              }
            >
              {contest.status === "RUNNING"
                ? "Идёт"
                : contest.status === "FINISHED"
                  ? "Завершён"
                  : "Черновик"}
            </Badge>
          </div>
          <fieldset
            className="mt-6 grid gap-5 disabled:opacity-70"
            disabled={contest.status !== "ANNOUNCED"}
          >
            <label className="form-label">
              Название
              <input className="field" defaultValue={contest.title} name="title" required />
            </label>
            <label className="form-label">
              Описание
              <textarea
                className="field min-h-24"
                defaultValue={contest.description}
                name="description"
              />
            </label>
            <div className="grid gap-5 md:grid-cols-2">
              <label className="form-label">
                Начало
                <input
                  className="field"
                  defaultValue={toLocalInput(contest.startAt)}
                  name="startAt"
                  required
                  type="datetime-local"
                />
              </label>
              <label className="form-label">
                Длительность
                <input
                  className="field"
                  defaultValue={contest.durationMinutes}
                  max="360"
                  min="15"
                  name="durationMinutes"
                  type="number"
                />
              </label>
              <label className="form-label">
                Количество задач
                <input
                  className="field"
                  defaultValue={contest.requiredProblemCount}
                  max="12"
                  min={Math.max(1, problems.length)}
                  name="requiredProblemCount"
                  type="number"
                />
              </label>
              <label className="form-label">
                Видимость
                <select className="field" defaultValue={String(contest.isPublic)} name="isPublic">
                  <option value="true">Публичный</option>
                  <option value="false">Для организации</option>
                </select>
              </label>
              <label className="form-label">
                Организация
                <select
                  className="field"
                  defaultValue={contest.organization?.id ?? organizations[0]?.id}
                  name="organizationId"
                >
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="form-label">
              Теги
              <input className="field" defaultValue={contest.tags.join(", ")} name="tags" />
            </label>
            <label className="form-label">
              Правила
              <textarea className="field min-h-28" defaultValue={contest.rules} name="rules" />
            </label>
          </fieldset>
          {contest.status !== "ANNOUNCED" && (
            <p className="mt-4 text-xs leading-5 text-[var(--muted)]">
              После запуска расписание, видимость и правила зафиксированы, чтобы баллы и доступ
              участников не менялись задним числом.
            </p>
          )}
          <button
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--strong)] px-4 text-sm font-semibold text-white disabled:opacity-60"
            disabled={contest.status !== "ANNOUNCED" || pendingAction === "contest"}
            type="submit"
          >
            {pendingAction === "contest" ? (
              <LoaderCircle className="animate-spin" size={17} />
            ) : (
              <Save size={17} />
            )}
            Сохранить параметры
          </button>
        </form>

        <form className="card p-5 sm:p-6" onSubmit={savePolicy}>
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
              <ShieldCheck size={20} />
            </span>
            <div>
              <h2 className="font-display text-2xl font-semibold">Доступ и автоматика</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                Эти параметры можно безопасно менять во время контеста. Новые значения сразу
                применяются к регистрации, таблице и проверке.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <label className="form-label">
              Регистрация открыта до
              <input
                className="field"
                defaultValue={toLocalInput(contest.registrationClosesAt ?? contest.startAt)}
                max={toLocalInput(contest.endAt)}
                name="registrationClosesAt"
                required
                type="datetime-local"
              />
              <span className="text-xs font-normal leading-5 text-[var(--muted)]">
                Можно выбрать время после старта, но не позже окончания.
              </span>
            </label>
            <label className="form-label">
              Порог ручной проверки AI, %
              <input
                className="field"
                defaultValue={Math.round(contest.reviewConfidenceThreshold * 100)}
                max="99"
                min="50"
                name="reviewConfidenceThreshold"
                type="number"
              />
              <span className="text-xs font-normal leading-5 text-[var(--muted)]">
                Ниже порога результат попадёт в отдельную очередь администратора.
              </span>
            </label>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <PolicyToggle
              defaultChecked={contest.showStandingsDuringContest}
              description="Если выключено, участник видит только свою строку до финиша."
              label="Таблица во время тура"
              name="showStandingsDuringContest"
            />
            <PolicyToggle
              defaultChecked={contest.showOthersSubmissions}
              description="Разрешает ленту публичных посылок других участников."
              label="Чужие посылки"
              name="showOthersSubmissions"
            />
            <PolicyToggle
              defaultChecked={contest.showSubmissionComments}
              description="Открывает AI-, системные и админские пояснения в таблице."
              label="Комментарии к чужим решениям"
              name="showSubmissionComments"
            />
            <PolicyToggle
              defaultChecked={contest.showPreliminaryScores}
              description="Показывает текущие баллы до финального пересчёта."
              label="Предварительные баллы"
              name="showPreliminaryScores"
            />
            <PolicyToggle
              defaultChecked={contest.autoFinalRejudge}
              description="Сразу после финиша проверяет последние решения повторно."
              label="Автоперепроверка после финиша"
              name="autoFinalRejudge"
            />
            <PolicyToggle
              defaultChecked={contest.autoCalculateRating}
              description="Начисляет рейтинг, когда спорных решений больше нет."
              label="Автоматический рейтинг"
              name="autoCalculateRating"
            />
            <PolicyToggle
              defaultChecked={contest.autoPublishArchive}
              description="Публикует разрешённые задачи после утверждения итогов."
              label="Автопубликация в архив"
              name="autoPublishArchive"
            />
          </div>

          <button
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--strong)] px-4 text-sm font-semibold text-white disabled:opacity-60"
            disabled={pendingAction === "policy"}
            type="submit"
          >
            {pendingAction === "policy" ? (
              <LoaderCircle className="animate-spin" size={17} />
            ) : (
              <Save size={17} />
            )}
            Сохранить политику
          </button>
        </form>

        <div>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl font-semibold">Задачи</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {problems.length}/{contest.requiredProblemCount} заполнено
              </p>
            </div>
            {problems.length === contest.requiredProblemCount && (
              <Badge tone="green">
                <Check size={12} />
                Комплект готов
              </Badge>
            )}
          </div>
          {contest.status === "ANNOUNCED" && problems.length < contest.requiredProblemCount && (
            <form
              className="card mb-4 border-blue-200 bg-blue-50/50 p-5 dark:border-blue-900 dark:bg-blue-950/20"
              onSubmit={importArchiveProblem}
            >
              <div className="flex items-center gap-2 font-semibold">
                <Sparkles size={17} className="text-blue-600" />
                Добавить из архива
              </div>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                Создаётся независимая копия: условие и критерии можно отредактировать для этого
                тура.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <select
                  className="field min-w-0 flex-1"
                  disabled={archiveProblems.length === 0}
                  name="sourceProblemId"
                  required
                >
                  <option value="">
                    {archiveProblems.length
                      ? "Выберите задачу"
                      : "В архиве пока нет доступных задач"}
                  </option>
                  {archiveProblems.map((problem) => (
                    <option key={problem.id} value={problem.id}>
                      {problem.title} · {problem.contestTitle} · {problem.difficultyRating ?? "—"}
                    </option>
                  ))}
                </select>
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
                  disabled={archiveProblems.length === 0 || pendingAction === "archive-import"}
                  type="submit"
                >
                  {pendingAction === "archive-import" ? (
                    <LoaderCircle className="animate-spin" size={16} />
                  ) : (
                    <Plus size={16} />
                  )}
                  Добавить
                </button>
              </div>
            </form>
          )}
          <div className="space-y-4">
            {problems.map((problem) => (
              <ProblemForm
                contestId={contest.id}
                disabled={contest.status !== "ANNOUNCED"}
                key={problem.id}
                onSaved={() => router.refresh()}
                maxOrder={contest.requiredProblemCount}
                problem={problem}
              />
            ))}
            {problems.length < contest.requiredProblemCount && contest.status === "ANNOUNCED" && (
              <ProblemForm
                contestId={contest.id}
                onSaved={() => router.refresh()}
                maxOrder={contest.requiredProblemCount}
                suggestedOrder={problems.length + 1}
              />
            )}
          </div>
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
        <div className="card p-5">
          <h2 className="font-semibold">Управление туром</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Запуск доступен после заполнения заданного количества задач.
          </p>
          <div className="mt-5 grid gap-2">
            {contest.status === "ANNOUNCED" && (
              <form
                action={`/api/admin/contests/${contest.id}/publish`}
                method="post"
                onSubmit={(event) => {
                  event.preventDefault();
                  void changeStatus("RUNNING");
                }}
              >
                <button
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
                  disabled={
                    problems.length !== contest.requiredProblemCount || pendingAction === "RUNNING"
                  }
                  type="submit"
                >
                  {pendingAction === "RUNNING" ? (
                    <LoaderCircle className="animate-spin" size={17} />
                  ) : (
                    <Play size={17} />
                  )}
                  Запустить контест
                </button>
              </form>
            )}
            {contest.status === "RUNNING" && (
              <form
                action={`/api/admin/contests/${contest.id}`}
                method="post"
                onSubmit={(event) => {
                  event.preventDefault();
                  void changeStatus("FINISHED");
                }}
              >
                <input name="status" type="hidden" value="FINISHED" />
                <button
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white"
                  type="submit"
                >
                  <CircleStop size={17} />
                  Завершить контест
                </button>
              </form>
            )}
            {contest.status === "FINISHED" && (
              <form
                action={`/api/admin/contests/${contest.id}/rating`}
                method="post"
                onSubmit={(event) => {
                  event.preventDefault();
                  void calculateRating();
                }}
              >
                <button
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--strong)] px-4 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={pendingAction === "rating" || finalization?.status !== "COMPLETED"}
                  type="submit"
                >
                  {pendingAction === "rating" ? (
                    <LoaderCircle className="animate-spin" size={17} />
                  ) : (
                    <Check size={17} />
                  )}
                  {ratingCalculation ? "Пересчитать рейтинг" : "Рассчитать рейтинг"}
                </button>
              </form>
            )}
            {contest.status === "FINISHED" && (
              <button
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--line-strong)] px-4 text-sm font-semibold disabled:opacity-60"
                disabled={pendingAction.startsWith("finalization-")}
                onClick={() =>
                  void rejudgeFinalization(finalization?.status === "FAILED" ? "failed" : "all")
                }
                type="button"
              >
                {pendingAction.startsWith("finalization-") ? (
                  <LoaderCircle className="animate-spin" size={17} />
                ) : (
                  <RefreshCw size={17} />
                )}
                {!finalization
                  ? "Запустить финальную проверку"
                  : finalization.status === "FAILED"
                    ? "Повторить ошибки"
                    : "Перепроверить все"}
              </button>
            )}
            <Link
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--line)] px-4 text-sm font-semibold"
              href={`/contests/${contest.id}`}
            >
              <ExternalLink size={16} />
              Открыть страницу
            </Link>
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--line)] px-4 text-sm font-semibold"
              href={`/admin/submissions?contestId=${contest.id}`}
            >
              Посылки контеста
            </Link>
            <div className="grid grid-cols-2 gap-2">
              <a
                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-[var(--line)] px-2 text-xs font-semibold"
                href={`/api/admin/contests/${contest.id}/export?type=results`}
              >
                <Download size={14} />
                Результаты CSV
              </a>
              <a
                aria-disabled={!ratingCalculation}
                className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-[var(--line)] px-2 text-xs font-semibold ${!ratingCalculation ? "pointer-events-none opacity-45" : ""}`}
                href={`/api/admin/contests/${contest.id}/export?type=rating`}
              >
                <Download size={14} />
                Рейтинг CSV
              </a>
            </div>
          </div>
          {ratingCalculation && (
            <p
              className={`mt-4 rounded-xl px-3 py-2 text-xs font-semibold ${ratingCalculation.isStale ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}
            >
              {ratingCalculation.isStale
                ? "Результаты изменились: опубликованный рейтинг устарел и требует контролируемого пересчёта"
                : `Рейтинг рассчитан для ${ratingCalculation.participantCount} участников`}
            </p>
          )}
          {finalization && finalization.status !== "COMPLETED" && (
            <p
              className={`mt-4 rounded-xl px-3 py-2 text-xs font-semibold ${finalization.status === "FAILED" ? "bg-red-50 text-red-700" : finalization.status === "NEEDS_REVIEW" ? "bg-amber-50 text-amber-800" : "bg-blue-50 text-blue-800"}`}
            >
              {finalization.status === "FAILED"
                ? `Финальная проверка остановлена: ошибок ${finalization.failedCount}. Повторите неудачные посылки.`
                : finalization.status === "NEEDS_REVIEW"
                  ? "Рейтинг заблокирован: спорные финальные решения нужно подтвердить вручную."
                  : `Финальная проверка: ${finalization.completedCount}/${finalization.queuedCount}.`}
            </p>
          )}
        </div>
        {(message || error) && (
          <p
            aria-live="polite"
            className={`card p-4 text-sm font-semibold ${error ? "text-[var(--accent)]" : "text-emerald-700"}`}
          >
            {error || message}
          </p>
        )}
      </aside>
    </div>
  );
}

function ProblemForm({
  contestId,
  disabled = false,
  onSaved,
  maxOrder,
  problem,
  suggestedOrder
}: {
  contestId: string;
  disabled?: boolean;
  onSaved: () => void;
  maxOrder: number;
  problem?: AdminProblem;
  suggestedOrder?: number;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const order = problem?.orderIndex ?? suggestedOrder ?? 1;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetchWithTimeout(
        problem ? `/api/problems/${problem.id}` : `/api/contests/${contestId}/problems`,
        {
          body: JSON.stringify({
            archiveEnabled: form.get("archiveEnabled") === "on",
            archiveIntro: form.get("archiveIntro"),
            baseScore: Number(form.get("baseScore")),
            evaluationRubric: form.get("evaluationRubric"),
            maxScore: Number(form.get("maxScore")),
            officialSolution: form.get("officialSolution"),
            orderIndex: Number(form.get("orderIndex")),
            scoreDecayPer5Min: Number(form.get("scoreDecayPer5Min")),
            statement: form.get("statement"),
            subtopic: form.get("subtopic"),
            title: form.get("title"),
            topic: form.get("topic")
          }),
          headers: { "Content-Type": "application/json" },
          method: problem ? "PATCH" : "POST"
        }
      );
      if (!response.ok) {
        setError((await readApiError(response)).message);
        return;
      }
      if (!problem) event.currentTarget.reset();
      onSaved();
    } catch {
      setError("Не удалось связаться с сервером");
    } finally {
      setPending(false);
    }
  }

  async function deleteProblem() {
    if (!problem || !window.confirm(`Удалить задачу «${problem.title}»?`)) return;
    setPending(true);
    setError("");
    try {
      const response = await fetchWithTimeout(`/api/problems/${problem.id}`, {
        method: "DELETE"
      });
      if (!response.ok) {
        setError((await readApiError(response)).message);
        return;
      }
      onSaved();
    } catch {
      setError("Не удалось связаться с сервером");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      action={problem ? `/api/problems/${problem.id}` : `/api/contests/${contestId}/problems`}
      className="card p-5 sm:p-6"
      method="post"
      onSubmit={submit}
    >
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-[var(--strong)] font-display text-xl font-semibold text-white">
          {String.fromCharCode(64 + order)}
        </span>
        <div>
          <h3 className="font-display text-xl font-semibold">
            {problem ? problem.title : "Новая задача"}
          </h3>
          <p className="text-xs text-[var(--muted)]">
            {problem
              ? topics.find(([value]) => value === problem.topic)?.[1]
              : "Заполните условие и рубрику"}
          </p>
        </div>
      </div>
      <fieldset className="mt-5 grid gap-4 disabled:opacity-70" disabled={disabled || pending}>
        <div className="grid gap-4 md:grid-cols-[5rem_1fr_12rem]">
          <label className="form-label">
            №
            <input
              className="field"
              defaultValue={order}
              max={maxOrder}
              min="1"
              name="orderIndex"
              type="number"
            />
          </label>
          <label className="form-label">
            Название
            <input className="field" defaultValue={problem?.title} name="title" required />
          </label>
          <label className="form-label">
            Тема
            <select
              className="field"
              defaultValue={problem?.topic ?? topics[(order - 1) % topics.length]?.[0]}
              name="topic"
            >
              {topics.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="form-label">
          Подтема для архива
          <input
            className="field"
            defaultValue={problem?.subtopic}
            maxLength={80}
            name="subtopic"
            placeholder="Например: неравенства, окружности, инварианты"
          />
        </label>
        <label className="form-label">
          Условие
          <textarea
            className="field min-h-36 resize-y"
            defaultValue={problem?.statement}
            name="statement"
            required
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="form-label">
            Базовый балл
            <input
              className="field"
              defaultValue={problem?.baseScore ?? defaultScores[order - 1] ?? 200}
              min="1"
              name="baseScore"
              type="number"
            />
          </label>
          <label className="form-label">
            Максимум
            <input
              className="field"
              defaultValue={problem?.maxScore ?? defaultScores[order - 1] ?? 200}
              min="1"
              name="maxScore"
              type="number"
            />
          </label>
          <label className="form-label">
            Снижение / 5 мин
            <input
              className="field"
              defaultValue={problem?.scoreDecayPer5Min ?? 5}
              min="0"
              name="scoreDecayPer5Min"
              type="number"
            />
          </label>
        </div>
        <label className="form-label">
          Критерии проверки для ИИ
          <textarea
            className="field min-h-28 resize-y"
            defaultValue={problem?.evaluationRubric}
            name="evaluationRubric"
            placeholder="Шаги решения, частичные баллы, обязательные обоснования…"
          />
        </label>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
          <label className="flex items-center gap-3 text-sm font-semibold">
            <input
              className="size-4 accent-[var(--accent)]"
              defaultChecked={problem?.archiveEnabled ?? true}
              name="archiveEnabled"
              type="checkbox"
            />
            Добавить задачу в архив после завершения контеста
          </label>
          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
            Тема и подтема не показываются участникам во время контеста.
          </p>
        </div>
        <label className="form-label">
          Вводная для архива
          <textarea
            className="field min-h-24 resize-y"
            defaultValue={problem?.archiveIntro}
            name="archiveIntro"
            placeholder="Дополнительный контекст без подсказки к решению"
          />
        </label>
        <label className="form-label">
          Официальное решение
          <textarea
            className="field min-h-36 resize-y"
            defaultValue={problem?.officialSolution}
            name="officialSolution"
            placeholder="Полное авторское решение, которое можно раскрыть в архиве"
          />
        </label>
      </fieldset>
      {!disabled && (
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--strong)] px-4 text-sm font-semibold text-white disabled:opacity-60"
            disabled={pending}
            type="submit"
          >
            {pending ? (
              <LoaderCircle className="animate-spin" size={16} />
            ) : problem ? (
              <Save size={16} />
            ) : (
              <Plus size={16} />
            )}
            {problem ? "Сохранить задачу" : "Добавить задачу"}
          </button>
          {problem && (
            <button
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-red-200 px-4 text-sm font-semibold text-red-700 disabled:opacity-60 dark:border-red-900 dark:text-red-300"
              disabled={pending}
              onClick={() => void deleteProblem()}
              type="button"
            >
              <Trash2 size={16} />
              Удалить
            </button>
          )}
        </div>
      )}
      {disabled && (
        <p className="mt-4 text-xs font-semibold text-[var(--muted)]">
          После запуска условия заблокированы.
        </p>
      )}
      {error && <p className="mt-3 text-sm font-semibold text-[var(--accent)]">{error}</p>}
    </form>
  );
}

function PolicyToggle({
  defaultChecked,
  description,
  label,
  name
}: {
  defaultChecked: boolean;
  description: string;
  label: string;
  name: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-4 transition hover:border-[var(--line-strong)]">
      <input
        className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
        defaultChecked={defaultChecked}
        name={name}
        type="checkbox"
      />
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-1 block text-xs font-normal leading-5 text-[var(--muted)]">
          {description}
        </span>
      </span>
    </label>
  );
}

function toLocalInput(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
