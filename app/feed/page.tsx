import type { Metadata } from "next";
import { Archive, CalendarDays, Newspaper, Trophy, UsersRound } from "lucide-react";
import Link from "next/link";
import { NewsComments } from "@/components/content/NewsComments";
import { QuickNewsComposer } from "@/components/content/QuickNewsComposer";
import { getCurrentUser } from "@/server/auth/session";
import { prisma } from "@/server/db/client";

export const metadata: Metadata = { title: "Главное" };
export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const viewer = await getCurrentUser();
  const [posts, users, contests, problems, nextContest] = await Promise.all([
    prisma.newsPost.findMany({
      include: {
        author: { select: { nickname: true } },
        comments: {
          include: {
            user: { select: { id: true, nickname: true } },
            votes: { select: { userId: true, value: true } }
          },
          orderBy: { createdAt: "asc" },
          take: 100
        }
      },
      orderBy: { publishedAt: "desc" },
      take: 30,
      where: { isPublished: true }
    }),
    prisma.user.count(),
    prisma.contest.count({ where: { status: "FINISHED" } }),
    prisma.problem.count({ where: { archiveEnabled: true, archivedAt: { not: null } } }),
    prisma.contest.findFirst({
      orderBy: { startAt: "asc" },
      where: { isPublic: true, startAt: { gt: new Date() }, status: "ANNOUNCED" }
    })
  ]);

  return (
    <section className="page-section">
      <div className="page-shell">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <main>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
              <Newspaper size={15} />
              Лента Mathforces
            </p>
            <h1 className="mt-3 font-display text-5xl font-semibold tracking-[-0.045em]">
              Главное
            </h1>
            <p className="mt-4 max-w-2xl leading-7 text-[var(--muted)]">
              Контесты, изменения механик и важные объявления.
            </p>
            <div className="mt-8">
              {viewer?.role === "ADMIN" && <QuickNewsComposer />}
              <div className="space-y-5">
                {posts.map((post) => (
                  <article className="card overflow-hidden" key={post.id}>
                    <div className="p-5 sm:p-6">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                        <span>{post.author?.nickname ?? "Команда Mathforces"}</span>
                        <span>·</span>
                        <time>
                          {new Date(post.publishedAt ?? post.createdAt).toLocaleDateString(
                            "ru-RU",
                            { dateStyle: "long" }
                          )}
                        </time>
                      </div>
                      <h2 className="mt-3 font-display text-3xl font-semibold">{post.title}</h2>
                      {post.excerpt && (
                        <p className="mt-3 font-semibold leading-7 text-[var(--muted)]">
                          {post.excerpt}
                        </p>
                      )}
                      <p className="mt-5 whitespace-pre-wrap leading-8">{post.body}</p>
                    </div>
                    <NewsComments
                      comments={post.comments.map((comment) => ({
                        body: comment.body,
                        createdAt: comment.createdAt.toISOString(),
                        id: comment.id,
                        score: comment.votes.reduce((sum, vote) => sum + vote.value, 0),
                        user: comment.user,
                        viewerVote:
                          comment.votes.find((vote) => vote.userId === viewer?.id)?.value ?? 0
                      }))}
                      isAuthenticated={Boolean(viewer)}
                      postId={post.id}
                    />
                  </article>
                ))}
              </div>
            </div>
          </main>
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="card p-5">
              <p className="text-xs font-bold uppercase tracking-[0.13em] text-[var(--muted)]">
                Платформа
              </p>
              <div className="mt-5 space-y-4">
                <Metric icon={UsersRound} label="Участников" value={users} />
                <Metric icon={Trophy} label="Завершённых туров" value={contests} />
                <Metric icon={Archive} label="Задач в архиве" value={problems} />
              </div>
            </div>
            {nextContest && (
              <Link
                className="block rounded-2xl bg-[var(--strong)] p-5 text-white"
                href={`/contests/${nextContest.id}`}
              >
                <CalendarDays size={20} />
                <p className="mt-5 text-xs font-bold uppercase tracking-[0.12em] text-white/55">
                  Следующий контест
                </p>
                <h2 className="mt-2 font-display text-xl font-semibold">{nextContest.title}</h2>
                <p className="mt-2 text-xs text-white/65">
                  {nextContest.startAt.toLocaleString("ru-RU")}
                </p>
              </Link>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}

function Metric({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Trophy;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-sm text-[var(--muted)]">
        <Icon size={16} />
        {label}
      </span>
      <strong className="font-mono">{value}</strong>
    </div>
  );
}
