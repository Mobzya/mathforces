export const PROFILE_ACCENTS = {
  crimson: { color: "#c63e46", label: "Рубин" },
  emerald: { color: "#16855b", label: "Изумруд" },
  ocean: { color: "#2563a8", label: "Океан" },
  violet: { color: "#7c3aed", label: "Фиолетовый" },
  amber: { color: "#b7791f", label: "Янтарь" }
} as const;

export const PROFILE_PATTERNS = {
  grid: { label: "Координатная сетка" },
  orbit: { label: "Орбиты" },
  waves: { label: "Волны" },
  minimal: { label: "Минимализм" }
} as const;

export const TOPIC_LABELS = {
  ARITHMETIC: "Арифметика",
  ALGEBRA: "Алгебра",
  APPLIED_MATH: "Прикладная математика",
  CALCULUS: "Математический анализ",
  COMBINATORICS: "Комбинаторика",
  GRAPH_THEORY: "Теория графов",
  LOGIC: "Логика",
  NUMBER_THEORY: "Теория чисел",
  GEOMETRY: "Геометрия",
  PROBABILITY: "Теория вероятностей",
  SET_THEORY: "Теория множеств",
  STATISTICS: "Статистика"
} as const;

export type ProfileAccent = keyof typeof PROFILE_ACCENTS;
export type ProfilePattern = keyof typeof PROFILE_PATTERNS;
export type FavoriteTopic = keyof typeof TOPIC_LABELS;

export function profileAccentColor(value: string) {
  return PROFILE_ACCENTS[value as ProfileAccent]?.color ?? PROFILE_ACCENTS.crimson.color;
}

export function publicAvatarUrl(user: {
  avatarStorageKey: string | null;
  avatarVersion: number;
  id: string;
}) {
  return user.avatarStorageKey ? `/api/users/${user.id}/avatar?v=${user.avatarVersion}` : null;
}
