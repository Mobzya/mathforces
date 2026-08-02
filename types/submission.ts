export type SubmissionStatusValue =
  "QUEUED" | "PROCESSING" | "PRELIMINARY_READY" | "NEEDS_REVIEW" | "FINALIZED" | "REJECTED";

export type PublicSubmission = {
  contestId: string;
  createdAt: string;
  finalScore: number | null;
  id: string;
  isOwn: boolean;
  evaluationConfidence: "LOW" | "MEDIUM" | "HIGH" | null;
  evaluationNeedsReview: boolean;
  preliminaryScore: number | null;
  problem: {
    id: string;
    orderIndex: number;
    title: string;
  };
  status: SubmissionStatusValue;
  updatedAt: string;
  user: {
    id: string;
    nickname: string;
    rankColor: string;
  };
};

export type SubmissionDetail = PublicSubmission & {
  adminComment: string;
  aiComment: string;
  imageAccessUrl: string | null;
  isPublic: boolean;
};
