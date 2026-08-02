import type { Problem, Submission, User } from "@/generated/prisma/client";
import type { PublicSubmission, SubmissionDetail } from "@/types/submission";
import { getRankMeta } from "@/lib/rating/rank";

type SubmissionWithPublicRelations = Submission & {
  contest?: { showSubmissionComments: boolean };
  evaluations?: {
    confidence: "LOW" | "MEDIUM" | "HIGH" | null;
    status: "PROCESSING" | "COMPLETED" | "NEEDS_REVIEW" | "FAILED";
  }[];
  problem: Pick<Problem, "id" | "orderIndex" | "title">;
  user: Pick<User, "id" | "nickname"> & Partial<Pick<User, "currentRating">>;
};

export function serializePublicSubmission(
  submission: SubmissionWithPublicRelations,
  options: {
    isAdmin?: boolean;
    showPreliminaryScores?: boolean;
    viewerId?: string;
  } = {}
): PublicSubmission {
  const isAdmin = options.isAdmin === true;
  const isOwn = submission.userId === options.viewerId;
  const isFinal = submission.status === "FINALIZED";
  const canSeePreliminary = isAdmin || isOwn || options.showPreliminaryScores !== false;
  return {
    contestId: submission.contestId,
    createdAt: submission.createdAt.toISOString(),
    finalScore: isAdmin || isFinal ? submission.finalScore : null,
    id: submission.id,
    isOwn,
    evaluationConfidence: isAdmin ? (submission.evaluations?.[0]?.confidence ?? null) : null,
    evaluationNeedsReview:
      isAdmin &&
      (submission.evaluations?.[0]?.status === "NEEDS_REVIEW" ||
        submission.evaluations?.[0]?.status === "FAILED"),
    preliminaryScore: canSeePreliminary ? submission.preliminaryScore : null,
    problem: {
      id: submission.problem.id,
      orderIndex: submission.problem.orderIndex,
      title: submission.problem.title
    },
    status:
      !isAdmin && submission.status === "NEEDS_REVIEW" ? "PRELIMINARY_READY" : submission.status,
    updatedAt: submission.updatedAt.toISOString(),
    user: {
      id: submission.user.id,
      nickname: submission.user.nickname,
      rankColor: getRankMeta(submission.user.currentRating ?? 0).color
    }
  };
}

export function serializeSubmissionDetail(
  submission: SubmissionWithPublicRelations,
  viewer: { id: string; role: "ADMIN" | "PARTICIPANT" } | null
): SubmissionDetail {
  const canSeePrivateData = viewer?.role === "ADMIN" || viewer?.id === submission.userId;
  const canSeeSharedComment =
    canSeePrivateData || submission.contest?.showSubmissionComments === true;

  return {
    ...serializePublicSubmission(submission, {
      isAdmin: viewer?.role === "ADMIN",
      viewerId: viewer?.id
    }),
    adminComment: canSeeSharedComment ? submission.adminComment : "",
    aiComment: viewer?.role === "ADMIN" ? submission.aiComment : "",
    imageAccessUrl: canSeePrivateData ? `/api/submissions/${submission.id}/image` : null,
    isPublic: submission.isPublic
  };
}
