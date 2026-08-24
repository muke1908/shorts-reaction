import { memo, useState } from "react";
import type {
  AvatarReactionProviderKind,
  GeneratedVideoSummary,
  ProcessShortRequest,
  ShortRecord
} from "../../shared/types";
import {
  providerRequiresUserMedia,
  providerUserMediaAnonymizer
} from "../../shared/reaction-providers";
import { InlineProcessingStageBar } from "../features/processing/InlineProcessingStageBar";
import { isActiveProcessingStatus, statusLabel } from "../features/processing/stages";
import { UserMediaRecorder } from "./UserMediaRecorder";
import type { RecordedUserMedia } from "../lib/user-media-recording";

interface ProcessButtonProps {
  record: ShortRecord;
  summary: GeneratedVideoSummary | null;
  onProcess: (record: ShortRecord, request: ProcessShortRequest) => Promise<void>;
  onOpenAdvanced: (record: ShortRecord, provider: AvatarReactionProviderKind) => void;
}

export const ProcessButton = memo(function ProcessButton({ record, summary, onProcess, onOpenAdvanced }: ProcessButtonProps): JSX.Element {
  const running = summary ? isActiveProcessingStatus(summary.status) : false;
  const [provider, setProvider] = useState<AvatarReactionProviderKind>("ai-character");
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
          <option value="ai-character">AI character (static)</option>
          <option value="user-media">User media</option>
          <option value="user-media-sunglasses">User media + sunglasses</option>
          <option value="user-media-pixelated">User media + pixelated</option>
          <option value="heygen-avatar">HeyGen avatar</option>
        </select>
      </label>
      <div className="process-actions">
        <button className="process-button" disabled={running || recorderOpen} onClick={() => {
          if (providerRequiresUserMedia(provider)) {
            setRecorderOpen(true);
            return;
          }

          startPipeline({
            reactionProvider: provider
          }).catch(() => undefined);
        }}>
          {running ? "Processing..." : "Process"}
        </button>
        {providerRequiresUserMedia(provider) ? (
          <button
            className="secondary-button"
            type="button"
            disabled={running || recorderOpen}
            onClick={() => {
              onOpenAdvanced(record, provider);
            }}
          >
            Advanced
          </button>
        ) : null}
      </div>
      <UserMediaRecorder
        anonymizer={providerUserMediaAnonymizer(provider)}
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
            reactionProvider: provider,
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
});
