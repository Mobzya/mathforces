import type { ContestStatus } from "@/generated/prisma/client";

type ContestWindow = {
  endAt: Date | string;
  startAt: Date | string;
  status: ContestStatus;
};

export function isContestRegistrationOpen(
  contest: Pick<ContestWindow, "startAt" | "status"> & {
    endAt?: Date | string;
    registrationClosesAt?: Date | string | null;
  },
  at = new Date()
) {
  const closesAt = contest.registrationClosesAt
    ? toDate(contest.registrationClosesAt)
    : toDate(contest.startAt);
  return (
    (contest.status === "ANNOUNCED" || contest.status === "RUNNING") &&
    closesAt > at &&
    (!contest.endAt || toDate(contest.endAt) > at)
  );
}

export function hasContestStarted(
  contest: Pick<ContestWindow, "startAt" | "status">,
  at = new Date()
) {
  return contest.status !== "ANNOUNCED" && toDate(contest.startAt) <= at;
}

export function isContestAcceptingSubmissions(contest: ContestWindow, at = new Date()) {
  return (
    contest.status === "RUNNING" && toDate(contest.startAt) <= at && toDate(contest.endAt) > at
  );
}

export function canRevealContestProblems(
  contest: Pick<ContestWindow, "startAt" | "status">,
  isAdmin: boolean,
  at = new Date()
) {
  return isAdmin || hasContestStarted(contest, at);
}

function toDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}
