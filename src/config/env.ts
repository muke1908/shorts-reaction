import { resolve } from "node:path";
import { DEFAULT_KEYWORD_SEEDS } from "./keywords";
import type { PipelineConfig } from "../shared/types";

function readNumber(name: string, fallback: number): number {
  const value = process.env[name];
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readPlaywrightBrowser(): PipelineConfig["playwrightBrowser"] {
  const value = (process.env.PLAYWRIGHT_BROWSER ?? "chromium").toLowerCase();
  if (value === "firefox" || value === "webkit") {
    return value;
  }

  return "chromium";
}

export function loadConfig(overrides: Partial<PipelineConfig> = {}): PipelineConfig {
  const outputDir = resolve(process.cwd(), "data/dumps");
  const generatedDir = process.env.GENERATED_ASSETS_DIR
    ? resolve(process.cwd(), process.env.GENERATED_ASSETS_DIR)
    : resolve(process.cwd(), "data/generated");
  const reportsDir = resolve(process.cwd(), "data/reports");
  const workflowDir = resolve(process.cwd(), "workflow");

  return {
    youtubeApiKey: process.env.YOUTUBE_API_KEY,
    outputDir,
    byDayDir: resolve(outputDir, "by-day"),
    reportsDir,
    workflowDir,
    port: readNumber("PIPELINE_PORT", 3000),
    maxResultsPerQuery: readNumber("PIPELINE_MAX_RESULTS_PER_QUERY", 10),
    keywordSeeds: (process.env.PIPELINE_KEYWORD_SEEDS ?? DEFAULT_KEYWORD_SEEDS.join(","))
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    copilotCliBinary: process.env.COPILOT_CLI_BINARY,
    copilotModel: process.env.COPILOT_MODEL,
    requestTimeoutMs: readNumber("PIPELINE_REQUEST_TIMEOUT_MS", 15_000),
    serveUi: false,
    requestedDay: null,
    generatedDir,
    heygenApiKey: process.env.HEYGEN_API_KEY,
    heygenApiUrl: process.env.HEYGEN_API_URL,
    heygenTemplateId: process.env.HEYGEN_TEMPLATE_ID,
    heygenAvatarId: process.env.HEYGEN_AVATAR_ID,
    heygenVoiceId: process.env.HEYGEN_VOICE_ID,
    heygenReactionVideoUrl: process.env.HEYGEN_REACTION_VIDEO_URL,
    heygenOverlayChromaKeyColor: process.env.HEYGEN_OVERLAY_CHROMA_KEY_COLOR,
    ytdlpBinary: process.env.YTDLP_BINARY ?? "yt-dlp",
    ffmpegBinary: process.env.FFMPEG_BINARY ?? "ffmpeg",
    ffprobeBinary: process.env.FFPROBE_BINARY ?? "ffprobe",
    playwrightBrowser: readPlaywrightBrowser(),
    ...overrides
  };
}
