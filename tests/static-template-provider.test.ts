import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import type { PipelineConfig } from "../src/shared/types";
import {
  buildTemplate1CompositionPlan,
  buildTemplate2CompositionPlan,
  resolveTemplate1StaticAssetPath
} from "../src/processing/reactions/providers/static-template-provider";

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

test("resolveTemplate1StaticAssetPath prefers the start asset", async () => {
  const baseDir = join(tmpdir(), `avatar-ai-character-${randomUUID()}`);
  const config = createConfig(baseDir);

  await mkdir(config.aiCharacterAssetDir, { recursive: true });
  await writeFile(join(config.aiCharacterAssetDir, "start.mp4"), "fallback");

  const path = await resolveTemplate1StaticAssetPath(config);

  assert.equal(path, join(config.aiCharacterAssetDir, "start.mp4"));
});

test("resolveTemplate1StaticAssetPath falls back to the first supported asset", async () => {
  const baseDir = join(tmpdir(), `avatar-ai-character-${randomUUID()}`);
  const config = createConfig(baseDir);

  await mkdir(config.aiCharacterAssetDir, { recursive: true });
  await writeFile(join(config.aiCharacterAssetDir, "ambient.webm"), "fallback");

  const path = await resolveTemplate1StaticAssetPath(config);

  assert.equal(path, join(config.aiCharacterAssetDir, "ambient.webm"));
});

test("buildTemplate1CompositionPlan wires source, start, and optional end timing", async () => {
  const baseDir = join(tmpdir(), `avatar-ai-character-${randomUUID()}`);
  const config = createConfig(baseDir);

  await mkdir(config.aiCharacterAssetDir, { recursive: true });
  await writeFile(join(config.aiCharacterAssetDir, "end.mp4"), "ending");

  const plan = await buildTemplate1CompositionPlan({
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

test("buildTemplate2CompositionPlan starts the bottom clip one second before the top ends", () => {
  const plan = buildTemplate2CompositionPlan({
    job: {} as never,
    sourceVideoPath: "/tmp/source.mp4",
    providerRenderPath: "/tmp/provider-render.mp4",
    outputVideoPath: "/tmp/reaction.mp4",
    config: {} as never
  });

  assert.deepEqual(plan, {
    top: {
      videoPath: "/tmp/source.mp4",
      startTimeSeconds: 0
    },
    bottomStart: {
      videoPath: "/tmp/reaction.mp4",
      startAtTopEndOffsetSeconds: -1,
      overlayImageBeforeStartPath: fileURLToPath(
        new URL("../src/processing/assets/template-2-wait-for-the-end.png", import.meta.url)
      )
    },
    bottomEnd: null
  });
});
