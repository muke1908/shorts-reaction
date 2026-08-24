import express from "express";
import type { ProcessShortRequest } from "../shared/types";
import { relative } from "node:path";
import { runMasterAgent } from "../agents/master-agent";
import { getCopilotRuntimeStatus, resetCopilotRuntimeStatus } from "../copilot/client";
import type { CopilotRuntimeStatus, PipelineConfig } from "../shared/types";
import { findLatestJobForShort, getReactionJob } from "../processing/jobs/job-store";
import { startReactionJob } from "../processing/jobs/create-job";
import type { GeneratedVideoSummary } from "../shared/types";
import { findShortRecord, listAvailableDays, loadDumpByDay, loadLatestDump } from "./load-dumps";

let activeScan: Promise<Awaited<ReturnType<typeof runMasterAgent>>> | null = null;
let lastCopilotStatus: CopilotRuntimeStatus = getCopilotRuntimeStatus();

async function runLatestScan(config: PipelineConfig) {
  if (!activeScan) {
    resetCopilotRuntimeStatus();
    lastCopilotStatus = getCopilotRuntimeStatus();
    activeScan = runMasterAgent({
      ...config,
      requestedDay: null
    })
      .finally(() => {
        lastCopilotStatus = getCopilotRuntimeStatus();
        activeScan = null;
      });
  }

  return activeScan;
}

function toGeneratedSummary(config: PipelineConfig, record: Awaited<ReturnType<typeof getReactionJob>>): GeneratedVideoSummary | null {
  if (!record) {
    return null;
  }

  const toPublicUrl = (path: string | null): string | null => {
    if (!path) {
      return null;
    }

    const relativePath = relative(config.generatedDir, path).replaceAll("\\", "/");
    return `/generated/${relativePath}`;
  };

  return {
    latestJobId: record.id,
    status: record.status,
    outputUrl: toPublicUrl(record.outputVideoPath),
    posterUrl: toPublicUrl(record.posterPath),
    updatedAt: record.updatedAt,
    error: record.error
  };
}

export function createApiRouter(config: PipelineConfig): express.Router {
  const router = express.Router();
  router.use(express.json({ limit: "50mb" }));

  router.get("/health", (_request, response) => {
    response.json({ ok: true });
  });

  router.get("/copilot/status", (_request, response) => {
    const status = getCopilotRuntimeStatus();
    if (!status.active && !status.startedAt && lastCopilotStatus.startedAt) {
      response.json(lastCopilotStatus);
      return;
    }

    lastCopilotStatus = status;
    response.json(status);
  });

  router.get("/days", async (_request, response, next) => {
    try {
      response.json({ days: await listAvailableDays(config.outputDir) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/dump", async (request, response, next) => {
    try {
      const day = typeof request.query.day === "string" ? request.query.day : undefined;
      const dump = day ? await loadDumpByDay(config.outputDir, day) : await loadLatestDump(config.outputDir);
      response.json(dump);
    } catch (error) {
      next(error);
    }
  });

  router.post("/scan", async (_request, response, next) => {
    try {
      const result = await runLatestScan(config);
      response.status(201).json(result.dump);
    } catch (error) {
      next(error);
    }
  });

  router.post("/process/:shortId", async (request, response, next) => {
    try {
      const body = (request.body ?? {}) as ProcessShortRequest;
      const day = typeof body.day === "string" ? body.day : undefined;
      const short = await findShortRecord(config.outputDir, request.params.shortId, day);
      if (!short) {
        response.status(404).json({ error: "Short not found in the selected dump." });
        return;
      }

      const reactionProvider = body.reactionProvider ?? "dummy";
      if (reactionProvider === "user-media" && !body.userMedia?.base64) {
        response.status(400).json({ error: "Record a user video before using the UserMediaProvider." });
        return;
      }

      const job = await startReactionJob(short, day ?? null, {
        reactionProvider,
        userMedia: body.userMedia ?? null
      }, config);
      response.status(202).json(job);
    } catch (error) {
      next(error);
    }
  });

  router.get("/process/:jobId", async (request, response, next) => {
    try {
      const job = await getReactionJob(request.params.jobId, config);
      if (!job) {
        response.status(404).json({ error: "Job not found." });
        return;
      }

      response.json(job);
    } catch (error) {
      next(error);
    }
  });

  router.get("/process/by-short/:shortId", async (request, response, next) => {
    try {
      const day = typeof request.query.day === "string" ? request.query.day : null;
      response.json(toGeneratedSummary(config, await findLatestJobForShort(request.params.shortId, day, config)));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
