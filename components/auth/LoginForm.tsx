"use client";

import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  LockKeyhole,
  Mail
} from "lucide-react";
import { useRef, useState } from "react";
import { fetchWithTimeout, isTimeoutError, readApiError } from "@/components/auth/form-utils";

export function LoginForm({ initialFormError = "" }: { initialFormError?: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, setIsPending] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [formError, setFormError] = useState(initialFormError);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setFormError("");
    setFieldErrors({});

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const clientErrors: Record<string, string> = {};

    if (!email) {
      clientErrors.email = "Введите электронную почту";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      clientErrors.email = "Укажите корректную электронную почту";
    }
    if (!password) {
      clientErrors.password = "Введите пароль";
    }

    if (Object.keys(clientErrors).length > 0) {
      showErrors(clientErrors, "Исправьте выделенные поля");
      setIsPending(false);
      return;
    }

    try {
      const response = await fetchWithTimeout("/api/auth/login", {
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password")
        }),
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });

      if (!response.ok) {
        const error = await readApiError(response);
        showErrors(error.fieldErrors, error.message);
        return;
      }

      const payload = (await response.json()) as { user: { id: string } };
      setIsRedirecting(true);
      window.dispatchEvent(new Event("mathforces:user-updated"));
      window.requestAnimationFrame(() => {
        window.location.replace(`/profile/${payload.user.id}`);
      });
    } catch (error: unknown) {
      setFormError(
        isTimeoutError(error)
          ? "Сервер отвечает слишком долго. Повторите попытку"
          : "Нет связи с сервером. Проверьте интернет и попробуйте ещё раз"
      );
    } finally {
      setIsPending(false);
    }
  }

  function showErrors(errors: Record<string, string>, message: string) {
    setFieldErrors(errors);
    setFormError(message);

    window.requestAnimationFrame(() => {
      const firstField = Object.keys(errors)[0];
      if (firstField) {
        formRef.current?.querySelector<HTMLElement>(`[name='${firstField}']`)?.focus();
      }
    });
  }

  function clearFieldError(field: string) {
    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }
      const next = { ...current };
      delete next[field];
      return next;
    });
    setFormError("");
  }

  return (
    <form
      action="/api/auth/login"
      className="space-y-4"
      method="post"
      noValidate
      onSubmit={handleSubmit}
      ref={formRef}
    >
      <noscript>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Для входа необходимо включить JavaScript.
        </div>
      </noscript>
      <label className="form-label">
        Электронная почта
        <span className="relative">
          <Mail
            aria-hidden="true"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
            size={18}
          />
          <input
            aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
            aria-invalid={Boolean(fieldErrors.email)}
            autoComplete="email"
            className={`field field-with-icon ${fieldErrors.email ? "field-error" : ""}`}
            name="email"
            onChange={() => clearFieldError("email")}
            placeholder="name@example.ru"
            required
            type="email"
          />
        </span>
        {fieldErrors.email && (
          <span className="text-xs font-medium text-[var(--accent)]" id="login-email-error">
            {fieldErrors.email}
          </span>
        )}
      </label>
      <label className="form-label">
        Пароль
        <span className="relative">
          <LockKeyhole
            aria-hidden="true"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
            size={18}
          />
          <input
            aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
            aria-invalid={Boolean(fieldErrors.password)}
            autoComplete="current-password"
            className={`field field-with-icon ${fieldErrors.password ? "field-error" : ""}`}
            name="password"
            onChange={() => clearFieldError("password")}
            placeholder="Ваш пароль"
            required
            type="password"
          />
        </span>
        {fieldErrors.password && (
          <span className="text-xs font-medium text-[var(--accent)]" id="login-password-error">
            {fieldErrors.password}
          </span>
        )}
      </label>

      {formError && (
        <div
          className="flex gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          <CircleAlert className="mt-0.5 shrink-0" size={18} />
          <div>
            <p className="font-semibold">Не удалось войти</p>
            <p className="mt-0.5">{formError}</p>
          </div>
        </div>
      )}

      {isRedirecting && (
        <div
          className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          role="status"
        >
          <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
          <div>
            <p className="font-semibold">Вход выполнен</p>
            <p className="mt-0.5">Открываем ваш профиль…</p>
          </div>
        </div>
      )}

      <button
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--strong)] px-4 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending || isRedirecting}
        type="submit"
      >
        {isPending || isRedirecting ? (
          <>
            <LoaderCircle className="animate-spin" size={17} />
            {isRedirecting ? "Открываем профиль…" : "Входим…"}
          </>
        ) : (
          <>
            Войти
            <ArrowRight size={17} />
          </>
        )}
      </button>
    </form>
  );
}
