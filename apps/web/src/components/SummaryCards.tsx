import { formatDistance, formatDuration } from "../lib/format";
import type { AthleteSummary } from "../types";

type SummaryCardsProps = {
  summary: AthleteSummary;
};

export function SummaryCards({ summary }: SummaryCardsProps) {
  const cards = [
    {
      label: "Runs",
      value: summary.totals.runs.toString(),
    },
    {
      label: "Distance",
      value: formatDistance(summary.totals.distanceKm),
    },
    {
      label: "Moving time",
      value: formatDuration(summary.totals.movingTimeSeconds),
    },
    {
      label: "Elevation",
      value: `${Math.round(summary.totals.elevationGainMeters)} m`,
    },
  ];

  return (
    <section className="summary-grid" aria-label="Summary metrics">
      {cards.map((card) => (
        <article key={card.label} className="summary-card">
          <span>{card.label}</span>
          <strong>{card.value}</strong>
        </article>
      ))}
    </section>
  );
}
