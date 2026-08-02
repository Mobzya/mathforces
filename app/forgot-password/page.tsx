import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";

export const metadata: Metadata = { title: "Забыли пароль" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      description="В закрытом школьном MVP восстановление подтверждает администратор — так ссылка не уйдёт постороннему человеку."
      title="Как восстановить пароль"
    >
      <div className="mt-6 rounded-2xl bg-[var(--surface-muted)] p-5 text-sm leading-7">
        Сообщите администратору свой ник или электронную почту. В разделе пользователей он создаст
        одноразовую ссылку, действующую 30 минут. После установки нового пароля все старые сессии
        завершатся.
      </div>
      <Link
        className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[var(--strong)] px-4 text-sm font-semibold text-white"
        href="/login"
      >
        Вернуться ко входу
      </Link>
    </AuthShell>
  );
}
