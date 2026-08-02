"use client";

import { Check, LoaderCircle, LogIn } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { fetchWithTimeout, isTimeoutError, readApiError } from "@/components/auth/form-utils";

export function RegisterContestButton({
  contestId,
  initialRegistered,
  isAuthenticated,
  initialError = ""
}: {
  contestId: string;
  initialRegistered: boolean;
  isAuthenticated: boolean;
  initialError?: string;
}) {
  const [isPending, setIsPending] = useState(false);
  const [isRegistered, setIsRegistered] = useState(initialRegistered);
  const [error, setError] = useState(initialError);

  if (!isAuthenticated) {
    return (
      <Link
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--strong)] px-4 text-sm font-semibold text-white"
        href="/login"
      >
        <LogIn size={17} />
        Войти для участия
      </Link>
    );
  }

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError("");

    try {
      const response = await fetchWithTimeout(`/api/contests/${contestId}/register`, {
        method: "POST"
      });
      if (!response.ok) {
        const apiError = await readApiError(response);
        setError(apiError.message);
        return;
      }
      setIsRegistered(true);
      window.location.replace(`/contests/${contestId}`);
    } catch (requestError) {
      setError(
        isTimeoutError(requestError)
          ? "Сервер отвечает слишком долго. Попробуйте ещё раз"
          : "Нет связи с сервером"
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form action={`/api/contests/${contestId}/register`} method="post" onSubmit={register}>
      <button
        className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:opacity-60 ${
          isRegistered
            ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
            : "bg-[var(--strong)] text-white"
        }`}
        disabled={isPending || isRegistered}
        type="submit"
      >
        {isPending ? <LoaderCircle className="animate-spin" size={17} /> : <Check size={17} />}
        {isRegistered ? "Вы зарегистрированы" : "Участвовать"}
      </button>
      {error && (
        <p aria-live="polite" className="mt-2 text-center text-xs font-medium text-[var(--accent)]">
          {error}
        </p>
      )}
    </form>
  );
}
