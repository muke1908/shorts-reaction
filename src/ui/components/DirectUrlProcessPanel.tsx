import { memo, useEffect, useMemo, useState } from "react";
import type {
  AvatarReactionProviderKind,
  GeneratedVideoSummary,
  ProcessShortRequest,
  ReactionJobRecord
} from "../../shared/types";
import {
  providerRequiresUserMedia,
  providerUserMediaAnonymizer
} from "../../shared/reaction-providers";
import { OutputVideoCell } from "./OutputVideoCell";
import { InlineProcessingStageBar } from "../features/processing/InlineProcessingStageBar";
import { isActiveProcessingStatus, statusLabel } from "../features/processing/stages";
import { UserMediaRecorder } from "./UserMediaRecorder";
import type { RecordedUserMedia } from "../lib/user-media-recording";

interface DirectUrlProcessPanelProps {
  onProcessUrl: (request: ProcessShortRequest) => Promise<ReactionJobRecord>;
  onOpenAdvanced: (provider: AvatarReactionProviderKind, sourceUrl: string) => void;
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

export const DirectUrlProcessPanel = memo(function DirectUrlProcessPanel({ onProcessUrl, onOpenAdvanced }: DirectUrlProcessPanelProps): JSX.Element {
  const [sourceUrl, setSourceUrl] = useState("");
  const [provider, setProvider] = useState<AvatarReactionProviderKind>("ai-character");
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [summary, setSummary] = useState<GeneratedVideoSummary | null>(null);
  const [trackedShortId, setTrackedShortId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const running = summary ? isActiveProcessingStatus(summary.status) : false;

  useEffect(() => {
    if (!trackedShortId || !summary || !isActiveProcessingStatus(summary.status)) {
      return;
    }

    const timer = window.setInterval(() => {
      fetchJson<GeneratedVideoSummary | null>(`/api/process/by-short/${trackedShortId}`)
        .then((payload) => {
          if (payload) {
            setSummary(payload);
          }
        })
        .catch((reason: unknown) => {
          setLocalError(reason instanceof Error ? reason.message : String(reason));
        });
    }, 1500);

    return () => window.clearInterval(timer);
  }, [trackedShortId, summary]);

  const buttonLabel = useMemo(() => {
    if (running) {
      return "Processing...";
    }

    return providerRequiresUserMedia(provider) ? "Record + process URL" : "Process URL";
  }, [provider, running]);

  async function submit(request: ProcessShortRequest): Promise<void> {
    const trimmedSourceUrl = sourceUrl.trim();
    if (!trimmedSourceUrl) {
      setLocalError("Paste a YouTube URL before starting the pipeline.");
      return;
    }

    setLocalError(null);
    const job = await onProcessUrl({
      ...request,
      sourceUrl: trimmedSourceUrl,
      reactionProvider: provider
    });
    setTrackedShortId(job.shortId);
    setSummary({
      latestJobId: job.id,
      status: job.status,
      outputUrl: null,
      posterUrl: null,
      updatedAt: job.updatedAt,
      error: job.error
    });
  }

  return (
    <section className="panel direct-url-panel">
      <div className="direct-url-panel__header">
        <div>
          <strong>Process from URL</strong>
          <div className="small-text">Paste a YouTube Shorts, watch, or youtu.be link and run the composition pipeline directly. Imported sources are also filed under the Direct imports category.</div>
        </div>
      </div>
      <div className="direct-url-panel__controls">
        <label className="direct-url-panel__field">
          <span className="small-text">YouTube URL</span>
          <input
            className="direct-url-panel__input"
            type="url"
            placeholder="https://www.youtube.com/shorts/..."
            value={sourceUrl}
            onChange={(event) => {
              setSourceUrl(event.target.value);
              setLocalError(null);
            }}
            disabled={running || recorderOpen}
          />
        </label>
        <label className="process-provider">
          <span className="small-text">Provider</span>
          <select
            value={provider}
            disabled={running || recorderOpen}
            onChange={(event) => {
              setProvider(event.target.value as AvatarReactionProviderKind);
              setRecorderOpen(false);
              setLocalError(null);
            }}
          >
            <option value="ai-character">AI character (static)</option>
            <option value="user-media">User media</option>
            <option value="user-media-sunglasses">User media + sunglasses</option>
            <option value="user-media-pixelated">User media + pixelated</option>
            <option value="heygen-avatar">HeyGen avatar</option>
          </select>
        </label>
        <div className="process-actions">
          <button
            className="process-button"
            type="button"
            disabled={running || recorderOpen}
            onClick={() => {
                if (providerRequiresUserMedia(provider)) {
                setRecorderOpen(true);
                return;
              }

              submit({}).catch((reason: unknown) => {
                setLocalError(reason instanceof Error ? reason.message : String(reason));
              });
            }}
          >
            {buttonLabel}
          </button>
          {providerRequiresUserMedia(provider) ? (
            <button
              className="secondary-button"
              type="button"
              disabled={running || recorderOpen || sourceUrl.trim() === ""}
              onClick={() => {
                onOpenAdvanced(provider, sourceUrl.trim());
              }}
            >
              Advanced
            </button>
          ) : null}
        </div>
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
          submit({
            userMedia: {
              mimeType: media.mimeType,
              base64: media.base64
            }
          }).catch((reason: unknown) => {
            setLocalError(reason instanceof Error ? reason.message : String(reason));
          });
        }}
      />
      {summary ? (
        <div className="direct-url-panel__result">
          <div className="process-status small-text">Status: {statusLabel(summary.status)}</div>
          <InlineProcessingStageBar summary={summary} />
          {summary.error ? <div className="process-meta processing-error small-text">{summary.error}</div> : null}
          <OutputVideoCell summary={summary} />
        </div>
      ) : null}
      {localError ? <div className="process-meta processing-error small-text">{localError}</div> : null}
    </section>
  );
});
