import { buildCategoryRegroupPrompt, buildSearchPlanPrompt, buildWorkflowSystemPrompt } from "../copilot/prompts";
import { requestJsonFromCopilot } from "../copilot/client";
import type { CopilotCategoryRegroupResponse, CopilotSearchPlanResponse } from "../copilot/schemas";
import { slugifyCategoryName } from "../server/category-store";
import type {
  ExistingCategoryRecord,
  PipelineConfig,
  RecategorizationResult,
  ScanSearchPlan,
  ShortRecord
} from "../shared/types";
import type { WorkflowBundle } from "../agents/workflow-loader";

const MAX_SEMANTIC_CATEGORIES = 10;

function normalizeSearchPlan(response: CopilotSearchPlanResponse): ScanSearchPlan {
  const searchQueries = Array.from(new Set(
    (response.searchQueries ?? [])
      .map((query) => query.trim())
      .filter(Boolean)
  )).slice(0, 6);

  if (searchQueries.length === 0) {
    throw new Error("Copilot did not return any usable YouTube search queries.");
  }

  return {
    intent: response.intent?.trim() || searchQueries[0],
    searchQueries
  };
}

export async function generateSearchPlan(
  userQuery: string,
  config: PipelineConfig,
  workflow: WorkflowBundle
): Promise<ScanSearchPlan> {
  const response = await requestJsonFromCopilot<CopilotSearchPlanResponse>(
    buildWorkflowSystemPrompt(workflow),
    buildSearchPlanPrompt(userQuery),
    config,
    "scan-search-plan"
  );
  return normalizeSearchPlan(response);
}

export async function recategorizeLibrary(
  scanQuery: string,
  existingRecords: ExistingCategoryRecord[],
  currentRecords: ShortRecord[],
  config: PipelineConfig,
  workflow: WorkflowBundle
): Promise<RecategorizationResult> {
  const response = await requestJsonFromCopilot<CopilotCategoryRegroupResponse>(
    buildWorkflowSystemPrompt(workflow),
    buildCategoryRegroupPrompt(scanQuery, existingRecords, currentRecords),
    config,
    "scan-category-regroup"
  );

  if (!Array.isArray(response.categories) || response.categories.length === 0) {
    throw new Error("Copilot did not return any categories for the current library regrouping.");
  }

  if (response.categories.length > MAX_SEMANTIC_CATEGORIES) {
    throw new Error(`Copilot returned ${response.categories.length} categories. The semantic category limit is ${MAX_SEMANTIC_CATEGORIES}.`);
  }

  const currentIds = new Set(currentRecords.map((record) => record.id));
  const combined = new Map<string, ShortRecord>();
  for (const entry of existingRecords) {
    combined.set(entry.record.id, entry.record);
  }
  for (const record of currentRecords) {
    combined.set(record.id, record);
  }

  const assignedIds = new Set<string>();
  const categories = response.categories.map((category) => {
    const parentCategoryName = category.parentCategoryName?.trim();
    const name = category.name?.trim();
    if (!parentCategoryName) {
      throw new Error("Copilot returned a category without a valid top-level parent category.");
    }
    if (!name) {
      throw new Error("Copilot returned a category without a valid name.");
    }

    const ids = Array.from(new Set((category.ids ?? []).map((value) => value.trim()).filter(Boolean)));
    if (ids.length === 0) {
      throw new Error(`Copilot returned an empty category for "${name}".`);
    }

    const records = ids.map((id) => {
      if (assignedIds.has(id)) {
        throw new Error(`Copilot assigned record ${id} to more than one category.`);
      }
      const record = combined.get(id);
      if (!record) {
        throw new Error(`Copilot assigned unknown record ${id}.`);
      }
      assignedIds.add(id);
      return record;
    });

    return {
      parentCategorySlug: slugifyCategoryName(parentCategoryName),
      parentCategoryName,
      slug: slugifyCategoryName(`${parentCategoryName}-${name}`),
      name,
      reason: category.reason?.trim() || "No categorization reason provided.",
      records,
      touchedByCurrentScan: records.some((record) => currentIds.has(record.id))
    };
  });

  for (const id of combined.keys()) {
    if (!assignedIds.has(id)) {
      throw new Error(`Copilot categorization omitted record ${id}.`);
    }
  }

  const touchedCategories = categories.filter((category) => category.touchedByCurrentScan);
  const touchedParentCategories = Array.from(new Map(
    touchedCategories.map((category) => [category.parentCategorySlug, {
      slug: category.parentCategorySlug,
      name: category.parentCategoryName
    }])
  ).values());
  if (touchedCategories.length === 1) {
    return {
      categories,
      primaryCategorySlug: touchedCategories[0]?.slug ?? null,
      primaryCategoryName: touchedCategories[0]?.name ?? null,
      primaryParentCategorySlug: touchedCategories[0]?.parentCategorySlug ?? null,
      primaryParentCategoryName: touchedCategories[0]?.parentCategoryName ?? null
    };
  }

  return {
    categories,
    primaryCategorySlug: null,
    primaryCategoryName: touchedCategories.length > 1 ? "Multiple topics" : null,
    primaryParentCategorySlug: touchedParentCategories.length === 1 ? touchedParentCategories[0]?.slug ?? null : null,
    primaryParentCategoryName: touchedParentCategories.length === 1 ? touchedParentCategories[0]?.name ?? null : null
  };
}
