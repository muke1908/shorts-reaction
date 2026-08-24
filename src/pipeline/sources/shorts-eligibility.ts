import type { SourceItem } from "../../shared/types";

export const MIN_SHORT_DURATION_SECONDS = 10;
export const MAX_SHORT_DURATION_SECONDS = 180;

export function toShortsUrl(videoId: string): string {
  return `https://www.youtube.com/shorts/${videoId}`;
}

export function hasEligibleShortDuration(durationSeconds: number | null): boolean {
  return durationSeconds !== null &&
    durationSeconds >= MIN_SHORT_DURATION_SECONDS &&
    durationSeconds <= MAX_SHORT_DURATION_SECONDS;
}

export function hasCommentsEnabled(commentsEnabled: boolean): boolean {
  return commentsEnabled;
}

export function isEligibleShortCandidate(item: Pick<SourceItem, "durationSeconds" | "commentsEnabled">): boolean {
  return hasEligibleShortDuration(item.durationSeconds) && hasCommentsEnabled(item.commentsEnabled);
}
