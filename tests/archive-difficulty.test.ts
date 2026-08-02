import assert from "node:assert/strict";
import test from "node:test";
import { ARCHIVE_AREAS } from "../lib/archive/taxonomy";
import { estimateArchiveDifficulty } from "../server/archive/difficulty";

test("архивное колесо содержит 12 уникальных областей", () => {
  assert.equal(ARCHIVE_AREAS.length, 12);
  assert.equal(new Set(ARCHIVE_AREAS.map((area) => area.key)).size, 12);
  assert.ok(ARCHIVE_AREAS.every((area) => area.subtopics.length >= 4));
});

test("сложность округлена до 10 и ограничена 3000", () => {
  const result = estimateArchiveDifficulty({
    observations: Array.from({ length: 40 }, (_, index) => ({
      rating: index * 75,
      score: index >= 20 ? 95 : 45
    })),
    orderIndex: 5
  });
  assert.equal(result.rating % 10, 0);
  assert.ok(result.rating >= 0 && result.rating <= 3000);
  assert.ok(result.confidence > 0);
});

test("поздняя позиция задачи повышает априорную сложность", () => {
  const first = estimateArchiveDifficulty({ observations: [], orderIndex: 1 });
  const fifth = estimateArchiveDifficulty({ observations: [], orderIndex: 5 });
  assert.ok(fifth.rating > first.rating);
});
