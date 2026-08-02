import { ArrowRight, Building2, CalendarDays, Clock3, Radio, Tags, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { contestStatusMeta, formatContestDate } from "@/lib/contests/presentation";
import type { ContestSummary } from "@/types/contest";

export function ContestCard({ contest }: { contest: ContestSummary }) {
  const status = contestStatusMeta[contest.status];

  return (
    <article className="card grid gap-6 p-5 transition hover:border-[var(--line-strong)] sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={status.tone}>
            {contest.status === "RUNNING" && <Radio size={11} />}
            {status.label}
          </Badge>
          <span className="text-xs font-medium text-[var(--muted)]">
            {contest.problemCount}/{contest.requiredProblemCount} задач
          </span>
        </div>
        <h2 className="mt-4 font-display text-2xl font-semibold tracking-[-0.02em]">
          {contest.title}
        </h2>
        {contest.description && (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
            {contest.description}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--muted)]">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays size={15} />
            {formatContestDate(contest.startAt)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock3 size={15} />
            {contest.durationMinutes} минут
          </span>
          <span className="inline-flex items-center gap-1.5">
            <UsersRound size={15} />
            {contest.registrationCount} участников
          </span>
          {contest.organization && (
            <span className="inline-flex items-center gap-1.5">
              <Building2 size={15} />
              {contest.organization.name}
            </span>
          )}
          {contest.tags.length > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Tags size={15} />
              {contest.tags.join(" · ")}
            </span>
          )}
        </div>
      </div>
      <ButtonLink
        aria-label={`Открыть контест «${contest.title}»`}
        className="w-full lg:w-auto"
        href={`/contests/${contest.id}`}
        variant={contest.status === "RUNNING" ? "primary" : "secondary"}
      >
        Открыть
        <ArrowRight size={17} />
      </ButtonLink>
    </article>
  );
}
