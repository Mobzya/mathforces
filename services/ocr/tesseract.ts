import { spawn } from "node:child_process";
import type { OcrService } from "@/services/ocr/types";

const geometryPattern =
  /треуг|окруж|угол|высот|медиан|биссект|геометр|triangle|circle|angle|perpendicular/i;

export const tesseractOcr: OcrService = {
  async recognize(image) {
    const startedAt = Date.now();
    const configured = process.env.TESSERACT_LANGUAGES ?? "rus+eng";

    try {
      const candidates = [...new Set([configured, "eng", "afr"])];
      let output = "";
      let selectedLanguage = "";
      let lastError: unknown;
      for (const language of candidates) {
        try {
          output = await runTesseract(image, language);
          selectedLanguage = language;
          break;
        } catch (error: unknown) {
          lastError = error;
        }
      }
      if (!selectedLanguage) {
        throw lastError ?? new Error("TESSERACT_FAILED");
      }
      const parsed = parseTsv(output);
      return {
        confidence: parsed.confidence,
        error: "",
        geometryDetected: geometryPattern.test(parsed.text),
        latencyMs: Date.now() - startedAt,
        provider: `tesseract-5:${selectedLanguage}`,
        success: true,
        text: parsed.text
      };
    } catch (error: unknown) {
      return {
        confidence: 0,
        error: error instanceof Error ? error.message.slice(0, 500) : "OCR недоступен",
        geometryDetected: false,
        latencyMs: Date.now() - startedAt,
        provider: "tesseract-5",
        success: false,
        text: ""
      };
    }
  }
};

function runTesseract(image: Uint8Array, languages: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.env.TESSERACT_BINARY ?? "tesseract",
      ["stdin", "stdout", "-l", languages, "tsv"],
      { stdio: ["pipe", "pipe", "pipe"] }
    );
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("OCR превысил лимит 30 секунд"));
    }, 30_000);

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.stdin.on("error", (error: NodeJS.ErrnoException) => {
      // Tesseract can exit immediately when a requested language pack is
      // absent. Its close event contains the useful stderr; EPIPE here is only
      // a consequence of that early exit and must not crash the web process.
      if (error.code !== "EPIPE") {
        clearTimeout(timeout);
        reject(error);
      }
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve(Buffer.concat(stdout).toString("utf8"));
      } else {
        reject(
          new Error(
            Buffer.concat(stderr).toString("utf8").trim() || `Tesseract завершился с кодом ${code}`
          )
        );
      }
    });
    child.stdin.end(Buffer.from(image));
  });
}

function parseTsv(tsv: string) {
  const words: string[] = [];
  const confidences: number[] = [];

  for (const line of tsv.split(/\r?\n/).slice(1)) {
    const columns = line.split("\t");
    const text = columns.slice(11).join("\t").trim();
    const confidence = Number(columns[10]);
    if (!text) continue;
    words.push(text);
    if (Number.isFinite(confidence) && confidence >= 0) {
      confidences.push(confidence / 100);
    }
  }

  return {
    confidence:
      confidences.length > 0
        ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
        : 0,
    text: words.join(" ").replace(/\s+/g, " ").trim()
  };
}
