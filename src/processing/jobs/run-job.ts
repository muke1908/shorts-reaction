import type { PipelineConfig, ReactionJobRecord } from "../../shared/types";
import { updateReactionJob } from "./job-store";
import { downloadYoutubeShort } from "../sources/download-youtube-short";
import { composeReactionVideo } from "../composition/compose-reaction-video";
import { getJobPaths } from "../storage/paths";

export async function runReactionJob(job: ReactionJobRecord, config: PipelineConfig): Promise<ReactionJobRecord> {
  const paths = getJobPaths(job.id, config);
  let current = await updateReactionJob(job, { status: "downloading", error: null });

  try {
    await downloadYoutubeShort(job.short.url, paths.sourceVideoPath, config);
    current = await updateReactionJob(current, {
      sourceVideoPath: paths.sourceVideoPath,
      status: "compositing"
    });

    await composeReactionVideo(
      paths.sourceVideoPath,
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
