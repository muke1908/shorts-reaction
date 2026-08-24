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
4. The pipeline queries YouTube with the configured seed list.
5. API results are preferred; web fallback is used when API data is unavailable.
6. Candidate Shorts are normalized into a shared `SourceItem` shape.
7. Copilot CLI reviews candidates using the markdown workflow as its contract and decides keep/drop/rank.
8. Heuristic metrics remain available as supporting evidence.
9. JSON dumps and markdown reports are written locally.
10. When a Process job runs, the video pipeline downloads the Short, invokes the Avatar Reaction Provider to create a reaction-layer asset, composites both layers, and writes job artifacts locally.
11. If `--serve-ui` is passed, the workflow builds the frontend and starts the local server.

## Storage design

The pipeline is intentionally file-backed:

- `data/dumps/latest.json` is the aggregate view for the most recent run.
- `data/dumps/by-day/*.json` stores per-day slices for archival and inspection.
- `data/dumps/iterations/*.json` stores per-scan snapshots.
- `data/reports/*.md` stores human-readable scan reports.

This keeps the solution easy to inspect, diff, archive, and copy without adding a database dependency.

## Why hybrid ingestion

The API path provides stronger metadata coverage for views, likes, comments, and durations. The web fallback keeps the pipeline usable when an API key is missing, but its metadata is less complete and the evidence score penalizes missing fields accordingly.

## Why markdown-driven orchestration

The markdown workflow files are the primary reasoning contract. They let Copilot CLI decide what is relevant, what is spam, and how to rank the surviving items, while the code handles scraping, persistence, and UI delivery.

## UI model

The UI is a React + Vite frontend that reads from the Node server:

- `/api/dump` returns the latest aggregate dump.
- `/api/scan` triggers a fresh top-10 scan.
- `/api/process/:shortId` starts a reaction-video job.

## Video processing model

The Process flow is now split into two render layers:

1. **Source layer**: the downloaded YouTube Short, scaled into the top 60% of a 9:16 frame.
2. **Avatar reaction layer**: a provider-owned video asset rendered for the bottom 40%.

Today the provider is a dummy implementation that creates a synthetic animated clip, but the boundary is explicit in `src/processing/reactions/` so it can be swapped for a future AI/avatar-backed generator without rewriting the compositor contract.

The current provider set is:

- `DummyAvatarReactionProvider` for generated synthetic reaction clips
- `UserMediaAvatarReactionProvider` for user-recorded camera clips captured in the browser and passed into the pipeline
