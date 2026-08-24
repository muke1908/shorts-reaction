import type { PipelineConfig, ReactionJobRecord } from "../../shared/types";
import { copyFile } from "node:fs/promises";
import { updateReactionJob } from "./job-store";
import { findReusableSourceVideoPathForShort } from "./job-store";
import { downloadYoutubeShort } from "../sources/download-youtube-short";
import { composeReactionVideo } from "../composition/compose-reaction-video";
import { getJobPaths } from "../storage/paths";
import { getAvatarReactionProvider } from "../reactions/provider";
import { writeReactionInstructions } from "../reactions/reaction-instructions";
import { resolveOptionalAiCharacterStaticAssetPath } from "../reactions/providers/ai-character-provider";
import { runCommand } from "../media/run-command";

async function finalizeRecordedStageOutputVideo(
  inputVideoPath: string,
  outputVideoPath: string,
  posterPath: string,
  config: PipelineConfig
): Promise<void> {
  await runCommand(config.ffmpegBinary, [
    "-y",
    "-i",
    inputVideoPath,
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
        `Could not find ${config.ffmpegBinary}. Install ffmpeg or set FFMPEG_BINARY so the advanced reaction stage can be exported.`
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
        `Could not find ${config.ffmpegBinary}. Install ffmpeg or set FFMPEG_BINARY so the advanced reaction stage poster can be exported.`
      );
    }

    throw error;
  });
}

export async function runReactionJob(job: ReactionJobRecord, config: PipelineConfig): Promise<ReactionJobRecord> {
  const paths = getJobPaths(job.id, config);
  const avatarReactionProvider = getAvatarReactionProvider(job.reactionProvider);
  let current = await updateReactionJob(job, { status: "downloading", error: null });

  try {
    if (current.recordedStageOutput) {
      if (!current.providerInputVideoPath) {
        throw new Error("Advanced stage recording is missing its captured video.");
      }
      const recordedStageVideoPath = current.providerInputVideoPath;

      current = await updateReactionJob(current, {
        reactionVideoPath: recordedStageVideoPath,
        status: "rendering-reaction"
      });

      await finalizeRecordedStageOutputVideo(
        recordedStageVideoPath,
        paths.outputVideoPath,
        paths.posterPath,
        config
      );

      return updateReactionJob(current, {
        status: "completed",
        outputVideoPath: paths.outputVideoPath,
        posterPath: paths.posterPath
      });
    }

    const reusableSourceVideoPath = await findReusableSourceVideoPathForShort(job.shortId, config);
    if (reusableSourceVideoPath && reusableSourceVideoPath !== paths.sourceVideoPath) {
      await copyFile(reusableSourceVideoPath, paths.sourceVideoPath);
    } else {
      await downloadYoutubeShort(job.short.url, paths.sourceVideoPath, config);
    }

    current = await updateReactionJob(current, {
      sourceVideoPath: paths.sourceVideoPath,
      status: "preparing-reaction"
    });

    await writeReactionInstructions(current, paths.sourceVideoPath, paths.reactionInstructionsPath, config);
    current = await updateReactionJob(current, {
      reactionInstructionsPath: paths.reactionInstructionsPath,
      status: "rendering-reaction"
    });

    const request = {
      job: current,
      sourceVideoPath: paths.sourceVideoPath,
      reactionInstructionsPath: paths.reactionInstructionsPath,
      providerRenderPath: paths.providerRenderPath,
      outputVideoPath: paths.reactionVideoPath,
      config
    };

    avatarReactionProvider.validateRequest(request);
    await avatarReactionProvider.prepareAssets(request);
    const submission = await avatarReactionProvider.submitRender(request);
    current = await updateReactionJob(current, {
      providerRenderJobId: submission.providerJobId
    });
    const result = await avatarReactionProvider.waitForRender(submission, request);
    await avatarReactionProvider.normalizeResult(result, request);
    current = await updateReactionJob(current, {
      reactionVideoPath: paths.reactionVideoPath,
      status: "compositing"
    });

    const endVideoPath = current.reactionProvider === "ai-character"
      ? await resolveOptionalAiCharacterStaticAssetPath(config, "end")
      : null;

    await composeReactionVideo(
      paths.sourceVideoPath,
      paths.reactionVideoPath,
      endVideoPath,
      paths.outputVideoPath,
      paths.posterPath,
      config
    );

    return updateReactionJob(current, {
      status: "completed",
      outputVideoPath: paths.outputVideoPath,
      posterPath: paths.posterPath
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return updateReactionJob(current, {
      status: "failed",
      error: message
    });
  }
}
