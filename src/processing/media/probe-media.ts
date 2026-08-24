import type { PipelineConfig } from "../../shared/types";
import { runCommand } from "./run-command";

export async function probeMediaDurationSeconds(path: string, config: PipelineConfig): Promise<number> {
  const { stdout } = await runCommand(config.ffprobeBinary, [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    path
  ]).catch((error: unknown) => {
    if (error instanceof Error && /ENOENT/.test(error.message)) {
      throw new Error(
        `Could not find ${config.ffprobeBinary}. Install ffprobe or set FFPROBE_BINARY so the Process flow can inspect source video duration.`
      );
    }

    throw error;
  });

  const duration = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Could not determine media duration for ${path}.`);
  }

  return duration;
}

export async function probeMediaHasAudioStream(path: string, config: PipelineConfig): Promise<boolean> {
  const { stdout } = await runCommand(config.ffprobeBinary, [
    "-v",
    "error",
    "-select_streams",
    "a",
    "-show_entries",
    "stream=index",
    "-of",
    "csv=p=0",
    path
  ]).catch((error: unknown) => {
    if (error instanceof Error && /ENOENT/.test(error.message)) {
      throw new Error(
        `Could not find ${config.ffprobeBinary}. Install ffprobe or set FFPROBE_BINARY so the Process flow can inspect media audio streams.`
      );
    }

    throw error;
  });

  return stdout.trim().length > 0;
}
