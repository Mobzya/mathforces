import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FriendsManager } from "@/components/friends/FriendsManager";
import { getCurrentUser } from "@/server/auth/session";
import { listFriendDashboard } from "@/server/friends/queries";

export const metadata: Metadata = { title: "Друзья" };
export const dynamic = "force-dynamic";

export default async function FriendsPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/friends");
  const value = (await searchParams).q;
  const dashboard = await listFriendDashboard(user.id, typeof value === "string" ? value : "");
  return (
    <section className="page-section">
      <div className="page-shell max-w-5xl">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
          Ваш круг
        </p>
        <h1 className="mt-3 font-display text-5xl font-semibold tracking-[-0.04em]">Друзья</h1>
        <p className="mt-4 max-w-2xl leading-7 text-[var(--muted)]">
          Собирайте круг соперников, сравнивайте результаты в контестах и архиве.
        </p>
        <div className="mt-8">
          <FriendsManager {...dashboard} />
        </div>
      </div>
    </section>
  );
}
