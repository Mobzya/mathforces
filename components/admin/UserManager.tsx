"use client";

import { KeyRound, LoaderCircle, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { fetchWithTimeout, readApiError } from "@/components/auth/form-utils";
import { Badge } from "@/components/ui/Badge";
import type { AdminUser } from "@/types/admin";

export function UserManager({
  organizations,
  users
}: {
  organizations: { id: string; name: string }[];
  users: AdminUser[];
}) {
  if (users.length === 0) {
    return (
      <div className="card p-10 text-center text-[var(--muted)]">Пользователи не найдены.</div>
    );
  }
  return (
    <div className="space-y-3">
      {users.map((user) => (
        <UserRow key={user.id} organizations={organizations} user={user} />
      ))}
    </div>
  );
}

function UserRow({
  organizations,
  user
}: {
  organizations: { id: string; name: string }[];
  user: AdminUser;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [resetUrl, setResetUrl] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetchWithTimeout(`/api/admin/users/${user.id}`, {
        body: JSON.stringify({
          organizationId: form.get("organizationId"),
          role: form.get("role")
        }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH"
      });
      if (!response.ok) {
        setMessage((await readApiError(response)).message);
        return;
      }
      setMessage("Сохранено");
      router.refresh();
    } catch {
      setMessage("Нет связи с сервером");
    } finally {
      setPending(false);
    }
  }

  async function createResetLink() {
    setPending(true);
    setMessage("");
    setResetUrl("");
    try {
      const response = await fetchWithTimeout(`/api/admin/users/${user.id}/password-reset`, {
        method: "POST"
      });
      if (!response.ok) {
        setMessage((await readApiError(response)).message);
        return;
      }
      const payload = (await response.json()) as { resetUrl: string };
      setResetUrl(payload.resetUrl);
      setMessage("Одноразовая ссылка создана на 30 минут");
    } catch {
      setMessage("Нет связи с сервером");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="card grid gap-4 p-5 lg:grid-cols-[1fr_13rem_13rem_auto] lg:items-end"
      onSubmit={save}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-mono font-bold">{user.nickname}</p>
          {user.role === "ADMIN" && <Badge tone="red">Админ</Badge>}
        </div>
        <p className="mt-1 truncate text-sm text-[var(--muted)]">{user.email}</p>
        <p className="mt-2 text-xs text-[var(--muted)]">
          {user.submissionCount} посылок · {user.contestCount} контестов · рейтинг{" "}
          {user.currentRating === 0 ? "—" : user.currentRating}
        </p>
      </div>
      <label className="form-label">
        Организация
        <select className="field" defaultValue={user.organization.id} name="organizationId">
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>
      </label>
      <label className="form-label">
        Роль
        <select className="field" defaultValue={user.role} name="role">
          <option value="PARTICIPANT">Участник</option>
          <option value="ADMIN">Администратор</option>
        </select>
      </label>
      <button
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--strong)] px-4 text-sm font-semibold text-white"
        disabled={pending}
        type="submit"
      >
        {pending ? <LoaderCircle className="animate-spin" size={16} /> : <Save size={16} />}
        Сохранить
      </button>
      <div className="flex flex-col gap-2 lg:col-span-4 sm:flex-row sm:items-center">
        <button
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[var(--line-strong)] px-3 text-xs font-semibold disabled:opacity-60"
          disabled={pending}
          onClick={() => void createResetLink()}
          type="button"
        >
          <KeyRound size={14} />
          Ссылка восстановления
        </button>
        {resetUrl && (
          <input
            aria-label="Одноразовая ссылка восстановления"
            className="field min-w-0 flex-1 font-mono text-xs"
            onFocus={(event) => event.currentTarget.select()}
            readOnly
            value={resetUrl}
          />
        )}
      </div>
      {message && (
        <p className="text-xs font-semibold text-[var(--accent)] lg:col-span-4">{message}</p>
      )}
    </form>
  );
}
