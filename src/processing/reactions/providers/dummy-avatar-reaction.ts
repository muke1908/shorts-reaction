import { probeMediaDurationSeconds } from "../../media/probe-media";
import { runCommand } from "../../media/run-command";
import type { AvatarReactionRequest } from "../provider";

function hashSeed(value: string): number {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return hash;
}

function colorFromSeed(seed: number, shift: number): string {
  const channel = (offset: number) => (((seed >>> offset) & 0xff) + shift) % 256;
  return `0x${[channel(0), channel(8), channel(16)].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

export async function createDummyAvatarReactionVideo({
  job,
  sourceVideoPath,
  outputVideoPath,
  config
}: AvatarReactionRequest): Promise<void> {
  const duration = await probeMediaDurationSeconds(sourceVideoPath, config);
  const seed = hashSeed(`${job.short.id}:${job.short.title}`);
  const primaryColor = colorFromSeed(seed, 40);
  const accentColor = colorFromSeed(seed, 120);
  const overlayColor = colorFromSeed(seed, 200);

  const filter = [
    "[0:v]format=rgba,colorchannelmixer=aa=0.22[pattern]",
    `[1:v]drawbox=x=96:y=72:w=888:h=624:color=${accentColor}@0.28:t=fill[base]`,
    `[base][pattern]overlay=0:0[tmp]`,
    `[tmp]drawbox=x=96:y=72:w=888:h=624:color=white@0.18:t=6,drawgrid=width=120:height=96:thickness=2:color=${overlayColor}@0.16[v]`
  ].join(";");

  await runCommand(config.ffmpegBinary, [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `testsrc2=s=1080x768:r=30:d=${duration.toFixed(3)}`,
    "-f",
    "lavfi",
    "-i",
    `color=c=${primaryColor}:s=1080x768:r=30:d=${duration.toFixed(3)}`,
    "-filter_complex",
    filter,
    "-map",
    "[v]",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outputVideoPath
  ]).catch((error: unknown) => {
    if (error instanceof Error && /ENOENT/.test(error.message)) {
      throw new Error(
        `Could not find ${config.ffmpegBinary}. Install ffmpeg or set FFMPEG_BINARY so the Avatar Reaction Provider can render its video layer.`
      );
    }

    throw error;
  });
}
