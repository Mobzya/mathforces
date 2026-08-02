import { localSubmissionStorage } from "@/services/storage/local";

// The web layer depends only on this adapter contract. A remote S3-compatible
// implementation can replace local storage without changing submission logic.
export const objectStorage = localSubmissionStorage;
export const submissionStorage = objectStorage;
