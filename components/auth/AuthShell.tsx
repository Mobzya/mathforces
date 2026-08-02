import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";

export function AuthShell({
  children,
  description,
  title
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="page-shell grid min-h-[calc(100vh-8rem)] place-items-center py-12">
      <div className="w-full max-w-md">
        <div className="mb-7 text-center">
          <Logo className="justify-center" />
          <h1 className="mt-8 font-display text-4xl font-semibold tracking-[-0.035em]">{title}</h1>
          <p className="mt-3 leading-6 text-[var(--muted)]">{description}</p>
        </div>
        <div className="card p-5 sm:p-7">{children}</div>
      </div>
    </section>
  );
}
