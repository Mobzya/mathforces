import assert from "node:assert/strict";
import test from "node:test";
import { calculateRatingChanges } from "@/server/rating/formula";

const contest = { durationMinutes: 90, maxScore: 500 };
const at = new Date("2026-08-02T12:00:00.000Z");

function field(ratings: number[]) {
  return ratings.map((rating, index) => ({
    currentRating: rating,
    lastSubmissionAt: new Date(at.getTime() + index * 1_000),
    ratingAtStart: rating,
    seedPlace: index + 1,
    totalScore: 400 - index * 100,
    userId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`
  }));
}

test("один активный участник не получает рейтинг", () => {
  assert.deepEqual(calculateRatingChanges(field([0]), contest), []);
});

test("обычный тур почти консервативен", () => {
  const results = calculateRatingChanges(field([1500, 1500, 1500, 1500]), contest);
  assert.deepEqual(
    results.map((result) => result.delta),
    [235, 79, -77, -233]
  );
  assert.equal(
    results.reduce((sum, result) => sum + result.delta, 0),
    results.length
  );
});

test("новички получают onboarding, но рейтинг остаётся в границах", () => {
  const results = calculateRatingChanges(field([0, 0, 0, 0]), contest);
  assert.deepEqual(
    results.map((result) => result.delta),
    [422, 235, 48, 25]
  );
  assert.ok(results.every((result) => result.newRating >= 0 && result.newRating <= 3000));
});
