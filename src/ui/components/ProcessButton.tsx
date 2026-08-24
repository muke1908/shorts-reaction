import { useState } from "react";
import type { AvatarReactionProviderKind, GeneratedVideoSummary, ProcessShortRequest, ShortRecord } from "../../shared/types";
import { InlineProcessingStageBar } from "../features/processing/InlineProcessingStageBar";
import { isActiveProcessingStatus, statusLabel } from "../features/processing/stages";
import { UserMediaRecorder, type RecordedUserMedia } from "./UserMediaRecorder";

interface ProcessButtonProps {
  record: ShortRecord;
  summary: GeneratedVideoSummary | null;
  onProcess: (record: ShortRecord, request: ProcessShortRequest) => Promise<void>;
}

export function ProcessButton({ record, summary, onProcess }: ProcessButtonProps): JSX.Element {
  const running = summary ? isActiveProcessingStatus(summary.status) : false;
  const [provider, setProvider] = useState<AvatarReactionProviderKind>("dummy");
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function startPipeline(request: ProcessShortRequest): Promise<void> {
    setLocalError(null);
    try {
      await onProcess(record, request);
    } catch (reason) {
      setLocalError(reason instanceof Error ? reason.message : String(reason));
      throw reason;
    }
  }

  return (
    <div className="process-cell">
      <label className="process-provider">
        <span className="small-text">Provider</span>
        <select value={provider} disabled={running} onChange={(event) => {
          setProvider(event.target.value as AvatarReactionProviderKind);
          setRecorderOpen(false);
          setLocalError(null);
        }}>
          <option value="dummy">Dummy</option>
          <option value="user-media">User media</option>
        </select>
      </label>
      <button className="process-button" disabled={running || recorderOpen} onClick={() => {
        if (provider === "user-media") {
          setRecorderOpen(true);
          return;
        }

        startPipeline({ reactionProvider: provider }).catch(() => undefined);
      }}>
        {running ? "Processing..." : "Process"}
      </button>
      <UserMediaRecorder
        open={recorderOpen}
        onCancel={() => {
          setRecorderOpen(false);
        }}
        onError={(message) => {
          setLocalError(message);
        }}
        onRecorded={(media: RecordedUserMedia) => {
          setRecorderOpen(false);
          startPipeline({
            reactionProvider: "user-media",
            userMedia: {
              mimeType: media.mimeType,
              base64: media.base64
            }
          }).catch(() => undefined);
        }}
      />
      {summary ? (
        <div className="process-details small-text">
          <div className="process-status">Status: {statusLabel(summary.status)}</div>
          <InlineProcessingStageBar summary={summary} />
          {summary.error ? <div className="process-meta processing-error">{summary.error}</div> : null}
        </div>
      ) : null}
      {localError ? <div className="process-meta processing-error small-text">{localError}</div> : null}
    </div>
  );
}
