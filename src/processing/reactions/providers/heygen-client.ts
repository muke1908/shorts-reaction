import { writeFile } from "node:fs/promises";
import type { PipelineConfig } from "../../../shared/types";

interface HeyGenErrorResponse {
  error?: {
    code?: string;
    message?: string;
  };
}

export interface HeyGenCreateVideoPayload {
  type: "avatar";
  avatar_id: string;
  script: string;
  voice_id?: string;
  title?: string;
  resolution?: "720p" | "1080p";
  aspect_ratio?: "16:9" | "9:16" | "1:1" | "4:5" | "5:4" | "auto";
}

interface HeyGenCreateVideoResponse {
  data?: {
    video_id?: string;
    status?: string;
  };
}

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

function baseUrl(config: PipelineConfig): string {
  return (config.heygenApiUrl ?? "https://api.heygen.com").replace(/\/+$/, "");
}

function createTimeoutSignal(config: PipelineConfig): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer)
  };
}

async function readError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as HeyGenErrorResponse | null;
  return body?.error?.message ?? `HeyGen request failed with ${response.status}`;
}

async function requestHeyGenJson<T>(path: string, init: RequestInit, config: PipelineConfig): Promise<T> {
  const { signal, clear } = createTimeoutSignal(config);
  try {
    const response = await fetch(`${baseUrl(config)}${path}`, {
      ...init,
      signal,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "X-Api-Key": config.heygenApiKey ?? "",
        ...(init.headers ?? {})
      }
    });

    if (!response.ok) {
      throw new Error(await readError(response));
    }

    return (await response.json()) as T;
  } finally {
    clear();
  }
}

export async function createHeyGenVideo(
  payload: HeyGenCreateVideoPayload,
  idempotencyKey: string,
  config: PipelineConfig
): Promise<string> {
  const response = await requestHeyGenJson<HeyGenCreateVideoResponse>(
    "/v3/videos",
    {
      method: "POST",
      headers: {
        "Idempotency-Key": idempotencyKey
      },
      body: JSON.stringify(payload)
    },
    config
  );
  const videoId = response.data?.video_id;
  if (!videoId) {
    throw new Error("HeyGen did not return a video_id.");
  }

  return videoId;
}

export async function getHeyGenVideo(videoId: string, config: PipelineConfig): Promise<NonNullable<HeyGenVideoResponse["data"]>> {
  const response = await requestHeyGenJson<HeyGenVideoResponse>(`/v3/videos/${encodeURIComponent(videoId)}`, {}, config);
  if (!response.data?.id || !response.data.status) {
    throw new Error("HeyGen did not return a valid video status payload.");
  }

  return response.data;
}

export async function downloadHeyGenVideo(url: string, outputPath: string, config: PipelineConfig): Promise<void> {
  const { signal, clear } = createTimeoutSignal(config);
  try {
    const response = await fetch(url, { signal });
    if (!response.ok) {
      throw new Error(`Could not download HeyGen render: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(outputPath, buffer);
  } finally {
    clear();
  }
}
