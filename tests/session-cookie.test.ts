import assert from "node:assert/strict";
import test from "node:test";
import { shouldUseSecureSessionCookie } from "@/server/auth/cookie-policy";

test("локальный production HTTP не получает Secure cookie", () => {
  const environment = process.env as unknown as Record<string, string | undefined>;
  const previousNodeEnv = environment.NODE_ENV;
  environment.NODE_ENV = "production";
  try {
    const request = new Request("http://localhost:3000/api/auth/login", {
      headers: { host: "127.0.0.1:3100" }
    });
    assert.equal(shouldUseSecureSessionCookie(request), false);
  } finally {
    if (previousNodeEnv === undefined) delete environment.NODE_ENV;
    else environment.NODE_ENV = previousNodeEnv;
  }
});

test("HTTPS reverse proxy получает Secure cookie", () => {
  const request = new Request("http://web:3000/api/auth/login", {
    headers: {
      host: "web:3000",
      "x-forwarded-host": "mathforces.example",
      "x-forwarded-proto": "https"
    }
  });
  assert.equal(shouldUseSecureSessionCookie(request), true);
});
