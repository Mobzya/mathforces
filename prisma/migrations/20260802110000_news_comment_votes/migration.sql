CREATE TABLE "NewsCommentVote" (
    "userId" UUID NOT NULL,
    "commentId" UUID NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsCommentVote_pkey" PRIMARY KEY ("userId", "commentId"),
    CONSTRAINT "NewsCommentVote_value_check" CHECK ("value" IN (-1, 1))
);

CREATE INDEX "NewsCommentVote_commentId_value_idx"
ON "NewsCommentVote"("commentId", "value");

ALTER TABLE "NewsCommentVote"
ADD CONSTRAINT "NewsCommentVote_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NewsCommentVote"
ADD CONSTRAINT "NewsCommentVote_commentId_fkey"
FOREIGN KEY ("commentId") REFERENCES "NewsComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
