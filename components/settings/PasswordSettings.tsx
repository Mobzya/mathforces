"use client";

import { KeyRound, LoaderCircle } from "lucide-react";
import { type FormEvent, useState } from "react";
import { fetchWithTimeout, isTimeoutError, readApiError } from "@/components/auth/form-utils";

export function PasswordSettings() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const newPassword = String(form.get("newPassword") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    setError("");
    setSuccess("");
    if (newPassword !== confirmPassword) {
      setError("Подтверждение не совпадает с новым паролем");
      return;
    }

    setPending(true);
    try {
      const response = await fetchWithTimeout("/api/users/me/password", {
        body: JSON.stringify({
          currentPassword: form.get("currentPassword"),
          newPassword
        }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH"
      });
      if (!response.ok) {
        setError((await readApiError(response)).message);
        return;
      }
      formElement.reset();
      setSuccess("Пароль изменён, остальные сессии завершены");
    } catch (requestError) {
      setError(
        isTimeoutError(requestError) ? "Сервер отвечает слишком долго" : "Нет связи с сервером"
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--strong)] text-white">
          <KeyRound aria-hidden="true" size={18} />
        </span>
        <div>
          <h2 className="font-display text-2xl font-semibold">Безопасность аккаунта</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            После смены пароля все остальные устройства выйдут из аккаунта.
          </p>
        </div>
      </div>
      <form className="mt-5 grid gap-4" onSubmit={submit}>
        <label className="form-label">
          Текущий пароль
          <input
            autoComplete="current-password"
            className="field"
            maxLength={72}
            name="currentPassword"
            required
            type="password"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="form-label">
            Новый пароль
            <input
              autoComplete="new-password"
              className="field"
              maxLength={72}
              minLength={8}
              name="newPassword"
              required
              type="password"
            />
          </label>
          <label className="form-label">
            Повторите новый пароль
            <input
              autoComplete="new-password"
              className="field"
              maxLength={72}
              minLength={8}
              name="confirmPassword"
              required
              type="password"
            />
          </label>
        </div>
        <button
          className="inline-flex min-h-11 w-fit items-center gap-2 rounded-xl bg-[var(--strong)] px-4 text-sm font-semibold text-white disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending && <LoaderCircle className="animate-spin" size={16} />}
          Изменить пароль
        </button>
        {(error || success) && (
          <p
            aria-live="polite"
            className={`text-sm font-semibold ${
              error ? "text-[var(--accent)]" : "text-emerald-700"
            }`}
          >
            {error || success}
          </p>
        )}
      </form>
    </section>
  );
}
