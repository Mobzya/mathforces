import Link from "next/link";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { ProfileNavLink } from "@/components/auth/ProfileNavLink";
import { Logo } from "@/components/brand/Logo";
import { SettingsMenu } from "@/components/settings/SettingsMenu";

const navigation = [
  { href: "/feed", label: "Главное" },
  { href: "/contests", label: "Контесты" },
  { href: "/submissions", label: "Посылки" },
  { href: "/archive", label: "Архив" },
  { href: "/rating", label: "Рейтинг" },
  { href: "/friends", label: "Друзья" },
  { href: "/faq", label: "FAQ" },
  { href: "/admin", label: "Админка" }
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--header)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo />
        <nav aria-label="Основная навигация" className="hidden items-center gap-1 xl:flex">
          {navigation.slice(0, 6).map((item) => (
            <Link
              className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--ink)]"
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
          <ProfileNavLink className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--ink)]" />
          {navigation.slice(6).map((item) => (
            <Link
              className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--ink)]"
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <SettingsMenu />
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
