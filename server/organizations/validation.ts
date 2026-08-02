import type { FieldErrors } from "@/server/http/responses";
import { isRecord } from "@/server/validation/primitives";

type OrganizationInput = {
  name: string;
};

type ValidationResult =
  { data: OrganizationInput; errors?: never } | { data?: never; errors: FieldErrors };

export function validateOrganizationInput(body: unknown): ValidationResult {
  if (!isRecord(body)) {
    return { errors: { form: "Некорректный формат запроса" } };
  }

  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";

  if (name.length < 2 || name.length > 80) {
    return {
      errors: {
        name: "Название должно содержать от 2 до 80 символов"
      }
    };
  }

  return { data: { name } };
}
