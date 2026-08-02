"use client";

import { CircleUserRound } from "lucide-react";
import Link from "next/link";
import { useCurrentUser } from "@/components/auth/CurrentUserProvider";
import { cn } from "@/lib/cn";

export function ProfileNavLink({
  className,
  compact = false
}: {
  className?: string;
  compact?: boolean;
}) {
  const { user } = useCurrentUser();
  return (
    <Link className={cn(className)} href={user ? `/profile/${user.id}` : "/profile/me"}>
      {compact && <CircleUserRound aria-hidden="true" size={19} strokeWidth={1.8} />}
      <span>Профиль</span>
    </Link>
  );
}
