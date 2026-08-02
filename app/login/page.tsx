import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Вход"
};

export const dynamic = "force-dynamic";

export default async function LoginPage({
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
      description="Вернитесь к своим контестам, посылкам и рейтингу."
      title="С возвращением"
    >
      <LoginForm initialFormError={initialFormError} />
      <p className="mt-4 text-center text-sm">
        <Link
          className="font-semibold text-[var(--muted)] hover:text-[var(--accent)] hover:underline"
          href="/forgot-password"
        >
          Забыли пароль?
        </Link>
      </p>
      <p className="mt-5 text-center text-sm text-[var(--muted)]">
        Ещё нет аккаунта?{" "}
        <Link className="font-semibold text-[var(--accent)] hover:underline" href="/register">
          Зарегистрироваться
        </Link>
      </p>
    </AuthShell>
  );
}
