"use client";

import {
  CircleUserRound,
  Archive,
  UsersRound,
  FileCheck2,
  House,
  LayoutList,
  Trophy
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrentUser } from "@/components/auth/CurrentUserProvider";

const items = [
  { href: "/feed", icon: House, label: "Главное" },
  { href: "/contests", icon: LayoutList, label: "Контесты" },
  { href: "/submissions", icon: FileCheck2, label: "Посылки" },
  { href: "/archive", icon: Archive, label: "Архив" },
  { href: "/rating", icon: Trophy, label: "Рейтинг" },
  { href: "/friends", icon: UsersRound, label: "Друзья" },
  { href: "/profile/me", icon: CircleUserRound, label: "Профиль", profile: true }
];

export function MobileNav() {
  const pathname = usePathname();
  const { user } = useCurrentUser();

  return (
    <nav
      aria-label="Мобильная навигация"
      className="fixed inset-x-2 bottom-2 z-50 grid grid-cols-7 rounded-2xl border border-[var(--line-strong)] bg-[var(--mobile-nav)] px-1 pb-[max(0.3rem,env(safe-area-inset-bottom))] pt-1 text-white shadow-[0_16px_48px_rgba(0,0,0,0.24)] backdrop-blur-xl xl:hidden"
    >
      {items.map(({ href, icon: Icon, label, profile }) => {
        const resolvedHref = profile && user ? `/profile/${user.id}` : href;
        const isActive =
          pathname === resolvedHref ||
          (profile && pathname.startsWith("/profile/")) ||
          (resolvedHref !== "/" && pathname.startsWith(`${resolvedHref}/`));
        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium transition hover:bg-white/10 hover:text-white ${
              isActive ? "bg-white/12 text-white" : "text-white/65"
            }`}
            href={resolvedHref}
            key={href}
          >
            <Icon aria-hidden="true" size={19} strokeWidth={1.8} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
