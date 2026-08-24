import { loadWorkflowBundle, type WorkflowBundle } from "../agents/workflow-loader";
import { reviewAndRankCandidates } from "./filters/llm-review";
import { generateSearchPlan, recategorizeLibrary } from "./scan-intelligence";
import { searchWithYoutubeApi } from "./sources/youtube-api";
import { searchManyWithYoutubePlaywright } from "./sources/youtube-playwright";
import { writeDumps } from "./writers/write-dumps";
import type { PipelineConfig, PipelineResult, SourceItem } from "../shared/types";
import { loadSemanticCategoryRecords } from "../server/category-store";

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

export async function collectCandidateShorts(
  config: PipelineConfig,
  keywordSeeds: string[]
): Promise<{ items: SourceItem[]; usedFallback: boolean }> {
  const items: SourceItem[] = [];
  let usedFallback = false;
  const fallbackSeeds: string[] = [];

  for (const keywordSeed of keywordSeeds) {
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

export async function runPipeline(
  config: PipelineConfig,
  scanQuery: string,
  workflowBundle?: WorkflowBundle
): Promise<PipelineResult> {
  const startedAt = new Date().toISOString();
  const resolvedWorkflow = workflowBundle ?? await loadWorkflowBundle(config);
  const searchPlan = await generateSearchPlan(scanQuery, config, resolvedWorkflow);
  const { items, usedFallback } = await collectCandidateShorts(config, searchPlan.searchQueries);
  const reviewed = await reviewAndRankCandidates(
    items,
    scanQuery,
    searchPlan.intent,
    searchPlan.searchQueries,
    config,
    resolvedWorkflow
  );
  const rankedRecords = reviewed.records.slice(0, 20);

  if (rankedRecords.length === 0) {
    throw new Error(
      "No Shorts matched the current scan. The Copilot-driven review rejected all candidates or the source scan returned weak evidence. Provide stronger seeds or richer metadata."
    );
  }

  const existingRecords = await loadSemanticCategoryRecords(config.outputDir);
  const recategorization = await recategorizeLibrary(
    scanQuery,
    existingRecords,
    rankedRecords,
    config,
    resolvedWorkflow
  );

  return writeDumps(
    rankedRecords,
    {
      startedAt,
      completedAt: new Date().toISOString(),
      keywordSeeds: searchPlan.searchQueries,
      scanQuery,
      parentCategorySlug: recategorization.primaryCategorySlug,
      parentCategoryName: recategorization.primaryCategoryName,
      usedFallback,
      sourceStrategy: "hybrid",
      workflowFiles: reviewed.workflowFiles
    },
    config,
    recategorization
  );
}
