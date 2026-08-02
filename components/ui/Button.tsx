import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonLinkProps = ComponentProps<typeof Link> & {
  children: ReactNode;
  variant?: ButtonVariant;
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--strong)] text-white shadow-[0_8px_24px_rgba(19,35,61,0.14)] hover:-translate-y-0.5 hover:bg-[#1a2f50]",
  secondary:
    "border border-[var(--line-strong)] bg-white text-[var(--ink)] hover:-translate-y-0.5 hover:border-[var(--ink)]",
  ghost: "text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]"
};

export function ButtonLink({
  children,
  className,
  variant = "primary",
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition duration-200",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
