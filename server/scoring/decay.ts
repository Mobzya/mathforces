export type DecayingProblem = {
  baseScore: number;
  maxScore: number;
  scoreDecayPer5Min: number;
};

export function availableProblemScore(problem: DecayingProblem, contestStartAt: Date, at: Date) {
  const elapsedIntervals = Math.max(
    0,
    Math.floor((at.getTime() - contestStartAt.getTime()) / (5 * 60_000))
  );
  return Math.max(
    0,
    Math.min(problem.maxScore, problem.baseScore - elapsedIntervals * problem.scoreDecayPer5Min)
  );
}
