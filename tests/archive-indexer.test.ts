import assert from "node:assert/strict";
import test from "node:test";
import { summarizeDifficultyObservations } from "@/services/archive-indexer/llm";

test("LLM-индексатор получает обезличенную агрегированную статистику", () => {
  const summary = summarizeDifficultyObservations([
    { rating: 400, score: 20 },
    { rating: 520, score: 60 },
    { rating: 750, score: 90 },
    { rating: 810, score: 100 },
    { rating: 4000, score: 100 }
  ]);

  assert.equal(summary.sampleSize, 4);
  assert.equal(summary.averageScore, 67.5);
  assert.equal(summary.fullSolveRate, 0.5);
  assert.deepEqual(summary.scoreBuckets, {
    "0-24": 1,
    "25-49": 0,
    "50-69": 1,
    "70-89": 0,
    "90-100": 2
  });
  assert.equal(summary.ratingBands.length, 3);
});
