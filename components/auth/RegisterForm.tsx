"use client";

import {
  ArrowRight,
  AtSign,
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  LockKeyhole,
  Mail
} from "lucide-react";
import { useRef, useState } from "react";
import { fetchWithTimeout, isTimeoutError, readApiError } from "@/components/auth/form-utils";

export function RegisterForm({ initialFormError = "" }: { initialFormError?: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, setIsPending] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [formError, setFormError] = useState(initialFormError);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const errors = validate(form);
    if (Object.keys(errors).length > 0) {
      showErrors(errors, "Исправьте выделенные поля");
      return;
    }
    setIsPending(true);
    setFormError("");
    setFieldErrors({});
    try {
      const response = await fetchWithTimeout("/api/auth/register", {
        body: JSON.stringify({
          email: form.get("email"),
          nickname: form.get("nickname"),
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
      window.location.replace(`/profile/${payload.user.id}`);
    } catch (error: unknown) {
      setFormError(
        isTimeoutError(error) ? "Сервер отвечает слишком долго" : "Нет связи с сервером"
      );
    } finally {
      setIsPending(false);
    }
  }
  function showErrors(errors: Record<string, string>, message: string) {
    setFieldErrors(errors);
    setFormError(message);
    window.requestAnimationFrame(() =>
      formRef.current?.querySelector<HTMLElement>(`[name='${Object.keys(errors)[0]}']`)?.focus()
    );
  }
  function clear(field: string) {
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
    setFormError("");
  }

  return (
    <form
      action="/api/auth/register"
      className="space-y-4"
      method="post"
      noValidate
      onSubmit={handleSubmit}
      ref={formRef}
    >
      <Field error={fieldErrors.nickname} label="Логин" name="nickname">
        <AtSign className="field-icon" size={18} />
        <input
          autoComplete="nickname"
          className={`field field-with-icon ${fieldErrors.nickname ? "field-error" : ""}`}
          maxLength={24}
          minLength={3}
          name="nickname"
          onChange={() => clear("nickname")}
          placeholder="euler_jr"
          required
        />
      </Field>
      <Field error={fieldErrors.email} label="Электронная почта" name="email">
        <Mail className="field-icon" size={18} />
        <input
          autoComplete="email"
          className={`field field-with-icon ${fieldErrors.email ? "field-error" : ""}`}
          name="email"
          onChange={() => clear("email")}
          placeholder="name@example.ru"
          required
          type="email"
        />
      </Field>
      <Field error={fieldErrors.password} label="Пароль" name="password">
        <LockKeyhole className="field-icon" size={18} />
        <input
          autoComplete="new-password"
          className={`field field-with-icon ${fieldErrors.password ? "field-error" : ""}`}
          minLength={8}
          name="password"
          onChange={() => clear("password")}
          placeholder="Не менее 8 символов"
          required
          type="password"
        />
      </Field>
      <Field
        error={fieldErrors.passwordConfirmation}
        label="Повторите пароль"
        name="passwordConfirmation"
      >
        <LockKeyhole className="field-icon" size={18} />
        <input
          autoComplete="new-password"
          className={`field field-with-icon ${fieldErrors.passwordConfirmation ? "field-error" : ""}`}
          minLength={8}
          name="passwordConfirmation"
          onChange={() => clear("passwordConfirmation")}
          placeholder="Ещё раз"
          required
          type="password"
        />
      </Field>
      <p className="rounded-xl bg-[var(--surface-muted)] px-4 py-3 text-xs leading-5 text-[var(--muted)]">
        Класс, организацию, описание и аватар можно добавить позже в профиле.
      </p>
      {formError && (
        <div
          className="flex gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          <CircleAlert className="mt-0.5 shrink-0" size={18} />
          <div>
            <p className="font-semibold">Не удалось зарегистрироваться</p>
            <p className="mt-0.5">{formError}</p>
          </div>
        </div>
      )}
      {isRedirecting && (
        <div className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 size={18} />
          <span>Аккаунт создан. Открываем профиль…</span>
        </div>
      )}
      <button
        className="button-primary inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold disabled:opacity-60"
        disabled={isPending || isRedirecting}
        type="submit"
      >
        {isPending || isRedirecting ? (
          <LoaderCircle className="animate-spin" size={17} />
        ) : (
          <ArrowRight size={17} />
        )}
        {isRedirecting ? "Открываем профиль…" : isPending ? "Создаём аккаунт…" : "Создать аккаунт"}
      </button>
    </form>
  );
}

function validate(form: FormData) {
  const errors: Record<string, string> = {};
  const nickname = String(form.get("nickname") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (nickname.length < 3 || nickname.length > 24 || !/^[\p{L}\p{N}_-]+$/u.test(nickname))
    errors.nickname = "От 3 до 24 букв, цифр, дефисов или подчёркиваний";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Укажите корректную почту";
  if (password.length < 8 || password.length > 72)
    errors.password = "Пароль должен содержать от 8 до 72 символов";
  if (password !== form.get("passwordConfirmation"))
    errors.passwordConfirmation = "Пароли не совпадают";
  return errors;
}
function Field({
  children,
  error,
  label,
  name
}: {
  children: React.ReactNode;
  error?: string;
  label: string;
  name: string;
}) {
  return (
    <label className="form-label">
      {label}
      <span className="relative">{children}</span>
      {error && (
        <span className="text-xs font-medium text-[var(--accent)]" id={`${name}-error`}>
          {error}
        </span>
      )}
    </label>
  );
}
