import type { Metadata } from "next";
import { ArrowLeft, LockKeyhole, Send } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContestTabs } from "@/components/contest/ContestTabs";
import { SubmissionFeed } from "@/components/submissions/SubmissionFeed";
import { getCurrentUser } from "@/server/auth/session";
import { findContest } from "@/server/contests/queries";
import { isUuid } from "@/server/validation/primitives";
import { isContestAcceptingSubmissions } from "@/server/contests/lifecycle";
import { listPublicContestSubmissions } from "@/server/submissions/queries";

export const metadata: Metadata = {
  title: "Посылки"
};

export const dynamic = "force-dynamic";

export default async function ContestSubmissionsPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) {
    notFound();
  }

  const viewer = await getCurrentUser();
  const contest = await findContest(id, viewer);
  if (!contest) {
    notFound();
  }

  const submissionPage = await listPublicContestSubmissions({
    contestId: contest.id,
    viewer
  });

  const canSubmit =
    Boolean(viewer) &&
    isContestAcceptingSubmissions(contest) &&
    (contest.isRegistered || viewer?.role === "ADMIN");

  return (
    <section className="page-section">
      <div className="page-shell">
        <Link
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
          href="/contests"
        >
          <ArrowLeft size={16} />
          Все контесты
        </Link>

        <div className="mt-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--accent)]">
              {contest.title}
            </p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em]">Посылки</h1>
          </div>
          {canSubmit && (
            <Link
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--strong)] px-5 text-sm font-semibold text-white"
              href={`/contests/${contest.id}/submit`}
            >
              <Send size={16} />
              Отправить решение
            </Link>
          )}
        </div>

        <div className="mt-7">
          <ContestTabs active="submissions" contestId={contest.id} />
        </div>

        <div className="mt-5 flex gap-3 rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--muted)]">
          <LockKeyhole className="mt-0.5 shrink-0" size={17} />
          <p>
            {contest.showOthersSubmissions
              ? "В ленте видны публичные посылки, но фотографии решений доступны только автору и администратору."
              : "Организатор скрыл чужие посылки до изменения настроек. Здесь отображаются только ваши отправки."}
          </p>
        </div>

        <div className="mt-6">
          <SubmissionFeed
            contestId={contest.id}
            initialNextCursor={submissionPage.nextCursor}
            initialSubmissions={submissionPage.submissions}
          />
        </div>
      </div>
    </section>
  );
}
