import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = { title: "Восстановление пароля" };

export default async function ResetPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const value = (await searchParams).token;
  const token = typeof value === "string" ? value : "";

  return (
    <AuthShell
      description="Одноразовая ссылка действует 30 минут и перестаёт работать сразу после использования."
      title="Задайте новый пароль"
    >
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          В ссылке отсутствует одноразовый код. Попросите администратора создать новую ссылку
          восстановления.
        </div>
      )}
      <Link className="mt-5 inline-flex text-sm font-semibold underline" href="/login">
        Вернуться ко входу
      </Link>
    </AuthShell>
  );
}
