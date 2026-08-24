import { spawn } from "node:child_process";
import type { PipelineConfig } from "../../shared/types";

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "pipe" });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `${command} exited with code ${code ?? "unknown"}`));
    });
  });
}

export async function downloadYoutubeShort(url: string, outputPath: string, config: PipelineConfig): Promise<void> {
  await runCommand(config.ytdlpBinary, [
    "--no-playlist",
    "--format",
    "mp4/bestvideo+bestaudio/best",
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
