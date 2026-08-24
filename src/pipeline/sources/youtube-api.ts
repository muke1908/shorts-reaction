import { parseIsoDuration } from "../../shared/dates";
import type { PipelineConfig, SourceItem } from "../../shared/types";
import { isEligibleShortCandidate, toShortsUrl } from "./shorts-eligibility";

interface YoutubeSearchResponse {
  items?: Array<{
    id?: {
      videoId?: string;
    };
  }>;
}

interface YoutubeVideosResponse {
  items?: Array<{
    id: string;
    snippet?: {
      title?: string;
      description?: string;
      channelTitle?: string;
      channelId?: string;
      publishedAt?: string;
    };
    contentDetails?: {
      duration?: string;
    };
    statistics?: {
      viewCount?: string;
      likeCount?: string;
      commentCount?: string;
    };
  }>;
}

async function fetchJson<T>(url: string, config: PipelineConfig): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`YouTube API request failed with ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function searchWithYoutubeApi(config: PipelineConfig, keywordSeed: string): Promise<SourceItem[]> {
  if (!config.youtubeApiKey) {
    return [];
  }

  const publishedAfter = config.requestedDay ? `${config.requestedDay}T00:00:00Z` : undefined;
  const searchParams = new URLSearchParams({
    key: config.youtubeApiKey,
    part: "id",
    type: "video",
    maxResults: String(config.maxResultsPerQuery),
    order: "date",
    q: `${keywordSeed} #shorts`
  });

  if (publishedAfter) {
    searchParams.set("publishedAfter", publishedAfter);
  }

  const searchResponse = await fetchJson<YoutubeSearchResponse>(
    `https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`,
    config
  );
  const videoIds = (searchResponse.items ?? [])
    .map((item) => item.id?.videoId)
    .filter((value): value is string => Boolean(value));

  if (videoIds.length === 0) {
    return [];
  }

  const videoParams = new URLSearchParams({
    key: config.youtubeApiKey,
    part: "snippet,contentDetails,statistics",
    id: videoIds.join(",")
  });
  const videosResponse = await fetchJson<YoutubeVideosResponse>(
    `https://www.googleapis.com/youtube/v3/videos?${videoParams.toString()}`,
    config
  );

  return (videosResponse.items ?? [])
    .map((item): SourceItem | null => {
      const durationSeconds = item.contentDetails?.duration ? parseIsoDuration(item.contentDetails.duration) : null;
      const title = item.snippet?.title?.trim();
      const publishedAt = item.snippet?.publishedAt;
      const channel = item.snippet?.channelTitle?.trim();
      const views = item.statistics?.viewCount !== undefined ? Number(item.statistics.viewCount) : null;
      const likes = item.statistics?.likeCount !== undefined ? Number(item.statistics.likeCount) : null;
      const comments = item.statistics?.commentCount !== undefined ? Number(item.statistics.commentCount) : null;
      const commentsEnabled = item.statistics?.commentCount !== undefined;

      if (!title || !publishedAt || !channel) {
        return null;
      }

      if (!isEligibleShortCandidate({ durationSeconds, commentsEnabled })) {
        return null;
      }

      return {
        id: item.id,
        title,
        url: toShortsUrl(item.id),
        channel,
        channelId: item.snippet?.channelId ?? null,
        description: item.snippet?.description?.trim() ?? "",
        publishedAt,
        captureTimestamp: new Date().toISOString(),
        views,
        likes,
        comments,
        commentsEnabled,
        durationSeconds,
        keywordSeed,
        source: "youtube-api"
      };
    })
    .filter((item): item is SourceItem => item !== null);
}
