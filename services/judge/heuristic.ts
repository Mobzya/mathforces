import type { JudgeService, SolutionStructure } from "@/services/judge/types";

const reasoningPattern =
  /(?:так как|поскольку|следовательно|значит|докаж|получаем|отсюда|because|therefore|hence|proof)/gi;
const conclusionPattern = /(?:ответ|что и требовалось|ч\.?\s*т\.?\s*д|итого|answer|qed)/i;
const geometryPattern =
  /треуг|окруж|угол|высот|медиан|биссект|геометр|triangle|circle|angle|perpendicular/i;

export const heuristicJudge: JudgeService = {
  score({ maxScore, ocrConfidence, text }) {
    const structure = analyzeStructure(text);
    if (!text) {
      return {
        comment:
          "Текст решения не распознан. Посылка направлена на ручную проверку; фотография сохранена.",
        score: 0,
        structure
      };
    }

    const readable = clamp(ocrConfidence);
    const factor = Math.min(
      0.55,
      (0.08 + structure.completeness * 0.42) * (0.45 + readable * 0.55)
    );
    const score = Math.max(0, Math.min(maxScore, Math.round(maxScore * factor)));
    const observations = [
      `Распознано ${structure.charCount} символов`,
      structure.reasoningMarkers > 0
        ? "обнаружены шаги рассуждения"
        : "явные связки доказательства не найдены",
      structure.hasConclusion ? "найден итоговый вывод" : "итоговый ответ не распознан"
    ];
    if (structure.geometryDetected) {
      observations.push("обнаружена геометрическая терминология или схема");
    }

    return {
      comment:
        `Предварительная структурная оценка: ${score}/${maxScore}. ` +
        `${observations.join("; ")}. ` +
        "Корректность математики этой локальной моделью не подтверждается.",
      score,
      structure
    };
  }
};

function analyzeStructure(text: string): SolutionStructure {
  const reasoningMarkers = text.match(reasoningPattern)?.length ?? 0;
  const formulaTokens = text.match(/[=<>±√^]|\b(?:sin|cos|tg|log)\b/gi)?.length ?? 0;
  const hasConclusion = conclusionPattern.test(text);
  const charCoverage = Math.min(1, text.length / 350);
  const reasoningCoverage = Math.min(1, reasoningMarkers / 4);
  const formulaCoverage = Math.min(1, formulaTokens / 5);

  return {
    charCount: text.length,
    completeness: clamp(
      charCoverage * 0.5 +
        reasoningCoverage * 0.25 +
        formulaCoverage * 0.1 +
        (hasConclusion ? 0.15 : 0)
    ),
    formulaTokens,
    geometryDetected: geometryPattern.test(text),
    hasConclusion,
    reasoningMarkers
  };
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}
