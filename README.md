# YouTube Shorts Topic Virality Pipeline

This project scans public YouTube Shorts metadata for a user-supplied topic, runs a markdown-guided Copilot CLI workflow to generate search terms, review candidates, dynamically regroup semantic categories across the stored library, and rank them, then writes JSON dumps plus markdown reports locally and exposes a category-driven UI.

## LLM-first workflow

This app is intentionally **Copilot/LLM-driven**, not just an API scraper with a thin prompt on top. The LLM is responsible for the key judgment calls in the pipeline:

1. **Query planning** — turns a loose user topic into practical YouTube search queries.
2. **Candidate review** — decides relevance, spam rejection, keep/drop, confidence, and virality framing.
3. **Semantic recategorization** — rebuilds the category library on the fly, including splitting, renaming, or recreating categories when new scans reveal distinct topics.
4. **Human-readable reporting** — writes the scan summary/report from the reviewed results.

The deterministic code handles data collection, normalization, eligibility filters, persistence, and media composition. The LLM handles the meaning-heavy parts: **intent expansion, topical judgment, grouping, and explanation**.

## What it does

1. Accepts a free-text scan query from the CLI or UI.
2. Uses Copilot CLI to turn that query into effective YouTube Shorts search terms.
3. Collects candidate Shorts with a **hybrid source strategy**:
   - primary: YouTube Data API
   - fallback: Playwright browser scraping of rendered YouTube Shorts pages
   - candidates are kept only when they are **10-180 seconds** and have **comments enabled**
4. Loads the markdown workflow contract from `workflow/*.md`.
5. Uses Copilot CLI as the primary reviewer for:
   - topic relevance
   - spam rejection
   - keep/drop decisions
   - virality ranking
   - rationale and confidence
6. Uses Copilot CLI again to **regroup the semantic category library**, reusing, splitting, renaming, or recreating topic categories when the stored videos show distinct contexts.
7. Computes a supporting **evidence score** with a transparent score breakdown that emphasizes:
   - reach
   - view velocity
   - engagement quality
   - conversation intensity
   - freshness
8. Writes:
   - `data/dumps/latest.json`
   - `data/dumps/categories/index.json`
   - `data/dumps/categories/<category>.json`
   - `data/dumps/by-day/YYYY-MM-DD.json`
   - `data/dumps/iterations/<timestamp>.json`
   - `data/reports/<timestamp>.md`
9. Serves a React UI that lets you type a scan query, click through parent categories, inspect the latest **20 records** per category, and trigger processing.
10. Lets you paste a direct YouTube URL and run the processing pipeline without waiting for that Short to appear in a scan result.
11. Lets you delete a ranked Short from the UI, which removes it from the stored dumps and deletes its generated job artifacts.
12. Lets you click **Process** on a ranked Short to start a video-layout job that:
   - downloads the selected Short
   - asks the selected **Avatar Reaction Provider** for a reaction-layer video
   - creates a **9:16** output canvas
   - places the original Short in the **top 60%**
   - places the provider video in the **bottom 40%**
   - keeps source audio when present, and carries provider audio through when the selected provider clip includes it
   - writes the generated output video under `data/generated/jobs/`

Current providers:

- **User media provider**: lets you record your own camera clip from the **Process** cell and sends it into the processing pipeline as the reaction layer
- **AI character**: uses a static server-hosted reaction clip normalized into the lower panel
- **HeyGen avatar**: prefers the locally authenticated HeyGen CLI/OAuth path, falls back to the raw API-key flow, sends a minimal expression-marker avatar script, and preserves provider audio when present

Each processing job now also writes a `reaction-instructions.json` artifact into its job folder so provider behavior stays inspectable and can be handed to remote vendors like HeyGen.

## Where Copilot is used

Copilot CLI is used multiple times in a single scan:

- **before search**: create better YouTube search terms from the user query
- **after collection**: review each candidate Short for relevance, spam, and virality
- **after ranking**: regroup the existing semantic library so category structure can evolve with the data
- **after persistence**: produce a markdown report for the scan iteration

This means categories are **not fixed**. A broad bucket like `politics` can later be re-split into more useful categories such as `political party`, `political abortion`, or other topic-specific clusters when the LLM sees enough evidence in the stored record set.

## Quickstart

```bash
npm install
cp .env.example .env
npm run copilot:scan -- --query "indian politics" --max-results 5
```

To scan and launch the UI:

```bash
npm run copilot:scan -- --query "indian politics" --max-results 5 --serve-ui
```

