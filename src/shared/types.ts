export type SourceKind = "youtube-api" | "youtube-web";
export type AvatarReactionProviderKind =
  | "ai-character"
  | "user-media"
  | "heygen-avatar";
export type ProcessingStatus =
  | "pending"
  | "downloading"
  | "preparing-reaction"
  | "rendering-reaction"
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
  scanQuery?: string | null;
  parentCategorySlug?: string | null;
  parentCategoryName?: string | null;
  sourceStrategy: "hybrid";
  usedFallback: boolean;
  itemCount: number;
  outputFiles: string[];
  workflowFiles: string[];
}

export interface DumpDocument {
  generatedAt: string;
  requestedDay: string | null;
  categorySlug?: string | null;
  categoryName?: string | null;
  searchQuery?: string | null;
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
  aiCharacterAssetDir: string;
  heygenApiKey?: string;
  heygenApiUrl?: string;
  heygenCliBinary?: string;
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

export interface CategorySummary {
  slug: string;
  name: string;
  latestQuery: string;
  latestScanAt: string;
  recordCount: number;
  scanCount: number;
  queries: string[];
}

export interface CategoryIndexDocument {
  generatedAt: string;
  categories: CategorySummary[];
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

export interface ServerRuntimeStatus {
  pid: number;
  sampledAt: string;
  uptimeSeconds: number;
  cpuPercent: number;
  cpuCoreCount: number;
  rssBytes: number;
  heapUsedBytes: number;
  heapTotalBytes: number;
  externalBytes: number;
  arrayBuffersBytes: number;
  loadAverage: [number, number, number];
  nodeVersion: string;
  platform: NodeJS.Platform;
}

export interface DeleteShortResponse {
  deletedShortId: string;
  updatedDumpFiles: number;
  deletedDumpFiles: number;
  deletedJobDirectories: number;
}

export interface ProcessShortRequest {
  day?: string;
  categorySlug?: string | null;
  sourceUrl?: string;
  reactionProvider?: AvatarReactionProviderKind;
  userMedia?: {
    mimeType: string;
    base64: string;
  } | null;
}

export interface ReactionInstructions {
  sourceTitle: string;
  sourceChannel: string;
  sourceDurationSeconds: number | null;
  providerKind: AvatarReactionProviderKind;
  speechMode: "silent" | "preserve-user" | "mix-when-available";
  reactionSummary: string;
  expressionDirection: string;
  timingGuidance: string[];
}

export interface ReactionJobRecord {
  id: string;
  shortId: string;
  requestedDay: string | null;
  reactionProvider: AvatarReactionProviderKind;
  short: Pick<
    ShortRecord,
    "id" | "title" | "url" | "channel" | "publishedAt" | "captureTimestamp" | "score" | "scoreBreakdown"
  >;
  status: ProcessingStatus;
  sourceVideoPath: string | null;
  providerInputVideoPath: string | null;
  reactionInstructionsPath: string | null;
  providerRenderJobId: string | null;
  reactionVideoPath: string | null;
  outputVideoPath: string | null;
  posterPath: string | null;
  manifestPath: string;
  workingDirectory: string;
  createdAt: string;
  updatedAt: string;
  error: string | null;
}

export interface ScanRequest {
  query: string;
}

export interface ScanSearchPlan {
  intent: string;
  searchQueries: string[];
}

export interface ScanCategoryDecision {
  parentCategoryName: string;
  reason: string;
}

export interface ExistingCategoryRecord {
  record: ShortRecord;
  categorySlug: string;
  categoryName: string;
}

export interface RecategorizedCategory {
  slug: string;
  name: string;
  reason: string;
  records: ShortRecord[];
  touchedByCurrentScan: boolean;
}

export interface RecategorizationResult {
  categories: RecategorizedCategory[];
  primaryCategorySlug: string | null;
  primaryCategoryName: string | null;
}
