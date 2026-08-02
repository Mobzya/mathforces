"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { fetchWithTimeout, isTimeoutError, readApiError } from "@/components/auth/form-utils";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("confirmPassword") ?? "")) {
      setError("Подтверждение не совпадает с новым паролем");
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await fetchWithTimeout("/api/auth/reset-password", {
        body: JSON.stringify({ password, token }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      if (!response.ok) {
        setError((await readApiError(response)).message);
        return;
      }
      const payload = (await response.json()) as { profileUrl: string };
      router.replace(payload.profileUrl);
      router.refresh();
    } catch (requestError) {
      setError(
        isTimeoutError(requestError) ? "Сервер отвечает слишком долго" : "Нет связи с сервером"
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="mt-6 grid gap-4" onSubmit={submit}>
      <label className="form-label">
        Новый пароль
        <input
          autoComplete="new-password"
          className="field"
          maxLength={72}
          minLength={8}
          name="password"
          required
          type="password"
        />
      </label>
      <label className="form-label">
        Повторите пароль
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
      <button
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--strong)] px-5 text-sm font-semibold text-white disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending && <LoaderCircle className="animate-spin" size={16} />}
        Сохранить и войти
      </button>
      {error && (
        <p aria-live="polite" className="text-sm font-semibold text-[var(--accent)]">
          {error}
        </p>
      )}
    </form>
  );
}
