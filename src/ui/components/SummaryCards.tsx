import type { ShortRecord } from "../../shared/types";
import { formatNumber } from "../lib/format";

interface SummaryCardsProps {
  records: ShortRecord[];
}

function averageViews(records: ShortRecord[]): number {
  const values = records.map((record) => record.views ?? 0);
  return values.length === 0 ? 0 : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function SummaryCards({ records }: SummaryCardsProps): JSX.Element {
  const topScore = records[0]?.score ?? 0;

  return (
    <section className="summary-grid">
      <article className="panel summary-card">
        <h3>Ranked Shorts</h3>
        <strong>{records.length}</strong>
      </article>
      <article className="panel summary-card">
        <h3>Top Score</h3>
        <strong>{topScore}</strong>
      </article>
      <article className="panel summary-card">
        <h3>Average Views</h3>
        <strong>{formatNumber(averageViews(records))}</strong>
      </article>
    </section>
  );
}
