export type SourceKind = "youtube-api" | "youtube-web";
export type ProcessingStatus =
  | "pending"
  | "downloading"
  | "compositing"
  | "completed"
  | "failed";

export interface ScoreBreakdown {
  reach: number;
  viewVelocity: number;
  engagement: number;
  conversation: number;
  freshness: number;
  sourceCompletenessPenalty: number;
  total: number;
  reasons: string[];
}

export interface LlmReview {
  keep: boolean;
  relevant: boolean;
  spam: boolean;
  viralityScore: number;
  confidence: number;
  reason: string;
  evidenceSummary: string;
}

export interface ShortRecord {
  id: string;
  title: string;
  url: string;
  channel: string;
  channelId: string | null;
  description: string;
  publishedAt: string;
  captureTimestamp: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  commentsEnabled: boolean;
  durationSeconds: number | null;
  keywordSeed: string;
  matchedKeywords: string[];
  llmReview: LlmReview | null;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  source: SourceKind;
}

export interface GeneratedVideoSummary {
  latestJobId: string;
  status: ProcessingStatus;
  outputUrl: string | null;
  posterUrl: string | null;
  updatedAt: string;
  error: string | null;
}

export interface RunMetadata {
  startedAt: string;
  completedAt: string;
  keywordSeeds: string[];
  sourceStrategy: "hybrid";
  usedFallback: boolean;
  itemCount: number;
  outputFiles: string[];
  workflowFiles: string[];
}

export interface DumpDocument {
  generatedAt: string;
  requestedDay: string | null;
  records: ShortRecord[];
  metadata: RunMetadata;
}

export interface PipelineConfig {
  youtubeApiKey?: string;
  outputDir: string;
  byDayDir: string;
  reportsDir: string;
  workflowDir: string;
  port: number;
  maxResultsPerQuery: number;
  keywordSeeds: string[];
  copilotCliBinary?: string;
  copilotModel?: string;
  requestTimeoutMs: number;
  serveUi: boolean;
  requestedDay: string | null;
  generatedDir: string;
  heygenApiKey?: string;
  heygenApiUrl?: string;
  heygenTemplateId?: string;
  heygenAvatarId?: string;
  heygenVoiceId?: string;
  heygenReactionVideoUrl?: string;
  heygenOverlayChromaKeyColor?: string;
  ytdlpBinary: string;
  ffmpegBinary: string;
  ffprobeBinary: string;
  playwrightBrowser: "chromium" | "firefox" | "webkit";
}

export interface SourceItem {
  id: string;
  title: string;
  url: string;
  channel: string;
  channelId: string | null;
  description: string;
  publishedAt: string;
  captureTimestamp: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  commentsEnabled: boolean;
  durationSeconds: number | null;
  keywordSeed: string;
  source: SourceKind;
}

export interface PipelineResult {
  latestFile: string;
  byDayFiles: string[];
  iterationFile: string;
  reportFile: string;
  dump: DumpDocument;
}

export interface CopilotUsageTotals {
  premiumRequests: number;
  nanoAiu: number;
  apiDurationMs: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number;
  lastCallInputTokens: number;
  lastCallOutputTokens: number;
}

export interface CopilotInvocationSnapshot {
  phase: string;
  pid: number | null;
  model: string | null;
  startedAt: string;
  finishedAt: string | null;
  totals: CopilotUsageTotals;
}

export interface CopilotRuntimeStatus {
  active: boolean;
  phase: string | null;
  pid: number | null;
  binary: string | null;
  model: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  lastUpdatedAt: string;
  completedInvocations: number;
  totals: CopilotUsageTotals;
  lastInvocation: CopilotInvocationSnapshot | null;
  error: string | null;
}

export interface ProcessShortRequest {
  day?: string;
}

export interface ReactionJobRecord {
  id: string;
  shortId: string;
  requestedDay: string | null;
  short: Pick<
    ShortRecord,
    "id" | "title" | "url" | "channel" | "publishedAt" | "captureTimestamp" | "score" | "scoreBreakdown"
  >;
  status: ProcessingStatus;
  sourceVideoPath: string | null;
  outputVideoPath: string | null;
  posterPath: string | null;
  manifestPath: string;
  workingDirectory: string;
  createdAt: string;
  updatedAt: string;
  error: string | null;
}
