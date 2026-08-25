import type { PipelineConfig } from "../../shared/types";
import { runCommand } from "./run-command";

export async function exportVideoAsMp4(
  inputVideoPath: string,
  outputVideoPath: string,
  config: PipelineConfig,
  exportLabel: string
): Promise<void> {
  await runCommand(config.ffmpegBinary, [
    "-y",
    "-i",
    inputVideoPath,
    "-map",
    "0:v",
    "-map",
    "0:a?",
    "-vf",
    "scale=trunc(iw/2)*2:trunc(ih/2)*2",
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
        `Could not find ${config.ffmpegBinary}. Install ffmpeg or set FFMPEG_BINARY so the ${exportLabel} can be exported as mp4.`
      );
    }

    throw error;
  });
}
