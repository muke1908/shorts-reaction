import type { PipelineConfig } from "../../shared/types";
import { probeMediaHasAudioStream } from "../media/probe-media";
import { runCommand } from "../media/run-command";

export async function composeReactionVideo(
  sourceVideoPath: string,
  reactionVideoPath: string,
  outputVideoPath: string,
  posterPath: string,
  config: PipelineConfig
): Promise<void> {
  const sourceHasAudio = await probeMediaHasAudioStream(sourceVideoPath, config);
  const reactionHasAudio = await probeMediaHasAudioStream(reactionVideoPath, config);
  const stackedReactionFilter = [
    "[0:v]scale=1080:1152:force_original_aspect_ratio=decrease,pad=1080:1152:(ow-iw)/2:(oh-ih)/2:black[top]",
    "[1:v]scale=1080:768:force_original_aspect_ratio=increase,crop=1080:768[bottom]",
    "[top][bottom]vstack=inputs=2[v]"
  ].join(";");

  const audioFilter = sourceHasAudio && reactionHasAudio
    ? "[0:a]aresample=async=1:first_pts=0,volume=0.9[sourcea];[1:a]aresample=async=1:first_pts=0,volume=1.0[reactiona];[sourcea][reactiona]amix=inputs=2:duration=first:normalize=0[a]"
    : null;

  const filterComplex = audioFilter ? `${stackedReactionFilter};${audioFilter}` : stackedReactionFilter;
  const args = [
    "-y",
    "-i",
    sourceVideoPath,
    "-i",
    reactionVideoPath,
    "-filter_complex",
    filterComplex,
    "-map",
    "[v]"
  ];

  if (audioFilter) {
    args.push("-map", "[a]");
  } else if (sourceHasAudio) {
    args.push("-map", "0:a");
  } else if (reactionHasAudio) {
    args.push("-map", "1:a");
  }

  args.push(
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p"
  );

  if (audioFilter || sourceHasAudio || reactionHasAudio) {
    args.push("-c:a", "aac");
  }

  args.push(
    "-movflags",
    "+faststart",
    "-shortest",
    outputVideoPath
  );

  await runCommand(config.ffmpegBinary, args).catch((error: unknown) => {
    if (error instanceof Error && /ENOENT/.test(error.message)) {
      throw new Error(
        `Could not find ${config.ffmpegBinary}. Install ffmpeg or set FFMPEG_BINARY so the Process flow can composite the final reaction video.`
      );
    }

    throw error;
  });

  await runCommand(config.ffmpegBinary, [
    "-y",
    "-i",
    outputVideoPath,
    "-ss",
    "00:00:01",
    "-frames:v",
    "1",
    posterPath
  ]).catch((error: unknown) => {
    if (error instanceof Error && /ENOENT/.test(error.message)) {
      throw new Error(
        `Could not find ${config.ffmpegBinary}. Install ffmpeg or set FFMPEG_BINARY so the Process flow can export preview posters.`
      );
    }

    throw error;
  });
}
