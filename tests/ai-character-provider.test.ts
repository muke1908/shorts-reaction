import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { PipelineConfig } from "../src/shared/types";
import { buildAiCharacterCompositionPlan, resolveAiCharacterStaticAssetPath } from "../src/processing/reactions/providers/ai-character-provider";

function createConfig(baseDir: string): PipelineConfig {
  return {
    youtubeApiKey: undefined,
    outputDir: join(baseDir, "output"),
    byDayDir: join(baseDir, "output", "by-day"),
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
    ytdlpBinary: "yt-dlp",
    ffmpegBinary: "ffmpeg",
    ffprobeBinary: "ffprobe",
    playwrightBrowser: "chromium"
  };
}

test("resolveAiCharacterStaticAssetPath prefers the start asset", async () => {
  const baseDir = join(tmpdir(), `avatar-ai-character-${randomUUID()}`);
  const config = createConfig(baseDir);

  await mkdir(config.aiCharacterAssetDir, { recursive: true });
  await writeFile(join(config.aiCharacterAssetDir, "start.mp4"), "fallback");

  const path = await resolveAiCharacterStaticAssetPath(config);

  assert.equal(path, join(config.aiCharacterAssetDir, "start.mp4"));
});

test("resolveAiCharacterStaticAssetPath falls back to the first supported asset", async () => {
  const baseDir = join(tmpdir(), `avatar-ai-character-${randomUUID()}`);
  const config = createConfig(baseDir);

  await mkdir(config.aiCharacterAssetDir, { recursive: true });
  await writeFile(join(config.aiCharacterAssetDir, "ambient.webm"), "fallback");

  const path = await resolveAiCharacterStaticAssetPath(config);

  assert.equal(path, join(config.aiCharacterAssetDir, "ambient.webm"));
});

test("buildAiCharacterCompositionPlan wires source, start, and optional end timing", async () => {
  const baseDir = join(tmpdir(), `avatar-ai-character-${randomUUID()}`);
  const config = createConfig(baseDir);

  await mkdir(config.aiCharacterAssetDir, { recursive: true });
  await writeFile(join(config.aiCharacterAssetDir, "end.mp4"), "ending");

  const plan = await buildAiCharacterCompositionPlan({
    job: {} as never,
    sourceVideoPath: "/tmp/source.mp4",
    providerRenderPath: "/tmp/provider-render.mp4",
    outputVideoPath: "/tmp/reaction.mp4",
    config
  });

  assert.deepEqual(plan, {
    top: {
      videoPath: "/tmp/source.mp4",
      startTimeSeconds: 3
    },
    bottomStart: {
      videoPath: "/tmp/reaction.mp4",
      startTimeSeconds: 0
    },
    bottomEnd: {
      videoPath: join(config.aiCharacterAssetDir, "end.mp4"),
      startAtTopEndOffsetSeconds: -1
    }
  });
});
