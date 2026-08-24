# Architecture

## Overview

The system is organized as six layers:

1. **Source ingestion**
   - `src/pipeline/sources/youtube-api.ts`
   - `src/pipeline/sources/youtube-playwright.ts`
2. **Workflow contracts**
   - `workflow/*.md`
3. **Copilot orchestration and review**
   - `src/agents/master-agent.ts`
   - `src/agents/workflow-loader.ts`
   - `src/pipeline/filters/llm-review.ts`
   - `src/copilot/*`
4. **Heuristic evidence scoring**
   - `src/shared/scoring.ts`
5. **Persistence**
   - `src/pipeline/writers/write-dumps.ts`
   - `src/pipeline/writers/write-report.ts`
6. **Delivery**
   - `src/server/*`
   - `src/ui/*`
   - `src/agents/copilot-trigger.ts`

## Request flow

1. Copilot CLI triggers `npm run copilot:scan`.
2. The workflow loads environment and run options.
3. The master agent loads the markdown workflow files from `workflow/`.
4. Copilot CLI converts the user's free-text query into YouTube search terms.
5. The pipeline queries YouTube with those generated search terms.
6. API results are preferred; web fallback is used when API data is unavailable.
7. Candidate Shorts are normalized into a shared `SourceItem` shape.
8. Copilot CLI reviews candidates using the markdown workflow as its contract and decides keep/drop/rank.
9. Copilot CLI then re-evaluates the whole semantic library so existing categories can be reused, split, renamed, or recreated when a new scan reveals distinct subtopics.
10. Heuristic metrics remain available as supporting evidence.
11. JSON dumps and markdown reports are written locally, including a rebuilt category index and per-category latest-20 files.
12. When a Process job runs, the video pipeline downloads the Short, invokes the Avatar Reaction Provider to create a reaction-layer asset, composites both layers, and writes job artifacts locally.
13. If `--serve-ui` is passed, the workflow builds the frontend and starts the local server.

## Storage design

The pipeline is intentionally file-backed:

- `data/dumps/latest.json` is the aggregate view for the most recent run.
- `data/dumps/categories/index.json` is the LLM-maintained semantic category dictionary and may be rebuilt on each scan.
- `data/dumps/categories/<slug>.json` stores the latest 20 records for that category after the latest regrouping pass.
- `data/dumps/by-day/*.json` stores per-day slices for archival and inspection.
- `data/dumps/iterations/*.json` stores per-scan snapshots.
- `data/reports/*.md` stores human-readable scan reports.

This keeps the solution easy to inspect, diff, archive, and copy without adding a database dependency.

## Why hybrid ingestion

The API path provides stronger metadata coverage for views, likes, comments, and durations. The web fallback keeps the pipeline usable when an API key is missing, but its metadata is less complete and the evidence score penalizes missing fields accordingly.

## Why markdown-driven orchestration

The markdown workflow files are the primary reasoning contract. They let Copilot CLI generate search terms, decide what is relevant, regroup semantic categories, reject spam, and rank the surviving items, while the code handles scraping, persistence, and UI delivery.

## UI model

The UI is a React + Vite frontend that reads from the Node server:

- `/api/dump` returns the latest aggregate dump.
- `/api/categories` returns the current parent-category dictionary.
- `/api/scan` triggers a fresh query-driven top-20 scan.
- `/api/process/:shortId` starts a reaction-video job.
- `/api/process-url` starts the same reaction-video job from a pasted direct YouTube URL without requiring the Short to exist in the latest scan dump.

## Video processing model

The Process flow is now split into two render layers:

1. **Source layer**: the downloaded YouTube Short, scaled into the top 60% of a 9:16 frame.
2. **Avatar reaction layer**: a provider-owned video asset rendered for the bottom 40%.

The provider boundary in `src/processing/reactions/` is now an explicit adapter lifecycle so local and future remote vendors can share the same orchestration model without changing the compositor:

- `validateRequest(...)`
- `prepareAssets(...)`
- `submitRender(...)`
- `waitForRender(...)`
- `normalizeResult(...)`

The current provider set is:

- `UserMediaAvatarReactionProvider` for user-recorded camera clips captured in the browser and passed into the pipeline
- `ai-character` as a local static-media provider that resolves `start.*` from the server filesystem and normalizes it into the shared reaction contract
- `HeyGenAvatarProviderAdapter` for basic HeyGen avatar rendering with expression-marker script text, preferring CLI/OAuth auth and falling back to `/v3/videos` API calls

Before provider rendering starts, the runner writes a provider-agnostic `reaction-instructions.json` artifact into the job folder. That keeps reaction logic inspectable and decouples "how the reaction should behave" from "which provider renders it."
