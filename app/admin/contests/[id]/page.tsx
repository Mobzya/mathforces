import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContestEditor } from "@/components/admin/ContestEditor";
import { prisma } from "@/server/db/client";
import { isUuid } from "@/server/validation/primitives";
import type { AdminArchiveProblem, AdminContest, AdminProblem } from "@/types/admin";

export const metadata: Metadata = { title: "Конструктор контеста" };

export default async function AdminContestEditorPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const [contest, organizations, archiveProblems] = await Promise.all([
    prisma.contest.findUnique({
      include: {
        _count: { select: { problems: true, registrations: true } },
        organization: { select: { id: true, name: true } },
        problems: { orderBy: { orderIndex: "asc" } },
        finalization: {
          select: {
            completedCount: true,
            failedCount: true,
            queuedCount: true,
            status: true
          }
        },
        ratingCalculation: {
          select: {
            calculatedAt: true,
            participantCount: true,
            resultsRevision: true
          }
        }
      },
      where: { id }
    }),
    prisma.organization.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    }),
    prisma.problem.findMany({
      orderBy: [{ isFeatured: "desc" }, { archivedAt: "desc" }],
      select: {
        contest: { select: { title: true } },
        difficultyRating: true,
        id: true,
        maxScore: true,
        subtopic: true,
        title: true,
        topic: true
      },
      take: 250,
      where: {
        archiveEnabled: true,
        archivedAt: { not: null },
        contestId: { not: id }
      }
    })
  ]);
  if (!contest) notFound();
  const requestedError = (await searchParams).error;
  const initialError = typeof requestedError === "string" ? requestedError.slice(0, 300) : "";

  const serializedContest: AdminContest = {
    autoCalculateRating: contest.autoCalculateRating,
    autoFinalRejudge: contest.autoFinalRejudge,
    autoPublishArchive: contest.autoPublishArchive,
    description: contest.description,
    durationMinutes: contest.durationMinutes,
    endAt: contest.endAt.toISOString(),
    id: contest.id,
    isPublic: contest.isPublic,
    organization: contest.organization,
    problemCount: contest._count.problems,
    registrationClosesAt: contest.registrationClosesAt?.toISOString() ?? null,
    registrationCount: contest._count.registrations,
    requiredProblemCount: contest.requiredProblemCount,
    reviewConfidenceThreshold: contest.reviewConfidenceThreshold,
    rules: contest.rules,
    showOthersSubmissions: contest.showOthersSubmissions,
    showPreliminaryScores: contest.showPreliminaryScores,
    showStandingsDuringContest: contest.showStandingsDuringContest,
    showSubmissionComments: contest.showSubmissionComments,
    startAt: contest.startAt.toISOString(),
    status: contest.status,
    tags: contest.tags,
    title: contest.title
  };
  const problems: AdminProblem[] = contest.problems.map((problem) => ({
    archiveEnabled: problem.archiveEnabled,
    archiveIntro: problem.archiveIntro,
    baseScore: problem.baseScore,
    evaluationRubric: problem.evaluationRubric,
    id: problem.id,
    maxScore: problem.maxScore,
    officialSolution: problem.officialSolution,
    orderIndex: problem.orderIndex,
    scoreDecayPer5Min: problem.scoreDecayPer5Min,
    statement: problem.statement,
    subtopic: problem.subtopic,
    title: problem.title,
    topic: problem.topic
  }));
  const serializedArchiveProblems: AdminArchiveProblem[] = archiveProblems.map((problem) => ({
    contestTitle: problem.contest.title,
    difficultyRating: problem.difficultyRating,
    id: problem.id,
    maxScore: problem.maxScore,
    subtopic: problem.subtopic,
    title: problem.title,
    topic: problem.topic
  }));

  return (
    <section className="page-section">
      <div className="page-shell">
        <Link
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)]"
          href="/admin/contests"
        >
          <ArrowLeft size={16} />
          Все контесты
        </Link>
        <h1 className="mt-5 font-display text-4xl font-semibold tracking-[-0.04em]">
          {contest.title}
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          Визуальный конструктор и управление состоянием тура.
        </p>
        <div className="mt-8">
          <ContestEditor
            archiveProblems={serializedArchiveProblems}
            contest={serializedContest}
            initialError={initialError}
            organizations={organizations}
            problems={problems}
            finalization={contest.finalization}
            ratingCalculation={
              contest.ratingCalculation
                ? {
                    calculatedAt: contest.ratingCalculation.calculatedAt.toISOString(),
                    participantCount: contest.ratingCalculation.participantCount,
                    isStale: contest.ratingCalculation.resultsRevision !== contest.resultsRevision
                  }
                : null
            }
          />
        </div>
      </div>
    </section>
  );
}
