# Operations

## Install

```bash
npm install
```

## Configure

```bash
cp .env.example .env
```

Recommended:

- set `YOUTUBE_API_KEY` for richer metadata
- make sure Copilot CLI is installed and logged in locally; optionally set `COPILOT_CLI_BINARY` or `COPILOT_MODEL`
- install `yt-dlp` and `ffmpeg` or point `YTDLP_BINARY` / `FFMPEG_BINARY` at the correct binaries
- if you want browser-based fallback scraping, keep `PLAYWRIGHT_BROWSER=chromium` unless you have a reason to switch

## Install browser fallback support

The scan falls back to a real Playwright browser when API metadata is unavailable.

```bash
npm install
npx playwright install chromium
```

## Run the pipeline

```bash
npm run scan -- --query "indian politics" --max-results 10
```

Optional date filter:

```bash
npm run scan -- --query "indian politics" --day 2026-08-21 --max-results 10
```

## Run the Copilot workflow

```bash
npm run copilot:scan -- --query "indian politics" --max-results 10
```

To also build the UI and serve it locally:

```bash
npm run copilot:scan -- --query "indian politics" --max-results 10 --serve-ui
```

## Scan from the UI

Once the UI is open, type a free-text topic and click **Scan**. Each scan:

- sends the topic to Copilot CLI so it can generate proper YouTube search terms
- sends the fetched candidates plus existing semantic category records back to Copilot CLI so it can rebuild the category list, including splitting or renaming categories when topics diverge
- refreshes the selected category view in the UI with the latest top-20 list
- updates `data/dumps/latest.json`
- updates `data/dumps/categories/index.json`
- updates `data/dumps/categories/<category>.json`
- writes a timestamped archive file to `data/dumps/iterations/`
- writes a timestamped markdown report to `data/reports/`
- overwrites older records in that category so only the latest 20 remain

## Serve the UI later

If you already built the frontend, you can serve it separately:

```bash
npm run build
npm run serve
```

## Process a ranked Short into a placeholder reaction layout

1. Run the scan and serve flow:

```bash
npm run copilot:scan -- --query "indian politics" --max-results 10 --serve-ui
```

2. In the target row’s **Process** section, choose an **Avatar reaction provider**:
   - **AI character** uses a static server-hosted reaction clip from `AI_CHARACTER_ASSET_DIR` (defaults to `data/static/ai-character`)
   - **User media provider** to record yourself with the camera and reuse that recording as the reaction layer
   - **HeyGen avatar** to render a lower-panel reaction using the locally authenticated HeyGen CLI/OAuth path when available, or API-key fallback otherwise
3. If you choose **User media provider**, click **Process**. The row opens an inline camera recorder.
4. Record your reaction and click **Stop recording**. The browser releases the camera stream immediately after stopping, and the captured clip is forwarded to the pipeline automatically.
5. The backend creates a job, downloads the source Short, writes a `reaction-instructions.json` brief into the job directory, asks the selected **Avatar Reaction Provider** for a reaction-layer video, builds a **9:16** canvas, starts the reaction layer immediately, keeps the source poster visible with a pause icon, begins source playback 4 seconds later, and exports the final output while preserving available audio. If both the source and provider clip contain audio, both tracks are mixed; if only one side has audio, that stream is kept.
6. The reaction clip is not repeated. When it stops, a pause icon appears over the bottom panel.
7. If `AI_CHARACTER_ASSET_DIR/end.mp4` exists, the composition starts it in the bottom panel 1 second before the source Short ends. Once the source ends, the top panel freezes on the source and shows the pause icon while the bottom pause overlay disappears and the outro clip keeps playing.
8. The UI polls until the generated video is ready and shows each background stage live:
   - queued
   - downloading source
   - preparing reaction brief
   - rendering reaction layer
   - compositing 9:16 layout
   - export ready / failed
9. Use the row-level **Delete** button to remove a Short from the local dump files and delete any generated job folders tied to that Short.
10. If a day-specific or iteration dump becomes empty after deletion, that dump file is removed from disk instead of being left behind as junk.

## Generated artifacts

| Path | Meaning |
| --- | --- |
| `data/dumps/latest.json` | The latest aggregate ranked result set |
| `data/dumps/categories/index.json` | The category dictionary used by the UI to navigate parent categories |
| `data/dumps/categories/<category>.json` | The latest 20 records for one parent category |
| `data/dumps/categories/direct-imports.json` | The latest 20 manually pasted YouTube URLs, kept separate from scan-driven discovery categories |
| `data/dumps/by-day/*.json` | Day-specific ranked slices |
| `data/dumps/iterations/*.json` | Timestamped per-scan archived result sets |
| `data/generated/jobs/<job-id>/reaction-instructions.json` | Provider-agnostic reaction brief used before provider rendering |
| `data/generated/jobs/<job-id>/provider-render.mp4` | Provider-specific raw render before final normalization or composition |
| `data/reports/*.md` | Timestamped markdown scan reports |
| `data/generated/jobs/<job-id>/manifest.json` | Durable processing status and output metadata |
| `data/generated/jobs/<job-id>/reaction.mp4` | Generated Avatar Reaction Provider layer used for the bottom panel |
| `data/generated/jobs/<job-id>/output.mp4` | Final stacked 9:16 two-layer reaction video |
| `ui-dist/` | Built frontend assets |
