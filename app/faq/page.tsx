import type { Metadata } from "next";
import { HelpCircle, MessageCircleQuestion } from "lucide-react";
import { prisma } from "@/server/db/client";

export const metadata: Metadata = { title: "FAQ" };
export const dynamic = "force-dynamic";

export default async function FaqPage() {
  const sections = await prisma.faqSection.findMany({
    include: { items: { orderBy: { orderIndex: "asc" }, where: { isPublished: true } } },
    orderBy: { orderIndex: "asc" },
    where: { isPublished: true }
  });
  const supportUrl = process.env.NEXT_PUBLIC_SUPPORT_URL;
  return (
    <section className="page-section">
      <div className="page-shell max-w-5xl">
        <div className="max-w-3xl">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
            <HelpCircle size={15} />
            Понятно о главном
          </p>
          <h1 className="mt-4 font-display text-5xl font-semibold tracking-[-0.05em] sm:text-6xl">
            Вопросы и ответы
          </h1>
          <p className="mt-5 text-lg leading-8 text-[var(--muted)]">
            Правила, механики рейтинга, посылки и советы для первого тура.
          </p>
        </div>
        <div className="mt-10 grid gap-6 lg:grid-cols-[15rem_1fr]">
          <nav className="space-y-2 lg:sticky lg:top-24 lg:self-start">
            {sections.map((section) => (
              <a
                className="block rounded-xl px-3 py-2 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"
                href={`#${section.slug}`}
                key={section.id}
              >
                {section.title}
              </a>
            ))}
          </nav>
          <div className="space-y-8">
            {sections.map((section) => (
              <section className="scroll-mt-24" id={section.slug} key={section.id}>
                <h2 className="font-display text-3xl font-semibold">{section.title}</h2>
                {section.description && (
                  <p className="mt-2 text-sm text-[var(--muted)]">{section.description}</p>
                )}
                <div className="card mt-4 divide-y divide-[var(--line)]">
                  {section.items.map((item) => (
                    <details className="group p-5" key={item.id}>
                      <summary className="cursor-pointer list-none pr-8 font-semibold">
                        {item.question}
                      </summary>
                      <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[var(--muted)]">
                        {item.answer}
                      </p>
                    </details>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
        <div className="mt-12 rounded-[1.5rem] bg-[var(--strong)] p-6 text-white sm:flex sm:items-center sm:justify-between">
          <div>
            <MessageCircleQuestion size={22} />
            <h2 className="mt-4 font-display text-2xl font-semibold">Не нашли ответ?</h2>
            <p className="mt-2 text-sm text-white/65">Напишите автору проекта.</p>
          </div>
          {supportUrl ? (
            <a
              className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-white px-5 text-sm font-bold text-[var(--ink)] sm:mt-0"
              href={supportUrl}
              rel="noreferrer"
              target="_blank"
            >
              Задать вопрос
            </a>
          ) : (
            <span className="mt-5 rounded-xl border border-white/15 px-4 py-3 text-xs text-white/55 sm:mt-0">
              Telegram-ссылка скоро появится
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
