import { getRankMeta } from "@/lib/rating/rank";

export type RatingChartPoint = {
  contestTitle: string;
  date: string;
  delta: number;
  rating: number;
};

const bands = [
  { color: "#94a3b8", from: 0, label: "Новичок", to: 1300 },
  { color: "#16855b", from: 1300, label: "Любитель", to: 1800 },
  { color: "#2563a8", from: 1800, label: "Эксперт", to: 2300 },
  { color: "#7c3aed", from: 2300, label: "Мастер", to: 2800 },
  { color: "#c63e46", from: 2800, label: "Тру физматик", to: 3000 }
] as const;

export function RatingChart({ points }: { points: RatingChartPoint[] }) {
  const width = Math.max(780, points.length * 105);
  const height = 330;
  const paddingLeft = 72;
  const paddingRight = 30;
  const paddingTop = 22;
  const paddingBottom = 38;
  const plotHeight = height - paddingTop - paddingBottom;
  const plotWidth = width - paddingLeft - paddingRight;
  const y = (rating: number) =>
    paddingTop + ((3000 - Math.max(0, Math.min(3000, rating))) / 3000) * plotHeight;
  const coordinates = points.map((point, index) => ({
    ...point,
    x:
      points.length <= 1
        ? paddingLeft + plotWidth / 2
        : paddingLeft + (index / (points.length - 1)) * plotWidth,
    y: y(point.rating)
  }));

  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
        <svg
          aria-label="График изменения рейтинга по рейтинговым диапазонам"
          className="block h-auto min-h-72"
          role="img"
          style={{ minWidth: `${Math.min(width, 780)}px`, width: `${width}px` }}
          viewBox={`0 0 ${width} ${height}`}
        >
          {bands.map((band) => (
            <g key={band.label}>
              <rect
                fill={band.color}
                fillOpacity="0.095"
                height={y(band.from) - y(band.to)}
                width={plotWidth}
                x={paddingLeft}
                y={y(band.to)}
              />
              <text
                fill={band.color}
                fontSize="10"
                fontWeight="700"
                textAnchor="end"
                x={paddingLeft - 10}
                y={y(band.to) + 13}
              >
                {band.label}
              </text>
              <line
                stroke={band.color}
                strokeOpacity="0.38"
                strokeWidth="1"
                x1={paddingLeft}
                x2={width - paddingRight}
                y1={y(band.to)}
                y2={y(band.to)}
              />
              <text
                fill="var(--muted)"
                fontSize="9"
                textAnchor="start"
                x={width - paddingRight + 5}
                y={y(band.to) + 3}
              >
                {band.to}
              </text>
            </g>
          ))}

          {[500, 1000, 1500, 2000, 2500].map((rating) => (
            <line
              key={rating}
              stroke="var(--line)"
              strokeDasharray="3 7"
              strokeWidth="1"
              x1={paddingLeft}
              x2={width - paddingRight}
              y1={y(rating)}
              y2={y(rating)}
            />
          ))}

          {coordinates.map((point) => (
            <line
              key={`guide-${point.date}-${point.contestTitle}`}
              stroke="var(--line)"
              strokeDasharray="2 6"
              x1={point.x}
              x2={point.x}
              y1={point.y}
              y2={height - paddingBottom}
            />
          ))}

          {coordinates.slice(1).map((point, index) => {
            const previous = coordinates[index]!;
            return (
              <line
                key={`segment-${point.date}-${point.contestTitle}`}
                stroke={getRankMeta(point.rating).color}
                strokeLinecap="round"
                strokeWidth="4"
                x1={previous.x}
                x2={point.x}
                y1={previous.y}
                y2={point.y}
              />
            );
          })}

          {coordinates.map((point) => {
            const color = getRankMeta(point.rating).color;
            return (
              <g key={`${point.date}-${point.contestTitle}`}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  fill={color}
                  r="7"
                  stroke="var(--surface)"
                  strokeWidth="4"
                >
                  <title>
                    {point.contestTitle}: {point.rating} ({formatDelta(point.delta)})
                  </title>
                </circle>
                <text
                  fill={color}
                  fontSize="11"
                  fontWeight="700"
                  textAnchor="middle"
                  x={point.x}
                  y={Math.max(14, point.y - 13)}
                >
                  {point.rating}
                </text>
                <text
                  fill="var(--muted)"
                  fontSize="9"
                  textAnchor="middle"
                  x={point.x}
                  y={height - 14}
                >
                  {formatShortDate(point.date)}
                </text>
              </g>
            );
          })}

          {points.length === 0 && (
            <g>
              <circle
                cx={paddingLeft + plotWidth / 2}
                cy={y(0)}
                fill="var(--surface)"
                r="16"
                stroke="var(--line-strong)"
              />
              <text
                fill="var(--muted)"
                fontFamily="Georgia, serif"
                fontSize="17"
                textAnchor="middle"
                x={paddingLeft + plotWidth / 2}
                y={y(0) + 6}
              >
                —
              </text>
            </g>
          )}
        </svg>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {bands.map((band) => (
          <span
            className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs"
            key={band.label}
          >
            <span className="size-2 rounded-full" style={{ backgroundColor: band.color }} />
            {band.label}
            <span className="text-[var(--muted)]">
              {band.from}–{band.to}
            </span>
          </span>
        ))}
      </div>
      {points.length === 0 && (
        <p className="mt-3 text-sm text-[var(--muted)]">
          Точки появятся после первого рейтингового контеста.
        </p>
      )}
    </div>
  );
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short"
  }).format(new Date(value));
}

function formatDelta(delta: number) {
  return delta > 0 ? `+${delta}` : String(delta);
}
