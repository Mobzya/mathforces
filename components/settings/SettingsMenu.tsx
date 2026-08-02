"use client";

import { Check, Monitor, Moon, Settings2, Sun } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePreferences } from "@/components/settings/PreferencesProvider";
import type { ThemePreference } from "@/types/preferences";

const themeOptions: Array<{
  icon: typeof Sun;
  label: string;
  value: ThemePreference;
}> = [
  { icon: Monitor, label: "Системная", value: "system" },
  { icon: Sun, label: "Светлая", value: "light" },
  { icon: Moon, label: "Тёмная", value: "dark" }
];

export function SettingsMenu() {
  const menu = useRef<HTMLDetailsElement>(null);
  const { preferences, setTheme } = usePreferences();

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) {
        menu.current?.removeAttribute("open");
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  return (
    <details className="group relative" ref={menu}>
      <summary
        aria-label="Настройки интерфейса"
        className="grid size-10 cursor-pointer list-none place-items-center rounded-xl border border-transparent text-[var(--muted)] transition-all hover:bg-[var(--surface)] hover:text-[var(--ink)] group-open:border-[var(--line)] group-open:bg-[var(--surface)] group-open:text-[var(--ink)] group-open:shadow-sm [&::-webkit-details-marker]:hidden"
      >
        <Settings2
          aria-hidden="true"
          className="transition-transform group-open:rotate-45"
          size={18}
        />
      </summary>
      <div className="menu-popover absolute right-0 top-12 z-50 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 shadow-[var(--shadow-popover)]">
        <div className="px-2 pb-2">
          <p className="font-display text-xl font-semibold">Быстрые настройки</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Оформление сохраняется на этом устройстве.
          </p>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {themeOptions.map(({ icon: Icon, label, value }) => (
            <button
              aria-pressed={preferences.theme === value}
              className={`relative flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border text-xs font-semibold transition ${
                preferences.theme === value
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "border-[var(--line)] hover:border-[var(--line-strong)]"
              }`}
              data-preference-key="theme"
              data-preference-value={value}
              key={value}
              onClick={() => setTheme(value)}
              type="button"
            >
              <Icon aria-hidden="true" size={18} />
              {label}
              {preferences.theme === value && (
                <Check className="absolute right-1.5 top-1.5" size={12} />
              )}
            </button>
          ))}
        </div>
        <Link
          className="button-primary mt-3 flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold"
          href="/settings"
          onClick={() => menu.current?.removeAttribute("open")}
        >
          Все настройки
        </Link>
      </div>
    </details>
  );
}
