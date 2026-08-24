import { useMemo, useState } from "react";

import {
  getQuickReactionProviderOptions
} from "../../shared/reaction-providers";
import type { AvatarReactionProviderKind } from "../../shared/types";

interface QuickReactionStartPageProps {
  onBack: () => void;
  onOpenRecorder: (provider: AvatarReactionProviderKind, sourceUrl: string) => void;
}

const QUICK_REACTION_PROVIDER_OPTIONS = getQuickReactionProviderOptions();

export function QuickReactionStartPage({
  onBack,
  onOpenRecorder
}: QuickReactionStartPageProps): JSX.Element {
  const [sourceUrl, setSourceUrl] = useState("");
  const [provider, setProvider] = useState<AvatarReactionProviderKind>("user-media");
  const [error, setError] = useState<string | null>(null);

  const canStart = useMemo(() => sourceUrl.trim().length > 0, [sourceUrl]);

  return (
    <main className="layout">
      <section className="panel quick-reaction-start">
        <div className="quick-reaction-start__header">
          <div>
            <p className="eyebrow">Quick reaction creator</p>
            <h1 className="quick-reaction-start__title">Prepare a Short for live reaction capture.</h1>
            <p className="quick-reaction-start__copy">
              Paste a YouTube Shorts or watch URL, choose the reaction capture style, and open the staged recorder.
            </p>
          </div>
          <button type="button" className="secondary-button" onClick={onBack}>
            Back
          </button>
        </div>

        <div className="quick-reaction-start__grid">
          <div className="quick-reaction-start__card">
            <label className="direct-url-panel__field">
              <span>YouTube URL</span>
              <input
                className="direct-url-panel__input"
                type="url"
                placeholder="https://www.youtube.com/shorts/..."
                value={sourceUrl}
                onChange={(event) => {
                  setSourceUrl(event.target.value);
                  if (error) {
                    setError(null);
                  }
                }}
              />
            </label>

            <label className="direct-url-panel__field">
              <span>Reaction mode</span>
              <select
                className="quick-reaction-start__select"
                value={provider}
                onChange={(event) => {
                  setProvider(event.target.value as AvatarReactionProviderKind);
                }}
              >
                {QUICK_REACTION_PROVIDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <div className="quick-reaction-start__actions">
              <button
                type="button"
                className="scan-button"
                disabled={!canStart}
                onClick={() => {
                  const trimmedUrl = sourceUrl.trim();
                  if (!trimmedUrl) {
                    setError("Enter a YouTube Shorts URL to open the recorder.");
                    return;
                  }

                  onOpenRecorder(provider, trimmedUrl);
                }}
              >
                Open reaction recorder
              </button>
              {error ? <div className="error quick-reaction-start__error">{error}</div> : null}
            </div>
          </div>

          <div className="quick-reaction-start__card quick-reaction-start__card--info">
            <div className="quick-reaction-start__info-block">
              <strong>What happens next</strong>
              <p className="small-text">
                The app fetches the source video, opens the 9:16 stage recorder, and lets you control playback and recording manually.
              </p>
            </div>
            <div className="quick-reaction-start__info-block">
              <strong>Recorder flow</strong>
              <p className="small-text">
                Turn on the camera, start recording, play or pause the Short whenever you want, then preview the captured stage output in a new tab.
              </p>
            </div>
            <div className="quick-reaction-start__info-block">
              <strong>Supported modes</strong>
              <p className="small-text">
                Quick reaction uses the user-media capture providers so the live recorder stays focused on play, react, and record.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
