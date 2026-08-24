import type { GeneratedVideoSummary, ShortRecord } from "../../shared/types";
import { InlineProcessingStageBar } from "../features/processing/InlineProcessingStageBar";
import { isActiveProcessingStatus, statusLabel } from "../features/processing/stages";

interface ProcessButtonProps {
  record: ShortRecord;
  summary: GeneratedVideoSummary | null;
  onProcess: (record: ShortRecord) => void;
}

export function ProcessButton({ record, summary, onProcess }: ProcessButtonProps): JSX.Element {
  const running = summary ? isActiveProcessingStatus(summary.status) : false;

  return (
    <div className="process-cell">
      <button className="process-button" disabled={running} onClick={() => onProcess(record)}>
        {running ? "Processing..." : "Process"}
      </button>
      {summary ? (
        <div className="process-details small-text">
          <div className="process-status">Status: {statusLabel(summary.status)}</div>
          <InlineProcessingStageBar summary={summary} />
          {summary.error ? <div className="process-meta processing-error">{summary.error}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
