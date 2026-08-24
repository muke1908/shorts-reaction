import { access, mkdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import type {
  AdvancedUserReactionPreviewDocument,
  PipelineConfig,
  ShortRecord
} from "../shared/types";
import { findShortRecord } from "./load-dumps";
import { findReusableSourceVideoPathForShort } from "../processing/jobs/job-store";
import { downloadYoutubeShort } from "../processing/sources/download-youtube-short";
import { resolveDirectYoutubeShort } from "../processing/sources/direct-youtube-source";

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function previewSourcePathForShort(short: ShortRecord, config: PipelineConfig): string {
  return resolve(config.generatedDir, "preview-sources", `${short.id}.mp4`);
}

function toGeneratedPublicUrl(path: string, config: PipelineConfig): string {
  return `/generated/${relative(config.generatedDir, path).replaceAll("\\", "/")}`;
}

async function ensurePreviewVideoPath(short: ShortRecord, config: PipelineConfig): Promise<string> {
  const reusableSourceVideoPath = await findReusableSourceVideoPathForShort(short.id, config);
  if (reusableSourceVideoPath) {
    return reusableSourceVideoPath;
  }

  const previewPath = previewSourcePathForShort(short, config);
  if (await pathExists(previewPath)) {
    return previewPath;
  }

  await mkdir(resolve(config.generatedDir, "preview-sources"), { recursive: true });
  await downloadYoutubeShort(short.url, previewPath, config);
  return previewPath;
}

export async function loadAdvancedUserReactionPreviewForShort(
  shortId: string,
  requestedDay: string | null,
  categorySlug: string | null,
  config: PipelineConfig
): Promise<AdvancedUserReactionPreviewDocument | null> {
  const record = await findShortRecord(config.outputDir, shortId, requestedDay ?? undefined, categorySlug);
  if (!record) {
    return null;
  }

  const previewVideoPath = await ensurePreviewVideoPath(record, config);
  return {
    record,
    requestedDay,
    categorySlug,
    previewVideoUrl: toGeneratedPublicUrl(previewVideoPath, config)
  };
}

export async function loadAdvancedUserReactionPreviewForUrl(
  sourceUrl: string,
  config: PipelineConfig
): Promise<AdvancedUserReactionPreviewDocument> {
  const record = await resolveDirectYoutubeShort(sourceUrl, config);
  const previewVideoPath = await ensurePreviewVideoPath(record, config);
  return {
    record,
    requestedDay: null,
    categorySlug: null,
    previewVideoUrl: toGeneratedPublicUrl(previewVideoPath, config)
  };
}
