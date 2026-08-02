import type { FieldErrors } from "@/server/http/responses";
import { normalizeNickname } from "@/server/auth/validation";
import {
  PROFILE_ACCENTS,
  PROFILE_PATTERNS,
  TOPIC_LABELS,
  type FavoriteTopic,
  type ProfileAccent,
  type ProfilePattern
} from "@/lib/profile/customization";
import { isRecord, isUuid } from "@/server/validation/primitives";

export type UpdateProfileInput = {
  description?: string;
  grade?: number | null;
  favoriteTopic?: FavoriteTopic | null;
  nickname?: string;
  nicknameNormalized?: string;
  organizationId?: string;
  profileAccent?: ProfileAccent;
  profilePattern?: ProfilePattern;
  showGrade?: boolean;
  showOrganization?: boolean;
};

type ValidationResult =
  { data: UpdateProfileInput; errors?: never } | { data?: never; errors: FieldErrors };

export function validateProfileUpdate(body: unknown): ValidationResult {
  if (!isRecord(body)) {
    return { errors: { form: "Некорректный формат запроса" } };
  }

  const data: UpdateProfileInput = {};
  const errors: FieldErrors = {};

  if ("nickname" in body) {
    const nickname = typeof body.nickname === "string" ? body.nickname.trim() : "";
    if (nickname.length < 3 || nickname.length > 24 || !/^[\p{L}\p{N}_-]+$/u.test(nickname)) {
      errors.nickname = "От 3 до 24 букв, цифр, дефисов или подчёркиваний";
    } else {
      data.nickname = nickname;
      data.nicknameNormalized = normalizeNickname(nickname);
    }
  }

  if ("description" in body) {
    const description = typeof body.description === "string" ? body.description.trim() : "";
    if (description.length > 400) {
      errors.description = "Описание не должно быть длиннее 400 символов";
    } else {
      data.description = description;
    }
  }

  if ("grade" in body) {
    if (body.grade === null || body.grade === "") {
      data.grade = null;
    } else {
      const grade = Number(body.grade);
      if (!Number.isInteger(grade) || grade < 1 || grade > 11) {
        errors.grade = "Класс должен быть числом от 1 до 11";
      } else {
        data.grade = grade;
      }
    }
  }

  if ("organizationId" in body) {
    const organizationId = typeof body.organizationId === "string" ? body.organizationId : "";
    if (!isUuid(organizationId)) {
      errors.organization = "Выберите существующую организацию";
    } else {
      data.organizationId = organizationId;
    }
  }

  if ("profileAccent" in body) {
    if (typeof body.profileAccent !== "string" || !(body.profileAccent in PROFILE_ACCENTS)) {
      errors.profileAccent = "Выберите доступный цвет профиля";
    } else {
      data.profileAccent = body.profileAccent as ProfileAccent;
    }
  }

  if ("profilePattern" in body) {
    if (typeof body.profilePattern !== "string" || !(body.profilePattern in PROFILE_PATTERNS)) {
      errors.profilePattern = "Выберите доступный фон профиля";
    } else {
      data.profilePattern = body.profilePattern as ProfilePattern;
    }
  }

  if ("favoriteTopic" in body) {
    if (body.favoriteTopic === null || body.favoriteTopic === "") {
      data.favoriteTopic = null;
    } else if (typeof body.favoriteTopic !== "string" || !(body.favoriteTopic in TOPIC_LABELS)) {
      errors.favoriteTopic = "Выберите математическую тему";
    } else {
      data.favoriteTopic = body.favoriteTopic as FavoriteTopic;
    }
  }

  for (const field of ["showGrade", "showOrganization"] as const) {
    if (field in body) {
      if (typeof body[field] !== "boolean") {
        errors[field] = "Некорректная настройка видимости";
      } else {
        data[field] = body[field];
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }
  if (Object.keys(data).length === 0) {
    return { errors: { form: "Нет данных для изменения" } };
  }

  return { data };
}
