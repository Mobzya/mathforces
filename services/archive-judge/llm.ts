type StrongJudgeResult = {
  confidence: number;
  feedback: string;
  recognizedText: string;
  score: number;
};

export function strongArchiveJudgeConfigured() {
  return Boolean(
    process.env.MATHFORCES_LLM_ENDPOINT &&
    process.env.MATHFORCES_LLM_API_KEY &&
    process.env.MATHFORCES_LLM_MODEL
  );
}

export async function judgeArchiveSolutionWithLlm(input: {
  image: Uint8Array;
  mimeType: string;
  officialSolution: string;
  rubric: string;
  statement: string;
  title: string;
}): Promise<StrongJudgeResult | null> {
  if (!strongArchiveJudgeConfigured()) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);
  try {
    const response = await fetch(process.env.MATHFORCES_LLM_ENDPOINT!, {
      body: JSON.stringify({
        max_tokens: 1800,
        messages: [
          {
            content: [
              {
                text:
                  "Ты — строгий проверяющий олимпиадных математических решений. " +
                  "Оцени полноту и корректность по шкале 0–100. В комментарии объясни только причины снятия баллов. " +
                  "Не давай подсказок, не продолжай решение, не подтверждай и не опровергай отдельные гипотезы участника. " +
                  'Верни только JSON: {"score":integer,"confidence":number_0_to_1,"feedback":string,"recognizedText":string}.\n\n' +
                  `Задача: ${input.title}\n${input.statement}\n\nКритерии:\n${input.rubric || "Проверь полноту доказательства."}\n\n` +
                  `Эталон для скрытого сравнения:\n${input.officialSolution || "Не задан."}`,
                type: "text"
              },
              {
                image_url: {
                  url: `data:${input.mimeType};base64,${Buffer.from(input.image).toString("base64")}`
                },
                type: "image_url"
              }
            ],
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
    if (!response.ok) throw new Error(`STRONG_JUDGE_HTTP_${response.status}`);
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
    ) as Partial<StrongJudgeResult>;
    const score = Math.round(Number(parsed.score));
    const confidence = Number(parsed.confidence);
    const feedback =
      typeof parsed.feedback === "string" ? parsed.feedback.trim().slice(0, 5000) : "";
    const recognizedText =
      typeof parsed.recognizedText === "string" ? parsed.recognizedText.slice(0, 30000) : "";
    if (
      !Number.isFinite(score) ||
      score < 0 ||
      score > 100 ||
      !Number.isFinite(confidence) ||
      confidence < 0 ||
      confidence > 1 ||
      feedback.length < 3
    ) {
      throw new Error("STRONG_JUDGE_INVALID_RESPONSE");
    }
    return { confidence, feedback, recognizedText, score };
  } finally {
    clearTimeout(timeout);
  }
}
