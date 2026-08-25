import type { LlmReview } from "../shared/types";

export interface CopilotReviewBatchResponse {
  reviews: Array<
    LlmReview & {
      id: string;
    }
  >;
}

export interface CopilotSearchPlanResponse {
  intent: string;
  searchQueries: string[];
}

export interface CopilotCategoryDecisionResponse {
  parentCategoryName: string;
  reason: string;
}

export interface CopilotCategoryRegroupResponse {
  categories: Array<{
    parentCategoryName: string;
    name: string;
    reason: string;
    ids: string[];
  }>;
}
