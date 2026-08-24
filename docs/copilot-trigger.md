# Copilot CLI trigger workflow

## Purpose

The project exposes one Copilot-friendly trigger path through:

```bash
npm run copilot:scan
```

That command is the intended "master agent" entrypoint for this repository.

## Recommended CLI prompts

Use prompts like:

```text
Run npm run copilot:scan -- --max-results 10
```

or

```text
Run npm run copilot:scan -- --day 2026-08-21 --max-results 10 --serve-ui
```

## What the workflow does

1. Loads environment and CLI options.
2. Runs the hybrid Shorts pipeline.
3. Uses Copilot CLI in non-interactive prompt mode for candidate review and scan-report generation.
4. Writes JSON dumps to `data/dumps/` and markdown reports to `data/reports/`.
5. Prints output locations.
6. Optionally builds and serves the UI.

## Notes

- `--serve-ui` intentionally keeps the process alive while the local server is running.
- Without `YOUTUBE_API_KEY`, the workflow falls back to public web extraction with reduced metadata coverage.
- AI reasoning is handled by the local Copilot CLI runtime, not by an external HTTP LLM API.
