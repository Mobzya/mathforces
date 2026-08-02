export type DifficultyObservation = {
  rating: number;
  score: number;
};

export function estimateArchiveDifficulty(input: {
  observations: DifficultyObservation[];
  orderIndex: number;
}) {
  const observations = input.observations.filter(
    (item) =>
      Number.isFinite(item.rating) &&
      Number.isFinite(item.score) &&
      item.rating >= 0 &&
      item.rating <= 3000
  );
  const positionPrior = clamp(600 + (input.orderIndex - 1) * 300, 0, 3000);
  if (observations.length < 3) {
    return {
      confidence: Math.min(0.2, observations.length / 15),
      rating: roundRating(positionPrior),
      sampleSize: observations.length
    };
  }

  let monotonicProbability = 0;
  let empiricalTarget = 3000;
  for (let candidate = 0; candidate <= 3000; candidate += 10) {
    let weight = 0;
    let success = 0;
    for (const observation of observations) {
      const distance = Math.abs(observation.rating - candidate);
      const localWeight = Math.exp(-(distance * distance) / (2 * 360 * 360));
      weight += localWeight;
      success += localWeight * (observation.score >= 90 ? 1 : 0);
    }
    const localProbability = weight > 0.05 ? success / weight : 0;
    monotonicProbability = Math.max(monotonicProbability, localProbability);
    if (monotonicProbability >= 0.7) {
      empiricalTarget = candidate;
      break;
    }
  }

  const distinctRatings = new Set(observations.map((item) => Math.round(item.rating / 100))).size;
  const confidence = clamp(
    (observations.length / (observations.length + 24)) * Math.min(1, distinctRatings / 6),
    0,
    0.92
  );
  const blended = positionPrior * (1 - confidence) + empiricalTarget * confidence;
  return {
    confidence,
    rating: roundRating(clamp(blended, 0, 3000)),
    sampleSize: observations.length
  };
}

function roundRating(value: number) {
  return Math.round(value / 10) * 10;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
