"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { PREFERENCES_CHANGED_EVENT, PREFERENCES_STORAGE_KEY } from "@/lib/preferences";
import type {
  DensityPreference,
  InterfacePreferences,
  MotionPreference,
  ThemePreference
} from "@/types/preferences";

const defaults: InterfacePreferences = {
  density: "comfortable",
  motion: "system",
  theme: "system"
};

type PreferencesContextValue = {
  preferences: InterfacePreferences;
  resetPreferences: () => void;
  setDensity: (density: DensityPreference) => void;
  setMotion: (motion: MotionPreference) => void;
  setTheme: (theme: ThemePreference) => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<InterfacePreferences>(defaults);
  const initializedRef = useRef(false);
  const preferencesRef = useRef<InterfacePreferences>(defaults);

  const commitPreferences = useCallback((next: InterfacePreferences) => {
    preferencesRef.current = next;
    applyPreferences(next);
    persistPreferences(next);
    setPreferences(next);
  }, []);

  const updatePreferences = useCallback(
    (update: (current: InterfacePreferences) => InterfacePreferences) => {
      // Keep the authoritative value outside React's concurrent updater. This
      // applies every click immediately and cannot be replayed out of order.
      commitPreferences(update(preferencesRef.current));
    },
    [commitPreferences]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      initializedRef.current = true;
      commitPreferences(readPreferences());
    }, 0);
    return () => window.clearTimeout(timer);
  }, [commitPreferences]);

  useEffect(() => {
    if (!initializedRef.current) return;
    applyPreferences(preferences);

    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const refreshSystemPreferences = () => applyPreferences(preferences);
    colorScheme.addEventListener("change", refreshSystemPreferences);
    reducedMotion.addEventListener("change", refreshSystemPreferences);
    return () => {
      colorScheme.removeEventListener("change", refreshSystemPreferences);
      reducedMotion.removeEventListener("change", refreshSystemPreferences);
    };
  }, [preferences]);

  useEffect(() => {
    const syncPreferences = (event: StorageEvent) => {
      if (event.key === PREFERENCES_STORAGE_KEY) {
        commitPreferences(readPreferences());
      }
    };
    const syncEarlyPreference = () => commitPreferences(readPreferences());
    window.addEventListener("storage", syncPreferences);
    window.addEventListener(PREFERENCES_CHANGED_EVENT, syncEarlyPreference);
    return () => {
      window.removeEventListener("storage", syncPreferences);
      window.removeEventListener(PREFERENCES_CHANGED_EVENT, syncEarlyPreference);
    };
  }, [commitPreferences]);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      preferences,
      resetPreferences: () => updatePreferences(() => defaults),
      setDensity: (density) => updatePreferences((current) => ({ ...current, density })),
      setMotion: (motion) => updatePreferences((current) => ({ ...current, motion })),
      setTheme: (theme) => updatePreferences((current) => ({ ...current, theme }))
    }),
    [preferences, updatePreferences]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used inside PreferencesProvider");
  }
  return context;
}

function readPreferences(): InterfacePreferences {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? "{}"
    ) as Partial<InterfacePreferences>;
    return {
      density: parsed.density === "compact" ? "compact" : "comfortable",
      motion: parsed.motion === "full" || parsed.motion === "reduced" ? parsed.motion : "system",
      theme: parsed.theme === "light" || parsed.theme === "dark" ? parsed.theme : "system"
    };
  } catch {
    return defaults;
  }
}

function applyPreferences(preferences: InterfacePreferences) {
  const root = document.documentElement;
  const dark =
    preferences.theme === "dark" ||
    (preferences.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const reduced =
    preferences.motion === "reduced" ||
    (preferences.motion === "system" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  root.dataset.theme = dark ? "dark" : "light";
  root.dataset.motion = reduced ? "reduced" : "full";
  root.dataset.density = preferences.density;
  root.style.colorScheme = dark ? "dark" : "light";
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", dark ? "#0b1220" : "#13233d");
}

function persistPreferences(preferences: InterfacePreferences) {
  try {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // The selected theme still applies for the current tab when persistent
    // storage is unavailable (for example, in strict private mode).
  }
}
