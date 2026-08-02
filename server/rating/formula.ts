export const RATING_FORMULA_VERSION = "placement-v2";
export const MAX_RATING = 3_000;
export const MAX_RATING_DELTA = 500;

const EXPECTATION_SCALE = 400;
const SYSTEM_GROWTH_PER_PARTICIPANT = 1;
const NEWCOMER_BASE_BONUS = 100;
const NEWCOMER_RESULT_BONUS = 100;
const NEWCOMER_MIN_DELTA = 25;

export type RatingSeedInput = {
  ratingAtStart: number;
  registeredAt: Date;
  userId: string;
};

export type RatingSeed = RatingSeedInput & {
  expectedPlace: number;
  seedPlace: number;
};

export type RatingParticipantInput = {
  currentRating: number;
  lastSubmissionAt: Date;
  ratingAtStart: number;
  seedPlace: number;
  totalScore: number;
  userId: string;
};

export type RatingContestInput = {
  durationMinutes: number;
  maxScore: number;
};

export type RatingParticipantResult = RatingParticipantInput & {
  actualScore: number;
  contestWeight: number;
  delta: number;
  expectedPlace: number;
  expectedScore: number;
  newRating: number;
  performance: number;
  place: number;
  previousRating: number | null;
};

type RatingDraft = RatingParticipantResult & {
  maxDelta: number;
  minDelta: number;
  onboardingIssuance: number;
};

/**
 * Builds the immutable pre-contest order. Equal ratings are ordered by
 * registration time only to make the displayed seed deterministic; their
 * mathematical expected places remain equal.
 */
export function buildRatingSeeds(participants: RatingSeedInput[]): RatingSeed[] {
  const ordered = [...participants].sort((left, right) => {
    if (left.ratingAtStart !== right.ratingAtStart) {
      return right.ratingAtStart - left.ratingAtStart;
    }
    const registrationDifference = left.registeredAt.getTime() - right.registeredAt.getTime();
    return registrationDifference || left.userId.localeCompare(right.userId);
  });

  return ordered.map((participant, index) => ({
    ...participant,
    expectedPlace: calculateExpectedPlace(participant, ordered),
    seedPlace: index + 1
  }));
}

export function calculateRatingChanges(
  participants: RatingParticipantInput[],
  contest: RatingContestInput
): RatingParticipantResult[] {
  if (participants.length < 2) {
    return [];
  }

  const ordered = [...participants].sort(compareParticipants);
  const contestWeight = calculateContestWeight(contest, ordered.length);
  const comparisons = ordered.length - 1;

  const drafts: RatingDraft[] = ordered.map((participant, index) => {
    const place = index + 1;
    const expectedPlace = calculateExpectedPlace(participant, ordered);
    const actualScore = (ordered.length - place) / comparisons;
    const expectedScore = (ordered.length - expectedPlace) / comparisons;
    const performance = actualScore - expectedScore;
    const performanceDelta = Math.round(MAX_RATING_DELTA * contestWeight * performance);
    const newcomerBonus =
      participant.ratingAtStart === 0
        ? Math.round(contestWeight * (NEWCOMER_BASE_BONUS + NEWCOMER_RESULT_BONUS * actualScore))
        : 0;

    let desiredDelta = performanceDelta + newcomerBonus + SYSTEM_GROWTH_PER_PARTICIPANT;
    if (participant.ratingAtStart === 0) {
      desiredDelta = Math.max(NEWCOMER_MIN_DELTA, desiredDelta);
    }
    const maxDelta = Math.min(MAX_RATING_DELTA, MAX_RATING - participant.currentRating);
    const ordinaryMinDelta = Math.max(-MAX_RATING_DELTA, -participant.currentRating);
    const minDelta =
      participant.ratingAtStart === 0 && maxDelta > 0
        ? Math.min(NEWCOMER_MIN_DELTA, maxDelta)
        : ordinaryMinDelta;
    const delta = clamp(desiredDelta, minDelta, maxDelta);
    const onboardingIssuance =
      participant.ratingAtStart === 0
        ? Math.max(0, delta - performanceDelta - SYSTEM_GROWTH_PER_PARTICIPANT)
        : 0;

    return {
      ...participant,
      actualScore,
      contestWeight,
      delta,
      expectedPlace,
      expectedScore,
      maxDelta,
      minDelta,
      newRating: participant.currentRating + delta,
      onboardingIssuance,
      performance,
      place,
      previousRating: participant.currentRating > 0 ? participant.currentRating : null
    };
  });

  const targetNetDelta = clamp(
    ordered.length * SYSTEM_GROWTH_PER_PARTICIPANT +
      drafts.reduce((total, participant) => total + participant.onboardingIssuance, 0),
    drafts.reduce((total, participant) => total + participant.minDelta, 0),
    drafts.reduce((total, participant) => total + participant.maxDelta, 0)
  );
  rebalanceToTarget(drafts, targetNetDelta);

  return drafts.map((draft) => ({
    actualScore: draft.actualScore,
    contestWeight: draft.contestWeight,
    currentRating: draft.currentRating,
    delta: draft.delta,
    expectedPlace: draft.expectedPlace,
    expectedScore: draft.expectedScore,
    lastSubmissionAt: draft.lastSubmissionAt,
    newRating: draft.currentRating + draft.delta,
    performance: draft.performance,
    place: draft.place,
    previousRating: draft.previousRating,
    ratingAtStart: draft.ratingAtStart,
    seedPlace: draft.seedPlace,
    totalScore: draft.totalScore,
    userId: draft.userId
  }));
}

