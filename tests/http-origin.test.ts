import assert from "node:assert/strict";
import test from "node:test";
import { hasValidOrigin } from "@/server/http/responses";

test("origin совпадает с публичным Host даже за внутренним origin Next.js", () => {
  const request = new Request("http://localhost:3000/api/auth/logout", {
    headers: {
      host: "127.0.0.1:3100",
      origin: "http://127.0.0.1:3100"
    },
    method: "POST"
  });
  assert.equal(hasValidOrigin(request), true);
});

test("origin учитывает reverse proxy protocol и отклоняет чужой сайт", () => {
  const valid = new Request("http://web:3000/api/auth/logout", {
    headers: {
      host: "web:3000",
      origin: "https://mathforces.example",
      "x-forwarded-host": "mathforces.example",
      "x-forwarded-proto": "https"
    },
    method: "POST"
  });
  const invalid = new Request("http://web:3000/api/auth/logout", {
    headers: {
      host: "web:3000",
      origin: "https://attacker.example",
      "x-forwarded-host": "mathforces.example",
      "x-forwarded-proto": "https"
    },
    method: "POST"
  });
  assert.equal(hasValidOrigin(valid), true);
  assert.equal(hasValidOrigin(invalid), false);
});
