import type { Contest, Organization, Problem } from "@/generated/prisma/client";
import type { ContestDetail, ContestProblem, ContestSummary } from "@/types/contest";

type ContestWithSummaryRelations = Contest & {
  organization: Organization | null;
  _count: {
    problems: number;
    registrations: number;
  };
};

export function serializeContestSummary(contest: ContestWithSummaryRelations): ContestSummary {
  return {
    description: contest.description,
    durationMinutes: contest.durationMinutes,
    endAt: contest.endAt.toISOString(),
    id: contest.id,
    isPublic: contest.isPublic,
    organization: contest.organization
      ? {
          id: contest.organization.id,
          name: contest.organization.name
        }
      : null,
    problemCount: contest._count.problems,
    registrationClosesAt: contest.registrationClosesAt?.toISOString() ?? null,
    registrationCount: contest._count.registrations,
    requiredProblemCount: contest.requiredProblemCount,
    startAt: contest.startAt.toISOString(),
    status: contest.status,
    tags: contest.tags,
    title: contest.title
  };
}

export function serializeProblem(problem: Problem): ContestProblem {
  return {
    baseScore: problem.baseScore,
    id: problem.id,
    maxScore: problem.maxScore,
    orderIndex: problem.orderIndex,
    scoreDecayPer5Min: problem.scoreDecayPer5Min,
    statement: problem.statement,
    subtopic: problem.subtopic,
    title: problem.title,
    topic: problem.topic
  };
}

export function serializeContestDetail(
  contest: ContestWithSummaryRelations & {
    problems: Problem[];
  },
  isRegistered: boolean,
  revealStatements = contest.status !== "ANNOUNCED"
): ContestDetail {
  return {
    ...serializeContestSummary(contest),
    isRegistered,
    problems: contest.problems.map((problem) => ({
      ...serializeProblem(problem),
      statement: revealStatements ? problem.statement : "",
      title: revealStatements
        ? problem.title
        : `Задача ${String.fromCharCode(64 + problem.orderIndex)}`
    })),
    rules: contest.rules,
    showOthersSubmissions: contest.showOthersSubmissions,
    showPreliminaryScores: contest.showPreliminaryScores,
    showStandingsDuringContest: contest.showStandingsDuringContest,
    showSubmissionComments: contest.showSubmissionComments
  };
}
