import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Регистрация"
};

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const user = await getCurrentUser();
  if (user) {
    redirect(`/profile/${user.id}`);
  }

  const requestedError = (await searchParams).error;
  const initialFormError = typeof requestedError === "string" ? requestedError.slice(0, 300) : "";

  return (
    <AuthShell
      description="Только главное — остальное можно спокойно заполнить в профиле."
      title="Войти в соревнование"
    >
      <RegisterForm initialFormError={initialFormError} />
      <p className="mt-5 text-center text-sm text-[var(--muted)]">
        Уже зарегистрированы?{" "}
        <Link className="font-semibold text-[var(--accent)] hover:underline" href="/login">
          Войти
        </Link>
      </p>
    </AuthShell>
  );
}
