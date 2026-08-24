import type { PipelineConfig } from "../../shared/types";
import { runCommand } from "../media/run-command";

export async function downloadYoutubeShort(url: string, outputPath: string, config: PipelineConfig): Promise<void> {
  await runCommand(config.ytdlpBinary, [
    "--no-playlist",
    "--format",
    "bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best",
    "--merge-output-format",
    "mp4",
    "--output",
    outputPath,
    url
  ]).catch((error: unknown) => {
    if (error instanceof Error && /ENOENT/.test(error.message)) {
      throw new Error(
        `Could not find ${config.ytdlpBinary}. Install yt-dlp or set YTDLP_BINARY so the Process flow can download the selected YouTube Short.`
      );
    }

    throw error;
  });
}
