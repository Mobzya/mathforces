"use client";

import Link from "next/link";
import { useCurrentUser } from "@/components/auth/CurrentUserProvider";
import { PasswordSettings } from "@/components/settings/PasswordSettings";

export function AccountSecurityPanel() {
  const { hasError, isLoading, refreshUser, user } = useCurrentUser();

  if (isLoading) {
    return (
      <section aria-label="Загрузка настроек безопасности" className="card p-5 sm:p-6">
        <div className="skeleton h-7 w-56 rounded-lg" />
        <div className="skeleton mt-3 h-4 w-80 max-w-full rounded-full" />
      </section>
    );
  }

  if (user) return <PasswordSettings />;

  if (hasError) {
    return (
      <section className="card p-5 sm:p-6">
        <h2 className="font-display text-2xl font-semibold">Не удалось проверить аккаунт</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Мы не показываем гостевые действия, пока статус сессии неизвестен.
        </p>
        <button
          className="button-primary mt-4 min-h-11 rounded-xl px-4 text-sm font-semibold"
          onClick={() => void refreshUser()}
          type="button"
        >
          Проверить снова
        </button>
      </section>
    );
  }

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="font-display text-2xl font-semibold">Безопасность аккаунта</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Войдите, чтобы изменить пароль и завершить другие сессии.
      </p>
      <Link
        className="button-primary mt-4 inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold"
        href="/login"
      >
        Войти
      </Link>
    </section>
  );
}
