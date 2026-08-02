import { heuristicJudge } from "@/services/judge/heuristic";

export const judgeService = heuristicJudge;
export type { JudgeScore, JudgeService, SolutionStructure } from "@/services/judge/types";
