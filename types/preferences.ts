export type ThemePreference = "system" | "light" | "dark";
export type MotionPreference = "system" | "full" | "reduced";
export type DensityPreference = "comfortable" | "compact";

export type InterfacePreferences = {
  density: DensityPreference;
  motion: MotionPreference;
  theme: ThemePreference;
};
