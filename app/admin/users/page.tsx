import type { Metadata } from "next";
import { Search } from "lucide-react";
import Link from "next/link";
import { UserManager } from "@/components/admin/UserManager";
import { prisma } from "@/server/db/client";
import type { AdminUser } from "@/types/admin";

export const metadata: Metadata = { title: "Управление пользователями" };

export default async function AdminUsersPage({
  searchParams
}: {
  searchParams: Promise<{
    page?: string | string[];
    query?: string | string[];
  }>;
}) {
  const requested = await searchParams;
  const query = typeof requested.query === "string" ? requested.query.trim().slice(0, 100) : "";
  const pageValue = typeof requested.page === "string" ? Number(requested.page) : 1;
  const requestedPage = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const pageSize = 50;
  const where = query
    ? {
        OR: [
          { email: { contains: query, mode: "insensitive" as const } },
          { nickname: { contains: query, mode: "insensitive" as const } }
        ]
      }
    : undefined;
  const total = await prisma.user.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const [records, organizations] = await Promise.all([
    prisma.user.findMany({
      include: {
        _count: { select: { contestRegistrations: true, submissions: true } },
        organization: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      where
    }),
    prisma.organization.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
  ]);
  const users: AdminUser[] = records.map((user) => ({
    contestCount: user._count.contestRegistrations,
    createdAt: user.createdAt.toISOString(),
    currentRating: user.currentRating,
    email: user.email,
    grade: user.grade,
    id: user.id,
    nickname: user.nickname,
    organization: user.organization,
    role: user.role,
    submissionCount: user._count.submissions
  }));

  return (
    <section className="page-section">
      <div className="page-shell">
        <h1 className="font-display text-4xl font-semibold">Пользователи</h1>
        <p className="mt-2 text-[var(--muted)]">Роли, организации и активность аккаунтов.</p>
        <form className="card mt-8 flex gap-3 p-4" method="get">
          <div className="relative flex-1">
            <Search className="field-icon" size={17} />
            <input
              className="field field-with-icon"
              defaultValue={query}
              name="query"
              placeholder="Ник или электронная почта"
            />
          </div>
          <button
            className="rounded-xl bg-[var(--strong)] px-5 text-sm font-semibold text-white"
            type="submit"
          >
            Найти
          </button>
        </form>
        <div className="mt-6">
          <UserManager organizations={organizations} users={users} />
        </div>
        {totalPages > 1 && (
          <nav
            className="mt-6 flex items-center justify-center gap-3"
            aria-label="Страницы пользователей"
          >
            <UserPageLink disabled={page <= 1} label="Назад" page={page - 1} query={query} />
            <span className="text-sm text-[var(--muted)]">
              {page} / {totalPages}
            </span>
            <UserPageLink
              disabled={page >= totalPages}
              label="Дальше"
              page={page + 1}
              query={query}
            />
          </nav>
        )}
      </div>
    </section>
  );
}

function UserPageLink({
  disabled,
  label,
  page,
  query
}: {
  disabled: boolean;
  label: string;
  page: number;
  query: string;
}) {
  const params = new URLSearchParams({ page: String(page) });
  if (query) params.set("query", query);
  return disabled ? (
    <span className="rounded-xl border border-[var(--line)] px-4 py-2 text-sm font-semibold opacity-40">
      {label}
    </span>
  ) : (
    <Link
      className="rounded-xl border border-[var(--line-strong)] px-4 py-2 text-sm font-semibold"
      href={`/admin/users?${params.toString()}`}
    >
      {label}
    </Link>
  );
}
