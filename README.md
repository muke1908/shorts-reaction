# YouTube Shorts Indian Politics Virality Pipeline

This project scans public YouTube Shorts metadata related to Indian politics, runs a markdown-guided Copilot CLI review workflow over the candidates, writes JSON dumps plus markdown reports locally, and exposes a UI for the latest top 10 results.

## What it does

1. Collects candidate Shorts with a **hybrid source strategy**:
   - primary: YouTube Data API
   - fallback: Playwright browser scraping of rendered YouTube Shorts pages
   - candidates are kept only when they are **10-180 seconds** and have **comments enabled**
2. Loads the markdown workflow contract from `workflow/*.md`.
3. Uses Copilot CLI as the primary reviewer for:
   - political relevance
   - spam rejection
   - keep/drop decisions
   - virality ranking
   - rationale and confidence
4. Computes a supporting **evidence score** with a transparent score breakdown that emphasizes:
   - reach
   - view velocity
   - engagement quality
   - conversation intensity
   - freshness
5. Writes:
   - `data/dumps/latest.json`
   - `data/dumps/by-day/YYYY-MM-DD.json`
   - `data/dumps/iterations/<timestamp>.json`
   - `data/reports/<timestamp>.md`
6. Serves a React UI that shows the latest **top 10** results and lets you trigger a fresh scan with one button.
7. Lets you click **Process** on a ranked Short to start a video-layout job that:
   - downloads the selected Short
   - creates a **9:16** output canvas
   - places the original Short in the **top 60%**
   - reserves the **bottom 40%** as a black reaction placeholder
   - writes the generated output video under `data/generated/jobs/`

## Quickstart

```bash
npm install
cp .env.example .env
npm run copilot:scan -- --max-results 5
```

To scan and launch the UI:

```bash
npm run copilot:scan -- --max-results 5 --serve-ui
```

The local server runs on `http://localhost:3000` by default.

Inside the UI, the **Scan** button runs the latest scan and refreshes the table with the current **top 10** results.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `YOUTUBE_API_KEY` | Recommended primary source for rich YouTube metadata |
| `COPILOT_CLI_BINARY` | Optional explicit path to the Copilot CLI binary |
| `COPILOT_MODEL` | Optional model override for scripted Copilot review runs |
| `PIPELINE_PORT` | Local server port |
| `PIPELINE_MAX_RESULTS_PER_QUERY` | Results per keyword seed |
| `PIPELINE_REQUEST_TIMEOUT_MS` | HTTP timeout for source requests |
| `PIPELINE_KEYWORD_SEEDS` | Comma-separated search seed list |
| `PLAYWRIGHT_BROWSER` | Browser engine for the Playwright fallback (`chromium`, `firefox`, `webkit`) |
| `HEYGEN_API_KEY` | Reserved for a future HeyGen integration phase |
| `HEYGEN_API_URL` | Reserved for a future HeyGen integration phase |
| `HEYGEN_REACTION_VIDEO_URL` | Reserved for a future HeyGen integration phase |
| `HEYGEN_OVERLAY_CHROMA_KEY_COLOR` | Reserved for a future HeyGen integration phase |
| `YTDLP_BINARY` | Downloader binary used for acquiring the source Short |
| `FFMPEG_BINARY` / `FFPROBE_BINARY` | Video tools used for analysis and compositing |

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run scan` | Runs the pipeline and writes JSON dumps plus a markdown report |
| `npm run copilot:scan` | Copilot-friendly entry workflow |
| `npm run copilot:scan -- --serve-ui` | Runs the pipeline, builds the UI, and starts the local server |
| `npm run build` | Type-checks and builds the React UI |
| `npm run serve` | Starts the local API/UI server |
| `npm run test` | Runs the lightweight test suite |

## Output contract

Each ranked record includes:

- title
- url
- channel
- publish date
- views
- likes
- comments
- score
- score breakdown
- capture timestamp
- `llmReview` reasoning, confidence, and evidence summary when available from Copilot review

Candidate URLs are normalized to the cleaner Shorts form:

- `https://www.youtube.com/shorts/<video-id>`

Generated reaction jobs are stored under:

- `data/generated/jobs/<job-id>/source.mp4`
- `data/generated/jobs/<job-id>/output.mp4`
- `data/generated/jobs/<job-id>/manifest.json`
- `data/generated/jobs/<job-id>/poster.jpg`

## Project layout

```text
src/
  agents/       Copilot CLI trigger workflow and master orchestration
  config/       Environment and keyword configuration
  copilot/      Prompt builders, schemas, and Copilot CLI client
  pipeline/     Sources, review, scoring, writers, orchestrator
  server/       API and UI server
  shared/       Types, schema, date helpers, scoring helpers
  ui/           React frontend
scripts/        CLI entrypoints
docs/           Detailed architecture and operating docs
workflow/       Markdown workflow contracts used by the master agent
data/dumps/     Generated JSON output
data/reports/   Generated markdown scan reports
data/generated/ Generated reaction-video job assets
```

See `docs/` for the detailed architecture, pipeline, scoring, operations, Copilot CLI usage, and future HeyGen integration notes.
