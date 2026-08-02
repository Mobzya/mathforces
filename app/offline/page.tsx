import type { Metadata } from "next";
import { CloudOff } from "lucide-react";
import { OfflineActions } from "@/components/pwa/OfflineActions";

export const metadata: Metadata = {
  title: "Нет соединения"
};

export default function OfflinePage() {
  return (
    <section className="page-shell grid min-h-[65vh] place-items-center py-16 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-[var(--strong)] text-white">
          <CloudOff size={27} />
        </span>
        <h1 className="mt-6 font-display text-4xl font-semibold">Вы не в сети</h1>
        <p className="mt-4 leading-7 text-[var(--muted)]">
          Базовые страницы Mathforces доступны из кэша. Для свежих результатов и посылок
          восстановите соединение.
        </p>
        <OfflineActions />
      </div>
    </section>
  );
}
