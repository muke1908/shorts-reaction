import { access, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PipelineConfig } from "../../../shared/types";
import type { AvatarReactionRequest, ReactionCompositionPlan } from "../provider";
import { normalizeReactionVideo } from "./normalize-reaction-video";

const STATIC_ASSET_EXTENSIONS = [".mp4", ".mov", ".webm", ".mkv"] as const;
const TEMPLATE_2_OVERLAY_IMAGE_PATH = fileURLToPath(
  new URL("../../assets/template-2-wait-for-the-end.png", import.meta.url)
);

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function resolveOptionalStaticTemplateAssetPath(
  config: PipelineConfig,
  baseName: string
): Promise<string | null> {
  const directory = config.aiCharacterAssetDir;
  for (const extension of STATIC_ASSET_EXTENSIONS) {
    const assetPath = resolve(directory, `${baseName}${extension}`);
    if (await pathExists(assetPath)) {
      return assetPath;
    }
  }

  return null;
}

export async function resolveRequiredStaticTemplateAssetPath(
  config: PipelineConfig,
  baseName: string
): Promise<string> {
  const assetPath = await resolveOptionalStaticTemplateAssetPath(config, baseName);
  if (assetPath) {
    return assetPath;
  }

  throw new Error(
    `Could not find ${baseName}.mp4 (or .mov/.webm/.mkv) in ${config.aiCharacterAssetDir}.`
  );
}

export async function resolveTemplate1StaticAssetPath(config: PipelineConfig): Promise<string> {
  const directory = config.aiCharacterAssetDir;
  const startPath = await resolveOptionalStaticTemplateAssetPath(config, "start");
  if (startPath) {
    return startPath;
  }

  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const firstAsset = entries
    .filter((entry) => entry.isFile() && STATIC_ASSET_EXTENSIONS.includes(entry.name.slice(entry.name.lastIndexOf(".")) as typeof STATIC_ASSET_EXTENSIONS[number]))
    .map((entry) => resolve(directory, entry.name))
    .sort()[0];

  if (firstAsset) {
    return firstAsset;
  }

  throw new Error(
    `Could not find a static AI character asset in ${directory}. Add start.mp4 (or .mov/.webm/.mkv), or place a supported video asset in that directory.`
  );
}

export async function createTemplate1ReactionVideo({
  job: _job,
  outputVideoPath,
  config
}: AvatarReactionRequest): Promise<void> {
  const inputVideoPath = await resolveTemplate1StaticAssetPath(config);
  await normalizeReactionVideo(inputVideoPath, outputVideoPath, config, "Template-1 static provider");
}

export async function createTemplate2ReactionVideo({
  job: _job,
  outputVideoPath,
  config
}: AvatarReactionRequest): Promise<void> {
  const inputVideoPath = await resolveRequiredStaticTemplateAssetPath(config, "end");
  await normalizeReactionVideo(inputVideoPath, outputVideoPath, config, "Template-2 static provider");
}

export async function buildTemplate1CompositionPlan(
  request: AvatarReactionRequest
): Promise<ReactionCompositionPlan> {
  const endVideoPath = await resolveOptionalStaticTemplateAssetPath(request.config, "end");

  return {
    top: {
      videoPath: request.sourceVideoPath,
      startTimeSeconds: 3
    },
    bottomStart: {
      videoPath: request.outputVideoPath,
      startTimeSeconds: 0
    },
    bottomEnd: endVideoPath
      ? {
          videoPath: endVideoPath,
          startAtTopEndOffsetSeconds: -1
        }
      : null
  };
}

export function buildTemplate2CompositionPlan(
  request: AvatarReactionRequest
): ReactionCompositionPlan {
  return {
    top: {
      videoPath: request.sourceVideoPath,
      startTimeSeconds: 0
    },
    bottomStart: {
      videoPath: request.outputVideoPath,
      startAtTopEndOffsetSeconds: -1,
      overlayImageBeforeStartPath: TEMPLATE_2_OVERLAY_IMAGE_PATH
    },
    bottomEnd: null
  };
}
