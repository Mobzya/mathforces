"use client";

import { LoaderCircle, Plus, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { fetchWithTimeout, readApiError } from "@/components/auth/form-utils";
import type { AdminOrganization } from "@/types/admin";

export function OrganizationManager({ organizations }: { organizations: AdminOrganization[] }) {
  const router = useRouter();
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");

  async function send(key: string, url: string, method: "POST" | "PATCH", name: string) {
    setPending(key);
    setError("");
    try {
      const response = await fetchWithTimeout(url, {
        body: JSON.stringify({ name }),
        headers: { "Content-Type": "application/json" },
        method
      });
      if (!response.ok) {
        setError((await readApiError(response)).message);
        return;
      }
      router.refresh();
    } catch {
      setError("Нет связи с сервером");
    } finally {
      setPending("");
    }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await send("new", "/api/admin/organizations", "POST", String(form.get("name")));
    event.currentTarget.reset();
  }

  return (
    <>
      <form className="card flex flex-col gap-3 p-4 sm:flex-row" onSubmit={create}>
        <input className="field" name="name" placeholder="Название новой организации" required />
        <button
          className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--strong)] px-4 text-sm font-semibold text-white"
          disabled={pending === "new"}
          type="submit"
        >
          {pending === "new" ? (
            <LoaderCircle className="animate-spin" size={16} />
          ) : (
            <Plus size={16} />
          )}
          Создать
        </button>
      </form>
      {error && <p className="mt-3 text-sm font-semibold text-[var(--accent)]">{error}</p>}
      <div className="mt-6 space-y-3">
        {organizations.map((organization) => (
          <form
            className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center"
            key={organization.id}
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void send(
                organization.id,
                `/api/admin/organizations/${organization.id}`,
                "PATCH",
                String(form.get("name"))
              );
            }}
          >
            <div className="min-w-0 flex-1">
              <input
                className="field font-semibold"
                defaultValue={organization.name}
                name="name"
                required
              />
              <p className="mt-2 text-xs text-[var(--muted)]">
                {organization.memberCount} участников · {organization.contestCount} закрытых
                контестов
              </p>
            </div>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--line-strong)] px-4 text-sm font-semibold"
              disabled={pending === organization.id}
              type="submit"
            >
              {pending === organization.id ? (
                <LoaderCircle className="animate-spin" size={16} />
              ) : (
                <Save size={16} />
              )}
              Сохранить
            </button>
          </form>
        ))}
      </div>
    </>
  );
}
