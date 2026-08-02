import type { Metadata } from "next";
import { ArchiveManager } from "@/components/admin/ArchiveManager";
import { prisma } from "@/server/db/client";

export const metadata: Metadata = { title: "Управление архивом" };

export default async function AdminArchivePage() {
  const [problems, attempts] = await Promise.all([
    prisma.problem.findMany({
      include: { contest: { select: { title: true } } },
      orderBy: [{ archivedAt: "desc" }, { createdAt: "desc" }],
      take: 100,
      where: { contest: { status: "FINISHED" } }
    }),
    prisma.practiceAttempt.findMany({
      include: { problem: { select: { title: true } }, user: { select: { nickname: true } } },
      orderBy: { createdAt: "asc" },
      take: 50,
      where: { status: "NEEDS_REVIEW" }
    })
  ]);
  return (
    <section className="page-section">
      <div className="page-shell">
        <h1 className="font-display text-4xl font-semibold">Управление архивом</h1>
        <p className="mt-3 max-w-3xl leading-7 text-[var(--muted)]">
          Публикация, подтемы, официальные решения, индекс сложности и проверка внеконтестных
          попыток.
        </p>
        <div className="mt-8">
          <ArchiveManager
            attempts={attempts.map((attempt) => ({
              createdAt: attempt.createdAt.toISOString(),
              feedback: attempt.feedback,
              id: attempt.id,
              problemTitle: attempt.problem.title,
              score: attempt.score,
              userNickname: attempt.user.nickname
            }))}
            problems={problems.map((problem) => ({
              archiveEnabled: problem.archiveEnabled,
              archiveIntro: problem.archiveIntro,
              contestTitle: problem.contest.title,
              difficultyRating: problem.difficultyRating,
              id: problem.id,
              isFeatured: problem.isFeatured,
              officialSolution: problem.officialSolution,
              subtopic: problem.subtopic,
              title: problem.title,
              topic: problem.topic
            }))}
          />
        </div>
      </div>
    </section>
  );
}
