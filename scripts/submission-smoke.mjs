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
const contestId = randomUUID();
const problemId = randomUUID();
const token = randomBytes(32).toString("base64url");
const tokenHash = createHash("sha256").update(token).digest("hex");
const nickname = `submit_${userId.replaceAll("-", "").slice(0, 12)}`;
let storageKey = null;

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
    [
      userId,
      `submission-smoke-${userId}@mathforces.local`,
      nickname,
      nickname,
      "submission-smoke-not-a-password",
      organizationId
    ]
  );
  await pool.query(
    `INSERT INTO "AuthSession" (
      "id", "tokenHash", "userId", "expiresAt"
    ) VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes')`,
    [randomUUID(), tokenHash, userId]
  );
  await pool.query(
    `INSERT INTO "Contest" (
      "id", "title", "startAt", "endAt", "durationMinutes", "status",
      "isPublic", "updatedAt"
    ) VALUES (
      $1, 'Submission smoke contest', NOW() - INTERVAL '5 minutes',
      NOW() + INTERVAL '55 minutes', 60, 'RUNNING', true, NOW()
    )`,
    [contestId]
  );
  await pool.query(
    `INSERT INTO "Problem" (
      "id", "contestId", "title", "statement", "topic", "baseScore",
      "maxScore", "scoreDecayPer5Min", "orderIndex", "updatedAt"
    ) VALUES ($1, $2, 'Smoke problem', 'Test', 'ALGEBRA', 100, 100, 0, 1, NOW())`,
    [problemId, contestId]
  );
  await pool.query(
    `INSERT INTO "ContestRegistration" (
      "id", "contestId", "userId"
    ) VALUES ($1, $2, $3)`,
    [randomUUID(), contestId, userId]
  );

  const image = await readFile("public/icons/icon-192.png");
  const query = new URLSearchParams({
    contestId,
    isPublic: "true",
    problemId
  });
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}/api/submissions?${query}`, {
    body: image,
    headers: {
      "content-type": "image/png",
      cookie: `mathforces_session=${token}`,
      origin: baseUrl,
      "x-mathforces-file-name": "solution.png",
      "x-mathforces-upload": "raw-image"
    },
    method: "POST"
  });
  const latencyMs = Math.round(performance.now() - startedAt);
  assert(response.status === 201, `загрузка вернула HTTP ${response.status}`);
  assert(latencyMs < 5_000, `загрузка заняла ${latencyMs} мс`);
  const payload = await response.json();
  const submissionId = payload.submission?.id;
  assert(typeof submissionId === "string", "API не вернул id посылки");

  const records = await pool.query(
    `SELECT s."status", f."storageKey", j."status" AS "jobStatus"
     FROM "Submission" s
     INNER JOIN "SubmissionFile" f ON f."submissionId" = s."id"
     INNER JOIN "EvaluationJob" j ON j."submissionId" = s."id"
     WHERE s."id" = $1`,
    [submissionId]
  );
  const record = records.rows[0];
  storageKey = record?.storageKey ?? null;
  assert(record?.status === "QUEUED", "посылка не осталась в очереди");
  assert(record?.jobStatus === "QUEUED", "job не поставлен в очередь");

  const invalid = await fetch(`${baseUrl}/api/submissions?${query}`, {
    body: new TextEncoder().encode("not an image"),
    headers: {
      "content-type": "image/png",
      cookie: `mathforces_session=${token}`,
      origin: baseUrl,
      "x-mathforces-file-name": "fake.png",
      "x-mathforces-upload": "raw-image"
    },
    method: "POST"
  });
  assert(invalid.status === 422, "поддельное изображение не отклонено");
  console.log(`✓ Посылка принята за ${latencyMs} мс и передана только worker`);
} finally {
  if (!storageKey) {
    const stored = await pool.query(
      `SELECT f."storageKey"
       FROM "SubmissionFile" f
       INNER JOIN "Submission" s ON s."id" = f."submissionId"
       WHERE s."contestId" = $1
       LIMIT 1`,
      [contestId]
    );
    storageKey = stored.rows[0]?.storageKey ?? null;
  }
  await pool.query('DELETE FROM "Contest" WHERE "id" = $1', [contestId]);
  await pool.query('DELETE FROM "User" WHERE "id" = $1', [userId]);
  if (storageKey) {
    const configured = process.env.SUBMISSION_STORAGE_DIR ?? "./storage/submissions";
    const root = isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
    const target = resolve(root, storageKey);
    if (target.startsWith(`${root}/`)) await rm(target, { force: true });
  }
  await pool.end();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
