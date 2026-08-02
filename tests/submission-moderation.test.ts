import assert from "node:assert/strict";
import test from "node:test";
import { effectiveSubmissionScore, visibleSubmissionScore } from "../server/scoring/result";
import {
  validateSubmissionAdminPatch,
  validateSubmissionAdminTransition
} from "../server/submissions/validation";

test("отклонённая посылка хранит оценки, но даёт ноль в результате", () => {
  const submission = {
    finalScore: 91,
    preliminaryScore: 74,
    status: "REJECTED" as const
  };
  assert.equal(effectiveSubmissionScore(submission), 0);
  assert.equal(visibleSubmissionScore(submission), 0);
});

test("финальная оценка имеет приоритет над предварительной", () => {
  const submission = {
    finalScore: 88,
    preliminaryScore: 73,
    status: "FINALIZED" as const
  };
  assert.equal(effectiveSubmissionScore(submission), 88);
  assert.equal(visibleSubmissionScore(submission), 88);
});

test("спорная финальная оценка не подменяет предварительный результат", () => {
  const submission = {
    finalScore: 42,
    preliminaryScore: 73,
    status: "NEEDS_REVIEW" as const
  };
  assert.equal(effectiveSubmissionScore(submission), 73);
  assert.equal(visibleSubmissionScore(submission), 73);
});

test("администратор не может вручную подделать статус worker", () => {
  const result = validateSubmissionAdminPatch({ status: "PROCESSING" });
  assert.ok(result.errors?.status);
});

test("ручная оценка требует итоговый балл и причину", () => {
  const transition = validateSubmissionAdminTransition(
    {
      finalScore: null,
      preliminaryScore: 40,
      status: "NEEDS_REVIEW"
    },
    { status: "FINALIZED" }
  );
  assert.equal(transition.changesEvaluationState, true);
  assert.ok(transition.errors?.finalScore);
  assert.ok(transition.errors?.adminComment);
});

test("изменение только видимости не требует причины переоценки", () => {
  const transition = validateSubmissionAdminTransition(
    {
      finalScore: 50,
      preliminaryScore: 45,
      status: "FINALIZED"
    },
    { isPublic: false }
  );
  assert.equal(transition.changesEvaluationState, false);
  assert.equal(transition.errors, undefined);
});