The local server runs on `http://localhost:3000` by default.

Inside the UI, you enter a free-text topic, press **Scan**, and Copilot generates the YouTube search terms, reviews the resulting videos, then rebuilds the semantic category list on the fly so distinct topics can split into clearer buckets before refreshing the UI.

Each row also includes a **Delete** button that removes that Short from the local dump files and deletes any generated job folders tied to that Short.
If a day-specific or iteration dump becomes empty after deletion, that JSON file is removed from disk as part of the cleanup.
The category index is updated at the same time so category navigation stays in sync.

The UI also includes a **Process from URL** panel so you can paste a YouTube Shorts, watch, or `youtu.be` link and send it directly into the same processing pipeline. Every imported URL is also tracked under a dedicated **Direct imports** category so manual ingestions do not get mixed into LLM-driven scan categories.

Processing now always uses the fixed delayed-source composition:
- the reaction layer starts first
- the original video poster stays visible with a pause icon overlay
- YouTube playback begins **4 seconds later**
- the reaction clip is **not repeated**
- when the reaction clip stops, a pause icon appears over the bottom panel
- if `data/static/ai-character/end.mp4` exists, it starts in the bottom panel **1 second before** the main video ends; once the main video ends, the top panel freezes with the pause overlay while the outro continues

## Environment variables

| Variable | Purpose |
| --- | --- |
| `YOUTUBE_API_KEY` | Recommended primary source for rich YouTube metadata |
| `COPILOT_CLI_BINARY` | Optional explicit path to the Copilot CLI binary |
| `COPILOT_MODEL` | Optional model override for scripted Copilot review runs |
| `PIPELINE_PORT` | Local server port |
| `PIPELINE_MAX_RESULTS_PER_QUERY` | Results per LLM-generated YouTube search term |
| `PIPELINE_REQUEST_TIMEOUT_MS` | HTTP timeout for source requests |
| `PLAYWRIGHT_BROWSER` | Browser engine for the Playwright fallback (`chromium`, `firefox`, `webkit`) |
| `AI_CHARACTER_ASSET_DIR` | Optional directory for server-hosted static AI character videos; defaults to `data/static/ai-character` |
| `HEYGEN_API_KEY` | Optional fallback for the **HeyGen avatar** provider when CLI/OAuth auth is not available; still uses API credits |
| `HEYGEN_API_URL` | Optional HeyGen API base URL override; defaults to `https://api.heygen.com` |
| `HEYGEN_CLI_BINARY` | Optional explicit path to the `heygen` CLI binary |
| `HEYGEN_AVATAR_ID` | Required HeyGen avatar/look ID for the **HeyGen avatar** provider |
| `HEYGEN_VOICE_ID` | Optional voice/default-avatar fallback for the basic HeyGen avatar render path |
| `HEYGEN_TEMPLATE_ID` | Not used by the current basic integration |
| `HEYGEN_REACTION_VIDEO_URL` | Not used by the current basic integration |
| `HEYGEN_OVERLAY_CHROMA_KEY_COLOR` | Not used by the current basic integration |
| `YTDLP_BINARY` | Downloader binary used for acquiring the source Short |
| `FFMPEG_BINARY` / `FFPROBE_BINARY` | Video tools used for analysis and compositing |

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run scan -- --query "topic"` | Runs the pipeline and writes JSON dumps plus a markdown report |
| `npm run copilot:scan -- --query "topic"` | Copilot-friendly entry workflow |
| `npm run copilot:scan -- --query "topic" --serve-ui` | Runs the pipeline, builds the UI, and starts the local server |
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
- `data/generated/jobs/<job-id>/reaction.mp4`
- `data/generated/jobs/<job-id>/output.mp4`
- `data/generated/jobs/<job-id>/manifest.json`
- `data/generated/jobs/<job-id>/poster.jpg`

Static AI character assets are resolved from:

- `data/static/ai-character/start.mp4`
- `data/static/ai-character/end.mp4` for the optional ending segment in the fixed composition
- or the first supported video file found in `data/static/ai-character/`

Supported extensions are `.mp4`, `.mov`, `.webm`, and `.mkv`.

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
  categories/   Parent-category index plus latest 20 records per category
data/reports/   Generated markdown scan reports
data/generated/ Generated reaction-video job assets
```

See `docs/` for the detailed architecture, pipeline, scoring, operations, Copilot CLI usage, and future HeyGen integration notes.
