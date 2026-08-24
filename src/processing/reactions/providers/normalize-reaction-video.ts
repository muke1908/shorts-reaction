import type { PipelineConfig } from "../../../shared/types";
import { probeMediaDurationSeconds } from "../../media/probe-media";
import { runCommand } from "../../media/run-command";

export interface NormalizeReactionVideoOptions {
  preserveAudio?: boolean;
  targetDurationSeconds?: number;
}

export function shouldLoopReactionVideo(inputDurationSeconds: number, targetDurationSeconds: number): boolean {
  return inputDurationSeconds + 0.05 < targetDurationSeconds;
}

export async function normalizeReactionVideo(
  inputVideoPath: string,
  outputVideoPath: string,
  config: PipelineConfig,
  providerLabel: string,
  options: NormalizeReactionVideoOptions = {}
): Promise<void> {
  const preserveAudio = options.preserveAudio ?? true;
  const targetDurationSeconds = options.targetDurationSeconds ?? null;
  const args = ["-y"];

  if (targetDurationSeconds !== null) {
    const inputDurationSeconds = await probeMediaDurationSeconds(inputVideoPath, config);
    if (shouldLoopReactionVideo(inputDurationSeconds, targetDurationSeconds)) {
      args.push("-stream_loop", "-1");
    }
  }

  args.push(
    "-i",
    inputVideoPath,
    "-filter:v",
    "scale=1080:768:force_original_aspect_ratio=decrease,pad=1080:768:(ow-iw)/2:(oh-ih)/2:black",
    "-map",
    "0:v",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p"
  );

  if (preserveAudio) {
    args.push(
      "-map",
      "0:a?",
      "-c:a",
      "aac"
    );
  }

  if (targetDurationSeconds !== null) {
    args.push(
      "-t",
      targetDurationSeconds.toFixed(3)
    );
  }

  args.push(
    "-movflags",
    "+faststart",
    outputVideoPath
  );

  await runCommand(config.ffmpegBinary, args).catch((error: unknown) => {
    if (error instanceof Error && /ENOENT/.test(error.message)) {
      throw new Error(
        `Could not find ${config.ffmpegBinary}. Install ffmpeg or set FFMPEG_BINARY so the ${providerLabel} can normalize its reaction clip.`
      );
    }

    throw error;
  });
}
