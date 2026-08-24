import type { PipelineConfig, ReactionJobRecord, ShortRecord } from "../../shared/types";
import { createReactionJob, findLatestJobForShort } from "./job-store";
import { runReactionJob } from "./run-job";
import { writeFile } from "node:fs/promises";
import { getJobPaths } from "../storage/paths";

interface StartReactionJobOptions {
  reactionProvider: ReactionJobRecord["reactionProvider"];
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
    options.reactionProvider === "ai-character" &&
    ["pending", "downloading", "preparing-reaction", "rendering-reaction", "compositing"].includes(existing.status)
  ) {
    return existing;
  }

  const job = await createReactionJob(
    short,
    requestedDay,
    options.reactionProvider,
    config
  );
  if (options.reactionProvider === "user-media") {
    if (!options.userMedia?.base64 || !options.userMedia.mimeType.startsWith("video/")) {
      throw new Error("This provider requires a recorded video capture.");
    }

    const paths = getJobPaths(job.id, config);
    const providerInputVideoPath = paths.providerInputVideoPath.replace(/\.webm$/, extensionForMimeType(options.userMedia.mimeType));
    await writeFile(providerInputVideoPath, Buffer.from(options.userMedia.base64, "base64"));
    job.providerInputVideoPath = providerInputVideoPath;
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
