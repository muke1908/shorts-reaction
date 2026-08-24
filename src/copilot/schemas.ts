import type { LlmReview } from "../shared/types";

export interface CopilotReviewBatchResponse {
  reviews: Array<
    LlmReview & {
      id: string;
    }
  >;
}
