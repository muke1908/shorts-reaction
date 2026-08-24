# Pipeline

## Source stage

Each keyword seed produces a search pass.

### Primary path

`src/pipeline/sources/youtube-api.ts` uses the YouTube Data API:

- `search` endpoint for candidate IDs
- `videos` endpoint for snippet, duration, and statistics

The pipeline currently keeps only candidates that:

- are between **10 and 180 seconds**
- have **comments enabled**
- are normalized to `https://www.youtube.com/shorts/<id>` URLs

### Fallback path

`src/pipeline/sources/youtube-playwright.ts` uses a real Playwright browser session and extracts:

- video IDs from rendered YouTube Shorts search results
- title
- channel
- publish date
- view count
- likes when available from the rendered action strip
- comments-enabled state from the rendered page

Because comment availability and engagement metadata still vary by page state, the browser fallback remains intentionally conservative.

## Workflow review stage

`src/pipeline/filters/llm-review.ts` is the main decision layer.

It:

1. loads the markdown workflow contract
2. prepares candidate evidence
3. asks Copilot CLI to decide:
   - keep or drop
   - relevant or irrelevant
   - spam or not spam
   - virality score
   - confidence
   - short rationale

The pipeline expects Copilot CLI to be available locally and uses it as the runtime review engine.

## Scoring stage

The deterministic score is now a supporting evidence layer rather than the only ranking signal.

It includes:

- recency-adjusted view velocity
- engagement from likes and comments relative to views
- conversation intensity
- reach compression
- freshness bonus for newly published Shorts
- penalties when metadata is missing

Each result stores a score breakdown and an `llmReview` object populated from Copilot review.

## Persistence stage

The writer creates:

- `data/dumps/latest.json`
- `data/dumps/by-day/YYYY-MM-DD.json`
- `data/dumps/iterations/<timestamp>.json`
- `data/reports/<timestamp>.md`

The JSON schema is shared between pipeline and UI through `src/shared/types.ts`.
