export type RankMeta = {
  color: string;
  title: string;
};

const ranks = [
  { color: "#94a3b8", maxExclusive: 1, title: "Без рейтинга" },
  { color: "#64748b", maxExclusive: 1300, title: "Новичок" },
  { color: "#16855b", maxExclusive: 1800, title: "Любитель" },
  { color: "#2563a8", maxExclusive: 2300, title: "Эксперт" },
  { color: "#7c3aed", maxExclusive: 2800, title: "Мастер" },
  { color: "#c63e46", maxExclusive: Number.POSITIVE_INFINITY, title: "Тру физматик" }
] as const;

export function getRankMeta(rating: number): RankMeta {
  const rank = ranks.find((item) => rating < item.maxExclusive);
  const resolved = rank ?? ranks[ranks.length - 1];
  return {
    color: resolved.color,
    title: resolved.title
  };
}
