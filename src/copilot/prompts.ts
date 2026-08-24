import type { WorkflowBundle } from "../agents/workflow-loader";
import type { SourceItem } from "../shared/types";

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
    "You are GitHub Copilot CLI acting as the review engine for a YouTube Shorts political-virality workflow.",
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

export function buildCandidateReviewPrompt(
  candidates: Array<{ item: SourceItem; matchedKeywords: string[]; heuristicScore: number }>
): string {
  return [
    "Review the following candidate Shorts and decide which ones to keep.",
    "For each candidate return:",
    "- id",
    "- keep (boolean)",
    "- relevant (boolean)",
    "- spam (boolean)",
    "- viralityScore (0-100 number)",
    "- confidence (0-1 number)",
    "- reason (short string)",
    "- evidenceSummary (short string)",
    "",
    "Use the markdown workflow and ranking rubric above as the source of truth.",
    "",
    candidates
      .map((candidate, index) => `## Candidate ${index + 1}\n${summarizeCandidate(candidate.item, candidate.heuristicScore, candidate.matchedKeywords)}`)
      .join("\n\n"),
    "",
    "Return JSON with shape {\"reviews\":[...]}."
  ].join("\n");
}

export function buildScanReportPrompt(
  workflow: WorkflowBundle,
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
    "Include a short overview and a ranked Top 10 section.",
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
