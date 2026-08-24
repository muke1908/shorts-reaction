import type { WorkflowBundle } from "../agents/workflow-loader";
import { reviewAndRankCandidates } from "./filters/llm-review";
import { searchWithYoutubeApi } from "./sources/youtube-api";
import { searchManyWithYoutubePlaywright } from "./sources/youtube-playwright";
import { writeDumps } from "./writers/write-dumps";
import type { PipelineConfig, PipelineResult, SourceItem } from "../shared/types";

function dedupe(items: SourceItem[]): SourceItem[] {
  const map = new Map<string, SourceItem>();
  for (const item of items) {
    const existing = map.get(item.id);
    if (!existing || existing.source === "youtube-web") {
      map.set(item.id, item);
    }
  }

  return [...map.values()];
}

export async function collectCandidateShorts(config: PipelineConfig): Promise<{ items: SourceItem[]; usedFallback: boolean }> {
  const items: SourceItem[] = [];
  let usedFallback = false;
  const fallbackSeeds: string[] = [];

  for (const keywordSeed of config.keywordSeeds) {
    const apiItems = await searchWithYoutubeApi(config, keywordSeed);
    if (apiItems.length > 0) {
      items.push(...apiItems);
      continue;
    }

    fallbackSeeds.push(keywordSeed);
  }

  if (fallbackSeeds.length > 0) {
    usedFallback = true;
    items.push(...(await searchManyWithYoutubePlaywright(config, fallbackSeeds)));
  }

  return {
    items: dedupe(items),
    usedFallback
  };
}

export async function runPipeline(config: PipelineConfig, workflowBundle?: WorkflowBundle): Promise<PipelineResult> {
  const startedAt = new Date().toISOString();
  const { items, usedFallback } = await collectCandidateShorts(config);
  const reviewed = await reviewAndRankCandidates(items, config, workflowBundle);
  const rankedRecords = reviewed.records.slice(0, 10);

  if (rankedRecords.length === 0) {
    throw new Error(
      "No Shorts matched the current scan. The Copilot-driven review rejected all candidates or the source scan returned weak evidence. Provide stronger seeds or richer metadata."
    );
  }

  return writeDumps(
    rankedRecords,
    {
      startedAt,
      completedAt: new Date().toISOString(),
      keywordSeeds: config.keywordSeeds,
      usedFallback,
      sourceStrategy: "hybrid",
      workflowFiles: reviewed.workflowFiles
    },
    config
  );
}
