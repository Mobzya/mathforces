import type { Metadata } from "next";
import { ContentManager } from "@/components/admin/ContentManager";
import { prisma } from "@/server/db/client";
export const metadata: Metadata = { title: "Контент" };
export default async function AdminContentPage() {
  const [sections, posts] = await Promise.all([
    prisma.faqSection.findMany({
      include: { items: { orderBy: { orderIndex: "asc" } } },
      orderBy: { orderIndex: "asc" }
    }),
    prisma.newsPost.findMany({ orderBy: { createdAt: "desc" }, take: 100 })
  ]);
  return (
    <section className="page-section">
      <div className="page-shell max-w-5xl">
        <h1 className="font-display text-4xl font-semibold">Контент</h1>
        <p className="mt-3 text-[var(--muted)]">
          Разделы FAQ, вопросы, новости и публикация в «Главном».
        </p>
        <div className="mt-8">
          <ContentManager
            posts={posts.map((post) => ({
              body: post.body,
              excerpt: post.excerpt,
              id: post.id,
              isPublished: post.isPublished,
              title: post.title
            }))}
            sections={sections.map((section) => ({
              description: section.description,
              id: section.id,
              isPublished: section.isPublished,
              items: section.items,
              orderIndex: section.orderIndex,
              slug: section.slug,
              title: section.title
            }))}
          />
        </div>
      </div>
    </section>
  );
}
