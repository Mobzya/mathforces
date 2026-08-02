import type { ReactNode } from "react";

export function SectionHeading({
  action,
  eyebrow,
  title
}: {
  action?: ReactNode;
  eyebrow?: string;
  title: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
            {eyebrow}
          </p>
        )}
        <h2 className="font-display text-2xl font-semibold tracking-[-0.025em] text-[var(--ink)] sm:text-3xl">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}
