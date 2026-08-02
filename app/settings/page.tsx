import type { Metadata } from "next";
import { SlidersHorizontal } from "lucide-react";
import { AccountSecurityPanel } from "@/components/settings/AccountSecurityPanel";
import { PreferencesPanel } from "@/components/settings/PreferencesPanel";

export const metadata: Metadata = {
  title: "Настройки"
};

export default function SettingsPage() {
  return (
    <section className="page-shell page-section">
      <div className="mb-9 max-w-2xl">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-[var(--accent)]">
          <SlidersHorizontal aria-hidden="true" size={15} />
          Интерфейс
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
          Важные настройки
        </h1>
        <p className="mt-4 text-lg leading-8 text-[var(--muted)]">
          Настройте внешний вид, движение и плотность данных под своё устройство.
        </p>
      </div>
      <PreferencesPanel />
      <div className="mt-5">
        <AccountSecurityPanel />
      </div>
    </section>
  );
}
