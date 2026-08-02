const baseUrl = (process.env.SMOKE_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS) || 30_000;

const checks = [
  {
    name: "Главная страница и защитные заголовки",
    path: "/",
    validate: async (response) => {
      assert(response.ok, `HTTP ${response.status}`);
      assert(
        response.headers.get("x-content-type-options") === "nosniff",
        "нет X-Content-Type-Options"
      );
      assert(response.headers.get("x-frame-options") === "DENY", "нет X-Frame-Options");
      const page = await response.text();
      assert(page.includes("Меню аккаунта"), "нет нативного меню аккаунта");
      assert(page.includes("Настройки интерфейса"), "нет нативного меню настроек");
      const scripts = [...page.matchAll(/<script[^>]+src="([^"]+)"/g)]
        .map((match) => match[1])
        .filter((path) => path.startsWith("/_next/static/"));
      assert(scripts.length > 0, "не найдены JavaScript chunks");
      const scriptResponses = await Promise.all(
        scripts.map((path) =>
          fetch(`${baseUrl}${path}`, { signal: AbortSignal.timeout(timeoutMs) })
        )
      );
      assert(
        scriptResponses.every((item) => item.ok),
        "один из JavaScript chunks недоступен"
      );
    }
  },
  {
    name: "Список контестов",
    path: "/contests",
    validate: async (response) => {
      assert(response.ok, `HTTP ${response.status}`);
    }
  },
  {
    name: "Публичная таблица рейтинга",
    path: "/rating",
    validate: async (response) => {
      assert(response.ok, `HTTP ${response.status}`);
      assert(
        (await response.text()).includes("Полная классификация"),
        "таблица рейтинга не отрисовалась"
      );
    }
  },
  {
    name: "API рейтинга",
    path: "/api/rating?page=1",
    validate: async (response) => {
      assert(response.ok, `HTTP ${response.status}`);
      const payload = await response.json();
      assert(Array.isArray(payload.leaderboard?.rows), "нет строк рейтинга");
      assert(
        payload.leaderboard.rows.every(
          (row, index, rows) => index === 0 || rows[index - 1].currentRating >= row.currentRating
        ),
        "строки отсортированы не по убыванию рейтинга"
      );
    }
  },
  {
    name: "Настройки интерфейса",
    path: "/settings",
    validate: async (response) => {
      assert(response.ok, `HTTP ${response.status}`);
      const page = await response.text();
      assert(page.includes("Важные настройки"), "страница настроек не отрисовалась");
      assert(page.includes("Тёмная"), "переключатель темы не найден");
    }
  },
  {
    name: "Офлайн-страница",
    path: "/offline",
    validate: async (response) => {
      assert(response.ok, `HTTP ${response.status}`);
      assert((await response.text()).includes("Вы не в сети"), "неверная страница");
    }
  },
  {
    name: "PWA manifest",
    path: "/manifest.webmanifest",
    validate: async (response) => {
      assert(response.ok, `HTTP ${response.status}`);
      const manifest = await response.json();
      assert(manifest.display === "standalone", "display должен быть standalone");
      assert(
        manifest.icons?.some((icon) => icon.sizes === "192x192" && icon.type === "image/png"),
        "нет PNG-иконки 192x192"
      );
      assert(
        manifest.icons?.some((icon) => icon.sizes === "512x512" && icon.purpose === "maskable"),
        "нет maskable-иконки 512x512"
      );
    }
  },
  {
    name: "Service worker",
    path: "/sw.js",
    validate: async (response) => {
      assert(response.ok, `HTTP ${response.status}`);
      assert(
        response.headers.get("service-worker-allowed") === "/",
        "не задан Service-Worker-Allowed"
      );
      assert((await response.text()).includes("shell-v12"), "неожиданная версия service worker");
    }
  },
  {
    name: "Готовность приложения",
    path: "/api/health",
    validate: async (response) => {
      const health = await response.json();
      assert(response.ok, `HTTP ${response.status}, status=${health.status}`);
      assert(health.status === "ok", `status=${health.status}`);
    }
  }
];

let failures = 0;

console.log(`Smoke-проверка ${baseUrl}`);
for (const check of checks) {
  try {
    const response = await fetch(`${baseUrl}${check.path}`, {
      headers: { "user-agent": "Mathforces smoke test" },
      signal: AbortSignal.timeout(timeoutMs)
    });
    await check.validate(response);
    console.log(`✓ ${check.name}`);
  } catch (error) {
    failures += 1;
    console.error(`✗ ${check.name}: ${errorMessage(error)}`);
  }
}

if (failures > 0) {
  console.error(`Smoke-проверка не пройдена: ${failures} ошибок.`);
  process.exitCode = 1;
} else {
  console.log("Smoke-проверка пройдена.");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
