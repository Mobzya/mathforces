import { spawn } from "node:child_process";

const port = validPort(process.env.PORT) ?? 3000;
const origin = `http://127.0.0.1:${port}`;

console.log("Создаём временный HTTPS-туннель к Mathforces…");
console.log(`Локальный адрес: ${origin}`);
console.log("Публичный адрес появится ниже в строке с trycloudflare.com.");
console.log("Не публикуйте этот адрес и используйте только тестовые данные. Остановка: Ctrl+C.\n");

const tunnel = spawn(
  "docker",
  [
    "run",
    "--rm",
    "--network",
    "host",
    "--pull",
    "missing",
    "cloudflare/cloudflared:latest",
    "tunnel",
    "--no-autoupdate",
    "--url",
    origin
  ],
  { env: process.env, stdio: "inherit" }
);

let stopping = false;

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    tunnel.kill(signal);
  });
}

tunnel.once("error", (error) => {
  console.error(`Не удалось запустить Docker: ${error.message}`);
  console.error("Убедитесь, что Docker установлен и запущен.");
  process.exitCode = 1;
});

tunnel.once("exit", (code, signal) => {
  if (stopping && signal) return;
  process.exitCode = code ?? 1;
});

function validPort(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65_535 ? parsed : null;
}
