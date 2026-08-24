import type { PipelineConfig, ReactionJobRecord, ShortRecord } from "../../shared/types";
import { createReactionJob, findLatestJobForShort } from "./job-store";
import { runReactionJob } from "./run-job";

const activeJobs = new Map<string, Promise<ReactionJobRecord>>();

export async function startReactionJob(
  short: ShortRecord,
  requestedDay: string | null,
  config: PipelineConfig
): Promise<ReactionJobRecord> {
  const existing = await findLatestJobForShort(short.id, requestedDay, config);
  if (existing && ["pending", "downloading", "compositing"].includes(existing.status)) {
    return existing;
  }

  const job = await createReactionJob(short, requestedDay, config);
  const running = runReactionJob(job, config).finally(() => {
    activeJobs.delete(job.id);
  });
  activeJobs.set(job.id, running);
  return job;
}

export function isReactionJobRunning(jobId: string): boolean {
  return activeJobs.has(jobId);
}
