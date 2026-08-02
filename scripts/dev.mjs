import { spawn } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { resolve } from "node:path";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const lockPath = resolve(".next/dev/lock");
const lanMode = process.argv.includes("--lan");
const port = validPort(process.env.PORT) ?? 3000;

console.log("[Mathforces 1/3] Проверяем миграции PostgreSQL…");
await runStep(npm, ["run", "db:deploy"], 30_000).catch((error) => {
  console.error(`\nЗапуск остановлен: ${error.message}`);
  console.error("Проверьте состояние схемы: npm run db:status");
  console.error("Если база недоступна, запустите PostgreSQL: docker compose up -d postgres");
  process.exit(1);
});
console.log("[Mathforces 2/3] База готова.");

clearStaleNextLock();

console.log("[Mathforces 3/3] Запускаем web и фоновую проверку посылок…");
if (lanMode) printLanAddresses(port);
const web = spawn(npm, ["run", lanMode ? "dev:web:lan" : "dev:web"], {
  env: process.env,
  stdio: "inherit"
});
const worker = spawn(npm, ["run", "worker:judge"], {
  env: process.env,
  stdio: "inherit"
});
let stopping = false;

function stop(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  if (!web.killed) web.kill(signal);
  if (!worker.killed) worker.kill(signal);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stop(signal);
    windowlessExit(0);
  });
}

web.on("exit", (code, signal) => {
  if (stopping) return;
  console.error(`Web-процесс завершился (${signal ?? code ?? "unknown"}).`);
  stop();
  windowlessExit(code ?? 1);
});
worker.on("exit", (code, signal) => {
  if (stopping) return;
  console.error(`Worker завершился (${signal ?? code ?? "unknown"}).`);
  stop();
  windowlessExit(code ?? 1);
});

function windowlessExit(code) {
  process.exitCode = code;
  setTimeout(() => process.exit(code), 500).unref();
}

function clearStaleNextLock() {
  if (!existsSync(lockPath)) return;
  try {
    const lock = JSON.parse(readFileSync(lockPath, "utf8"));
    if (Number.isInteger(lock.pid)) {
      try {
        process.kill(lock.pid, 0);
        throw new Error(
          `Next.js уже запущен (PID ${lock.pid}, ${lock.appUrl ?? "port unknown"}). ` +
            "Остановите предыдущий npm run dev через Ctrl+C."
        );
      } catch (error) {
        if (error?.code !== "ESRCH") throw error;
      }
    }
    unlinkSync(lockPath);
    console.log("Удалён lock от завершившегося Next.js.");
  } catch (error) {
    if (error instanceof SyntaxError) {
      unlinkSync(lockPath);
      return;
    }
    throw error;
  }
}

function runStep(command, args, timeoutMs) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { env: process.env, stdio: "inherit" });
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`проверка базы не ответила за ${timeoutMs / 1000} секунд`));
    }, timeoutMs);
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timeout);
      if (code === 0) resolvePromise();
      else reject(new Error(`Prisma завершилась (${signal ?? code ?? "unknown"})`));
    });
  });
}

function printLanAddresses(publicPort) {
  const addresses = getLanAddresses();
  console.log("\nLAN-режим включён: web слушает все сетевые интерфейсы.");
  console.log(`На этом компьютере: http://localhost:${publicPort}`);
  if (addresses.length > 0) {
    for (const address of addresses) {
      console.log(`На телефоне или другом ПК: http://${address}:${publicPort}`);
    }
  } else {
    console.log(
      `Адрес сети не удалось определить автоматически. Узнайте IPv4 через ` +
        `«ip -4 addr» и откройте http://<IPv4>:${publicPort}.`
    );
  }
  console.log(
    "Устройства должны быть в одной локальной сети; наружу публикуется только web-порт.\n"
  );
}

function getLanAddresses() {
  try {
    return Object.entries(networkInterfaces())
      .filter(([name]) => !isVirtualInterface(name))
      .flatMap(([, entries]) => entries ?? [])
      .filter((entry) => entry.family === "IPv4" && !entry.internal && isPrivateIpv4(entry.address))
      .map((entry) => entry.address)
      .filter((address, index, addresses) => addresses.indexOf(address) === index);
  } catch {
    return [];
  }
}

function isVirtualInterface(name) {
  return /^(br-|docker|veth|virbr|vmnet|zt|tailscale)/i.test(name);
}

function isPrivateIpv4(address) {
  if (address.startsWith("10.") || address.startsWith("192.168.")) return true;
  const match = /^172\.(\d{1,2})\./.exec(address);
  return match ? Number(match[1]) >= 16 && Number(match[1]) <= 31 : false;
}

function validPort(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65_535 ? parsed : null;
}
