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

function extractYoutubeVideoId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const hostname = parsed.hostname.replace(/^www\./, "");
  if (hostname === "youtu.be") {
    const candidate = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
    return /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null;
  }

  if (hostname !== "youtube.com" && hostname !== "m.youtube.com") {
    return null;
  }

  if (parsed.pathname === "/watch") {
    const candidate = parsed.searchParams.get("v") ?? "";
    return /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null;
  }

  if (parsed.pathname.startsWith("/shorts/")) {
    const candidate = parsed.pathname.split("/").filter(Boolean)[1] ?? "";
    return /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null;
  }

  return null;
}

function toShortsUrl(videoId: string): string {
  return `https://www.youtube.com/shorts/${videoId}`;
}

function StageArtwork(): JSX.Element {
  return (
    <svg viewBox="0 0 360 240" role="presentation" focusable="false">
      <defs>
        <linearGradient id="stageGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#14b8a6" />
        </linearGradient>
      </defs>
      <rect x="82" y="16" width="150" height="208" rx="28" fill="#020617" stroke="rgba(148,163,184,0.28)" />
      <rect x="98" y="34" width="118" height="102" rx="18" fill="#0f172a" />
      <circle cx="158" cy="86" r="25" fill="rgba(34,211,238,0.12)" stroke="url(#stageGlow)" strokeWidth="2.5" />
      <path d="M148 72h10v28h-10zm15 0h10v28h-10z" fill="#e2e8f0" />
      <rect x="98" y="144" width="118" height="62" rx="18" fill="#111827" />
      <circle cx="156" cy="167" r="18" fill="#1e293b" />
      <path d="M144 167c2.5-8 8-12 12-12 4 0 9.5 4 12 12" fill="none" stroke="#93c5fd" strokeWidth="5" strokeLinecap="round" />
      <circle cx="149" cy="165" r="2.8" fill="#93c5fd" />
      <circle cx="163" cy="165" r="2.8" fill="#93c5fd" />
      <path d="M146 178c3.5 3 7 4.5 10 4.5 3 0 6.5-1.5 10-4.5" fill="none" stroke="#93c5fd" strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="250" cy="72" r="22" fill="rgba(239,68,68,0.16)" stroke="rgba(248,113,113,0.6)" />
      <circle cx="250" cy="72" r="8" fill="#ef4444" />
      <path d="M246 150h52" stroke="rgba(45,212,191,0.7)" strokeWidth="9" strokeLinecap="round" />
      <path d="M246 176h34" stroke="rgba(148,163,184,0.35)" strokeWidth="9" strokeLinecap="round" />
      <path d="M58 72h-24" stroke="rgba(96,165,250,0.5)" strokeWidth="7" strokeLinecap="round" />
      <path d="M58 94h-12" stroke="rgba(96,165,250,0.35)" strokeWidth="7" strokeLinecap="round" />
      <path d="M58 116h-18" stroke="rgba(96,165,250,0.22)" strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}

function WorkflowIcon({ kind }: { kind: "link" | "record" | "preview" }): JSX.Element {
  if (kind === "link") {
    return (
      <svg viewBox="0 0 32 32" role="presentation" focusable="false">
        <path d="M11 11h10a5 5 0 0 1 0 10h-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M21 21H11a5 5 0 0 1 0-10h3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === "record") {
    return (
      <svg viewBox="0 0 32 32" role="presentation" focusable="false">
        <circle cx="16" cy="16" r="7" fill="currentColor" />
        <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.35" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 32 32" role="presentation" focusable="false">
      <path d="M10 9h10a3 3 0 0 1 3 3v10H10a3 3 0 0 1-3-3V12a3 3 0 0 1 3-3Z" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <path d="m15 13 7 3-7 3z" fill="currentColor" />
    </svg>
  );
}

function ProviderArtwork({ provider }: { provider: AvatarReactionProviderKind }): JSX.Element {
  if (provider === "user-media-sunglasses") {
    return (
      <svg viewBox="0 0 52 52" role="presentation" focusable="false">
        <circle cx="26" cy="26" r="24" fill="#0f172a" />
        <path d="M14 24h8a4 4 0 0 1 4 4v1h-6a6 6 0 0 1-6-5zm24 0h-8a4 4 0 0 0-4 4v1h6a6 6 0 0 0 6-5z" fill="#22d3ee" />
        <path d="M22 26h8" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }

  if (provider === "user-media-pixelated") {
    return (
      <svg viewBox="0 0 52 52" role="presentation" focusable="false">
        <circle cx="26" cy="26" r="24" fill="#0f172a" />
        <rect x="15" y="15" width="8" height="8" rx="2" fill="#60a5fa" />
        <rect x="23" y="15" width="8" height="8" rx="2" fill="#38bdf8" />
        <rect x="31" y="15" width="8" height="8" rx="2" fill="#22d3ee" />
        <rect x="15" y="23" width="8" height="8" rx="2" fill="#38bdf8" />
        <rect x="23" y="23" width="8" height="8" rx="2" fill="#22d3ee" />
        <rect x="31" y="23" width="8" height="8" rx="2" fill="#14b8a6" />
        <rect x="19" y="31" width="14" height="6" rx="3" fill="#93c5fd" opacity="0.7" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 52 52" role="presentation" focusable="false">
      <circle cx="26" cy="26" r="24" fill="#0f172a" />
      <circle cx="26" cy="22" r="9" fill="#60a5fa" opacity="0.85" />
      <path d="M14 38c3-7 8-10 12-10s9 3 12 10" fill="none" stroke="#93c5fd" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function QuickReactionStartPage({
  onBack,
  onOpenRecorder
}: QuickReactionStartPageProps): JSX.Element {
  const [sourceUrl, setSourceUrl] = useState("");
  const [provider, setProvider] = useState<AvatarReactionProviderKind>("user-media");
  const [error, setError] = useState<string | null>(null);

  const normalizedSourceUrl = useMemo(() => {
    const trimmedSourceUrl = sourceUrl.trim();
    if (!trimmedSourceUrl) {
      return null;
    }

    const videoId = extractYoutubeVideoId(trimmedSourceUrl);
    return videoId ? toShortsUrl(videoId) : null;
  }, [sourceUrl]);

  const selectedProvider = useMemo(
    () => QUICK_REACTION_PROVIDER_OPTIONS.find((option) => option.value === provider) ?? QUICK_REACTION_PROVIDER_OPTIONS[0],
    [provider]
  );

  const canStart = normalizedSourceUrl !== null;
  const hasAttemptedInvalidUrl = sourceUrl.trim().length > 0 && normalizedSourceUrl === null;

  return (
    <main className="layout">
      <section className="panel quick-reaction-start">
        <div className="quick-reaction-start__header">
          <div className="quick-reaction-start__hero-copy">
            <p className="eyebrow">Quick reaction creator</p>
            <h1 className="quick-reaction-start__title">Set up your reaction take.</h1>
            <p className="quick-reaction-start__copy">
              Paste the YouTube link, choose the reaction style, and open the recorder. You stay in control of playback, recording, and timing.
            </p>
          </div>
          <button type="button" className="secondary-button" onClick={onBack}>
            Back
          </button>
        </div>

        <div className="quick-reaction-start__hero-visual" aria-hidden="true">
          <StageArtwork />
        </div>

        <div className="quick-reaction-start__grid">
          <div className="quick-reaction-start__card quick-reaction-start__card--form">
            <div className="quick-reaction-start__section-heading">Paste the video link</div>
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
            <div
              className={
                `quick-reaction-start__support${
                  normalizedSourceUrl
                    ? " quick-reaction-start__support--valid"
                    : hasAttemptedInvalidUrl
                      ? " quick-reaction-start__support--error"
                      : ""
                }`
              }
            >
              {normalizedSourceUrl
                ? `Ready to load: ${normalizedSourceUrl}`
                : hasAttemptedInvalidUrl
                  ? "Enter a valid YouTube URL before opening the staged recorder."
                  : "Supports YouTube Shorts, watch, and youtu.be links."}
            </div>

            <div className="quick-reaction-start__section-heading">Choose the reaction style</div>
            <label className="direct-url-panel__field">
              <span>Reaction mode</span>
              <select
                className="quick-reaction-start__select"
                value={provider}
                onChange={(event) => {
                  setProvider(event.target.value as AvatarReactionProviderKind);
                  if (error) {
                    setError(null);
                  }
                }}
              >
                {QUICK_REACTION_PROVIDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <div className="quick-reaction-start__mode-card">
              <div className="quick-reaction-start__mode-icon" aria-hidden="true">
                <ProviderArtwork provider={provider} />
              </div>
              <div className="quick-reaction-start__mode-copy">
                <strong>{selectedProvider.label}</strong>
                <p>{selectedProvider.description ?? "Use this mode for the staged quick-reaction workflow."}</p>
              </div>
            </div>

            <div className="quick-reaction-start__actions">
              <button
                type="button"
                className="scan-button"
                disabled={!canStart}
                onClick={() => {
                  if (!normalizedSourceUrl) {
                    setError("Enter a valid YouTube URL before opening the staged recorder.");
                    return;
                  }

                  onOpenRecorder(provider, normalizedSourceUrl);
                }}
              >
                Open recorder
              </button>
              {error ? <div role="alert" className="error quick-reaction-start__error">{error}</div> : null}
            </div>
          </div>

          <div className="quick-reaction-start__card quick-reaction-start__card--steps">
            <strong>How it works</strong>
            <ol className="quick-reaction-start__steps">
              <li>
                <span className="quick-reaction-start__step-icon" aria-hidden="true"><WorkflowIcon kind="link" /></span>
                <div>
                  <strong>Paste and prep</strong>
                  <p>The app normalizes the YouTube link and prepares a source video for the stage.</p>
                </div>
              </li>
              <li>
                <span className="quick-reaction-start__step-icon" aria-hidden="true"><WorkflowIcon kind="record" /></span>
                <div>
                  <strong>Record on your timing</strong>
                  <p>Turn on the camera, start recording, then play or pause the Short exactly when you want.</p>
                </div>
              </li>
              <li>
                <span className="quick-reaction-start__step-icon" aria-hidden="true"><WorkflowIcon kind="preview" /></span>
                <div>
                  <strong>Preview the result</strong>
                  <p>Save opens the recorded stage output in a new tab so you can review it immediately.</p>
                </div>
              </li>
            </ol>
          </div>

          <div className="quick-reaction-start__card quick-reaction-start__card--info">
            <strong>Before you record</strong>
            <div className="quick-reaction-start__info-block">
              <strong>Camera stays off by default</strong>
              <p className="small-text">You must enable it inside the recorder before recording can begin.</p>
            </div>
            <div className="quick-reaction-start__info-block">
              <strong>Source video stays under your control</strong>
              <p className="small-text">Playback does not auto-start, so your reaction timing stays intentional.</p>
            </div>
            <div className="quick-reaction-start__info-block">
              <strong>The stage is what gets captured</strong>
              <p className="small-text">The recording includes the composed top-and-bottom 9:16 layout, not just raw camera video.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
