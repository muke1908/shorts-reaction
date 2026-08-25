import type { WorkflowBundle } from "../agents/workflow-loader";
import type { ExistingCategoryRecord, ShortRecord, SourceItem } from "../shared/types";

function summarizeCandidate(item: SourceItem, heuristicScore: number, matchedKeywords: string[]): string {
  return [
    `id: ${item.id}`,
    `title: ${item.title}`,
    `channel: ${item.channel}`,
    `url: ${item.url}`,
    `publishedAt: ${item.publishedAt}`,
    `views: ${item.views ?? "unknown"}`,
    `likes: ${item.likes ?? "unknown"}`,
    `comments: ${item.comments ?? "unknown"}`,
    `commentsEnabled: ${item.commentsEnabled}`,
    `durationSeconds: ${item.durationSeconds ?? "unknown"}`,
    `keywordSeed: ${item.keywordSeed}`,
    `matchedKeywords: ${matchedKeywords.join(", ") || "none"}`,
    `heuristicEvidenceScore: ${heuristicScore}`
  ].join("\n");
}

export function buildWorkflowSystemPrompt(workflow: WorkflowBundle): string {
  return [
    "You are GitHub Copilot CLI acting as the review engine for a YouTube Shorts topic-virality workflow.",
    "Follow the markdown workflow contract exactly.",
    "Return strict JSON only when JSON is requested.",
    "",
    "# master-workflow.md",
    workflow.masterWorkflow,
    "",
    "# source-discovery.md",
    workflow.sourceDiscovery,
    "",
    "# political-relevance.md",
    workflow.politicalRelevance,
    "",
    "# spam-rejection.md",
    workflow.spamRejection,
    "",
    "# virality-ranking.md",
    workflow.viralityRanking,
    "",
    "# output-schema.md",
    workflow.outputSchema
  ].join("\n");
}

export function buildSearchPlanPrompt(userQuery: string): string {
  return [
    "Transform the user's free-text scan intent into a compact set of effective YouTube Shorts search queries.",
    "Focus on search terms that are likely to work directly in YouTube search.",
    "Return 3 to 6 searchQueries.",
    "Keep each query short and specific.",
    "Prefer phrases a human would realistically search on YouTube.",
    "Do not include explanations outside JSON.",
    "",
    `User query: ${userQuery}`,
    "",
    "Return JSON with shape {\"intent\":\"...\",\"searchQueries\":[\"...\"]}."
  ].join("\n");
}

export function buildCandidateReviewPrompt(
  scanQuery: string,
  parentCategoryName: string,
  candidates: Array<{ item: SourceItem; matchedKeywords: string[]; heuristicScore: number }>
): string {
  return [
    "Review the following candidate Shorts and decide which ones to keep.",
    `The user asked to scan for: ${scanQuery}`,
    `Treat "${parentCategoryName}" as the parent category for relevance decisions.`,
    "For each candidate return:",
    "- id",
    "- keep (boolean)",
    "- relevant (boolean)",
    "- spam (boolean)",
    "- viralityScore (0-100 number)",
    "- confidence (0-1 number)",
    "- reason (short string)",
    "- evidenceSummary (short string)",
    "- sentiment { label: positive|negative|neutral|mixed, confidence: 0-1, reason: short string }",
    "",
    "Use the markdown workflow and ranking rubric above as the source of truth.",
    "Sentiment should describe the emotional or rhetorical tone of the short itself, not whether you personally agree with it.",
    "",
    candidates
      .map((candidate, index) => `## Candidate ${index + 1}\n${summarizeCandidate(candidate.item, candidate.heuristicScore, candidate.matchedKeywords)}`)
      .join("\n\n"),
    "",
    "Return JSON with shape {\"reviews\":[...]}."
  ].join("\n");
}

export function buildCategoryDecisionPrompt(
  scanQuery: string,
  candidates: SourceItem[],
  existingCategories: string[]
): string {
  return [
    "Choose the best parent category for this scan result set.",
    "If an existing category is a clear semantic match, reuse it exactly.",
    "Otherwise create a short high-level parent category name.",
    "Parent categories should be broad buckets like Politics, Sports, Technology, Finance, Entertainment, etc.",
    "Do not return child or overly specific names unless the user intent truly demands it.",
    "",
    `User query: ${scanQuery}`,
    `Existing parent categories: ${existingCategories.length > 0 ? existingCategories.join(", ") : "none"}`,
    "",
    "Candidate sample:",
    ...candidates.slice(0, 12).map((item, index) => `${index + 1}. ${item.title} | ${item.channel} | ${item.url}`),
    "",
    "Return JSON with shape {\"parentCategoryName\":\"...\",\"reason\":\"...\"}."
  ].join("\n");
}

