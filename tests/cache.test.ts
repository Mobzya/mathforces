import assert from "node:assert/strict";
import test from "node:test";
import { cached, invalidateCache } from "../server/cache/ttl";

test("TTL-кэш объединяет параллельные промахи одного ключа", async () => {
  const key = `test:cache:${Date.now()}:${Math.random()}`;
  let loads = 0;
  const load = () =>
    cached(key, 5_000, async () => {
      loads += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { value: 42 };
    });

  const values = await Promise.all(Array.from({ length: 25 }, () => load()));
  assert.equal(loads, 1);
  assert.ok(values.every((value) => value.value === 42));

  invalidateCache("test:cache:");
  await load();
  assert.equal(loads, 2);
});
