import type { FieldErrors } from "@/server/http/responses";
import { isRecord, isUuid } from "@/server/validation/primitives";

export type OrganizationChoice = { id: string; mode: "existing" } | { mode: "new"; name: string };

export type RegisterInput = {
  email: string;
  grade: number | null;
  nickname: string;
  organization: OrganizationChoice | null;
  password: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
};

type ValidationResult<T> = { data: T; errors?: never } | { data?: never; errors: FieldErrors };

export function normalizeEmail(value: string): string {
  return value.trim().toLocaleLowerCase("ru");
}

export function normalizeNickname(value: string): string {
  return value.trim().toLocaleLowerCase("ru");
}

export function validateRegisterInput(body: unknown): ValidationResult<RegisterInput> {
  if (!isRecord(body)) {
    return { errors: { form: "Некорректный формат запроса" } };
  }

  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const nickname = typeof body.nickname === "string" ? body.nickname.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const gradeValue = body.grade;
  const errors: FieldErrors = {};

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    errors.email = "Укажите корректную электронную почту";
  }
  if (nickname.length < 3 || nickname.length > 24 || !/^[\p{L}\p{N}_-]+$/u.test(nickname)) {
    errors.nickname = "От 3 до 24 букв, цифр, дефисов или подчёркиваний";
  }
  if (password.length < 8 || password.length > 72) {
    errors.password = "Пароль должен содержать от 8 до 72 символов";
  }

  let grade: number | null = null;
  if (gradeValue !== null && gradeValue !== undefined && gradeValue !== "") {
    grade = Number(gradeValue);
    if (!Number.isInteger(grade) || grade < 1 || grade > 11) {
      errors.grade = "Класс должен быть числом от 1 до 11";
    }
  }

  let organization: OrganizationChoice | null = null;
  if (isRecord(body.organization) && body.organization.mode === "existing") {
    const id = typeof body.organization.id === "string" ? body.organization.id : "";
    if (!isUuid(id)) {
      errors.organization = "Выберите организацию";
    } else {
      organization = { id, mode: "existing" };
    }
  } else if (isRecord(body.organization) && body.organization.mode === "new") {
    const name =
      typeof body.organization.name === "string"
        ? body.organization.name.trim().replace(/\s+/g, " ")
        : "";
    if (name.length < 2 || name.length > 80) {
      errors.organization = "Название должно содержать от 2 до 80 символов";
    } else {
      organization = { mode: "new", name };
    }
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  return {
    data: {
      email,
      grade,
      nickname,
      organization,
      password
    }
  };
}

export function validateLoginInput(body: unknown): ValidationResult<LoginInput> {
  if (!isRecord(body)) {
    return { errors: { form: "Некорректный формат запроса" } };
  }

  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const password = typeof body.password === "string" ? body.password : "";
  const errors: FieldErrors = {};

  if (!email) {
    errors.email = "Введите электронную почту";
  }
  if (!password || password.length > 72) {
    errors.password = "Введите пароль";
  }

  return Object.keys(errors).length > 0 ? { errors } : { data: { email, password } };
}

export function validateChangePasswordInput(body: unknown): ValidationResult<ChangePasswordInput> {
  if (!isRecord(body)) {
    return { errors: { form: "Некорректный формат запроса" } };
  }

  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  const errors: FieldErrors = {};

  if (!currentPassword || currentPassword.length > 72) {
    errors.currentPassword = "Введите текущий пароль";
  }
  if (newPassword.length < 8 || newPassword.length > 72) {
    errors.newPassword = "Новый пароль должен содержать от 8 до 72 символов";
  } else if (newPassword === currentPassword) {
    errors.newPassword = "Новый пароль должен отличаться от текущего";
  }

  return Object.keys(errors).length > 0 ? { errors } : { data: { currentPassword, newPassword } };
}
