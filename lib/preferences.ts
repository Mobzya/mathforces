export const PREFERENCES_STORAGE_KEY = "mathforces:interface-preferences";
export const PREFERENCES_CHANGED_EVENT = "mathforces:preferences-changed";

export function shouldReduceMotion() {
  if (typeof document === "undefined") return false;
  const preference = document.documentElement.dataset.motion;
  return (
    preference === "reduced" ||
    (preference !== "full" && window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  );
}
