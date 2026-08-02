import type { EvaluationConfidence } from "@/generated/prisma/client";
import type { SolutionStructure } from "@/services/judge";

export function reviewPreliminaryResult(input: {
  ocrConfidence: number;
  ocrSucceeded: boolean;
  structure: SolutionStructure;
}) {
  const confidenceValue = input.ocrSucceeded
    ? Math.max(0, Math.min(1, input.ocrConfidence * 0.72 + input.structure.completeness * 0.28))
    : 0;
  const confidence: EvaluationConfidence =
    confidenceValue >= 0.75 ? "HIGH" : confidenceValue >= 0.45 ? "MEDIUM" : "LOW";
  const needsReview =
    !input.ocrSucceeded ||
    confidence === "LOW" ||
    input.structure.geometryDetected ||
    input.structure.charCount < 80;

  return {
    confidence,
    confidenceValue,
    needsReview,
    reason: !input.ocrSucceeded
      ? "OCR недоступен"
      : input.structure.geometryDetected
        ? "Геометрия требует просмотра рисунка"
        : input.structure.charCount < 80
          ? "Распознано слишком мало текста"
          : confidence === "LOW"
            ? "Низкая уверенность распознавания"
            : "Структура решения распознана"
  };
}
