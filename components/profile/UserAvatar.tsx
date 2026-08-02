"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/cn";

export function UserAvatar({
  avatarUrl,
  className,
  nickname,
  rankColor,
  sizes = "80px"
}: {
  avatarUrl: string | null;
  className?: string;
  nickname: string;
  rankColor: string;
  sizes?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initial = Array.from(nickname)[0]?.toLocaleUpperCase("ru") ?? "M";

  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-2xl font-display font-semibold text-white",
        className
      )}
      style={{ backgroundColor: rankColor }}
    >
      {avatarUrl && !failed ? (
        <Image
          alt={`Аватар ${nickname}`}
          className="object-cover"
          fill
          onError={() => setFailed(true)}
          sizes={sizes}
          src={avatarUrl}
          unoptimized
        />
      ) : (
        <span aria-hidden="true">{initial}</span>
      )}
    </span>
  );
}
