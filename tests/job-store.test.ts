import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { PipelineConfig, ReactionJobRecord } from "../src/shared/types";
import { findReusableSourceVideoPathForShort } from "../src/processing/jobs/job-store";

function createConfig(baseDir: string): PipelineConfig {
  return {
    outputDir: join(baseDir, "output"),
    byDayDir: join(baseDir, "output", "by-day"),
    reportsDir: join(baseDir, "output", "reports"),
    workflowDir: join(baseDir, "output", "workflow"),
    generatedDir: join(baseDir, "generated"),
    aiCharacterAssetDir: join(baseDir, "static-ai"),
    maxResultsPerQuery: 10,
    keywordSeeds: ["politics"],
    ytdlpBinary: "yt-dlp",
    ffmpegBinary: "ffmpeg",
    ffprobeBinary: "ffprobe",
    port: 3000,
    requestTimeoutMs: 10_000,
    serveUi: false,
    requestedDay: null,
    copilotCliBinary: "copilot",
    heygenCliBinary: "heygen",
    playwrightBrowser: "chromium"
  };
}

function createJobRecord(jobDir: string, sourceVideoPath: string | null, createdAt: string): ReactionJobRecord {
  return {
    id: `job-${randomUUID()}`,
    shortId: "short-1",
    requestedDay: "2026-08-24",
    reactionProvider: "ai-character",
    short: {
      id: "short-1",
      title: "Title",
      url: "https://www.youtube.com/shorts/abc12345678",
      channel: "Channel",
      publishedAt: "2026-08-24T00:00:00.000Z",
      captureTimestamp: "2026-08-24T00:00:00.000Z",
      score: 10,
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
    sourceVideoPath,
    providerInputVideoPath: null,
    recordedStageOutput: false,
    reactionInstructionsPath: null,
    providerRenderJobId: null,
    reactionVideoPath: null,
    outputVideoPath: null,
    posterPath: null,
    manifestPath: join(jobDir, "manifest.json"),
    workingDirectory: jobDir,
    createdAt,
    updatedAt: createdAt,
    error: null
  };
}

test("findReusableSourceVideoPathForShort returns the newest existing source video", async () => {
  const baseDir = join(tmpdir(), `avatar-job-store-${randomUUID()}`);
  const config = createConfig(baseDir);
  const jobsRoot = join(config.generatedDir, "jobs");
  const olderJobDir = join(jobsRoot, "job-older");
  const newerJobDir = join(jobsRoot, "job-newer");
  const olderSourcePath = join(olderJobDir, "source.mp4");
  const newerSourcePath = join(newerJobDir, "source.mp4");

  await mkdir(olderJobDir, { recursive: true });
  await mkdir(newerJobDir, { recursive: true });
  await writeFile(olderSourcePath, "older");
  await writeFile(newerSourcePath, "newer");
  await writeFile(
    join(olderJobDir, "manifest.json"),
    JSON.stringify(createJobRecord(olderJobDir, olderSourcePath, "2026-08-24T10:00:00.000Z"))
  );
  await writeFile(
    join(newerJobDir, "manifest.json"),
    JSON.stringify(createJobRecord(newerJobDir, newerSourcePath, "2026-08-24T11:00:00.000Z"))
  );

  const reusablePath = await findReusableSourceVideoPathForShort("short-1", config);

  assert.equal(reusablePath, newerSourcePath);
});

test("findReusableSourceVideoPathForShort ignores missing source video files", async () => {
  const baseDir = join(tmpdir(), `avatar-job-store-${randomUUID()}`);
  const config = createConfig(baseDir);
  const jobsRoot = join(config.generatedDir, "jobs");
  const missingJobDir = join(jobsRoot, "job-missing");
  const validJobDir = join(jobsRoot, "job-valid");
  const missingSourcePath = join(missingJobDir, "source.mp4");
  const validSourcePath = join(validJobDir, "source.mp4");

  await mkdir(missingJobDir, { recursive: true });
  await mkdir(validJobDir, { recursive: true });
  await writeFile(validSourcePath, "valid");
  await writeFile(
    join(missingJobDir, "manifest.json"),
    JSON.stringify(createJobRecord(missingJobDir, missingSourcePath, "2026-08-24T12:00:00.000Z"))
  );
  await writeFile(
    join(validJobDir, "manifest.json"),
    JSON.stringify(createJobRecord(validJobDir, validSourcePath, "2026-08-24T11:00:00.000Z"))
  );

  const reusablePath = await findReusableSourceVideoPathForShort("short-1", config);

  assert.equal(reusablePath, validSourcePath);
});
