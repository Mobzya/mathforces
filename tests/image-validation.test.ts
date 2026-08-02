import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  detectImageFormat,
  validateImageDimensions,
  validateSubmissionBytes
} from "@/server/submissions/validation";

test("настоящая PNG-иконка проходит проверку", async () => {
  const bytes = new Uint8Array(await readFile("public/icons/icon-192.png"));
  const result = validateSubmissionBytes(bytes, "solution.png");
  assert.ok(result.data);
  assert.equal(result.data.mimeType, "image/png");
});

test("одной сигнатуры PNG недостаточно", () => {
  const bytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const result = validateSubmissionBytes(bytes, "broken.png");
  assert.equal(result.data, undefined);
  assert.match(result.error, /повреждён|заголовок/);
});

test("чрезмерное разрешение блокируется до OCR", () => {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  bytes.set([0x00, 0x00, 0x2e, 0xe1], 16); // 12001
  bytes.set([0x00, 0x00, 0x00, 0x64], 20); // 100
  const format = detectImageFormat(bytes);
  assert.ok(format);
  assert.match(validateImageDimensions(bytes, format) ?? "", /слишком большое/);
});
