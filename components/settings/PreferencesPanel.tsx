"use client";

import { Check, Gauge, Monitor, Moon, MousePointer2, RotateCcw, Sparkles, Sun } from "lucide-react";
import { usePreferences } from "@/components/settings/PreferencesProvider";
import type { DensityPreference, MotionPreference, ThemePreference } from "@/types/preferences";

const themes: Array<{
  description: string;
  icon: typeof Sun;
  label: string;
  value: ThemePreference;
}> = [
  {
    description: "Следует настройке операционной системы.",
    icon: Monitor,
    label: "Системная",
    value: "system"
  },
  {
    description: "Светлый фон и контрастные тёмные элементы.",
    icon: Sun,
    label: "Светлая",
    value: "light"
  },
  {
    description: "Глубокие синие поверхности для вечерней работы.",
    icon: Moon,
    label: "Тёмная",
    value: "dark"
  }
];

export function PreferencesPanel() {
  const { preferences, resetPreferences, setDensity, setMotion, setTheme } = usePreferences();

  return (
    <div className="space-y-5">
      <PreferenceSection
        description="Тема применяется ко всем страницам Mathforces."
        icon={Sparkles}
        title="Оформление"
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {themes.map(({ description, icon: Icon, label, value }) => (
            <ChoiceCard
              active={preferences.theme === value}
              description={description}
              icon={Icon}
              key={value}
              label={label}
              onClick={() => setTheme(value)}
              value={value}
            />
          ))}
        </div>
      </PreferenceSection>

      <PreferenceSection
        description="Можно отключить перестановку строк и счётчики рейтинга."
        icon={MousePointer2}
        title="Анимации"
      >
        <SegmentedControl
          onChange={(value) => setMotion(value as MotionPreference)}
          preferenceKey="motion"
          options={[
            { label: "Системные", value: "system" },
            { label: "Полные", value: "full" },
            { label: "Сокращённые", value: "reduced" }
          ]}
          value={preferences.motion}
        />
      </PreferenceSection>

      <PreferenceSection
        description="Компактный режим показывает больше результатов на экране."
        icon={Gauge}
        title="Плотность таблиц"
      >
        <SegmentedControl
          onChange={(value) => setDensity(value as DensityPreference)}
          preferenceKey="density"
          options={[
            { label: "Комфортная", value: "comfortable" },
            { label: "Компактная", value: "compact" }
          ]}
          value={preferences.density}
        />
      </PreferenceSection>

      <div className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Настройки сохранены автоматически</p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Они применяются сразу и синхронизируются между вкладками.
          </p>
        </div>
        <button
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-sm font-semibold transition hover:border-[var(--ink)]"
          data-preference-reset
          onClick={resetPreferences}
          type="button"
        >
          <RotateCcw aria-hidden="true" size={15} />
          Сбросить
        </button>
      </div>
    </div>
  );
}

function PreferenceSection({
  children,
  description,
  icon: Icon,
  title
}: {
  children: React.ReactNode;
  description: string;
  icon: typeof Sparkles;
  title: string;
}) {
  return (
    <section className="card p-5 sm:p-6">
      <div className="flex gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--strong)] text-white">
          <Icon aria-hidden="true" size={18} />
        </span>
        <div>
          <h2 className="font-display text-2xl font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function ChoiceCard({
  active,
  description,
  icon: Icon,
  label,
  onClick,
  value
}: {
  active: boolean;
  description: string;
  icon: typeof Sun;
  label: string;
  onClick: () => void;
  value: ThemePreference;
}) {
  return (
    <button
      aria-pressed={active}
      className={`relative min-h-36 rounded-2xl border p-4 text-left transition ${
        active
          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
          : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--line-strong)]"
      }`}
      data-preference-key="theme"
      data-preference-value={value}
      onClick={onClick}
      type="button"
    >
      <Icon className={active ? "text-[var(--accent)]" : "text-[var(--muted)]"} size={21} />
      <p className="mt-5 font-semibold">{label}</p>
      <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{description}</p>
      {active && (
        <span className="absolute right-3 top-3 grid size-6 place-items-center rounded-full bg-[var(--accent)] text-white">
          <Check aria-hidden="true" size={13} />
        </span>
      )}
    </button>
  );
}

function SegmentedControl({
  onChange,
  options,
  preferenceKey,
  value
}: {
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  preferenceKey: "density" | "motion";
  value: string;
}) {
  return (
    <div className="grid gap-2 rounded-2xl bg-[var(--surface-muted)] p-1.5 sm:grid-flow-col">
      {options.map((option) => (
        <button
          aria-pressed={value === option.value}
          className={`min-h-11 rounded-xl px-4 text-sm font-semibold transition ${
            value === option.value
              ? "bg-[var(--surface)] text-[var(--ink)] shadow-sm"
              : "text-[var(--muted)] hover:text-[var(--ink)]"
          }`}
          data-preference-key={preferenceKey}
          data-preference-value={option.value}
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
