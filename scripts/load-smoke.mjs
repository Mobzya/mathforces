const baseUrl = (process.env.SMOKE_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const concurrency = Number(process.env.LOAD_CONCURRENCY ?? 100);
const paths = (process.env.LOAD_PATHS ?? "/,/contests,/api/rating?page=1")
  .split(",")
  .map((path) => path.trim())
  .filter(Boolean);
if (paths.length === 0) throw new Error("LOAD_PATHS не содержит маршрутов");

const results = await Promise.all(
  Array.from({ length: concurrency }, async (_, index) => {
    const startedAt = performance.now();
    try {
      const response = await fetch(`${baseUrl}${paths[index % paths.length]}`, {
        headers: { "user-agent": "Mathforces load smoke" },
        signal: AbortSignal.timeout(10_000)
      });
      await response.arrayBuffer();
      return {
        latencyMs: performance.now() - startedAt,
        ok: response.ok,
        status: response.status
      };
    } catch {
      return {
        latencyMs: performance.now() - startedAt,
        ok: false,
        status: 0
      };
    }
  })
);

const failures = results.filter((result) => !result.ok);
const latencies = results.map((result) => result.latencyMs).sort((a, b) => a - b);
const percentile = (value) =>
  Math.round(latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * value))] ?? 0);

console.log(
  JSON.stringify(
    {
      concurrency,
      failed: failures.length,
      latencyMs: {
        max: Math.round(latencies.at(-1) ?? 0),
        p50: percentile(0.5),
        p95: percentile(0.95)
      }
    },
    null,
    2
  )
);

if (failures.length > 0) {
  console.error(
    `Load smoke failed: ${failures.length}/${results.length}; statuses: ${[
      ...new Set(failures.map((failure) => failure.status))
    ].join(", ")}`
  );
  process.exitCode = 1;
}
