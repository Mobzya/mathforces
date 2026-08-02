"use client";

import { Check, LoaderCircle, Plus, RotateCcw, Settings2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { readApiError } from "@/components/auth/form-utils";
import { AvatarEditor } from "@/components/profile/AvatarEditor";
import { PROFILE_ACCENTS, PROFILE_PATTERNS, TOPIC_LABELS } from "@/lib/profile/customization";
import type { CurrentUser, PublicOrganization } from "@/types/account";

export function ProfileSettings({
  organizations,
  user
}: {
  organizations: PublicOrganization[];
  user: CurrentUser;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreatingOrganization, setIsCreatingOrganization] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [organizationOptions, setOrganizationOptions] = useState(organizations);
  const [organizationsLoaded, setOrganizationsLoaded] = useState(false);
  const [organizationsLoading, setOrganizationsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function openSettings() {
    setIsOpen(true);
    if (organizationsLoaded || organizationsLoading) return;
    setOrganizationsLoading(true);
    try {
      const response = await fetch("/api/organizations");
      if (!response.ok) throw new Error(`Organizations request failed: ${response.status}`);
      const payload = (await response.json()) as {
        organizations: PublicOrganization[];
      };
      setOrganizationOptions(payload.organizations);
      setOrganizationsLoaded(true);
    } catch {
      setFieldErrors((current) => ({
        ...current,
        organization: "Список организаций не загрузился. Текущая организация доступна."
      }));
    } finally {
      setOrganizationsLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setMessage("");
    setFieldErrors({});

    const form = new FormData(event.currentTarget);

    try {
      let organizationId = String(form.get("organizationId") ?? "");

      if (isCreatingOrganization) {
        const organizationResponse = await fetch("/api/organizations", {
          body: JSON.stringify({ name: form.get("organizationName") }),
          headers: { "Content-Type": "application/json" },
          method: "POST"
        });
        if (!organizationResponse.ok) {
          const error = await readApiError(organizationResponse);
          setFieldErrors({ organization: error.fieldErrors.name ?? error.message });
          return;
        }
        const organizationPayload = (await organizationResponse.json()) as {
          organization: PublicOrganization;
        };
        organizationId = organizationPayload.organization.id;
      }

      const response = await fetch("/api/users/me", {
        body: JSON.stringify({
          description: form.get("description"),
          favoriteTopic: form.get("favoriteTopic"),
          grade: form.get("grade"),
          nickname: form.get("nickname"),
          organizationId,
          profileAccent: form.get("profileAccent"),
          profilePattern: form.get("profilePattern"),
          showGrade: form.get("showGrade") === "on",
          showOrganization: form.get("showOrganization") === "on"
        }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH"
      });
      if (!response.ok) {
        const error = await readApiError(response);
        setFieldErrors(error.fieldErrors);
        setMessage(error.message);
        return;
      }

      setMessage("Изменения сохранены");
      setIsCreatingOrganization(false);
      window.dispatchEvent(new Event("mathforces:user-updated"));
      router.refresh();
    } catch {
      setMessage("Нет связи с сервером. Попробуйте ещё раз");
    } finally {
      setIsPending(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--line-strong)] bg-[var(--surface)] px-4 text-sm font-semibold transition hover:-translate-y-0.5 hover:border-[var(--ink)]"
        onClick={() => void openSettings()}
        type="button"
      >
        <Settings2 size={17} />
        Настроить профиль
      </button>
    );
  }

  return (
    <form className="card p-5 sm:p-6" onSubmit={handleSubmit}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--accent)]">
            Настройки
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold">Ваш профиль</h2>
        </div>
        <button
          aria-label="Закрыть настройки"
          className="grid size-10 place-items-center rounded-xl text-[var(--muted)] hover:bg-[var(--surface-muted)]"
          onClick={() => setIsOpen(false)}
          type="button"
        >
          <RotateCcw size={17} />
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="form-label">
          Ник
          <input
            className="field"
            defaultValue={user.nickname}
            maxLength={24}
            minLength={3}
            name="nickname"
            required
          />
          {fieldErrors.nickname && (
            <span className="text-xs text-[var(--accent)]">{fieldErrors.nickname}</span>
          )}
        </label>
        <label className="form-label">
          Класс
          <select className="field appearance-none" defaultValue={user.grade ?? ""} name="grade">
            <option value="">Не указывать</option>
            {Array.from({ length: 11 }, (_, index) => index + 1).map((grade) => (
              <option key={grade} value={grade}>
                {grade} класс
              </option>
            ))}
          </select>
          {fieldErrors.grade && (
            <span className="text-xs text-[var(--accent)]">{fieldErrors.grade}</span>
          )}
        </label>
      </div>

      <div className="mt-4">
        <AvatarEditor
          avatarUrl={user.avatarUrl}
          nickname={user.nickname}
          rankColor={user.rank.color}
        />
      </div>

      <label className="form-label mt-4">
        Описание
        <textarea
          className="field min-h-28 resize-y"
          defaultValue={user.description}
          maxLength={400}
          name="description"
          placeholder="Расскажите о любимых темах или математических целях"
        />
        {fieldErrors.description && (
          <span className="text-xs text-[var(--accent)]">{fieldErrors.description}</span>
        )}
      </label>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="form-label">
          Любимая тема
          <select
            className="field appearance-none"
            defaultValue={user.favoriteTopic ?? ""}
            name="favoriteTopic"
          >
            <option value="">Не указывать</option>
            {Object.entries(TOPIC_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="form-label">
          Фон профиля
          <select
            className="field appearance-none"
            defaultValue={user.profilePattern}
            name="profilePattern"
          >
            {Object.entries(PROFILE_PATTERNS).map(([value, item]) => (
              <option key={value} value={value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="mt-5">
        <legend className="text-sm font-semibold">Акцент обложки</legend>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {Object.entries(PROFILE_ACCENTS).map(([value, item]) => (
            <label className="cursor-pointer text-center" key={value}>
              <input
                className="peer sr-only"
                defaultChecked={user.profileAccent === value}
                name="profileAccent"
                type="radio"
                value={value}
              />
              <span
                className="mx-auto block size-10 rounded-xl border-4 border-transparent shadow-sm transition peer-checked:border-[var(--surface)] peer-checked:outline peer-checked:outline-2 peer-checked:outline-[var(--ink)]"
                style={{ backgroundColor: item.color }}
                title={item.label}
              />
              <span className="mt-1 hidden text-[10px] text-[var(--muted)] sm:block">
                {item.label}
              </span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Цвет ника не меняется: он всегда соответствует рейтинговому званию.
        </p>
      </fieldset>

      <fieldset className="mt-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <legend className="text-sm font-semibold">Организация</legend>
          <button
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)]"
            onClick={() => setIsCreatingOrganization((value) => !value)}
            type="button"
          >
            <Plus size={14} />
            {isCreatingOrganization ? "Выбрать существующую" : "Создать новую"}
          </button>
        </div>
        {isCreatingOrganization ? (
          <input
            className="field"
            maxLength={80}
            minLength={2}
            name="organizationName"
            placeholder="Название школы, кружка или команды"
            required
          />
        ) : (
          <select
            className="field appearance-none"
            defaultValue={user.organization.id}
            name="organizationId"
            required
          >
            {organizationOptions.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
                {organizationsLoaded ? ` · ${organization.memberCount} уч.` : ""}
              </option>
            ))}
          </select>
        )}
        {organizationsLoading && (
          <span className="inline-flex items-center gap-2 text-xs text-[var(--muted)]">
            <LoaderCircle className="animate-spin" size={13} />
            Обновляем список организаций…
          </span>
        )}
        {fieldErrors.organization && (
          <span className="text-xs text-[var(--accent)]">{fieldErrors.organization}</span>
        )}
      </fieldset>

      <fieldset className="mt-5 rounded-2xl border border-[var(--line)] p-4">
        <legend className="px-1 text-sm font-semibold">Видимость данных</legend>
        <label className="mt-1 flex min-h-10 items-center gap-3 text-sm">
          <input
            className="size-4 accent-[var(--accent)]"
            defaultChecked={user.showOrganization}
            name="showOrganization"
            type="checkbox"
          />
          Показывать организацию в профиле
        </label>
        <label className="flex min-h-10 items-center gap-3 text-sm">
          <input
            className="size-4 accent-[var(--accent)]"
            defaultChecked={user.showGrade}
            name="showGrade"
            type="checkbox"
          />
          Показывать класс в профиле
        </label>
      </fieldset>

      {message && (
        <p
          className={`mt-4 rounded-xl px-4 py-3 text-sm ${
            message === "Изменения сохранены"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
          role="status"
        >
          {message}
        </p>
      )}

      <button
        className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--strong)] px-4 text-sm font-semibold text-white disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? (
          <>
            <LoaderCircle className="animate-spin" size={17} />
            Сохраняем…
          </>
        ) : (
          <>
            <Check size={17} />
            Сохранить
          </>
        )}
      </button>
    </form>
  );
}
