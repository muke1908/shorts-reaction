import { normalizeReactionVideo } from "./normalize-reaction-video";
import type { AvatarReactionRequest } from "../provider";

export async function createUserMediaReactionVideo({
  job,
  outputVideoPath,
  config
}: AvatarReactionRequest): Promise<void> {
  if (!job.providerInputVideoPath) {
    throw new Error("UserMediaProvider requires a recorded user video before processing can start.");
  }

  await normalizeReactionVideo(job.providerInputVideoPath, outputVideoPath, config, "UserMediaProvider");
}