function summarizeLibraryRecord(
  record: ShortRecord,
  options: {
    currentCategoryName?: string | null;
    parentCategoryName?: string | null;
    fromCurrentScan: boolean;
  }
): string {
  const descriptionSnippet = record.description.replace(/\s+/g, " ").trim().slice(0, 160) || "none";
  return [
    `id: ${record.id}`,
    `fromCurrentScan: ${options.fromCurrentScan}`,
    `topLevelCategory: ${options.parentCategoryName ?? "none"}`,
    `currentCategory: ${options.currentCategoryName ?? "none"}`,
    `title: ${record.title}`,
    `channel: ${record.channel}`,
    `descriptionSnippet: ${descriptionSnippet}`,
    `keywordSeed: ${record.keywordSeed}`,
    `publishedAt: ${record.publishedAt}`,
    `views: ${record.views ?? "unknown"}`,
    `score: ${record.score}`,
    `sentiment: ${record.llmReview?.sentiment ? `${record.llmReview.sentiment.label} (${record.llmReview.sentiment.confidence.toFixed(2)})` : "unknown"}`
  ].join("\n");
}

export function buildCategoryRegroupPrompt(
  scanQuery: string,
  existingRecords: ExistingCategoryRecord[],
  currentRecords: ShortRecord[]
): string {
  const currentIds = new Set(currentRecords.map((record) => record.id));
  const allRecords = [
    ...currentRecords.map((record) => ({
      record,
      currentCategoryName: null,
      parentCategoryName: null,
      fromCurrentScan: true
    })),
    ...existingRecords
      .filter(({ record }) => !currentIds.has(record.id))
      .map(({ record, categoryName, parentCategoryName }) => ({
        record,
        currentCategoryName: categoryName,
        parentCategoryName,
        fromCurrentScan: false
      }))
  ];

  return [
    "Rebuild the semantic category list for this YouTube Shorts library.",
    "Build a two-level category hierarchy for this YouTube Shorts library.",
    "Each result category must have:",
    "- a broad top-level parent bucket",
    "- a more specific child topic category nested under that bucket",
    "You may reuse, rename, split, merge, or delete existing semantic child categories.",
    "Do not preserve a broad umbrella category if it mixes clearly distinct subtopics.",
    "If two groups are about different political subtopics, separate them into different categories.",
    "For example, party/election videos and abortion-policy videos should not be forced into the same category just because both are political.",
    "Category names should be short, human-readable, and specific enough to distinguish real topical clusters.",
    "Top-level parent buckets should stay broad, such as Politics, Sports, Entertainment, Tech, Business, World, Lifestyle, Culture, Science, or Other.",
    "Prefer reusing those broad parent buckets instead of inventing new ones unless the data clearly demands it.",
    "Prefer 1 to 4 words. Avoid vague buckets like General or Mixed when a clearer topic exists.",
    "Return no more than 10 semantic categories total.",
    "If you find more than 10 possible clusters, merge the closest compatible ones so the final result still stays specific but does not exceed 10 categories.",
    "Every record id must appear exactly once in the output.",
    "Only categorize the records provided below. Ignore the system category for direct imports; it is managed separately.",
    "",
    `Current scan query: ${scanQuery}`,
    `Existing semantic categories: ${existingRecords.length > 0 ? Array.from(new Set(existingRecords.map((entry) => `${entry.parentCategoryName ?? "Other"} > ${entry.categoryName}`))).join(", ") : "none"}`,
    "",
    allRecords
      .map((entry, index) => `## Record ${index + 1}\n${summarizeLibraryRecord(entry.record, entry)}`)
      .join("\n\n"),
    "",
    "Return strict JSON with shape {\"categories\":[{\"parentCategoryName\":\"...\",\"name\":\"...\",\"reason\":\"...\",\"ids\":[\"id1\",\"id2\"]}]}."
  ].join("\n");
}

export function buildScanReportPrompt(
  workflow: WorkflowBundle,
  scanQuery: string,
  parentCategoryName: string,
  keptItems: Array<{
    id: string;
    title: string;
    channel: string;
    score: number;
    reason: string;
    confidence: number;
    evidenceSummary: string;
  }>
): string {
  return [
    "Write a concise markdown scan report for the latest iteration.",
    "Use the markdown workflow as guidance.",
    `The scan query was: ${scanQuery}`,
    `The parent category is: ${parentCategoryName}`,
    "Include a short overview and a ranked Top 20 section.",
    "",
    "# virality-ranking.md",
    workflow.viralityRanking,
    "",
    keptItems
      .map((item, index) =>
        `- Rank ${index + 1}: ${item.title} | channel=${item.channel} | score=${item.score} | confidence=${item.confidence}\n  reason=${item.reason}\n  evidence=${item.evidenceSummary}`
      )
      .join("\n")
  ].join("\n");
}
