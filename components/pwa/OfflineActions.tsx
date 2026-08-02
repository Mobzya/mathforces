"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";

export function OfflineActions() {
  return (
    <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
      <button
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--strong)] px-4 text-sm font-semibold text-white"
        onClick={() => window.location.reload()}
        type="button"
      >
        <RefreshCw aria-hidden="true" size={17} />
        Проверить соединение
      </button>
      <Link
        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--line-strong)] bg-white px-4 text-sm font-semibold"
        href="/"
      >
        На главную
      </Link>
    </div>
  );
}
