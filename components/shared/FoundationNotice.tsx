import { Construction } from "lucide-react";

export function FoundationNotice({ text }: { text: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-dashed border-[var(--line-strong)] bg-[var(--surface-muted)] p-4 text-sm leading-6 text-[var(--muted)]">
      <Construction aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--accent)]" size={18} />
      <p>{text}</p>
    </div>
  );
}
