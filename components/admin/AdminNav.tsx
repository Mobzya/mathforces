import {
  Activity,
  Archive,
  Building2,
  ClipboardList,
  BookOpenText,
  FileCheck2,
  LayoutDashboard,
  ScrollText,
  UsersRound
} from "lucide-react";
import Link from "next/link";

const links = [
  { href: "/admin", icon: LayoutDashboard, label: "Обзор" },
  { href: "/admin/contests", icon: ClipboardList, label: "Контесты" },
  { href: "/admin/archive", icon: Archive, label: "Архив" },
  { href: "/admin/content", icon: BookOpenText, label: "Контент" },
  { href: "/admin/submissions", icon: FileCheck2, label: "Посылки" },
  { href: "/admin/organizations", icon: Building2, label: "Организации" },
  { href: "/admin/users", icon: UsersRound, label: "Пользователи" },
  { href: "/admin/logs", icon: ScrollText, label: "Аудит" },
  { href: "/admin/monitoring", icon: Activity, label: "Мониторинг" }
];

export function AdminNav() {
  return (
    <nav
      aria-label="Разделы админ-панели"
      className="border-b border-[var(--line)] bg-[var(--surface-glass)]"
    >
      <div className="page-shell flex gap-1 overflow-x-auto py-2">
        {links.map(({ href, icon: Icon, label }) => (
          <Link
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[var(--muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]"
            href={href}
            key={href}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
