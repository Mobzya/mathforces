import type { ProblemTopicValue } from "@/types/contest";

export type ArchiveProblemSummary = {
  averageScore: number | null;
  bestScore: number | null;
  contest: { id: string; title: string };
  difficultyRating: number | null;
  fullSolverCount: number;
  id: string;
  isFeatured: boolean;
  isSolved: boolean;
  isStarred: boolean;
  maxScore: number;
  number: string;
  starCount: number;
  subtopic: string;
  title: string;
  topic: ProblemTopicValue;
};

export type ArchiveComment = {
  author: { id: string; nickname: string; rankColor: string };
  body: string;
  createdAt: string;
  id: string;
  score: number;
  viewerVote: number;
};

export type PracticeAttemptView = {
  createdAt: string;
  feedback: string;
  id: string;
  score: number | null;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "NEEDS_REVIEW" | "FAILED";
};
