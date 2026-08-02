export function normalizeOrganizationName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("ru");
}
