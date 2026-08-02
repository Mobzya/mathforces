import Link from "next/link";
import { cn } from "@/lib/cn";

type LogoProps = {
  compact?: boolean;
  className?: string;
};

export function Logo({ compact = false, className }: LogoProps) {
  return (
    <Link
      aria-label="Mathforces — главная"
      className={cn("group inline-flex items-center gap-2.5", className)}
      href="/"
    >
      <span className="relative grid size-8 place-items-center overflow-hidden rounded-[10px] bg-[var(--strong)] text-white shadow-[0_4px_14px_rgba(19,35,61,0.16)]">
        <span className="font-display text-[19px] leading-none italic">M</span>
        <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-[var(--accent)]" />
      </span>
      {!compact && (
        <span className="font-display text-[21px] font-semibold tracking-[-0.035em] text-[var(--ink)]">
          Math<span className="text-[var(--accent)]">forces</span>
        </span>
      )}
    </Link>
  );
}
