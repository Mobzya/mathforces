import type { ContestStatus, ProblemTopic } from "@/generated/prisma/client";
import type { FieldErrors } from "@/server/http/responses";
import { isRecord, isUuid } from "@/server/validation/primitives";

export type ContestInput = {
  autoCalculateRating?: boolean;
  autoFinalRejudge?: boolean;
  autoPublishArchive?: boolean;
  description?: string;
  durationMinutes?: number;
  isPublic?: boolean;
  organizationId?: string | null;
  registrationClosesAt?: Date | null;
  requiredProblemCount?: number;
  reviewConfidenceThreshold?: number;
  rules?: string;
  showOthersSubmissions?: boolean;
  showPreliminaryScores?: boolean;
  showStandingsDuringContest?: boolean;
  showSubmissionComments?: boolean;
  startAt?: Date;
  status?: ContestStatus;
  tags?: string[];
  title?: string;
};

export type ProblemInput = {
  archiveEnabled?: boolean;
  archiveIntro?: string;
  baseScore?: number;
  difficultyRating?: number | null;
  evaluationRubric?: string;
  maxScore?: number;
  isFeatured?: boolean;
  officialSolution?: string;
  orderIndex?: number;
  scoreDecayPer5Min?: number;
  statement?: string;
  subtopic?: string;
  title?: string;
  topic?: ProblemTopic;
};

type ValidationResult<T> = { data: T; errors?: never } | { data?: never; errors: FieldErrors };

const contestStatuses = new Set<ContestStatus>(["ANNOUNCED", "RUNNING", "FINISHED"]);
const problemTopics = new Set<ProblemTopic>([
  "ARITHMETIC",
  "ALGEBRA",
  "APPLIED_MATH",
  "CALCULUS",
  "COMBINATORICS",
  "GRAPH_THEORY",
  "LOGIC",
  "NUMBER_THEORY",
  "GEOMETRY",
  "PROBABILITY",
  "SET_THEORY",
  "STATISTICS"
]);

export function validateContestInput(
  body: unknown,
  partial = false
): ValidationResult<ContestInput> {
  if (!isRecord(body)) {
    return { errors: { form: "Некорректный формат запроса" } };
  }

  const data: ContestInput = {};
  const errors: FieldErrors = {};

  if (!partial || "title" in body) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (title.length < 3 || title.length > 120) {
      errors.title = "Название должно содержать от 3 до 120 символов";
    } else {
      data.title = title;
    }
  }

  if (!partial || "description" in body) {
    const description = typeof body.description === "string" ? body.description.trim() : "";
    if (description.length > 5_000) {
      errors.description = "Описание не должно быть длиннее 5000 символов";
    } else {
      data.description = description;
    }
  }

  if (!partial || "rules" in body) {
    const rules = typeof body.rules === "string" ? body.rules.trim() : "";
    if (rules.length > 5_000) {
      errors.rules = "Правила не должны быть длиннее 5000 символов";
    } else {
      data.rules = rules;
    }
  }

  if (!partial || "startAt" in body) {
    const startAt =
      typeof body.startAt === "string" || body.startAt instanceof Date
        ? new Date(body.startAt)
        : new Date(Number.NaN);
    if (Number.isNaN(startAt.getTime())) {
      errors.startAt = "Укажите корректное время начала";
    } else {
      data.startAt = startAt;
    }
  }

  if (!partial || "durationMinutes" in body) {
    const durationMinutes = Number(body.durationMinutes ?? 90);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 360) {
      errors.durationMinutes = "Длительность должна быть от 15 до 360 минут";
    } else {
      data.durationMinutes = durationMinutes;
    }
  }

  if ("registrationClosesAt" in body) {
    if (body.registrationClosesAt === null || body.registrationClosesAt === "") {
      data.registrationClosesAt = null;
    } else {
      const registrationClosesAt =
        typeof body.registrationClosesAt === "string" || body.registrationClosesAt instanceof Date
          ? new Date(body.registrationClosesAt)
          : new Date(Number.NaN);
      if (Number.isNaN(registrationClosesAt.getTime())) {
        errors.registrationClosesAt = "Укажите корректное время закрытия регистрации";
      } else {
        data.registrationClosesAt = registrationClosesAt;
      }
    }
  }

  if (!partial || "requiredProblemCount" in body) {
    const requiredProblemCount = Number(body.requiredProblemCount ?? 5);
    if (
      !Number.isInteger(requiredProblemCount) ||
      requiredProblemCount < 1 ||
      requiredProblemCount > 12
    ) {
      errors.requiredProblemCount = "В контесте может быть от 1 до 12 задач";
    } else {
      data.requiredProblemCount = requiredProblemCount;
    }
  }

  if (!partial || "reviewConfidenceThreshold" in body) {
    const reviewConfidenceThreshold = Number(body.reviewConfidenceThreshold ?? 0.72);
    if (
      !Number.isFinite(reviewConfidenceThreshold) ||
      reviewConfidenceThreshold < 0.5 ||
      reviewConfidenceThreshold > 0.99
    ) {
      errors.reviewConfidenceThreshold = "Порог уверенности должен быть от 50% до 99%";
    } else {
      data.reviewConfidenceThreshold = reviewConfidenceThreshold;
    }
  }

  for (const field of [
    "showStandingsDuringContest",
    "showOthersSubmissions",
    "showSubmissionComments",
    "showPreliminaryScores",
    "autoFinalRejudge",
    "autoCalculateRating",
    "autoPublishArchive"
  ] as const) {
    if (!partial || field in body) {
      const defaultValue = field === "showSubmissionComments" ? false : true;
      const value = body[field] ?? defaultValue;
      if (typeof value !== "boolean") {
        errors[field] = "Некорректное значение настройки";
      } else {
        data[field] = value;
      }
    }
  }

  if (!partial || "status" in body) {
    const status = typeof body.status === "string" ? body.status : "ANNOUNCED";
    if (!contestStatuses.has(status as ContestStatus)) {
      errors.status = "Некорректный статус контеста";
    } else {
      data.status = status as ContestStatus;
    }
  }

  if (!partial || "isPublic" in body) {
    if (typeof body.isPublic !== "boolean" && body.isPublic !== undefined) {
      errors.isPublic = "Некорректная видимость";
    } else {
      data.isPublic = body.isPublic !== false;
    }
  }

  if ("organizationId" in body) {
    if (body.organizationId === null || body.organizationId === "") {
      data.organizationId = null;
    } else if (typeof body.organizationId !== "string" || !isUuid(body.organizationId)) {
      errors.organizationId = "Выберите существующую организацию";
    } else {
      data.organizationId = body.organizationId;
    }
  }

  if (!partial || "tags" in body) {
    if (!Array.isArray(body.tags)) {
      data.tags = [];
    } else {
      const tags = body.tags
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim().toLocaleLowerCase("ru"))
        .filter(Boolean);
      if (tags.length > 10 || tags.some((tag) => tag.length > 30)) {
        errors.tags = "Не более 10 тегов длиной до 30 символов";
      } else {
        data.tags = [...new Set(tags)];
      }
    }
  }

  if (partial && Object.keys(data).length === 0 && Object.keys(errors).length === 0) {
    errors.form = "Нет данных для изменения";
  }

  return Object.keys(errors).length > 0 ? { errors } : { data };
}

