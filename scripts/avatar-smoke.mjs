import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import pg from "pg";

if (existsSync(".env")) process.loadEnvFile?.(".env");

const baseUrl = (process.env.SMOKE_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL не задан");

const pool = new pg.Pool({ connectionString: databaseUrl });
const userId = randomUUID();
const token = randomBytes(32).toString("base64url");
const tokenHash = createHash("sha256").update(token).digest("hex");
const email = `avatar-smoke-${userId}@mathforces.local`;
const nickname = `avatar_${userId.replaceAll("-", "").slice(0, 12)}`;

try {
  const organization = await pool.query(
    'SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1'
  );
  const organizationId = organization.rows[0]?.id;
  if (!organizationId) throw new Error("Для теста нужна организация");

  await pool.query(
    `INSERT INTO "User" (
      "id", "email", "nickname", "nicknameNormalized", "passwordHash",
      "organizationId", "updatedAt"
    ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [userId, email, nickname, nickname, "avatar-smoke-not-a-password", organizationId]
  );
  await pool.query(
    `INSERT INTO "AuthSession" (
      "id", "tokenHash", "userId", "expiresAt"
    ) VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes')`,
    [randomUUID(), tokenHash, userId]
  );

  const image = await readFile("public/icons/icon-192.png");
  const form = new FormData();
  form.set("avatar", new File([image], "avatar.png", { type: "image/png" }));
  const upload = await fetch(`${baseUrl}/api/users/me/avatar`, {
    body: form,
    headers: {
      cookie: `mathforces_session=${token}`,
      origin: baseUrl
    },
    method: "POST"
  });
  assert(upload.status === 200, `загрузка вернула HTTP ${upload.status}`);
  const payload = await upload.json();
  assert(typeof payload.avatarUrl === "string", "API не вернул avatarUrl");

  const imageResponse = await fetch(`${baseUrl}${payload.avatarUrl}`);
  assert(imageResponse.status === 200, `чтение вернуло HTTP ${imageResponse.status}`);
  assert(
    imageResponse.headers.get("content-type") === "image/png",
    "неверный Content-Type аватара"
  );

  const deletion = await fetch(`${baseUrl}/api/users/me/avatar`, {
    headers: {
      cookie: `mathforces_session=${token}`,
      origin: baseUrl
    },
    method: "DELETE"
  });
  assert(deletion.status === 200, `удаление вернуло HTTP ${deletion.status}`);
  const removedImage = await fetch(`${baseUrl}${payload.avatarUrl}`);
  assert(removedImage.status === 404, "удалённый аватар всё ещё доступен");
  console.log("✓ Загрузка, чтение и удаление аватара работают");
} finally {
  const record = await pool.query('SELECT "avatarStorageKey" FROM "User" WHERE "id" = $1', [
    userId
  ]);
  const storageKey = record.rows[0]?.avatarStorageKey;
  await pool.query('DELETE FROM "User" WHERE "id" = $1', [userId]);
  if (typeof storageKey === "string") {
    const configured = process.env.SUBMISSION_STORAGE_DIR ?? "./storage/submissions";
    const root = isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
    const target = resolve(root, storageKey);
    if (target.startsWith(`${root}/`)) {
      await rm(target, { force: true });
    }
  }
  await pool.end();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
