import { access, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { PipelineConfig } from "../../../shared/types";
import type { AvatarReactionRequest } from "../provider";
import { normalizeReactionVideo } from "./normalize-reaction-video";

const STATIC_ASSET_EXTENSIONS = [".mp4", ".mov", ".webm", ".mkv"] as const;

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function resolveOptionalAiCharacterStaticAssetPath(
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

export async function resolveAiCharacterStaticAssetPath(config: PipelineConfig): Promise<string> {
  const directory = config.aiCharacterAssetDir;
  const startPath = await resolveOptionalAiCharacterStaticAssetPath(config, "start");
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

export async function createAiCharacterReactionVideo({
  job: _job,
  outputVideoPath,
  config
}: AvatarReactionRequest): Promise<void> {
  const inputVideoPath = await resolveAiCharacterStaticAssetPath(config);
  await normalizeReactionVideo(inputVideoPath, outputVideoPath, config, "AI character static provider");
}
