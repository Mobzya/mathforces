import { getCurrentUser } from "@/server/auth/session";

export async function getAdminUser() {
  const user = await getCurrentUser();
  return user?.role === "ADMIN" ? user : null;
}
