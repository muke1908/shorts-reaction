import { memo, useEffect, useMemo, useState } from "react";
import type {
  AvatarReactionProviderKind,
  GeneratedVideoSummary,
  ProcessShortRequest,
  ReactionJobRecord
} from "../../shared/types";
import { extractYoutubeVideoId } from "../../shared/youtube-url";
import {
  REACTION_PROVIDER_OPTIONS,
  providerRequiresUserMedia
} from "../../shared/reaction-providers";
import { OutputVideoCell } from "./OutputVideoCell";
import { InlineProcessingStageBar } from "../features/processing/InlineProcessingStageBar";
import { isActiveProcessingStatus, statusLabel } from "../features/processing/stages";

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

    return "Submit";
  }, [provider, running]);

  async function submit(request: ProcessShortRequest): Promise<void> {
    const trimmedSourceUrl = sourceUrl.trim();
    if (!trimmedSourceUrl) {
      setLocalError("Paste a YouTube URL before you submit.");
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
          <strong>Start with a YouTube link</strong>
          <div className="small-text">Paste the Short you want to react to, choose a pipeline, and jump straight into the right reaction flow.</div>
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
            disabled={running}
          />
        </label>
        <label className="process-provider">
          <span className="small-text">Pipeline</span>
          <select
            value={provider}
            disabled={running}
            onChange={(event) => {
              setProvider(event.target.value as AvatarReactionProviderKind);
              setLocalError(null);
            }}
          >
            {REACTION_PROVIDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <div className="process-actions">
          <button
            className="process-button"
            type="button"
            disabled={running}
            onClick={() => {
              if (providerRequiresUserMedia(provider)) {
                if (sourceUrl.trim() === "") {
                  setLocalError("Paste a YouTube URL before you submit.");
                  return;
                }
                if (!extractYoutubeVideoId(sourceUrl.trim())) {
                  setLocalError("Paste a valid YouTube URL before you submit.");
                  return;
                }

                onOpenAdvanced(provider, sourceUrl.trim());
                return;
              }

              submit({}).catch((reason: unknown) => {
                setLocalError(reason instanceof Error ? reason.message : String(reason));
              });
            }}
          >
            {buttonLabel}
          </button>
        </div>
      </div>
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
