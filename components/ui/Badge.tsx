import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type BadgeTone = "green" | "blue" | "amber" | "gray" | "red";

const tones: Record<BadgeTone, string> = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  blue: "border-sky-200 bg-sky-50 text-sky-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  gray: "border-slate-200 bg-slate-50 text-slate-600",
  red: "border-red-200 bg-red-50 text-red-700"
};

export function Badge({
  children,
  className,
  tone = "gray"
}: {
  children: ReactNode;
  className?: string;
  tone?: BadgeTone;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em]",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
