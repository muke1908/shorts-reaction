interface FeatureLandingPageProps {
  onOpenQuickReaction: () => void;
  onOpenPipeline: () => void;
}

export function FeatureLandingPage({
  onOpenQuickReaction,
  onOpenPipeline
}: FeatureLandingPageProps): JSX.Element {
  return (
    <main className="layout">
      <section className="feature-landing panel">
        <div className="feature-landing__intro">
          <p className="eyebrow">Shorts reaction studio</p>
          <h1 className="feature-landing__title">Choose how you want to create.</h1>
          <p className="feature-landing__copy">
            Start with a hands-on reaction recorder or open the Copilot-driven pipeline that discovers, ranks, and processes YouTube Shorts into reusable reaction outputs.
          </p>
        </div>
        <div className="feature-landing__grid">
          <article className="feature-option-card">
            <div className="feature-option-card__badge">Feature 1</div>
            <h2 className="feature-option-card__title">Quick reaction creator</h2>
            <p className="feature-option-card__copy">
              Paste a YouTube Shorts URL, prep the source, then play, react, and record against the staged 9:16 canvas.
            </p>
            <button type="button" className="scan-button feature-option-card__action" onClick={onOpenQuickReaction}>
              Start quick reaction
            </button>
          </article>
          <article className="feature-option-card">
            <div className="feature-option-card__badge">Feature 2</div>
            <h2 className="feature-option-card__title">LLM pipeline</h2>
            <p className="feature-option-card__copy">
              Run Copilot-guided scans, rank likely viral Shorts, organize the library by topic and day, then generate reaction variants from the results.
            </p>
            <button type="button" className="secondary-button feature-option-card__action" onClick={onOpenPipeline}>
              Open pipeline dashboard
            </button>
          </article>
        </div>
      </section>
    </main>
  );
}
