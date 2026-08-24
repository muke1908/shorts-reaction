interface FeatureLandingPageProps {
  onOpenQuickReaction: () => void;
  onOpenPipeline: () => void;
}

function QuickReactionArtwork(): JSX.Element {
  return (
    <svg viewBox="0 0 320 220" role="presentation" focusable="false">
      <defs>
        <linearGradient id="quickReactionGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#14b8a6" />
        </linearGradient>
      </defs>
      <rect x="56" y="20" width="122" height="184" rx="22" fill="#020617" stroke="rgba(148,163,184,0.25)" />
      <rect x="68" y="34" width="98" height="82" rx="16" fill="#0f172a" />
      <path d="M97 74h18v-17l28 22-28 22V84H97z" fill="url(#quickReactionGlow)" />
      <rect x="68" y="122" width="98" height="70" rx="16" fill="#111827" />
      <circle cx="117" cy="154" r="20" fill="#1e293b" />
      <path d="M103 154c3-11 11-16 14-16s11 5 14 16" fill="none" stroke="#93c5fd" strokeWidth="6" strokeLinecap="round" />
      <circle cx="111" cy="151" r="3.2" fill="#93c5fd" />
      <circle cx="123" cy="151" r="3.2" fill="#93c5fd" />
      <path d="M108 165c3 4 8 6 13 6s10-2 13-6" fill="none" stroke="#93c5fd" strokeWidth="5" strokeLinecap="round" />
      <circle cx="205" cy="70" r="28" fill="rgba(239,68,68,0.16)" stroke="rgba(248,113,113,0.6)" />
      <circle cx="205" cy="70" r="10" fill="#ef4444" />
      <path d="M184 150h64" stroke="rgba(148,163,184,0.3)" strokeWidth="10" strokeLinecap="round" />
      <path d="M184 176h78" stroke="rgba(45,212,191,0.5)" strokeWidth="10" strokeLinecap="round" />
    </svg>
  );
}

function PipelineArtwork(): JSX.Element {
  return (
    <svg viewBox="0 0 320 220" role="presentation" focusable="false">
      <defs>
        <linearGradient id="pipelineGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect x="38" y="34" width="78" height="52" rx="16" fill="#0f172a" stroke="rgba(96,165,250,0.45)" />
      <rect x="38" y="132" width="78" height="52" rx="16" fill="#0f172a" stroke="rgba(45,212,191,0.45)" />
      <rect x="202" y="84" width="82" height="58" rx="18" fill="#0f172a" stroke="rgba(139,92,246,0.45)" />
      <circle cx="160" cy="108" r="38" fill="rgba(96,165,250,0.12)" stroke="url(#pipelineGlow)" strokeWidth="2.5" />
      <path d="M92 60h30c9 0 17 7 17 17v11" fill="none" stroke="rgba(96,165,250,0.8)" strokeWidth="6" strokeLinecap="round" />
      <path d="M92 158h30c9 0 17-7 17-17v-11" fill="none" stroke="rgba(45,212,191,0.8)" strokeWidth="6" strokeLinecap="round" />
      <path d="M182 108h20" fill="none" stroke="rgba(168,85,247,0.8)" strokeWidth="6" strokeLinecap="round" />
      <circle cx="160" cy="92" r="7" fill="#60a5fa" />
      <circle cx="142" cy="122" r="7" fill="#22d3ee" />
      <circle cx="178" cy="122" r="7" fill="#8b5cf6" />
      <path d="M223 103h40" stroke="rgba(148,163,184,0.4)" strokeWidth="8" strokeLinecap="round" />
      <path d="M223 123h28" stroke="rgba(96,165,250,0.6)" strokeWidth="8" strokeLinecap="round" />
    </svg>
  );
}

