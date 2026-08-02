import type { ContestStatusValue, ProblemTopicValue } from "@/types/contest";

export const contestStatusMeta: Record<
  ContestStatusValue,
  { label: string; tone: "blue" | "green" | "gray" }
> = {
  ANNOUNCED: { label: "Анонсирован", tone: "blue" },
  FINISHED: { label: "Завершён", tone: "gray" },
  RUNNING: { label: "Идёт сейчас", tone: "green" }
};

export const problemTopicLabels: Record<ProblemTopicValue, string> = {
  ARITHMETIC: "Арифметика",
  ALGEBRA: "Алгебра",
  APPLIED_MATH: "Прикладная математика",
  CALCULUS: "Математический анализ",
  COMBINATORICS: "Комбинаторика",
  GEOMETRY: "Геометрия",
  GRAPH_THEORY: "Теория графов",
  LOGIC: "Логика",
  NUMBER_THEORY: "Теория чисел",
  PROBABILITY: "Теория вероятностей",
  SET_THEORY: "Теория множеств",
  STATISTICS: "Статистика"
};

export function formatContestDate(isoDate: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "long",
    timeZone: "Europe/Moscow"
  }).format(new Date(isoDate));
}
