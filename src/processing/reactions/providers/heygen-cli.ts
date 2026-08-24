import { spawn } from "node:child_process";
import type { PipelineConfig } from "../../../shared/types";
import type { HeyGenCreateVideoPayload } from "./heygen-client";

interface HeyGenVideoResponse {
  data?: {
    id?: string;
    status?: "pending" | "processing" | "completed" | "failed";
    video_url?: string | null;
    duration?: number | null;
    failure_code?: string | null;
    failure_message?: string | null;
  };
}

interface HeyGenCreateVideoResponse {
  data?: {
    video_id?: string;
    status?: string;
  };
}

interface CommandResult {
  stdout: string;
  stderr: string;
}

function heygenBinary(config: PipelineConfig): string {
  return config.heygenCliBinary ?? "heygen";
}

function cliEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.HEYGEN_API_KEY;
  return env;
}

function runHeyGenCliCommand(config: PipelineConfig, args: string[]): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(heygenBinary(config), args, {
      stdio: "pipe",
      env: cliEnv()
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(new Error(stderr.trim() || stdout.trim() || `${heygenBinary(config)} ${args.join(" ")} failed with exit code ${code ?? "unknown"}`));
    });
  });
}

function parseJson<T>(stdout: string, label: string): T {
  try {
    return JSON.parse(stdout) as T;
  } catch {
    throw new Error(`HeyGen CLI returned invalid JSON for ${label}.`);
  }
}

export async function isHeyGenCliAuthenticated(config: PipelineConfig): Promise<boolean> {
  try {
    await runHeyGenCliCommand(config, ["auth", "status"]);
    return true;
  } catch {
    return false;
  }
}

export async function createHeyGenVideoWithCli(
  payload: HeyGenCreateVideoPayload,
  config: PipelineConfig
): Promise<string> {
  const { stdout } = await runHeyGenCliCommand(config, ["video", "create", "-d", JSON.stringify(payload)]);
  const response = parseJson<HeyGenCreateVideoResponse>(stdout, "video create");
  const videoId = response.data?.video_id;
  if (!videoId) {
    throw new Error("HeyGen CLI did not return a video_id.");
  }

  return videoId;
}

export async function getHeyGenVideoWithCli(
  videoId: string,
  config: PipelineConfig
): Promise<NonNullable<HeyGenVideoResponse["data"]>> {
  const { stdout } = await runHeyGenCliCommand(config, ["video", "get", videoId]);
  const response = parseJson<HeyGenVideoResponse>(stdout, "video get");
  if (!response.data?.id || !response.data.status) {
    throw new Error("HeyGen CLI did not return a valid video status payload.");
  }

  return response.data;
}

export async function downloadHeyGenVideoWithCli(
  videoId: string,
  outputPath: string,
  config: PipelineConfig
): Promise<void> {
  await runHeyGenCliCommand(config, ["video", "download", videoId, "--output-path", outputPath]);
}
