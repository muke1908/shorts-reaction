import { memo, useState } from "react";
import type {
  AvatarReactionProviderKind,
  GeneratedVideoSummary,
  ProcessShortRequest,
  ShortRecord
} from "../../shared/types";
import {
  REACTION_PROVIDER_OPTIONS,
  providerRequiresUserMedia
} from "../../shared/reaction-providers";
import { InlineProcessingStageBar } from "../features/processing/InlineProcessingStageBar";
import { isActiveProcessingStatus, statusLabel } from "../features/processing/stages";

interface ProcessButtonProps {
  record: ShortRecord;
  summary: GeneratedVideoSummary | null;
  onProcess: (record: ShortRecord, request: ProcessShortRequest) => Promise<void>;
  onOpenAdvanced: (record: ShortRecord, provider: AvatarReactionProviderKind) => void;
}

export const ProcessButton = memo(function ProcessButton({ record, summary, onProcess, onOpenAdvanced }: ProcessButtonProps): JSX.Element {
  const running = summary ? isActiveProcessingStatus(summary.status) : false;
  const [provider, setProvider] = useState<AvatarReactionProviderKind>("template-1");
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
          setLocalError(null);
        }}>
          {REACTION_PROVIDER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
      <div className="process-actions">
        <button className="process-button" disabled={running} onClick={() => {
          if (providerRequiresUserMedia(provider)) {
            onOpenAdvanced(record, provider);
            return;
          }

          startPipeline({
            reactionProvider: provider
          }).catch(() => undefined);
        }}>
          {running ? "Processing..." : providerRequiresUserMedia(provider) ? "Open recorder" : "Process"}
        </button>
      </div>
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
