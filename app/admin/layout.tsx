import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { getCurrentUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (user.role !== "ADMIN") {
    redirect(`/profile/${user.id}`);
  }

  return (
    <>
      <AdminNav />
      {children}
    </>
  );
}
