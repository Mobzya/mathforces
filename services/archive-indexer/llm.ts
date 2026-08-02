import type { DifficultyObservation } from "@/server/archive/difficulty";

export type ArchiveDifficultyAdvice = {
  confidence: number;
  rating: number;
};

type DifficultySummary = {
  averageScore: number;
  fullSolveRate: number;
  ratingBands: Array<{
    averageScore: number;
    count: number;
    fullSolveRate: number;
    from: number;
    to: number;
  }>;
  sampleSize: number;
  scoreBuckets: Record<string, number>;
};

export function archiveDifficultyLlmConfigured() {
  return Boolean(
    process.env.MATHFORCES_LLM_ENDPOINT &&
    process.env.MATHFORCES_LLM_API_KEY &&
    process.env.MATHFORCES_LLM_MODEL
  );
}

export function summarizeDifficultyObservations(
  observations: DifficultyObservation[]
): DifficultySummary {
  const valid = observations.filter(
    (item) =>
      Number.isFinite(item.rating) &&
      Number.isFinite(item.score) &&
      item.rating >= 0 &&
      item.rating <= 3000 &&
      item.score >= 0 &&
      item.score <= 100
  );
  const bands = new Map<number, DifficultyObservation[]>();
  for (const observation of valid) {
    const start = Math.min(2750, Math.floor(observation.rating / 250) * 250);
    const band = bands.get(start) ?? [];
    band.push(observation);
    bands.set(start, band);
  }
  return {
    averageScore: roundedAverage(valid.map((item) => item.score)),
    fullSolveRate: roundedRate(valid.filter((item) => item.score >= 90).length, valid.length),
    ratingBands: [...bands.entries()]
      .sort(([left], [right]) => left - right)
      .map(([from, items]) => ({
        averageScore: roundedAverage(items.map((item) => item.score)),
        count: items.length,
        fullSolveRate: roundedRate(items.filter((item) => item.score >= 90).length, items.length),
        from,
        to: from === 2750 ? 3000 : from + 249
      })),
    sampleSize: valid.length,
    scoreBuckets: {
      "0-24": valid.filter((item) => item.score < 25).length,
      "25-49": valid.filter((item) => item.score >= 25 && item.score < 50).length,
      "50-69": valid.filter((item) => item.score >= 50 && item.score < 70).length,
      "70-89": valid.filter((item) => item.score >= 70 && item.score < 90).length,
      "90-100": valid.filter((item) => item.score >= 90).length
    }
  };
}

export async function adviseArchiveDifficultyWithLlm(input: {
  contestDurationMinutes: number;
  deterministicRating: number;
  maxScore: number;
  observations: DifficultyObservation[];
  orderIndex: number;
  subtopic: string;
  title: string;
}): Promise<ArchiveDifficultyAdvice | null> {
  if (!archiveDifficultyLlmConfigured() || input.observations.length < 3) {
    return null;
  }
  const summary = summarizeDifficultyObservations(input.observations);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(process.env.MATHFORCES_LLM_ENDPOINT!, {
      body: JSON.stringify({
        max_tokens: 500,
        messages: [
          {
            content:
              "Ты индексатор сложности олимпиадных математических задач. " +
              "Оцени минимальный рейтинг участника, при котором вероятность набрать не менее 90% равна примерно 70%. " +
              "Используй только агрегированную статистику, учитывай позицию задачи, длительность контеста и максимум баллов. " +
              "Не завышай рейтинг при малой выборке: детерминированная оценка дана как устойчивый prior. " +
              "Рейтинг обязан быть от 0 до 3000 и оканчиваться на 0. " +
              'Верни только JSON {"rating":integer,"confidence":number_0_to_1}.\n\n' +
              JSON.stringify({
                contestDurationMinutes: input.contestDurationMinutes,
                deterministicPrior: input.deterministicRating,
                maxScore: input.maxScore,
                orderIndex: input.orderIndex,
                statistics: summary,
                subtopic: input.subtopic,
                title: input.title
              }),
            role: "user"
          }
        ],
        model: process.env.MATHFORCES_LLM_MODEL,
        response_format: { type: "json_object" },
        temperature: 0
      }),
      headers: {
        Authorization: `Bearer ${process.env.MATHFORCES_LLM_API_KEY}`,
        "Content-Type": "application/json"
      },
      method: "POST",
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`ARCHIVE_INDEXER_HTTP_${response.status}`);
    }
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    const raw =
      typeof content === "string"
        ? content
        : (content?.map((part) => part.text ?? "").join("") ?? "");
    const parsed = JSON.parse(
      raw.replace(/^```json\s*|\s*```$/g, "")
    ) as Partial<ArchiveDifficultyAdvice>;
    const rating = Math.round(Number(parsed.rating) / 10) * 10;
    const confidence = Number(parsed.confidence);
    if (
      !Number.isFinite(rating) ||
      rating < 0 ||
      rating > 3000 ||
      !Number.isFinite(confidence) ||
      confidence < 0 ||
      confidence > 1
    ) {
      throw new Error("ARCHIVE_INDEXER_INVALID_RESPONSE");
    }
    return { confidence, rating };
  } finally {
    clearTimeout(timeout);
  }
}

function roundedAverage(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function roundedRate(count: number, total: number) {
  return total === 0 ? 0 : Math.round((count / total) * 1000) / 1000;
}
