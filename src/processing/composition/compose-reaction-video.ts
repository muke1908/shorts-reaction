import type { PipelineConfig } from "../../shared/types";
import { probeMediaDurationSeconds, probeMediaHasAudioStream } from "../media/probe-media";
import { runCommand } from "../media/run-command";

function withPauseOverlay(inputLabel: string, outputLabel: string, enableExpression: string): string {
  const escapedEnable = enableExpression.replaceAll("'", "\\'");
  return [
    `[${inputLabel}]drawbox=x=iw/2-84:y=ih/2-84:w=168:h=168:color=black@0.2:t=fill:enable='${escapedEnable}'`,
    `drawbox=x=iw/2-36:y=ih/2-54:w=24:h=108:color=white@0.78:t=fill:enable='${escapedEnable}'`,
    `drawbox=x=iw/2+12:y=ih/2-54:w=24:h=108:color=white@0.78:t=fill:enable='${escapedEnable}'[${outputLabel}]`
  ].join(",");
}

export async function composeReactionVideo(
  sourceVideoPath: string,
  startVideoPath: string,
  endVideoPath: string | null,
  outputVideoPath: string,
  posterPath: string,
  config: PipelineConfig
): Promise<void> {
  const sourceHasAudio = await probeMediaHasAudioStream(sourceVideoPath, config);
  const reactionHasAudio = await probeMediaHasAudioStream(startVideoPath, config);
  const endingHasAudio = endVideoPath
    ? await probeMediaHasAudioStream(endVideoPath, config)
    : false;
  let filterComplex: string;
  const args = [
    "-y",
    "-i",
    sourceVideoPath,
    "-i",
    startVideoPath,
  ];
  const sourceDuration = await probeMediaDurationSeconds(sourceVideoPath, config);
  const reactionDuration = await probeMediaDurationSeconds(startVideoPath, config);
  const sourceLeadSeconds = 4;
  const endClipLeadSeconds = 1;
  const sourceStopTime = sourceDuration + sourceLeadSeconds;
  const endingStartTime = Math.max(sourceLeadSeconds, sourceStopTime - endClipLeadSeconds);
  const endingDuration = endVideoPath
    ? await probeMediaDurationSeconds(endVideoPath, config)
    : 0;
  const outputDuration = endVideoPath
    ? Math.max(sourceStopTime, endingStartTime + endingDuration)
    : sourceStopTime;
  const topFreezeSeconds = Math.max(0, outputDuration - sourceStopTime);
  const reactionDisplayDuration = endVideoPath ? endingStartTime : sourceStopTime;
  const reactionPadSeconds = Math.max(0, reactionDisplayDuration - reactionDuration);
  const endingPadSeconds = endVideoPath ? Math.max(0, outputDuration - (endingStartTime + endingDuration)) : 0;
  let audioMap: string | null = null;

  if (endVideoPath) {
    args.push(
      "-i",
      endVideoPath,
      "-filter_complex"
    );

    const videoFilter = [
      `[0:v]scale=1080:1152:force_original_aspect_ratio=decrease,pad=1080:1152:(ow-iw)/2:(oh-ih)/2:black,tpad=start_duration=${sourceLeadSeconds}:start_mode=clone${topFreezeSeconds > 0 ? `:stop_mode=clone:stop_duration=${topFreezeSeconds.toFixed(3)}` : ""}[topbase]`,
      withPauseOverlay("topbase", "top", `lt(t,${sourceLeadSeconds.toFixed(3)})+gte(t,${sourceStopTime.toFixed(3)})`),
      `[1:v]scale=1080:768:force_original_aspect_ratio=increase,crop=1080:768,trim=duration=${reactionDisplayDuration.toFixed(3)},setpts=PTS-STARTPTS${reactionPadSeconds > 0 ? `,tpad=stop_mode=clone:stop_duration=${reactionPadSeconds.toFixed(3)}` : ""}[bottommainbase]`,
      withPauseOverlay("bottommainbase", "bottommain", `gte(t,${Math.min(reactionDuration, reactionDisplayDuration).toFixed(3)})`),
      `[2:v]scale=1080:768:force_original_aspect_ratio=increase,crop=1080:768,setpts=PTS-STARTPTS${endingPadSeconds > 0 ? `,tpad=stop_mode=clone:stop_duration=${endingPadSeconds.toFixed(3)}` : ""}[bottomending]`,
      "[bottommain][bottomending]concat=n=2:v=1:a=0[bottom]",
      "[top][bottom]vstack=inputs=2[v]"
    ].join(";");

    const sourceAudioChain = sourceHasAudio
      ? `[0:a]aresample=async=1:first_pts=0,volume=0.9,adelay=${sourceLeadSeconds * 1000}:all=1,apad=whole_dur=${outputDuration.toFixed(3)}[sourcea]`
      : null;
    const reactionAudioBase = reactionHasAudio
      ? `[1:a]aresample=async=1:first_pts=0,volume=1.0,atrim=duration=${reactionDisplayDuration.toFixed(3)},apad=whole_dur=${outputDuration.toFixed(3)}[reactionbasea]`
      : null;
    const endingAudioBase = endingHasAudio
      ? `[2:a]aresample=async=1:first_pts=0,volume=1.0,adelay=${Math.round(endingStartTime * 1000)}:all=1,apad=whole_dur=${outputDuration.toFixed(3)}[endinga]`
      : null;

    if (reactionAudioBase && endingAudioBase && sourceAudioChain) {
      filterComplex = `${videoFilter};${sourceAudioChain};${reactionAudioBase};${endingAudioBase};[reactionbasea][endinga]amix=inputs=2:duration=longest:normalize=0[reactiona];[sourcea][reactiona]amix=inputs=2:duration=longest:normalize=0[a]`;
      audioMap = "[a]";
    } else if (reactionAudioBase && endingAudioBase) {
      filterComplex = `${videoFilter};${reactionAudioBase};${endingAudioBase};[reactionbasea][endinga]amix=inputs=2:duration=longest:normalize=0[a]`;
      audioMap = "[a]";
    } else if (sourceAudioChain && reactionAudioBase) {
      filterComplex = `${videoFilter};${sourceAudioChain};${reactionAudioBase};[sourcea][reactionbasea]amix=inputs=2:duration=longest:normalize=0[a]`;
      audioMap = "[a]";
    } else if (sourceAudioChain && endingAudioBase) {
      filterComplex = `${videoFilter};${sourceAudioChain};${endingAudioBase};[sourcea][endinga]amix=inputs=2:duration=longest:normalize=0[a]`;
      audioMap = "[a]";
    } else if (sourceAudioChain) {
      filterComplex = `${videoFilter};${sourceAudioChain};[sourcea]anull[a]`;
      audioMap = "[a]";
    } else if (reactionAudioBase && endingAudioBase) {
      filterComplex = `${videoFilter};${reactionAudioBase};${endingAudioBase};[reactionbasea][endinga]amix=inputs=2:duration=longest:normalize=0[a]`;
      audioMap = "[a]";
    } else if (reactionAudioBase) {
      filterComplex = `${videoFilter};${reactionAudioBase};[reactionbasea]anull[a]`;
      audioMap = "[a]";
    } else if (endingAudioBase) {
      filterComplex = `${videoFilter};${endingAudioBase};[endinga]anull[a]`;
      audioMap = "[a]";
    } else {
      filterComplex = videoFilter;
    }
  } else {
    args.push("-filter_complex");

    const videoFilter = [
      `[0:v]scale=1080:1152:force_original_aspect_ratio=decrease,pad=1080:1152:(ow-iw)/2:(oh-ih)/2:black,tpad=start_duration=${sourceLeadSeconds}:start_mode=clone[topbase]`,
      withPauseOverlay("topbase", "top", `lt(t,${sourceLeadSeconds.toFixed(3)})`),
      `[1:v]scale=1080:768:force_original_aspect_ratio=increase,crop=1080:768${reactionPadSeconds > 0 ? `,tpad=stop_mode=clone:stop_duration=${reactionPadSeconds.toFixed(3)}` : ""}[bottombase]`,
      withPauseOverlay("bottombase", "bottom", `gte(t,${reactionDuration.toFixed(3)})`),
      "[top][bottom]vstack=inputs=2[v]"
    ].join(";");

    const sourceAudioChain = sourceHasAudio
      ? `[0:a]aresample=async=1:first_pts=0,volume=0.9,adelay=${sourceLeadSeconds * 1000}:all=1,apad=whole_dur=${outputDuration.toFixed(3)}[sourcea]`
      : null;
    const reactionAudioChain = reactionHasAudio
      ? `[1:a]aresample=async=1:first_pts=0,volume=1.0,apad=whole_dur=${outputDuration.toFixed(3)}[reactiona]`
      : null;

    if (sourceAudioChain && reactionAudioChain) {
      filterComplex = `${videoFilter};${sourceAudioChain};${reactionAudioChain};[sourcea][reactiona]amix=inputs=2:duration=longest:normalize=0[a]`;
      audioMap = "[a]";
    } else if (sourceAudioChain) {
      filterComplex = `${videoFilter};${sourceAudioChain};[sourcea]anull[a]`;
      audioMap = "[a]";
    } else if (reactionAudioChain) {
      filterComplex = `${videoFilter};${reactionAudioChain};[reactiona]anull[a]`;
      audioMap = "[a]";
    } else {
      filterComplex = videoFilter;
    }
  }

  args.push(
    filterComplex,
    "-map",
    "[v]"
  );

  if (audioMap) {
    args.push("-map", audioMap);
  }

  args.push(
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p"
  );

  if (audioMap) {
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
