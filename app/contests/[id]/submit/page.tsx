import type { Metadata } from "next";
import { ArrowLeft, CircleAlert, Clock3 } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SubmissionForm } from "@/components/submissions/SubmissionForm";
import { getCurrentUser } from "@/server/auth/session";
import { findContest } from "@/server/contests/queries";
import { isUuid } from "@/server/validation/primitives";
import { isContestAcceptingSubmissions } from "@/server/contests/lifecycle";

export const metadata: Metadata = {
  title: "Отправить решение"
};

export const dynamic = "force-dynamic";

export default async function SubmitSolutionPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string | string[];
    problem?: string | string[];
  }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) {
    notFound();
  }

  const viewer = await getCurrentUser();
  if (!viewer) {
    redirect("/login");
  }

  const contest = await findContest(id, viewer);
  if (!contest) {
    notFound();
  }

  const requested = await searchParams;
  const requestedProblem = typeof requested.problem === "string" ? requested.problem : "";
  const initialProblemId = contest.problems.some((problem) => problem.id === requestedProblem)
    ? requestedProblem
    : (contest.problems[0]?.id ?? "");
  const initialError = typeof requested.error === "string" ? requested.error.slice(0, 300) : "";
  const acceptsSubmissions = isContestAcceptingSubmissions(contest);
  const canSubmit =
    acceptsSubmissions &&
    contest.problems.length > 0 &&
    (contest.isRegistered || viewer.role === "ADMIN");

  return (
    <section className="page-section">
      <div className="page-shell max-w-3xl">
        <Link
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
          href={`/contests/${contest.id}`}
        >
          <ArrowLeft size={16} />К задачам контеста
        </Link>

        <div className="mt-7">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--accent)]">
            {contest.title}
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em]">
            Отправить решение
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Сфотографируйте все рассуждения целиком: доказательство, вычисления, чертёж и итоговый
            ответ должны хорошо читаться.
          </p>
        </div>

        <div className="card mt-8 p-5 sm:p-7">
          {canSubmit ? (
            <SubmissionForm
              contestId={contest.id}
              initialError={initialError}
              initialProblemId={initialProblemId}
              problems={contest.problems.map((problem) => ({
                id: problem.id,
                label: String.fromCharCode(64 + problem.orderIndex),
                maxScore: problem.maxScore,
                title: problem.title
              }))}
            />
          ) : (
            <div className="py-8 text-center">
              {acceptsSubmissions ? (
                <CircleAlert className="mx-auto text-[var(--accent)]" size={34} />
              ) : (
                <Clock3 className="mx-auto text-[var(--line-strong)]" size={34} />
              )}
              <h2 className="mt-4 font-display text-2xl font-semibold">
                {acceptsSubmissions
                  ? "Нужна регистрация на контест"
                  : "Приём решений сейчас закрыт"}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
                {acceptsSubmissions
                  ? "Вернитесь на страницу контеста и зарегистрируйтесь, затем откройте отправку снова."
                  : "Фотографии можно отправлять только во время активного тура."}
              </p>
              <Link
                className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--strong)] px-5 text-sm font-semibold text-white"
                href={`/contests/${contest.id}`}
              >
                Открыть контест
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
