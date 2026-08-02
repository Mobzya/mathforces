import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import pg from "pg";

if (existsSync(".env")) process.loadEnvFile?.(".env");

const baseUrl = (process.env.SMOKE_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL не задан");

const pool = new pg.Pool({ connectionString: databaseUrl });
const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
const email = `security-smoke-${suffix}@mathforces.local`;
const nickname = `security_${suffix}`;
const oldPassword = "old-password-123";
const changedPassword = "changed-password-456";
const resetPassword = "reset-password-789";
let userId = null;
let adminSessionId = null;

try {
  const organization = await pool.query(
    'SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1'
  );
  const organizationId = organization.rows[0]?.id;
  if (!organizationId) throw new Error("Для теста нужна организация");
  const admin = await pool.query(
    'SELECT "id" FROM "User" WHERE "role" = \'ADMIN\' ORDER BY "createdAt" ASC LIMIT 1'
  );
  const adminId = admin.rows[0]?.id;
  if (!adminId) throw new Error("Для теста нужен администратор");

  const registration = await request("/api/auth/register", {
    body: JSON.stringify({
      email,
      grade: 9,
      nickname,
      organization: { id: organizationId, mode: "existing" },
      password: oldPassword
    }),
    headers: { "content-type": "application/json", origin: baseUrl },
    method: "POST"
  });
  assert(registration.status === 201, `регистрация вернула ${registration.status}`);
  const registered = await registration.json();
  userId = registered.user?.id;
  assert(typeof userId === "string", "регистрация не вернула user.id");
  assert(registered.user.currentRating === 0, "стартовый рейтинг должен быть 0");
  assert(registered.user.maxRating === 0, "стартовый максимум должен быть 0");
  const firstCookie = sessionCookie(registration);
  assert(
    !/;\s*secure(?:;|$)/i.test(registration.headers.get("set-cookie") ?? ""),
    "локальный HTTP получил Secure cookie и браузер потеряет сессию"
  );
  const publicProfile = await request(`/profile/${userId}`);
  assert(
    (await publicProfile.text()).includes("Вы смотрите публичный профиль"),
    "гостю не объясняется публичный режим профиля"
  );
  const ownerProfile = await request(`/profile/${userId}`, {
    headers: { cookie: firstCookie }
  });
  const ownerProfileHtml = await ownerProfile.text();
  assert(
    ownerProfileHtml.includes("Настроить профиль") &&
      !ownerProfileHtml.includes("Вы смотрите публичный профиль"),
    "владелец не распознан в собственном профиле"
  );

  const change = await request("/api/users/me/password", {
    body: JSON.stringify({ currentPassword: oldPassword, newPassword: changedPassword }),
    headers: {
      "content-type": "application/json",
      cookie: firstCookie,
      origin: baseUrl
    },
    method: "PATCH"
  });
  assert(change.status === 200, `смена пароля вернула ${change.status}`);
  const changedCookie = sessionCookie(change);
  assert(
    (await request("/api/users/me", { headers: { cookie: firstCookie } })).status === 401,
    "старая сессия осталась активной"
  );
  assert(
    (await request("/api/users/me", { headers: { cookie: changedCookie } })).status === 200,
    "новая сессия не работает"
  );

  const adminToken = randomBytes(32).toString("base64url");
  adminSessionId = randomUUID();
  await pool.query(
    `INSERT INTO "AuthSession" ("id", "tokenHash", "userId", "expiresAt")
     VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes')`,
    [adminSessionId, createHash("sha256").update(adminToken).digest("hex"), adminId]
  );
  const issue = await request(`/api/admin/users/${userId}/password-reset`, {
    headers: {
      cookie: `mathforces_session=${adminToken}`,
      origin: baseUrl
    },
    method: "POST"
  });
  assert(issue.status === 200, `выдача recovery вернула ${issue.status}`);
  const resetUrl = new URL((await issue.json()).resetUrl);
  const token = resetUrl.searchParams.get("token");
  assert(token, "recovery API не вернул token в ссылке");

  const reset = await request("/api/auth/reset-password", {
    body: JSON.stringify({ password: resetPassword, token }),
    headers: { "content-type": "application/json", origin: baseUrl },
    method: "POST"
  });
  assert(reset.status === 200, `восстановление вернуло ${reset.status}`);
  const resetCookie = sessionCookie(reset);
  assert(
    (await request("/api/users/me", { headers: { cookie: changedCookie } })).status === 401,
    "восстановление не отозвало прежнюю сессию"
  );
  assert(
    (await request("/api/users/me", { headers: { cookie: resetCookie } })).status === 200,
    "автовход после восстановления не работает"
  );
  const reuse = await request("/api/auth/reset-password", {
    body: JSON.stringify({ password: "another-password", token }),
    headers: { "content-type": "application/json", origin: baseUrl },
    method: "POST"
  });
  assert(reuse.status === 422, `повтор token должен вернуть 422, получено ${reuse.status}`);

  const logout = await request("/api/auth/logout", {
    body: "",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: resetCookie,
      origin: baseUrl
    },
    method: "POST",
    redirect: "manual"
  });
  assert(logout.status === 303, `выход через HTML-форму вернул ${logout.status}`);
  assert(
    (await request("/api/users/me", { headers: { cookie: resetCookie } })).status === 401,
    "выход через HTML-форму не завершил сессию"
  );

  const formLogin = await request("/api/auth/login", {
    body: new URLSearchParams({ email, password: resetPassword }),
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin: baseUrl
    },
    method: "POST",
    redirect: "manual"
  });
  assert(formLogin.status === 303, `вход через HTML-форму вернул ${formLogin.status}`);
  const formLoginCookie = sessionCookie(formLogin);
  assert(
    (await request("/api/users/me", { headers: { cookie: formLoginCookie } })).status === 200,
    "вход через HTML-форму не создал рабочую сессию"
  );

  console.log("✓ Локальная cookie, вход, восстановление и нативный выход из аккаунта работают");
} finally {
  if (userId) {
    await pool.query('DELETE FROM "AdminAction" WHERE "entityId" = $1', [userId]);
    await pool.query('DELETE FROM "User" WHERE "id" = $1', [userId]);
  }
  if (adminSessionId) {
    await pool.query('DELETE FROM "AuthSession" WHERE "id" = $1', [adminSessionId]);
  }
  await pool.end();
}

function request(path, init) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    signal: AbortSignal.timeout(15_000)
  });
}

function sessionCookie(response) {
  const header = response.headers.get("set-cookie") ?? "";
  const cookie = header.split(";", 1)[0];
  assert(cookie.startsWith("mathforces_session="), "ответ не установил сессию");
  return cookie;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
