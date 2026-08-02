import type {
  ContestStatus,
  ProblemTopic,
  SubmissionStatus,
  UserRole
} from "@/generated/prisma/client";

export type AdminContest = {
  autoCalculateRating: boolean;
  autoFinalRejudge: boolean;
  autoPublishArchive: boolean;
  description: string;
  durationMinutes: number;
  endAt: string;
  id: string;
  isPublic: boolean;
  organization: { id: string; name: string } | null;
  problemCount: number;
  registrationClosesAt: string | null;
  registrationCount: number;
  requiredProblemCount: number;
  reviewConfidenceThreshold: number;
  rules: string;
  showOthersSubmissions: boolean;
  showPreliminaryScores: boolean;
  showStandingsDuringContest: boolean;
  showSubmissionComments: boolean;
  startAt: string;
  status: ContestStatus;
  tags: string[];
  title: string;
};

export type AdminProblem = {
  archiveEnabled: boolean;
  archiveIntro: string;
  baseScore: number;
  evaluationRubric: string;
  id: string;
  maxScore: number;
  orderIndex: number;
  officialSolution: string;
  scoreDecayPer5Min: number;
  statement: string;
  subtopic: string;
  title: string;
  topic: ProblemTopic;
};

export type AdminArchiveProblem = {
  contestTitle: string;
  difficultyRating: number | null;
  id: string;
  maxScore: number;
  subtopic: string;
  title: string;
  topic: ProblemTopic;
};

export type AdminSubmission = {
  adminComment: string;
  aiComment: string;
  contest: { id: string; title: string };
  createdAt: string;
  finalScore: number | null;
  id: string;
  imageAccessUrl: string;
  isPublic: boolean;
  evaluationConfidence: "LOW" | "MEDIUM" | "HIGH" | null;
  evaluationConfidenceValue: number | null;
  evaluationStatus: "PROCESSING" | "COMPLETED" | "NEEDS_REVIEW" | "FAILED" | null;
  preliminaryScore: number | null;
  problem: {
    id: string;
    maxScore: number;
    orderIndex: number;
    title: string;
  };
  status: SubmissionStatus;
  updatedAt: string;
  user: { id: string; nickname: string };
};

export type AdminOrganization = {
  contestCount: number;
  createdAt: string;
  createdBy: { id: string; nickname: string } | null;
  id: string;
  memberCount: number;
  name: string;
};

export type AdminUser = {
  contestCount: number;
  createdAt: string;
  currentRating: number;
  email: string;
  grade: number | null;
  id: string;
  nickname: string;
  organization: { id: string; name: string };
  role: UserRole;
  submissionCount: number;
};
