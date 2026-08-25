import type { PipelineConfig, ReactionJobRecord, ShortRecord } from "../../shared/types";
import { providerRequiresUserMedia } from "../../shared/reaction-providers";
import { createReactionJob, findLatestJobForShort } from "./job-store";
import { runReactionJob } from "./run-job";
import { rm, writeFile } from "node:fs/promises";
import { getJobPaths } from "../storage/paths";
import { exportVideoAsMp4 } from "../media/export-video-as-mp4";

interface StartReactionJobOptions {
  reactionProvider: ReactionJobRecord["reactionProvider"];
  recordedStageOutput?: boolean;
  userMedia?: {
    mimeType: string;
    base64: string;
  } | null;
}

const activeJobs = new Map<string, Promise<ReactionJobRecord>>();

function extensionForMimeType(mimeType: string): string {
  if (mimeType.includes("mp4")) {
    return ".mp4";
  }

  if (mimeType.includes("quicktime")) {
    return ".mov";
  }

  return ".webm";
}

export async function startReactionJob(
  short: ShortRecord,
  requestedDay: string | null,
  options: StartReactionJobOptions,
  config: PipelineConfig
): Promise<ReactionJobRecord> {
  const existing = await findLatestJobForShort(short.id, requestedDay, config);
  if (
    existing &&
    existing.reactionProvider === options.reactionProvider &&
    !providerRequiresUserMedia(options.reactionProvider) &&
    ["pending", "downloading", "preparing-reaction", "rendering-reaction", "compositing"].includes(existing.status)
  ) {
    return existing;
  }

  const job = await createReactionJob(
    short,
    requestedDay,
    options.reactionProvider,
    options.recordedStageOutput ?? false,
    config
  );
  if (providerRequiresUserMedia(options.reactionProvider)) {
    if (!options.userMedia?.base64 || !options.userMedia.mimeType.startsWith("video/")) {
      throw new Error("This provider requires a recorded video capture.");
    }

    const paths = getJobPaths(job.id, config);
    const uploadedInputPath = `${paths.providerInputVideoPath}.upload${extensionForMimeType(options.userMedia.mimeType)}`;
    await writeFile(uploadedInputPath, Buffer.from(options.userMedia.base64, "base64"));
    try {
      await exportVideoAsMp4(
        uploadedInputPath,
        paths.providerInputVideoPath,
        config,
        "recorded reaction input"
      );
    } finally {
      await rm(uploadedInputPath, { force: true }).catch(() => undefined);
    }
    job.providerInputVideoPath = paths.providerInputVideoPath;
  }

  const running = runReactionJob(job, config).finally(() => {
    activeJobs.delete(job.id);
  });
  activeJobs.set(job.id, running);
  return job;
}

export function isReactionJobRunning(jobId: string): boolean {
  return activeJobs.has(jobId);
}
