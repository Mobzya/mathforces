"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Ошибка интерфейса Mathforces", error);
  }, [error]);

  return (
    <section className="page-shell grid min-h-[65vh] place-items-center py-16 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
          <AlertTriangle aria-hidden="true" size={28} />
        </span>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
          Что-то пошло не так
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold">Страница не загрузилась</h1>
        <p className="mt-4 leading-7 text-[var(--muted)]">
          Попробуйте повторить запрос. Если ошибка сохраняется, сообщите администратору
          {error.digest ? ` код ${error.digest}` : ""}.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--strong)] px-4 text-sm font-semibold text-white"
            onClick={reset}
            type="button"
          >
            <RefreshCw aria-hidden="true" size={17} />
            Повторить
          </button>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--line-strong)] bg-white px-4 text-sm font-semibold"
            href="/"
          >
            На главную
          </Link>
        </div>
      </div>
    </section>
  );
}
