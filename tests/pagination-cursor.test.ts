import assert from "node:assert/strict";
import test from "node:test";
import { decodeTimelineCursor, encodeTimelineCursor } from "../server/pagination/cursor";

test("курсор временной ленты проходит обратимое кодирование", () => {
  const input = {
    createdAt: new Date("2026-08-02T12:34:56.789Z"),
    id: "00000000-0000-4000-8000-000000000001"
  };
  assert.deepEqual(decodeTimelineCursor(encodeTimelineCursor(input)), input);
});

test("повреждённый курсор не принимается", () => {
  assert.equal(decodeTimelineCursor("not-a-valid-cursor"), null);
  assert.equal(
    decodeTimelineCursor(
      Buffer.from(JSON.stringify({ createdAt: "bad", id: "bad" })).toString("base64url")
    ),
    null
  );
});
