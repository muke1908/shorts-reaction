import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import type { PipelineConfig, ReactionJobRecord, ShortRecord } from "../../shared/types";
import { ensureJobDirectory, getJobsRoot, getJobPaths } from "../storage/paths";

function now(): string {
  return new Date().toISOString();
}

function createJobId(): string {
  return `job-${Date.now()}-${randomBytes(4).toString("hex")}`;
}

async function pathExists(path: string | null): Promise<boolean> {
  if (!path) {
    return false;
  }

  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function writeManifest(job: ReactionJobRecord): Promise<void> {
  await writeFile(job.manifestPath, `${JSON.stringify(job, null, 2)}\n`, "utf8");
}

export async function createReactionJob(
  short: ShortRecord,
  requestedDay: string | null,
  reactionProvider: ReactionJobRecord["reactionProvider"],
  recordedStageOutput: boolean,
  config: PipelineConfig
): Promise<ReactionJobRecord> {
  await mkdir(getJobsRoot(config), { recursive: true });
  const id = createJobId();
  const paths = await ensureJobDirectory(id, config);
  const timestamp = now();

  const job: ReactionJobRecord = {
    id,
    shortId: short.id,
    requestedDay,
    reactionProvider,
    short: {
      id: short.id,
      title: short.title,
      url: short.url,
      channel: short.channel,
      publishedAt: short.publishedAt,
      captureTimestamp: short.captureTimestamp,
      score: short.score,
      scoreBreakdown: short.scoreBreakdown
    },
    status: "pending",
    sourceVideoPath: null,
    providerInputVideoPath: null,
    recordedStageOutput,
    providerRenderJobId: null,
    reactionVideoPath: null,
    outputVideoPath: null,
    posterPath: null,
    manifestPath: paths.manifestPath,
    workingDirectory: paths.jobDir,
    createdAt: timestamp,
    updatedAt: timestamp,
    error: null
  };

  await writeManifest(job);
  return job;
}

export async function updateReactionJob(
  job: ReactionJobRecord,
  patch: Partial<Omit<ReactionJobRecord, "id" | "manifestPath" | "workingDirectory" | "createdAt" | "short" | "shortId" | "requestedDay">>
): Promise<ReactionJobRecord> {
  const next: ReactionJobRecord = {
    ...job,
    ...patch,
    updatedAt: now()
  };
  await writeManifest(next);
  return next;
}

export async function getReactionJob(jobId: string, config: PipelineConfig): Promise<ReactionJobRecord | null> {
  const path = getJobPaths(jobId, config).manifestPath;
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as ReactionJobRecord;
  } catch {
    return null;
  }
}

export async function findLatestJobForShort(
  shortId: string,
  requestedDay: string | null,
  config: PipelineConfig
): Promise<ReactionJobRecord | null> {
  const root = getJobsRoot(config);
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const jobs: ReactionJobRecord[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const manifestPath = resolve(root, entry.name, "manifest.json");
    try {
      const raw = await readFile(manifestPath, "utf8");
      const job = JSON.parse(raw) as ReactionJobRecord;
      if (job.shortId === shortId && job.requestedDay === requestedDay) {
        jobs.push(job);
      }
    } catch {
      // Ignore broken manifests so one bad job does not hide others.
    }
  }

  return jobs.sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
}

export async function findReusableSourceVideoPathForShort(
  shortId: string,
  config: PipelineConfig
): Promise<string | null> {
  const root = getJobsRoot(config);
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const jobs: ReactionJobRecord[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const manifestPath = resolve(root, entry.name, "manifest.json");
    try {
      const raw = await readFile(manifestPath, "utf8");
      const job = JSON.parse(raw) as ReactionJobRecord;
      if (job.shortId === shortId && (await pathExists(job.sourceVideoPath))) {
        jobs.push(job);
      }
    } catch {
      // Ignore broken manifests so one bad job does not hide others.
    }
  }

  return jobs.sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]?.sourceVideoPath ?? null;
}
