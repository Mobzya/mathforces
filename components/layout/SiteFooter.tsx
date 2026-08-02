import { Logo } from "@/components/brand/Logo";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--line)] bg-[var(--surface-glass)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <Logo />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[var(--muted)]">
          <Link className="hover:text-[var(--ink)]" href="/faq">
            FAQ
          </Link>
          <Link className="hover:text-[var(--ink)]" href="/archive">
            Архив
          </Link>
          <Link className="hover:text-[var(--ink)]" href="/submissions">
            Посылки
          </Link>
          <Link className="hover:text-[var(--ink)]" href="/feed">
            Главное
          </Link>
          <span className="max-w-md">Олимпиадная платформа для тех, кто любит доказывать.</span>
        </div>
      </div>
    </footer>
  );
}
