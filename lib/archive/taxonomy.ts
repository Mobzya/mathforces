import type { ProblemTopicValue } from "@/types/contest";

export type ArchiveArea = {
  color: string;
  key: ProblemTopicValue;
  label: string;
  shortLabel: string;
  subtopics: string[];
};

// The outer areas and inner subtopics follow the supplied Math Areas wheel,
// adapted to the school-olympiad vocabulary used by Mathforces.
export const ARCHIVE_AREAS: ArchiveArea[] = [
  {
    key: "ARITHMETIC",
    label: "Арифметика",
    shortLabel: "Арифметика",
    color: "#e78b62",
    subtopics: ["Дроби", "Делимость", "Оценки", "Последовательности"]
  },
  {
    key: "ALGEBRA",
    label: "Алгебра",
    shortLabel: "Алгебра",
    color: "#d56672",
    subtopics: ["Уравнения", "Неравенства", "Многочлены", "Функции"]
  },
  {
    key: "GEOMETRY",
    label: "Геометрия",
    shortLabel: "Геометрия",
    color: "#b966a3",
    subtopics: ["Треугольники", "Окружности", "Площади", "Преобразования"]
  },
  {
    key: "CALCULUS",
    label: "Математический анализ",
    shortLabel: "Анализ",
    color: "#7b75c8",
    subtopics: ["Пределы", "Производные", "Интегралы", "Функциональные оценки"]
  },
  {
    key: "PROBABILITY",
    label: "Теория вероятностей",
    shortLabel: "Вероятность",
    color: "#4c8fcd",
    subtopics: ["Случайные процессы", "Условная вероятность", "Матожидание", "Игры"]
  },
  {
    key: "STATISTICS",
    label: "Статистика",
    shortLabel: "Статистика",
    color: "#369cad",
    subtopics: ["Распределения", "Оценивание", "Регрессия", "Комбинаторная статистика"]
  },
  {
    key: "LOGIC",
    label: "Логика",
    shortLabel: "Логика",
    color: "#3d9c79",
    subtopics: ["Высказывания", "Стратегии", "Парадоксы", "Инварианты"]
  },
  {
    key: "SET_THEORY",
    label: "Теория множеств",
    shortLabel: "Множества",
    color: "#6c9b55",
    subtopics: ["Отображения", "Мощности", "Отношения", "Конструкции"]
  },
  {
    key: "GRAPH_THEORY",
    label: "Теория графов",
    shortLabel: "Графы",
    color: "#96a847",
    subtopics: ["Деревья", "Пути", "Раскраски", "Паросочетания"]
  },
  {
    key: "COMBINATORICS",
    label: "Комбинаторика",
    shortLabel: "Комбинаторика",
    color: "#c3a342",
    subtopics: ["Подсчёт", "Принцип Дирихле", "Конструкции", "Экстремальные задачи"]
  },
  {
    key: "NUMBER_THEORY",
    label: "Теория чисел",
    shortLabel: "Числа",
    color: "#d28b42",
    subtopics: ["Простые числа", "Сравнения", "Диофантовы уравнения", "Мультипликативность"]
  },
  {
    key: "APPLIED_MATH",
    label: "Прикладная математика",
    shortLabel: "Прикладная",
    color: "#c77758",
    subtopics: ["Моделирование", "Оптимизация", "Алгоритмы", "Математическая физика"]
  }
];

export const ARCHIVE_AREA_BY_KEY = Object.fromEntries(
  ARCHIVE_AREAS.map((area) => [area.key, area])
) as Record<ProblemTopicValue, ArchiveArea>;
