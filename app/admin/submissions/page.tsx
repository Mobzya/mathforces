import type { Metadata } from "next";
import { Filter } from "lucide-react";
import Link from "next/link";
import { SubmissionReviewList } from "@/components/admin/SubmissionReviewList";
import { submissionStatusMeta } from "@/lib/submissions/presentation";
import { prisma } from "@/server/db/client";
import { isUuid } from "@/server/validation/primitives";
import type { AdminSubmission } from "@/types/admin";

export const metadata: Metadata = { title: "Проверка посылок" };

export default async function AdminSubmissionsPage({
  searchParams
}: {
  searchParams: Promise<{
    contestId?: string | string[];
    page?: string | string[];
    query?: string | string[];
    status?: string | string[];
  }>;
}) {
  const requested = await searchParams;
  const contestId =
    typeof requested.contestId === "string" && isUuid(requested.contestId)
      ? requested.contestId
      : "";
  const validStatuses = Object.keys(submissionStatusMeta);
  const status =
    typeof requested.status === "string" && validStatuses.includes(requested.status)
      ? requested.status
      : "";
  const query = typeof requested.query === "string" ? requested.query.trim().slice(0, 80) : "";
  const requestedPage = typeof requested.page === "string" ? Number(requested.page) : 1;
  const normalizedPage = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = 50;
  const submissionWhere = {
    ...(contestId ? { contestId } : {}),
    ...(status ? { status: status as never } : {}),
    ...(query
      ? {
          OR: [
            { user: { nickname: { contains: query, mode: "insensitive" as const } } },
            { problem: { title: { contains: query, mode: "insensitive" as const } } }
          ]
        }
      : {})
  };

  const submissionCount = await prisma.submission.count({ where: submissionWhere });
  const totalPages = Math.max(1, Math.ceil(submissionCount / pageSize));
  const page = Math.min(normalizedPage, totalPages);
  const [submissions, contests] = await Promise.all([
    prisma.submission.findMany({
      include: {
        contest: { select: { id: true, title: true } },
        evaluations: {
          orderBy: { createdAt: "desc" },
          select: { confidence: true, confidenceValue: true, status: true },
          take: 1
        },
        problem: { select: { id: true, maxScore: true, orderIndex: true, title: true } },
        user: { select: { id: true, nickname: true } }
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      where: submissionWhere
    }),
    prisma.contest.findMany({
      orderBy: { startAt: "desc" },
      select: { id: true, title: true }
    })
  ]);

  const serialized: AdminSubmission[] = submissions.map((submission) => ({
    adminComment: submission.adminComment,
    aiComment: submission.aiComment,
    contest: submission.contest,
    createdAt: submission.createdAt.toISOString(),
    finalScore: submission.finalScore,
    id: submission.id,
    imageAccessUrl: `/api/submissions/${submission.id}/image`,
    isPublic: submission.isPublic,
    evaluationConfidence: submission.evaluations[0]?.confidence ?? null,
    evaluationConfidenceValue: submission.evaluations[0]?.confidenceValue ?? null,
    evaluationStatus: submission.evaluations[0]?.status ?? null,
    preliminaryScore: submission.preliminaryScore,
    problem: submission.problem,
    status: submission.status,
    updatedAt: submission.updatedAt.toISOString(),
    user: submission.user
  }));

  return (
    <section className="page-section">
      <div className="page-shell">
        <h1 className="font-display text-4xl font-semibold">Проверка посылок</h1>
        <p className="mt-2 text-[var(--muted)]">
          Фото, ручные баллы, комментарии и повторная проверка.
        </p>

        <form
          className="card mt-8 grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_14rem_14rem_auto]"
          method="get"
        >
          <label className="form-label">
            Контест
            <select className="field" defaultValue={contestId} name="contestId">
              <option value="">Все контесты</option>
              {contests.map((contest) => (
                <option key={contest.id} value={contest.id}>
                  {contest.title}
                </option>
              ))}
            </select>
          </label>
          <label className="form-label">
            Поиск
            <input
              className="field"
              defaultValue={query}
              name="query"
              placeholder="Ник или задача"
            />
          </label>
          <label className="form-label">
            Статус
            <select className="field" defaultValue={status} name="status">
              <option value="">Все статусы</option>
              {validStatuses.map((value) => (
                <option key={value} value={value}>
                  {submissionStatusMeta[value as keyof typeof submissionStatusMeta].label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="inline-flex min-h-12 items-center justify-center gap-2 self-end rounded-xl bg-[var(--strong)] px-4 text-sm font-semibold text-white"
            type="submit"
          >
            <Filter size={16} />
            Применить
          </button>
        </form>

        <div className="mt-6">
          <SubmissionReviewList submissions={serialized} />
        </div>
        {totalPages > 1 && (
          <nav
            className="mt-6 flex items-center justify-center gap-3"
            aria-label="Страницы посылок"
          >
            <AdminPageLink
              contestId={contestId}
              disabled={page <= 1}
              label="Назад"
              page={page - 1}
              query={query}
              status={status}
            />
            <span className="text-sm text-[var(--muted)]">
              {page} / {totalPages}
            </span>
            <AdminPageLink
              contestId={contestId}
              disabled={page >= totalPages}
              label="Дальше"
              page={page + 1}
              query={query}
              status={status}
            />
          </nav>
        )}
      </div>
    </section>
  );
}

function AdminPageLink({
  contestId,
  disabled,
  label,
  page,
  query,
  status
}: {
  contestId: string;
  disabled: boolean;
  label: string;
  page: number;
  query: string;
  status: string;
}) {
  const params = new URLSearchParams();
  if (contestId) params.set("contestId", contestId);
  if (status) params.set("status", status);
  if (query) params.set("query", query);
  params.set("page", String(page));
  return disabled ? (
    <span className="rounded-xl border border-[var(--line)] px-4 py-2 text-sm font-semibold opacity-40">
      {label}
    </span>
  ) : (
    <Link
      className="rounded-xl border border-[var(--line-strong)] px-4 py-2 text-sm font-semibold"
      href={`/admin/submissions?${params.toString()}`}
    >
      {label}
    </Link>
  );
}
