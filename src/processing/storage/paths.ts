import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { PipelineConfig } from "../../shared/types";

export interface JobPaths {
  jobDir: string;
  manifestPath: string;
  sourceVideoPath: string;
  providerInputVideoPath: string;
  reactionVideoPath: string;
  outputVideoPath: string;
  posterPath: string;
}

export function getJobsRoot(config: PipelineConfig): string {
  return resolve(config.generatedDir, "jobs");
}

export function getJobPaths(jobId: string, config: PipelineConfig): JobPaths {
  const jobDir = resolve(getJobsRoot(config), jobId);
  return {
    jobDir,
    manifestPath: resolve(jobDir, "manifest.json"),
    sourceVideoPath: resolve(jobDir, "source.mp4"),
    providerInputVideoPath: resolve(jobDir, "provider-input.webm"),
    reactionVideoPath: resolve(jobDir, "reaction.mp4"),
    outputVideoPath: resolve(jobDir, "output.mp4"),
    posterPath: resolve(jobDir, "poster.jpg")
  };
}

export async function ensureJobDirectory(jobId: string, config: PipelineConfig): Promise<JobPaths> {
  const paths = getJobPaths(jobId, config);
  await mkdir(paths.jobDir, { recursive: true });
  return paths;
}
