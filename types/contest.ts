export type ContestStatusValue = "ANNOUNCED" | "RUNNING" | "FINISHED";
export type ProblemTopicValue =
  | "ARITHMETIC"
  | "ALGEBRA"
  | "COMBINATORICS"
  | "NUMBER_THEORY"
  | "GEOMETRY"
  | "PROBABILITY"
  | "CALCULUS"
  | "LOGIC"
  | "GRAPH_THEORY"
  | "SET_THEORY"
  | "STATISTICS"
  | "APPLIED_MATH";

export type ContestSummary = {
  description: string;
  durationMinutes: number;
  endAt: string;
  id: string;
  isPublic: boolean;
  organization: { id: string; name: string } | null;
  problemCount: number;
  registrationClosesAt: string | null;
  registrationCount: number;
  requiredProblemCount: number;
  startAt: string;
  status: ContestStatusValue;
  tags: string[];
  title: string;
};

export type ContestProblem = {
  baseScore: number;
  id: string;
  maxScore: number;
  orderIndex: number;
  scoreDecayPer5Min: number;
  statement: string;
  subtopic: string;
  title: string;
  topic: ProblemTopicValue;
};

export type ContestDetail = ContestSummary & {
  isRegistered: boolean;
  problems: ContestProblem[];
  rules: string;
  showOthersSubmissions: boolean;
  showPreliminaryScores: boolean;
  showStandingsDuringContest: boolean;
  showSubmissionComments: boolean;
};
