import { runCommand } from "../../media/run-command";
import type { AvatarReactionRequest } from "../provider";

export async function createUserMediaReactionVideo({
  job,
  outputVideoPath,
  config
}: AvatarReactionRequest): Promise<void> {
  if (!job.providerInputVideoPath) {
    throw new Error("UserMediaProvider requires a recorded user video before processing can start.");
  }

  await runCommand(config.ffmpegBinary, [
    "-y",
    "-i",
    job.providerInputVideoPath,
    "-filter:v",
    "scale=1080:768:force_original_aspect_ratio=decrease,pad=1080:768:(ow-iw)/2:(oh-ih)/2:black",
    "-map",
    "0:v",
    "-map",
    "0:a?",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    outputVideoPath
  ]).catch((error: unknown) => {
    if (error instanceof Error && /ENOENT/.test(error.message)) {
      throw new Error(
        `Could not find ${config.ffmpegBinary}. Install ffmpeg or set FFMPEG_BINARY so the UserMediaProvider can normalize the recorded reaction clip.`
      );
    }

    throw error;
  });
}