export function calculateContestWeight(contest: RatingContestInput, participantCount: number) {
  const durationFactor = clamp(Math.sqrt(Math.max(1, contest.durationMinutes) / 90), 0.65, 1);
  const scoreFactor = clamp(Math.sqrt(Math.max(1, contest.maxScore) / 500), 0.65, 1);
  const fieldFactor = clamp(0.65 + 0.08 * Math.log2(Math.max(2, participantCount)), 0.7, 1);

  return (durationFactor + scoreFactor + fieldFactor) / 3;
}

function calculateExpectedPlace(
  participant: Pick<RatingSeedInput, "ratingAtStart" | "userId">,
  field: Pick<RatingSeedInput, "ratingAtStart" | "userId">[]
) {
  let expectedOpponentsAhead = 0;
  for (const opponent of field) {
    if (opponent.userId === participant.userId) continue;
    expectedOpponentsAhead += expectedPairwiseScore(
      opponent.ratingAtStart,
      participant.ratingAtStart
    );
  }
  return 1 + expectedOpponentsAhead;
}

function expectedPairwiseScore(rating: number, opponentRating: number) {
  return 1 / (1 + 10 ** ((opponentRating - rating) / EXPECTATION_SCALE));
}

function compareParticipants(left: RatingParticipantInput, right: RatingParticipantInput) {
  if (left.totalScore !== right.totalScore) {
    return right.totalScore - left.totalScore;
  }
  const timeDifference = left.lastSubmissionAt.getTime() - right.lastSubmissionAt.getTime();
  return timeDifference || left.userId.localeCompare(right.userId);
}

function rebalanceToTarget(drafts: RatingDraft[], target: number) {
  let difference = target - drafts.reduce((total, participant) => total + participant.delta, 0);
  if (difference > 0) {
    difference -= distribute(
      drafts.filter((participant) => participant.delta < 0),
      difference,
      1,
      (participant) => -participant.delta
    );
    distribute(
      [...drafts].sort((left, right) => right.performance - left.performance),
      difference,
      1,
      (participant) => participant.maxDelta - participant.delta
    );
  } else if (difference < 0) {
    let excess = -difference;
    excess -= distribute(
      drafts.filter((participant) => participant.delta > 0),
      excess,
      -1,
      (participant) => participant.delta
    );
    distribute(
      [...drafts].sort((left, right) => left.performance - right.performance),
      excess,
      -1,
      (participant) => participant.delta - participant.minDelta
    );
  }
}

function distribute(
  participants: RatingDraft[],
  amount: number,
  direction: 1 | -1,
  available: (participant: RatingDraft) => number
) {
  if (amount <= 0 || participants.length === 0) return 0;
  const capacities = participants.map((participant) => Math.max(0, available(participant)));
  const totalCapacity = capacities.reduce((total, value) => total + value, 0);
  const target = Math.min(amount, totalCapacity);
  if (target === 0) return 0;

  let applied = 0;
  for (let index = 0; index < participants.length; index += 1) {
    const capacity = capacities[index] ?? 0;
    const share = Math.min(capacity, Math.floor((target * capacity) / totalCapacity));
    participants[index]!.delta += direction * share;
    capacities[index] = capacity - share;
    applied += share;
  }
  let remainder = target - applied;
  for (let index = 0; remainder > 0; index = (index + 1) % participants.length) {
    if ((capacities[index] ?? 0) <= 0) continue;
    participants[index]!.delta += direction;
    capacities[index] = (capacities[index] ?? 0) - 1;
    remainder -= 1;
    applied += 1;
  }
  return applied;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