export function validateProblemInput(
  body: unknown,
  partial = false
): ValidationResult<ProblemInput> {
  if (!isRecord(body)) {
    return { errors: { form: "Некорректный формат запроса" } };
  }

  const data: ProblemInput = {};
  const errors: FieldErrors = {};

  validateTextField(body, data, errors, "title", 1, 120, partial);
  validateTextField(body, data, errors, "statement", 10, 20_000, partial);
  validateTextField(body, data, errors, "evaluationRubric", 0, 10_000, partial);
  validateTextField(body, data, errors, "archiveIntro", 0, 5_000, partial);
  validateTextField(body, data, errors, "officialSolution", 0, 30_000, partial);
  validateTextField(body, data, errors, "subtopic", 0, 80, partial);

  if (!partial || "archiveEnabled" in body) {
    if (body.archiveEnabled === undefined && !partial) {
      data.archiveEnabled = true;
    } else if (typeof body.archiveEnabled !== "boolean") {
      errors.archiveEnabled = "Некорректная настройка архива";
    } else {
      data.archiveEnabled = body.archiveEnabled;
    }
  }

  if ("isFeatured" in body) {
    if (typeof body.isFeatured !== "boolean") {
      errors.isFeatured = "Некорректная настройка витрины";
    } else {
      data.isFeatured = body.isFeatured;
    }
  }

  if ("difficultyRating" in body) {
    if (body.difficultyRating === null || body.difficultyRating === "") {
      data.difficultyRating = null;
    } else {
      const rating = Number(body.difficultyRating);
      if (!Number.isInteger(rating) || rating < 0 || rating > 3000 || rating % 10 !== 0) {
        errors.difficultyRating = "Рейтинг должен быть от 0 до 3000 и оканчиваться на 0";
      } else {
        data.difficultyRating = rating;
      }
    }
  }

  if (!partial || "topic" in body) {
    const topic = typeof body.topic === "string" ? body.topic : "";
    if (!problemTopics.has(topic as ProblemTopic)) {
      errors.topic = "Выберите тему задачи";
    } else {
      data.topic = topic as ProblemTopic;
    }
  }

  validateIntegerField(body, data, errors, "baseScore", 1, 10_000, partial);
  validateIntegerField(body, data, errors, "maxScore", 1, 10_000, partial);
  validateIntegerField(body, data, errors, "scoreDecayPer5Min", 0, 1_000, partial);
  validateIntegerField(body, data, errors, "orderIndex", 1, 12, partial);

  if (partial && Object.keys(data).length === 0 && Object.keys(errors).length === 0) {
    errors.form = "Нет данных для изменения";
  }

  return Object.keys(errors).length > 0 ? { errors } : { data };
}

function validateTextField(
  body: Record<string, unknown>,
  data: ProblemInput,
  errors: FieldErrors,
  field:
    "title" | "statement" | "evaluationRubric" | "archiveIntro" | "officialSolution" | "subtopic",
  min: number,
  max: number,
  partial: boolean
) {
  if (partial && !(field in body)) return;
  const value = typeof body[field] === "string" ? body[field].trim() : "";
  if (value.length < min || value.length > max) {
    errors[field] = `Длина поля должна быть от ${min} до ${max} символов`;
  } else {
    data[field] = value;
  }
}

function validateIntegerField(
  body: Record<string, unknown>,
  data: ProblemInput,
  errors: FieldErrors,
  field: "baseScore" | "maxScore" | "scoreDecayPer5Min" | "orderIndex",
  min: number,
  max: number,
  partial: boolean
) {
  if (partial && !(field in body)) return;
  const value = Number(body[field]);
  if (!Number.isInteger(value) || value < min || value > max) {
    errors[field] = `Введите целое число от ${min} до ${max}`;
  } else {
    data[field] = value;
  }
}
