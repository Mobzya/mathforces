import type { SubmissionStatusValue } from "@/types/submission";

export type StandingProblem = {
  baseScore: number;
  currentMaxScore: number;
  id: string;
  label: string;
  maxScore: number;
  orderIndex: number;
  scoreDecayPer5Min: number;
  title: string;
};

export type StandingHistoryEntry = {
  body: string;
  createdAt: string;
  kind: "ADMIN" | "AI" | "SYSTEM";
};

export type StandingCell = {
  adminComment: string;
  aiComment: string;
  finalScore: number | null;
  history: StandingHistoryEntry[];
  maxScoreAtSubmission: number | null;
  preliminaryScore: number | null;
  problemId: string;
  score: number | null;
  scoreDelta: number | null;
  status: SubmissionStatusValue | null;
  submissionId: string | null;
  submittedAt: string | null;
};

export type StandingRow = {
  cells: StandingCell[];
  isOwn: boolean;
  lastSubmissionAt: string | null;
  place: number;
  preContest: {
    expectedPlace: number;
    ratingAtStart: number;
    seedPlace: number;
  } | null;
  totalScore: number;
  user: {
    currentRating: number;
    id: string;
    nickname: string;
    rankColor: string;
    rankTitle: string;
  };
};

export type ContestStandings = {
  contestId: string;
  generatedAt: string;
  problems: StandingProblem[];
  rows: StandingRow[];
  scoring: {
    currentMaxScore: number;
    endAt: string;
    finalReview: {
      completed: number;
      failed: number;
      queued: number;
      status: "QUEUED" | "PROCESSING" | "NEEDS_REVIEW" | "COMPLETED" | "FAILED";
    } | null;
    maxScore: number;
    serverNow: string;
    startAt: string;
  };
  status: "ANNOUNCED" | "RUNNING" | "FINISHED";
};
