import type { PipelineConfig, ScoreBreakdown, ShortRecord } from "../../shared/types";
import { extractYoutubeVideoId } from "../../shared/youtube-url";
import { runCommand } from "../media/run-command";
import { toShortsUrl } from "../../pipeline/sources/shorts-eligibility";

interface YtDlpMetadata {
  id?: string;
  title?: string;
  channel?: string;
  channel_id?: string;
  description?: string;
  upload_date?: string;
  timestamp?: number;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  duration?: number;
}

function createEmptyScoreBreakdown(): ScoreBreakdown {
  return {
    reach: 0,
    viewVelocity: 0,
    engagement: 0,
    conversation: 0,
    freshness: 0,
    sourceCompletenessPenalty: 0,
    total: 0,
    reasons: ["Direct URL sources skip scan-time ranking and use neutral placeholder scoring."]
  };
}

function parsePublishedAt(metadata: YtDlpMetadata): string {
  if (metadata.timestamp) {
    return new Date(metadata.timestamp * 1000).toISOString();
  }

  if (metadata.upload_date && /^\d{8}$/.test(metadata.upload_date)) {
    const year = metadata.upload_date.slice(0, 4);
    const month = metadata.upload_date.slice(4, 6);
    const day = metadata.upload_date.slice(6, 8);
    return new Date(`${year}-${month}-${day}T00:00:00.000Z`).toISOString();
  }

  return new Date().toISOString();
}

export { extractYoutubeVideoId } from "../../shared/youtube-url";

export async function resolveDirectYoutubeShort(url: string, config: PipelineConfig): Promise<ShortRecord> {
  const videoId = extractYoutubeVideoId(url);
  if (!videoId) {
    throw new Error("Enter a valid YouTube Short or video URL (shorts, watch, or youtu.be).");
  }

  const normalizedUrl = toShortsUrl(videoId);
  const { stdout } = await runCommand(config.ytdlpBinary, [
    "--dump-single-json",
    "--no-playlist",
    "--skip-download",
    normalizedUrl
  ]).catch((error: unknown) => {
    if (error instanceof Error && /ENOENT/.test(error.message)) {
      throw new Error(
        `Could not find ${config.ytdlpBinary}. Install yt-dlp or set YTDLP_BINARY so direct YouTube URLs can be inspected.`
      );
    }

    throw error;
  });

  const metadata = JSON.parse(stdout) as YtDlpMetadata;
  const timestamp = new Date().toISOString();

  return {
    id: metadata.id ?? videoId,
    title: metadata.title?.trim() || `Direct YouTube source ${videoId}`,
    url: normalizedUrl,
    channel: metadata.channel?.trim() || "Direct URL source",
    channelId: metadata.channel_id ?? null,
    description: metadata.description ?? "",
    publishedAt: parsePublishedAt(metadata),
    captureTimestamp: timestamp,
    views: typeof metadata.view_count === "number" ? metadata.view_count : null,
    likes: typeof metadata.like_count === "number" ? metadata.like_count : null,
    comments: typeof metadata.comment_count === "number" ? metadata.comment_count : null,
    commentsEnabled: metadata.comment_count !== undefined && metadata.comment_count !== null,
    durationSeconds: typeof metadata.duration === "number" ? metadata.duration : null,
    keywordSeed: "direct-url",
    matchedKeywords: [],
    llmReview: null,
    score: 0,
    scoreBreakdown: createEmptyScoreBreakdown(),
    source: "youtube-web"
  };
}
