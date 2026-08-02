"use client";

import { ChevronDown, CircleUserRound, LogIn, LogOut, UserPlus } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useCurrentUser } from "@/components/auth/CurrentUserProvider";
import { UserAvatar } from "@/components/profile/UserAvatar";

export function AccountMenu() {
  const menu = useRef<HTMLDetailsElement>(null);
  const { hasError, isLoading, refreshUser, user } = useCurrentUser();

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) {
        menu.current?.removeAttribute("open");
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  const closeMenu = () => menu.current?.removeAttribute("open");

  return (
    <details className="group relative" ref={menu}>
      <summary
        aria-label={user ? `Меню пользователя ${user.nickname}` : "Меню аккаунта"}
        className="account-trigger inline-flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-xl border border-transparent px-2 py-1.5 text-sm font-semibold transition-all hover:border-[var(--line)] hover:bg-[var(--surface)] group-open:border-[var(--line-strong)] group-open:bg-[var(--surface)] group-open:shadow-sm [&::-webkit-details-marker]:hidden"
      >
        {user ? (
          <UserAvatar
            avatarUrl={user.avatarUrl}
            className="size-7 rounded-lg text-xs ring-1 ring-black/5"
            nickname={user.nickname}
            rankColor={user.currentRating > 0 ? user.rank.color : "var(--strong)"}
            sizes="28px"
          />
        ) : (
          <span className="grid size-7 place-items-center rounded-lg bg-[var(--strong)] text-white">
            <CircleUserRound aria-hidden="true" size={16} />
          </span>
        )}
        <span
          className="hidden max-w-28 truncate font-mono sm:block"
          style={{
            color: user && user.currentRating > 0 ? user.rank.color : "var(--ink)"
          }}
        >
          {user?.nickname ?? (isLoading || hasError ? "Аккаунт" : "Войти")}
        </span>
        <ChevronDown
          aria-hidden="true"
          className="hidden text-[var(--muted)] transition-transform group-open:rotate-180 sm:block"
          size={14}
        />
      </summary>

      <div
        aria-label="Меню аккаунта"
        className="menu-popover absolute right-0 top-12 z-50 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-2 shadow-[var(--shadow-popover)]"
        role="menu"
      >
        {user ? (
          <>
            <div className="mb-1 border-b border-[var(--line)] px-3 py-2.5">
              <p className="truncate font-mono text-sm font-bold">{user.nickname}</p>
              <p className="mt-0.5 truncate text-xs text-[var(--muted)]">{user.email}</p>
            </div>
            <p className="px-3 py-2 text-xs leading-5 text-[var(--muted)]">
              Вы вошли в аккаунт. В этом меню доступен только выход.
            </p>
            <form action="/api/auth/logout" method="post">
              <button
                className="mt-1 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent-soft)]"
                role="menuitem"
                type="submit"
              >
                <LogOut aria-hidden="true" size={17} />
                Выйти
              </button>
            </form>
          </>
        ) : isLoading ? (
          <div className="px-3 py-3">
            <p className="text-sm font-semibold">Проверяем сессию…</p>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Вход и регистрация появятся только после точного ответа сервера.
            </p>
          </div>
        ) : hasError ? (
          <div className="px-3 py-3">
            <p className="text-sm font-semibold">Не удалось проверить вход</p>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Мы не считаем вас гостем, пока статус сессии неизвестен.
            </p>
            <button
              className="mt-3 min-h-10 rounded-xl bg-[var(--strong)] px-3 text-sm font-semibold text-white"
              onClick={() => void refreshUser()}
              type="button"
            >
              Проверить снова
            </button>
          </div>
        ) : (
          <>
            <div className="mb-1 px-3 py-2">
              <p className="text-sm font-semibold">Вы не вошли</p>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                Войдите в существующий аккаунт или создайте новый.
              </p>
            </div>
            <MenuLink href="/login" icon={LogIn} label="Войти" onSelect={closeMenu} />
            <MenuLink
              href="/register"
              icon={UserPlus}
              label="Создать аккаунт"
              onSelect={closeMenu}
            />
          </>
        )}
      </div>
    </details>
  );
}

function MenuLink({
  href,
  icon: Icon,
  label,
  onSelect
}: {
  href: string;
  icon: typeof CircleUserRound;
  label: string;
  onSelect: () => void;
}) {
  return (
    <Link
      className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors hover:bg-[var(--surface-muted)]"
      href={href}
      onClick={onSelect}
      role="menuitem"
    >
      <Icon aria-hidden="true" className="text-[var(--muted)]" size={17} />
      {label}
    </Link>
  );
}
