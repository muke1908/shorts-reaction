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

export async function runReactionJob(job: ReactionJobRecord, config: PipelineConfig): Promise<ReactionJobRecord> {
  const paths = getJobPaths(job.id, config);
  const avatarReactionProvider = getAvatarReactionProvider(job.reactionProvider);
  let current = await updateReactionJob(job, { status: "downloading", error: null });

  try {
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
