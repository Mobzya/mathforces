export type SolutionStructure = {
  charCount: number;
  completeness: number;
  formulaTokens: number;
  geometryDetected: boolean;
  hasConclusion: boolean;
  reasoningMarkers: number;
};

export type JudgeScore = {
  comment: string;
  score: number;
  structure: SolutionStructure;
};

export interface JudgeService {
  score(input: {
    maxScore: number;
    ocrConfidence: number;
    rubric: string;
    text: string;
  }): JudgeScore;
}
