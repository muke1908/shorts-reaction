import { hoursSince } from "./dates";
import type { LlmReview, ScoreBreakdown, ShortRecord, SourceItem } from "./types";

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function computeBreakdown(item: SourceItem): ScoreBreakdown {
  const hoursOld = hoursSince(item.publishedAt);
  const views = item.views ?? 0;
  const likes = item.likes ?? 0;
  const comments = item.comments ?? 0;
  const viewsPerHour = views / hoursOld;
  const likesPerHour = likes / hoursOld;
  const commentsPerHour = comments / hoursOld;
  const likesPerThousandViews = views > 0 ? (likes / views) * 1000 : 0;
  const commentsPerThousandViews = views > 0 ? (comments / views) * 1000 : 0;
  const completenessPenalty =
    (item.views === null ? 10 : 0) + (item.likes === null ? 3 : 0) + (item.comments === null ? 6 : 0);

  const reach = Math.min(18, Math.log10(views + 1) * 4.5);
  const viewVelocity = Math.min(
    34,
    (Math.log10(viewsPerHour + 1) * 14) +
      (Math.log10((likesPerHour * 2) + (commentsPerHour * 5) + 1) * 4)
  );
  const engagement =
    Math.min(
      22,
      (Math.sqrt(likesPerThousandViews) * 2.4) + (Math.sqrt(commentsPerThousandViews) * 4.2)
    );
  const conversation =
    Math.min(
      16,
      (Math.log10(comments + 1) * 3) + (commentsPerThousandViews * 0.9)
    );
  const freshness = Math.max(0, 20 - Math.min(hoursOld, 96) / 5);

  const total = Math.max(0, round(reach + viewVelocity + engagement + conversation + freshness - completenessPenalty));
  const reasons = [
    `reach=${round(reach)}`,
    `viewVelocity=${round(viewVelocity)}`,
    `engagement=${round(engagement)}`,
    `conversation=${round(conversation)}`,
    `freshness=${round(freshness)}`,
    `completenessPenalty=${round(completenessPenalty)}`
  ];

  return {
    reach: round(reach),
    viewVelocity: round(viewVelocity),
    engagement: round(engagement),
    conversation: round(conversation),
    freshness: round(freshness),
    sourceCompletenessPenalty: round(completenessPenalty),
    total,
    reasons
  };
}

export function scoreShort(item: SourceItem, matchedKeywords: string[], llmReview: LlmReview | null): ShortRecord {
  const breakdown = computeBreakdown(item);

  return {
    ...item,
    matchedKeywords,
    llmReview,
    score: breakdown.total,
    scoreBreakdown: breakdown
  };
}