function SplitDecisionArtwork(): JSX.Element {
  return (
    <svg viewBox="0 0 320 160" role="presentation" focusable="false">
      <defs>
        <linearGradient id="decisionGlow" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="50%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <circle cx="48" cy="80" r="28" fill="#0f172a" stroke="rgba(148,163,184,0.25)" />
      <path d="M46 66h8v28h-8zm13 0h8v28h-8z" fill="#e2e8f0" />
      <path d="M76 80h72" stroke="url(#decisionGlow)" strokeWidth="8" strokeLinecap="round" />
      <path d="M148 80c28 0 36-26 70-26" fill="none" stroke="url(#decisionGlow)" strokeWidth="8" strokeLinecap="round" />
      <path d="M148 80c28 0 36 26 70 26" fill="none" stroke="url(#decisionGlow)" strokeWidth="8" strokeLinecap="round" />
      <rect x="224" y="38" width="58" height="34" rx="14" fill="#0f172a" stroke="rgba(45,212,191,0.55)" />
      <rect x="224" y="88" width="58" height="34" rx="14" fill="#0f172a" stroke="rgba(139,92,246,0.55)" />
      <circle cx="244" cy="55" r="8" fill="#22d3ee" />
      <circle cx="244" cy="105" r="8" fill="#8b5cf6" />
      <path d="M257 55h14" stroke="#93c5fd" strokeWidth="6" strokeLinecap="round" />
      <path d="M257 105h14" stroke="#c4b5fd" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

export function FeatureLandingPage({
  onOpenQuickReaction,
  onOpenPipeline
}: FeatureLandingPageProps): JSX.Element {
  return (
    <main className="layout">
      <section className="feature-landing panel">
        <div className="feature-landing__hero">
          <div className="feature-landing__intro">
            <p className="eyebrow">Shorts reaction studio</p>
            <h1 className="feature-landing__title">What do you want to create?</h1>
            <p className="feature-landing__copy">
              Choose the fast hands-on recorder if you already have a video in mind, or open the pipeline if you want discovery, ranking, and automation first.
            </p>
          </div>
          <div className="feature-landing__hero-visual" aria-hidden="true">
            <SplitDecisionArtwork />
          </div>
        </div>

        <div className="feature-landing__grid">
          <article className="feature-option-card feature-option-card--quick">
            <div className="feature-option-card__visual" aria-hidden="true">
              <QuickReactionArtwork />
            </div>
            <div className="feature-option-card__badge">Fast and hands-on</div>
            <h2 className="feature-option-card__title">Quick reaction</h2>
            <p className="feature-option-card__copy">
              Bring a YouTube Short, control the timing yourself, and record a staged reaction clip in minutes.
            </p>
            <div className="feature-option-card__fit">
              Best when you already have a source video and want speed, manual control, and immediate preview.
            </div>
            <ul className="feature-option-card__list">
              <li>Paste a Shorts, watch, or youtu.be URL</li>
              <li>Play, pause, and record exactly when you want</li>
              <li>Preview the staged output right after capture</li>
            </ul>
            <button type="button" className="scan-button feature-option-card__action" onClick={onOpenQuickReaction}>
              Record a quick reaction
            </button>
          </article>

          <article className="feature-option-card feature-option-card--pipeline">
            <div className="feature-option-card__visual" aria-hidden="true">
              <PipelineArtwork />
            </div>
            <div className="feature-option-card__badge">Research and automate</div>
            <h2 className="feature-option-card__title">Discovery pipeline</h2>
            <p className="feature-option-card__copy">
              Let Copilot discover candidate Shorts, rank likely virality, organize the library, and generate reaction outputs from the queue.
            </p>
            <div className="feature-option-card__fit">
              Best when you want research, topic coverage, reusable JSON dumps, and provider-driven processing at scale.
            </div>
            <ul className="feature-option-card__list">
              <li>Scan topics and regroup results by category and day</li>
              <li>Process ranked Shorts or paste direct URLs</li>
              <li>Track outputs, telemetry, and Copilot activity in one place</li>
            </ul>
            <button type="button" className="secondary-button feature-option-card__action" onClick={onOpenPipeline}>
              Open pipeline
            </button>
          </article>
        </div>
      </section>
    </main>
  );
}
