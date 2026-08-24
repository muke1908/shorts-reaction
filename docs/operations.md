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
npm run scan -- --max-results 10
```

Optional date filter:

```bash
npm run scan -- --day 2026-08-21 --max-results 10
```

## Run the Copilot workflow

```bash
npm run copilot:scan -- --max-results 10
```

To also build the UI and serve it locally:

```bash
npm run copilot:scan -- --max-results 10 --serve-ui
```

## Scan from the UI

Once the UI is open, click **Scan** to run the pipeline again. Each scan:

- refreshes the latest top-10 list in the UI
- updates `data/dumps/latest.json`
- writes a timestamped archive file to `data/dumps/iterations/`
- writes a timestamped markdown report to `data/reports/`

## Serve the UI later

If you already built the frontend, you can serve it separately:

```bash
npm run build
npm run serve
```

## Process a ranked Short into a placeholder reaction layout

1. Run the scan and serve flow:

```bash
npm run copilot:scan -- --max-results 10 --serve-ui
```

2. Open the UI and click **Process** on a row.
3. The backend creates a job, downloads the source Short, builds a **9:16** canvas, places the source video in the **top 60%**, fills the **bottom 40%** with a black placeholder panel, and exports the final output while preserving source audio.
4. The UI polls until the generated video is ready and shows each background stage live:
   - queued
   - downloading source
   - compositing 9:16 layout
   - export ready / failed

## Generated artifacts

| Path | Meaning |
| --- | --- |
| `data/dumps/latest.json` | The latest aggregate ranked result set |
| `data/dumps/by-day/*.json` | Day-specific ranked slices |
| `data/dumps/iterations/*.json` | Timestamped per-scan archived result sets |
| `data/reports/*.md` | Timestamped markdown scan reports |
| `data/generated/jobs/<job-id>/manifest.json` | Durable processing status and output metadata |
| `data/generated/jobs/<job-id>/output.mp4` | Final stacked 9:16 placeholder-layout video |
| `ui-dist/` | Built frontend assets |
