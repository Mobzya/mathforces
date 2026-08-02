import { existsSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile?.(".env");

export {};

const [{ runJudgeWorker }, { prisma }] = await Promise.all([
  import("@/workers/judge-worker"),
  import("@/server/db/client")
]);

const controller = new AbortController();
process.on("SIGINT", () => controller.abort());
process.on("SIGTERM", () => controller.abort());

const once = process.argv.includes("--once");
const result = await runJudgeWorker({
  once,
  signal: controller.signal
}).finally(() => prisma.$disconnect());

if (once) {
  console.log(
    result.processed ? `Processed submission: ${JSON.stringify(result)}` : "Queue is empty"
  );
}
