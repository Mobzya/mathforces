import type { SubmissionStatusValue } from "@/types/submission";

export const submissionStatusMeta: Record<
  SubmissionStatusValue,
  {
    label: string;
    tone: "amber" | "blue" | "gray" | "green" | "red";
  }
> = {
  FINALIZED: { label: "Итоговая оценка", tone: "green" },
  NEEDS_REVIEW: { label: "Нужна проверка", tone: "amber" },
  PRELIMINARY_READY: { label: "Предварительно проверено", tone: "blue" },
  PROCESSING: { label: "Проверяется", tone: "blue" },
  QUEUED: { label: "В очереди", tone: "gray" },
  REJECTED: { label: "Отклонено", tone: "red" }
};

export function formatSubmissionTime(value: string | Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  }).format(typeof value === "string" ? new Date(value) : value);
}
