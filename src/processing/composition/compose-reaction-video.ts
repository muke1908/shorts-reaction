import { spawn } from "node:child_process";
import type { PipelineConfig } from "../../shared/types";

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: "pipe" });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      reject(new Error(stderr.trim() || `${command} exited with code ${code ?? "unknown"}`));
    });
  });
}

export async function composeReactionVideo(
  sourceVideoPath: string,
  outputVideoPath: string,
  posterPath: string,
  config: PipelineConfig
): Promise<void> {
  const stackedPlaceholderFilter = [
    "color=c=black:s=1080x1920:r=30[canvas]",
    "[0:v]scale=1080:1152:force_original_aspect_ratio=decrease,pad=1080:1152:(ow-iw)/2:(oh-ih)/2:black[top]",
    "[canvas][top]overlay=(W-w)/2:0:shortest=1[v]"
  ].join(";");

  await runCommand(config.ffmpegBinary, [
    "-y",
    "-i",
    sourceVideoPath,
    "-filter_complex",
    stackedPlaceholderFilter,
    "-map",
    "[v]",
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
    "-shortest",
    outputVideoPath
  ]);

  await runCommand(config.ffmpegBinary, [
    "-y",
    "-i",
    outputVideoPath,
    "-ss",
    "00:00:01",
    "-frames:v",
    "1",
    posterPath
  ]);
}
