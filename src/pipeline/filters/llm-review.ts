import { loadWorkflowBundle, type WorkflowBundle } from "../../agents/workflow-loader";
import { buildCandidateReviewPrompt, buildWorkflowSystemPrompt } from "../../copilot/prompts";
import { requestJsonFromCopilot } from "../../copilot/client";
import type { CopilotReviewBatchResponse } from "../../copilot/schemas";
import { isSameUtcDay } from "../../shared/dates";
import { scoreShort } from "../../shared/scoring";
import type { LlmReview, PipelineConfig, SentimentLabel, ShortRecord, SourceItem } from "../../shared/types";

function normalize(value: string): string {
  return value.toLowerCase();
}

function matchedKeywords(item: SourceItem, relevanceTerms: string[]): string[] {
  const haystack = normalize([item.title, item.description, item.channel, item.keywordSeed].join(" "));
  return relevanceTerms.filter((keyword) => haystack.includes(normalize(keyword)));
}

function buildRelevanceTerms(scanQuery: string, topicContextName: string, keywordSeeds: string[]): string[] {
  return Array.from(new Set(
    [scanQuery, topicContextName, ...keywordSeeds]
      .flatMap((value) => value.split(/[,\s/#]+/))
      .map((value) => value.trim())
      .filter((value) => value.length >= 3)
  ));
}

function isSentimentLabel(value: string): value is SentimentLabel {
  return value === "positive" || value === "negative" || value === "neutral" || value === "mixed";
}

function validateCopilotReviews(
  response: CopilotReviewBatchResponse,
  expectedItems: SourceItem[]
): Map<string, LlmReview> {
  if (!Array.isArray(response.reviews)) {
    throw new Error("Copilot CLI returned an invalid review batch payload.");
  }

  const reviews = new Map<string, LlmReview>();
  for (const entry of response.reviews) {
    const { id, ...review } = entry;
    if (!review.sentiment || !isSentimentLabel(review.sentiment.label)) {
      throw new Error(`Copilot review for candidate ${id} is missing a valid sentiment label.`);
    }
    if (typeof review.sentiment.confidence !== "number" || typeof review.sentiment.reason !== "string") {
      throw new Error(`Copilot review for candidate ${id} is missing valid sentiment confidence or reason.`);
    }
    reviews.set(id, review satisfies LlmReview);
  }

  for (const item of expectedItems) {
    if (!reviews.has(item.id)) {
      throw new Error(`Copilot CLI review omitted candidate ${item.id}.`);
    }
  }

  return reviews;
}

export async function reviewAndRankCandidates(
  items: SourceItem[],
  scanQuery: string,
  topicContextName: string,
  keywordSeeds: string[],
  config: PipelineConfig,
  workflowBundle?: WorkflowBundle
): Promise<{ records: ShortRecord[]; workflowFiles: string[] }> {
  const filteredByDay = config.requestedDay
    ? items.filter((item) => isSameUtcDay(item.publishedAt, config.requestedDay!))
    : items;

  const workflow = workflowBundle ?? await loadWorkflowBundle(config);
  const relevanceTerms = buildRelevanceTerms(scanQuery, topicContextName, keywordSeeds);
  const evidence = filteredByDay.map((item) => {
    const keywords = matchedKeywords(item, relevanceTerms);
    const heuristicRecord = scoreShort(item, keywords, null);
    return {
      item,
      matchedKeywords: keywords,
      heuristicScore: heuristicRecord.score
    };
  });

  let llmReviews = new Map<string, LlmReview>();
  if (evidence.length > 0) {
    const response = await requestJsonFromCopilot<CopilotReviewBatchResponse>(
      buildWorkflowSystemPrompt(workflow),
      buildCandidateReviewPrompt(scanQuery, topicContextName, evidence),
      config,
      "candidate-review"
    );
    llmReviews = validateCopilotReviews(
      response,
      evidence.map((entry) => entry.item)
    );
  }

  const ranked = evidence.map<ShortRecord | null>(({ item, matchedKeywords: keywords }) => {
      const llmReview = llmReviews.get(item.id);
      if (!llmReview) {
        throw new Error(`Missing Copilot review for candidate ${item.id}.`);
      }
      if (!llmReview.keep || !llmReview.relevant || llmReview.spam) {
        return null;
      }

      const scored = scoreShort(item, keywords, llmReview);
      return {
        ...scored,
        score: llmReview.viralityScore > 0 ? llmReview.viralityScore : scored.score,
        llmReview
      };
    });

  const records = ranked
    .filter((record): record is ShortRecord => record !== null)
    .sort((left, right) => right.score - left.score);

  return {
    records,
    workflowFiles: workflow.files
  };
}
