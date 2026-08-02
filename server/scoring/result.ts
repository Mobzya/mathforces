import type { SubmissionStatus } from "@/generated/prisma/client";

type ScoredSubmission = {
  finalScore: number | null;
  preliminaryScore: number | null;
  status: SubmissionStatus;
};

/**
 * The value that contributes to standings and rating. Rejected submissions
 * keep their historical scores for audit purposes, but contribute zero.
 */
export function effectiveSubmissionScore(submission: ScoredSubmission) {
  if (submission.status === "REJECTED") return 0;
  if (submission.status === "FINALIZED" && submission.finalScore !== null) {
    return submission.finalScore;
  }
  return submission.preliminaryScore ?? 0;
}

export function visibleSubmissionScore(submission: ScoredSubmission) {
  if (submission.status === "REJECTED") return 0;
  if (submission.status === "FINALIZED" && submission.finalScore !== null) {
    return submission.finalScore;
  }
  return submission.preliminaryScore;
}
