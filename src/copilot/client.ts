import { spawn } from "node:child_process";
import { access, readFile, readdir, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type {
  CopilotInvocationSnapshot,
  CopilotRuntimeStatus,
  CopilotUsageTotals,
  PipelineConfig
} from "../shared/types";

interface CopilotJsonEvent {
  type?: string;
  data?: {
    message?: {
      content?: string;
    };
  };
}

interface CopilotUsageFile {
  totalPremiumRequestCost?: number;
  totalNanoAiu?: number;
  totalApiDurationMs?: number;
  currentModel?: string;
  lastCallInputTokens?: number;
  lastCallOutputTokens?: number;
  modelMetrics?: Record<
    string,
    {
      usage?: {
        inputTokens?: number;
        outputTokens?: number;
        cacheReadTokens?: number;
        cacheWriteTokens?: number;
        reasoningTokens?: number;
      };
    }
  >;
}

const emptyUsageTotals = (): CopilotUsageTotals => ({
  premiumRequests: 0,
  nanoAiu: 0,
  apiDurationMs: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  reasoningTokens: 0,
  lastCallInputTokens: 0,
  lastCallOutputTokens: 0
});

let runtimeStatus: CopilotRuntimeStatus = {
  active: false,
  phase: null,
  pid: null,
  binary: null,
  model: null,
  startedAt: null,
  finishedAt: null,
  lastUpdatedAt: new Date(0).toISOString(),
  completedInvocations: 0,
  totals: emptyUsageTotals(),
  lastInvocation: null,
  error: null
};

async function isExecutable(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function compareVersionDesc(left: string, right: string): number {
  const normalize = (value: string) =>
    value
      .split(/[^0-9]+/)
      .filter(Boolean)
      .map((part) => Number(part));

  const leftParts = normalize(left);
  const rightParts = normalize(right);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const delta = (rightParts[index] ?? 0) - (leftParts[index] ?? 0);
    if (delta !== 0) {
      return delta;
    }
  }

  return right.localeCompare(left);
}

async function resolveCopilotBinary(config: PipelineConfig): Promise<string> {
  if (config.copilotCliBinary) {
    return config.copilotCliBinary;
  }

  const installsDir = join(homedir(), ".copilot-cli");
  try {
    const versions = (await readdir(installsDir, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort(compareVersionDesc);

    for (const version of versions) {
      const candidate = join(installsDir, version, "copilot");
      if (await isExecutable(candidate)) {
        return candidate;
      }
    }
  } catch {
    // Fall through to PATH lookup name below.
  }

  return "copilot";
}

function runCopilotPrompt(prompt: string, config: PipelineConfig): Promise<string> {
  return new Promise(async (resolve, reject) => {
    const binary = await resolveCopilotBinary(config);
    const usageFile = join(tmpdir(), `copilot-usage-${randomUUID()}.json`);
    const args = [
      "-C",
      process.cwd(),
      "--allow-all",
      "--silent",
      "--stream",
      "off",
      "--output-format",
      "json",
      "--usage-output-file",
      usageFile,
      "--disable-builtin-mcps",
      "--no-custom-instructions",
      "-p",
      prompt
    ];

    if (config.copilotModel) {
      args.unshift(config.copilotModel);
      args.unshift("--model");
    }

    const child = spawn(binary, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const phase = currentPhase;
    const startedAt = new Date().toISOString();
    const model = config.copilotModel ?? null;
    updateRuntimeStatus({
      active: true,
      phase,
      pid: child.pid ?? null,
      binary,
      model,
      startedAt,
      finishedAt: null,
      error: null
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      reject(error);
    });
    child.on("close", async (code) => {
      const finishedAt = new Date().toISOString();
      const usageTotals = await loadUsageTotals(usageFile, model);
      await rm(usageFile, { force: true }).catch(() => undefined);

      if (code !== 0) {
        updateRuntimeStatus({
          active: false,
          phase: null,
          pid: null,
          finishedAt,
          error: stderr.trim() || `Copilot CLI exited with code ${code}`
        }, usageTotals, {
          phase,
          pid: child.pid ?? null,
          model,
          startedAt,
          finishedAt,
          totals: usageTotals
        });
        reject(new Error(`Copilot CLI review failed with exit code ${code}: ${stderr.trim() || "no stderr output"}`));
        return;
      }

      const output = extractResponseText(stdout);
      if (!output) {
        updateRuntimeStatus({
          active: false,
          phase: null,
          pid: null,
          finishedAt,
          error: "Copilot CLI returned an empty response."
        }, usageTotals, {
          phase,
          pid: child.pid ?? null,
          model,
          startedAt,
          finishedAt,
          totals: usageTotals
        });
        reject(new Error("Copilot CLI returned an empty response."));
        return;
      }

      updateRuntimeStatus({
        active: false,
        phase: null,
        pid: null,
        finishedAt,
        error: null
      }, usageTotals, {
        phase,
        pid: child.pid ?? null,
        model,
        startedAt,
        finishedAt,
        totals: usageTotals
      });
      resolve(output);
    });
  });
}

let currentPhase = "unspecified";

function updateRuntimeStatus(
  patch: Partial<CopilotRuntimeStatus>,
  usageTotals?: CopilotUsageTotals,
  invocation?: CopilotInvocationSnapshot
): void {
  runtimeStatus = {
    ...runtimeStatus,
    ...patch,
    lastUpdatedAt: new Date().toISOString(),
    totals: usageTotals ? addUsageTotals(runtimeStatus.totals, usageTotals) : runtimeStatus.totals,
    completedInvocations: invocation ? runtimeStatus.completedInvocations + 1 : runtimeStatus.completedInvocations,
    lastInvocation: invocation ?? runtimeStatus.lastInvocation
  };
}

function addUsageTotals(left: CopilotUsageTotals, right: CopilotUsageTotals): CopilotUsageTotals {
  return {
    premiumRequests: left.premiumRequests + right.premiumRequests,
    nanoAiu: left.nanoAiu + right.nanoAiu,
    apiDurationMs: left.apiDurationMs + right.apiDurationMs,
    inputTokens: left.inputTokens + right.inputTokens,
    outputTokens: left.outputTokens + right.outputTokens,
    cacheReadTokens: left.cacheReadTokens + right.cacheReadTokens,
    cacheWriteTokens: left.cacheWriteTokens + right.cacheWriteTokens,
    reasoningTokens: left.reasoningTokens + right.reasoningTokens,
    lastCallInputTokens: right.lastCallInputTokens || left.lastCallInputTokens,
    lastCallOutputTokens: right.lastCallOutputTokens || left.lastCallOutputTokens
  };
}

async function loadUsageTotals(path: string, fallbackModel: string | null): Promise<CopilotUsageTotals> {
  try {
    const data = JSON.parse(await readFile(path, "utf8")) as CopilotUsageFile;
    const modelName = data.currentModel ?? fallbackModel ?? Object.keys(data.modelMetrics ?? {})[0];
    const usage = modelName ? data.modelMetrics?.[modelName]?.usage : undefined;

    return {
      premiumRequests: data.totalPremiumRequestCost ?? 0,
      nanoAiu: data.totalNanoAiu ?? 0,
      apiDurationMs: data.totalApiDurationMs ?? 0,
      inputTokens: usage?.inputTokens ?? 0,
      outputTokens: usage?.outputTokens ?? 0,
      cacheReadTokens: usage?.cacheReadTokens ?? 0,
      cacheWriteTokens: usage?.cacheWriteTokens ?? 0,
      reasoningTokens: usage?.reasoningTokens ?? 0,
      lastCallInputTokens: data.lastCallInputTokens ?? 0,
      lastCallOutputTokens: data.lastCallOutputTokens ?? 0
    };
  } catch {
    return emptyUsageTotals();
  }
}

function extractResponseText(stdout: string): string {
  let finalMessage = "";
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    try {
      const event = JSON.parse(trimmed) as CopilotJsonEvent;
      if (event.type === "model.message" && typeof event.data?.message?.content === "string") {
        finalMessage = event.data.message.content;
      }
    } catch {
      // Ignore non-JSON lines in the stream.
    }
  }

  return finalMessage.trim();
}

function composePrompt(systemPrompt: string, userPrompt: string): string {
  return [
    "System instructions:",
    systemPrompt,
    "",
    "User request:",
    userPrompt,
    "",
    "Do not use tools. Do not inspect files. Use only the provided text context."
  ].join("\n");
}

export async function requestTextFromCopilot(
  systemPrompt: string,
  userPrompt: string,
  config: PipelineConfig,
  phase = "unspecified"
): Promise<string> {
  currentPhase = phase;
  return runCopilotPrompt(composePrompt(systemPrompt, userPrompt), config);
}

export async function requestJsonFromCopilot<T>(
  systemPrompt: string,
  userPrompt: string,
  config: PipelineConfig,
  phase = "unspecified"
): Promise<T> {
  const responseText = await requestTextFromCopilot(systemPrompt, userPrompt, config, phase);

  try {
    return JSON.parse(responseText) as T;
  } catch (error) {
    throw new Error(
      `Copilot CLI returned non-JSON output. ${error instanceof Error ? error.message : String(error)}\nResponse:\n${responseText}`
    );
  }
}

export function getCopilotRuntimeStatus(): CopilotRuntimeStatus {
  return structuredClone(runtimeStatus);
}

export function resetCopilotRuntimeStatus(): void {
  runtimeStatus = {
    active: false,
    phase: null,
    pid: null,
    binary: null,
    model: null,
    startedAt: null,
    finishedAt: null,
    lastUpdatedAt: new Date().toISOString(),
    completedInvocations: 0,
    totals: emptyUsageTotals(),
    lastInvocation: null,
    error: null
  };
}
