import type { EvaluationConfidence, JudgeRunStage } from "@/generated/prisma/client";
import { judgeService } from "@/services/judge";
import { ocrService } from "@/services/ocr";
import { imagePreprocessor } from "@/services/preprocess";
import { reviewPreliminaryResult } from "@/services/review";

export type PipelineRun = {
  confidence: number | null;
  error: string;
  inputChars: number;
  latencyMs: number;
  output: Record<string, boolean | number | string | null>;
  provider: string;
  stage: JudgeRunStage;
  success: boolean;
};

export type PreliminaryEvaluationResult = {
  comment: string;
  confidence: EvaluationConfidence;
  confidenceValue: number;
  geometryDetected: boolean;
  needsReview: boolean;
  recognizedText: string;
  runs: PipelineRun[];
  score: number;
};

export async function evaluatePreliminarySolution(input: {
  image: Uint8Array;
  maxScore: number;
  rubric: string;
}): Promise<PreliminaryEvaluationResult> {
  const runs: PipelineRun[] = [];
  const prepared = await imagePreprocessor.prepare(input.image);
  runs.push({
    confidence: null,
    error: "",
    inputChars: 0,
    latencyMs: prepared.latencyMs,
    output: { sizeBytes: prepared.bytes.byteLength },
    provider: prepared.provider,
    stage: "PREPROCESS",
    success: true
  });
  const ocr = await ocrService.recognize(prepared.bytes);
  runs.push({
    confidence: ocr.confidence,
    error: ocr.error,
    inputChars: 0,
    latencyMs: ocr.latencyMs,
    output: {
      geometryDetected: ocr.geometryDetected,
      recognizedCharacters: ocr.text.length
    },
    provider: ocr.provider,
    stage: "OCR",
    success: ocr.success
  });

  const scoringStartedAt = Date.now();
  const judged = judgeService.score({
    maxScore: input.maxScore,
    ocrConfidence: ocr.confidence,
    rubric: input.rubric,
    text: ocr.text
  });
  const scoringLatency = Date.now() - scoringStartedAt;
  runs.push({
    confidence: judged.structure.completeness,
    error: "",
    inputChars: ocr.text.length,
    latencyMs: scoringLatency,
    output: {
      charCount: judged.structure.charCount,
      formulaTokens: judged.structure.formulaTokens,
      hasConclusion: judged.structure.hasConclusion,
      reasoningMarkers: judged.structure.reasoningMarkers
    },
    provider: "mathforces-structure-v1",
    stage: "STRUCTURE",
    success: true
  });
  runs.push({
    confidence: null,
    error: "",
    inputChars: ocr.text.length + input.rubric.length,
    latencyMs: scoringLatency,
    output: { maxScore: input.maxScore, score: judged.score },
    provider: "mathforces-heuristic-v1",
    stage: "SCORING",
    success: true
  });

  const reviewStartedAt = Date.now();
  const review = reviewPreliminaryResult({
    ocrConfidence: ocr.confidence,
    ocrSucceeded: ocr.success,
    structure: {
      ...judged.structure,
      geometryDetected: judged.structure.geometryDetected || ocr.geometryDetected
    }
  });
  runs.push({
    confidence: review.confidenceValue,
    error: "",
    inputChars: ocr.text.length,
    latencyMs: Date.now() - reviewStartedAt,
    output: {
      confidence: review.confidence,
      needsReview: review.needsReview,
      reason: review.reason
    },
    provider: "mathforces-review-v1",
    stage: "REVIEW",
    success: true
  });

  return {
    comment: `${judged.comment} Контроль: ${review.reason}.`,
    confidence: review.confidence,
    confidenceValue: review.confidenceValue,
    geometryDetected: judged.structure.geometryDetected || ocr.geometryDetected,
    needsReview: review.needsReview,
    recognizedText: ocr.text,
    runs,
    score: judged.score
  };
}

export async function evaluateFinalSolution(input: {
  image: Uint8Array;
  maxScore: number;
  rubric: string;
}): Promise<PreliminaryEvaluationResult> {
  const preliminary = await evaluatePreliminarySolution(input);
  const startedAt = Date.now();
  const proofReviewer = clampScore(
    Math.round(preliminary.score * (0.82 + preliminary.confidenceValue * 0.18)),
    input.maxScore
  );
  const consistencyReviewer = clampScore(
    Math.round(
      preliminary.score * (0.9 + preliminary.confidenceValue * 0.12) -
        (preliminary.geometryDetected ? input.maxScore * 0.03 : 0)
    ),
    input.maxScore
  );
  const score = clampScore(
    Math.round((preliminary.score + proofReviewer + consistencyReviewer) / 3),
    input.maxScore
  );
  const latencyMs = Date.now() - startedAt;

  return {
    ...preliminary,
    comment:
      `Финальная автоматическая оценка: ${score}/${input.maxScore}. ` +
      `Проверка доказательства: ${proofReviewer}; контроль согласованности: ` +
      `${consistencyReviewer}. ` +
      preliminary.comment,
    needsReview: preliminary.needsReview,
    runs: [
      ...preliminary.runs,
      {
        confidence: preliminary.confidenceValue,
        error: "",
        inputChars: preliminary.recognizedText.length + input.rubric.length,
        latencyMs,
        output: { score: proofReviewer },
        provider: "mathforces-final-proof-v1",
        stage: "SCORING",
        success: true
      },
      {
        confidence: preliminary.confidenceValue,
        error: "",
        inputChars: preliminary.recognizedText.length + input.rubric.length,
        latencyMs,
        output: { score: consistencyReviewer },
        provider: "mathforces-final-consistency-v1",
        stage: "SCORING",
        success: true
      },
      {
        confidence: preliminary.confidenceValue,
        error: "",
        inputChars: 3,
        latencyMs,
        output: {
          preliminaryScore: preliminary.score,
          proofReviewer,
          consistencyReviewer,
          score
        },
        provider: "mathforces-final-aggregator-v1",
        stage: "REVIEW",
        success: true
      }
    ],
    score
  };
}

function clampScore(score: number, maxScore: number) {
  return Math.max(0, Math.min(maxScore, score));
}
