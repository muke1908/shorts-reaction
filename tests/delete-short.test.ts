import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import type { DumpDocument, PipelineConfig, ReactionJobRecord, ShortRecord } from "../src/shared/types";
import { deleteShortAndArtifacts } from "../src/server/delete-short";

function createConfig(baseDir: string): PipelineConfig {
  return {
    youtubeApiKey: undefined,
    outputDir: join(baseDir, "dumps"),
    byDayDir: join(baseDir, "dumps", "by-day"),
    reportsDir: join(baseDir, "reports"),
    workflowDir: join(baseDir, "workflow"),
    port: 3000,
    maxResultsPerQuery: 10,
    keywordSeeds: ["politics"],
    copilotCliBinary: "copilot",
    copilotModel: undefined,
    requestTimeoutMs: 10_000,
    serveUi: false,
    requestedDay: null,
    generatedDir: join(baseDir, "generated"),
    aiCharacterAssetDir: join(baseDir, "static-ai"),
    heygenApiKey: undefined,
    heygenApiUrl: undefined,
    heygenCliBinary: "heygen",
    heygenTemplateId: undefined,
    heygenAvatarId: undefined,
    heygenVoiceId: undefined,
    heygenReactionVideoUrl: undefined,
    heygenOverlayChromaKeyColor: undefined,
    ytdlpBinary: "yt-dlp",
    ffmpegBinary: "ffmpeg",
    ffprobeBinary: "ffprobe",
    playwrightBrowser: "chromium"
  };
}

function createRecord(id: string, publishedAt = "2026-08-24T00:00:00.000Z"): ShortRecord {
  return {
    id,
    title: `Title ${id}`,
    url: `https://www.youtube.com/shorts/${id}`,
    channel: "Channel",
    channelId: null,
    description: "",
    publishedAt,
    captureTimestamp: publishedAt,
    views: 1,
    likes: 1,
    comments: 1,
    commentsEnabled: true,
    durationSeconds: 20,
    keywordSeed: "politics",
    matchedKeywords: ["politics"],
    llmReview: null,
    score: 1,
    scoreBreakdown: {
      reach: 1,
      viewVelocity: 1,
      engagement: 1,
      conversation: 1,
      freshness: 1,
      sourceCompletenessPenalty: 0,
      total: 5,
      reasons: []
    },
    source: "youtube-web"
  };
}

function createDump(records: ShortRecord[]): DumpDocument {
  return {
    generatedAt: "2026-08-24T00:00:00.000Z",
    requestedDay: null,
    records,
    metadata: {
      startedAt: "2026-08-24T00:00:00.000Z",
      completedAt: "2026-08-24T00:00:00.000Z",
      keywordSeeds: ["politics"],
      sourceStrategy: "hybrid",
      usedFallback: false,
      itemCount: records.length,
      outputFiles: [],
      workflowFiles: []
    }
  };
}

function createJob(shortId: string, jobDir: string): ReactionJobRecord {
  return {
    id: `job-${randomUUID()}`,
    shortId,
    requestedDay: null,
    reactionProvider: "ai-character",
    short: {
      id: shortId,
      title: "Title",
      url: `https://www.youtube.com/shorts/${shortId}`,
      channel: "Channel",
      publishedAt: "2026-08-24T00:00:00.000Z",
      captureTimestamp: "2026-08-24T00:00:00.000Z",
      score: 1,
      scoreBreakdown: {
        reach: 1,
        viewVelocity: 1,
        engagement: 1,
        conversation: 1,
        freshness: 1,
        sourceCompletenessPenalty: 0,
        total: 5,
        reasons: []
      }
    },
    status: "completed",
    sourceVideoPath: null,
    providerInputVideoPath: null,
    reactionInstructionsPath: null,
    providerRenderJobId: null,
    reactionVideoPath: null,
    outputVideoPath: null,
    posterPath: null,
    manifestPath: join(jobDir, "manifest.json"),
    workingDirectory: jobDir,
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
    error: null
  };
}

test("deleteShortAndArtifacts removes matching records from dumps and deletes related jobs", async () => {
  const baseDir = join(tmpdir(), `avatar-delete-${randomUUID()}`);
  const config = createConfig(baseDir);
  const target = createRecord("delete-me");
  const keep = createRecord("keep-me", "2026-08-25T00:00:00.000Z");
  const latest = createDump([target, keep]);
  const byDayTarget = createDump([target]);
  const byDayKeep = createDump([keep]);
  const iteration = createDump([keep, target]);
  const jobsRoot = join(config.generatedDir, "jobs");
  const targetJobDir = join(jobsRoot, "job-target");
  const keepJobDir = join(jobsRoot, "job-keep");

  await mkdir(config.byDayDir, { recursive: true });
  await mkdir(join(config.outputDir, "iterations"), { recursive: true });
  await mkdir(targetJobDir, { recursive: true });
  await mkdir(keepJobDir, { recursive: true });

  await writeFile(join(config.outputDir, "latest.json"), `${JSON.stringify(latest, null, 2)}\n`);
  await writeFile(join(config.byDayDir, "2026-08-24.json"), `${JSON.stringify(byDayTarget, null, 2)}\n`);
  await writeFile(join(config.byDayDir, "2026-08-25.json"), `${JSON.stringify(byDayKeep, null, 2)}\n`);
  await writeFile(join(config.outputDir, "iterations", "iteration.json"), `${JSON.stringify(iteration, null, 2)}\n`);
  await writeFile(join(targetJobDir, "manifest.json"), `${JSON.stringify(createJob("delete-me", targetJobDir), null, 2)}\n`);
  await writeFile(join(keepJobDir, "manifest.json"), `${JSON.stringify(createJob("keep-me", keepJobDir), null, 2)}\n`);

  const result = await deleteShortAndArtifacts("delete-me", config);

  assert.equal(result.updatedDumpFiles, 2);
  assert.equal(result.deletedDumpFiles, 1);
  assert.equal(result.deletedJobDirectories, 1);

  const latestAfter = JSON.parse(await readFile(join(config.outputDir, "latest.json"), "utf8")) as DumpDocument;
  const byDayKeepAfter = JSON.parse(await readFile(join(config.byDayDir, "2026-08-25.json"), "utf8")) as DumpDocument;
  const iterationAfter = JSON.parse(await readFile(join(config.outputDir, "iterations", "iteration.json"), "utf8")) as DumpDocument;

  assert.deepEqual(latestAfter.records.map((record) => record.id), ["keep-me"]);
  assert.deepEqual(byDayKeepAfter.records.map((record) => record.id), ["keep-me"]);
  assert.deepEqual(iterationAfter.records.map((record) => record.id), ["keep-me"]);

  await assert.rejects(() => access(join(config.byDayDir, "2026-08-24.json")));
});
