import { memo } from "react";
import type { AvatarReactionProviderKind, GeneratedVideoSummary, ProcessShortRequest, ShortRecord } from "../../shared/types";
import { formatDate, formatNumber } from "../lib/format";
import { OutputVideoCell } from "./OutputVideoCell";
import { ProcessButton } from "./ProcessButton";

interface ShortsTableProps {
  records: ShortRecord[];
  processingByShortId: Record<string, GeneratedVideoSummary | null>;
  onProcess: (record: ShortRecord, request: ProcessShortRequest) => Promise<void>;
  onDelete: (record: ShortRecord) => Promise<void>;
  onOpenAdvanced: (record: ShortRecord, provider: AvatarReactionProviderKind) => void;
}

export const ShortsTable = memo(function ShortsTable({
  records,
  processingByShortId,
  onProcess,
  onDelete,
  onOpenAdvanced
}: ShortsTableProps): JSX.Element {
  return (
    <section className="panel table-panel">
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th className="details-column">Details</th>
            <th>Breakdown</th>
            <th className="process-column">Process</th>
            <th className="output-column">Output</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record, index) => {
            const sentiment = record.llmReview?.sentiment ?? null;

            return (
            <tr key={record.id}>
              <td>{index + 1}</td>
              <td className="details-column small-text">
                <div className="details-title">
                  <a href={record.url} target="_blank" rel="noreferrer">
                    {record.title}
                  </a>
                </div>
                <div><strong>Channel:</strong> {record.channel}</div>
                <div><strong>Published:</strong> {formatDate(record.publishedAt)}</div>
                <div><strong>Views:</strong> {formatNumber(record.views)}</div>
                <div><strong>Likes:</strong> {formatNumber(record.likes)}</div>
                <div><strong>Comments:</strong> {formatNumber(record.comments)}</div>
                {sentiment ? (
                  <div>
                    <strong>Sentiment:</strong> {sentiment.label} ({sentiment.confidence.toFixed(2)})
                  </div>
                ) : null}
                <div className="details-actions">
                  <button
                    className="danger-button"
                    onClick={() => {
                      onDelete(record).catch(() => undefined);
                    }}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
                <div className="chip-row">
                  {sentiment ? (
                    <span className={`chip chip--sentiment chip--sentiment-${sentiment.label}`}>
                      {sentiment.label}
                    </span>
                  ) : null}
                  {record.matchedKeywords.map((keyword) => (
                    <span key={keyword} className="chip">
                      {keyword}
                    </span>
                  ))}
                </div>
              </td>
              <td className="small-text">
                <div>Score: {record.score}</div>
                <div>Reach: {record.scoreBreakdown.reach}</div>
                <div>Velocity: {record.scoreBreakdown.viewVelocity}</div>
                <div>Engagement: {record.scoreBreakdown.engagement}</div>
                <div>Conversation: {record.scoreBreakdown.conversation}</div>
                <div>Freshness: {record.scoreBreakdown.freshness}</div>
                <div>Penalty: {record.scoreBreakdown.sourceCompletenessPenalty}</div>
                {record.llmReview ? (
                  <>
                    <div>Copilot score: {record.llmReview.viralityScore}</div>
                    <div>Copilot confidence: {record.llmReview.confidence.toFixed(2)}</div>
                    <div>Copilot reason: {record.llmReview.reason}</div>
                    {sentiment ? <div>Sentiment reason: {sentiment.reason}</div> : null}
                  </>
                ) : null}
              </td>
              <td className="process-column">
                <ProcessButton
                  record={record}
                  summary={processingByShortId[record.id] ?? null}
                  onProcess={onProcess}
                  onOpenAdvanced={onOpenAdvanced}
                />
              </td>
              <td className="output-column">
                <OutputVideoCell summary={processingByShortId[record.id] ?? null} />
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
});
