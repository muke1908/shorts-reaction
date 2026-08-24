import { readFile } from "node:fs/promises";
import type { ReactionInstructions } from "../../../shared/types";
import { normalizeReactionVideo } from "./normalize-reaction-video";
import {
  createHeyGenVideoWithCli,
  downloadHeyGenVideoWithCli,
  getHeyGenVideoWithCli,
  isHeyGenCliAuthenticated
} from "./heygen-cli";
import {
  createHeyGenVideo,
  downloadHeyGenVideo,
  getHeyGenVideo,
  type HeyGenCreateVideoPayload
} from "./heygen-client";
import type { AvatarReactionRequest, AvatarReactionSubmission } from "../provider";

function defaultTone(): { opener: string; closer: string } {
  return {
    opener: "Wow. [neutral] [blink] [nod] Okay.",
    closer: "[observe] [slight_smile] [blink] Hmm."
  };
}

function buildExpressionScript(instructions: ReactionInstructions): string {
  const tone = defaultTone();
  const beats = Math.max(4, Math.min(8, Math.round((instructions.sourceDurationSeconds ?? 6) / 2)));
  const segments = Array.from({ length: beats }, (_, index) => (index % 2 === 0 ? tone.opener : tone.closer));
  return segments.join(" ");
}

function buildPayload(request: AvatarReactionRequest, instructions: ReactionInstructions): HeyGenCreateVideoPayload {
  return {
    type: "avatar",
    avatar_id: request.config.heygenAvatarId!,
    voice_id: request.config.heygenVoiceId || undefined,
    script: buildExpressionScript(instructions),
    title: `Reaction ${request.job.short.id}`,
    resolution: "720p",
    aspect_ratio: "16:9"
  };
}

async function readInstructions(path: string): Promise<ReactionInstructions> {
  return JSON.parse(await readFile(path, "utf8")) as ReactionInstructions;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveHeyGenTransport(request: AvatarReactionRequest): Promise<"heygen-cli" | "heygen-api"> {
  if (await isHeyGenCliAuthenticated(request.config)) {
    return "heygen-cli";
  }

  if (request.config.heygenApiKey) {
    return "heygen-api";
  }

  throw new Error(
    "HeyGen is not authenticated. Run `heygen auth login --oauth` (preferred) or configure HEYGEN_API_KEY with API credits."
  );
}

export async function submitHeyGenAvatarReactionVideo(
  request: AvatarReactionRequest
): Promise<AvatarReactionSubmission> {
  const instructions = await readInstructions(request.reactionInstructionsPath);
  const transport = await resolveHeyGenTransport(request);
  const payload = buildPayload(request, instructions);
  const videoId = transport === "heygen-cli"
    ? await createHeyGenVideoWithCli(payload, request.config)
    : await createHeyGenVideo(payload, request.job.id, request.config);
  return {
    providerJobId: videoId,
    assetPath: request.providerRenderPath,
    transport
  };
}

export async function waitForHeyGenAvatarReactionVideo(
  submission: AvatarReactionSubmission,
  request: AvatarReactionRequest
): Promise<AvatarReactionSubmission> {
  if (!submission.providerJobId) {
    throw new Error("HeyGen submission is missing a provider job id.");
  }

  for (let attempt = 0; attempt < 90; attempt += 1) {
    const video = submission.transport === "heygen-cli"
      ? await getHeyGenVideoWithCli(submission.providerJobId, request.config)
      : await getHeyGenVideo(submission.providerJobId, request.config);
    if (video.status === "completed") {
      if (submission.transport === "heygen-cli") {
        await downloadHeyGenVideoWithCli(submission.providerJobId, submission.assetPath, request.config);
        return submission;
      }

      if (!video.video_url) {
        throw new Error("HeyGen marked the video as completed but did not provide a video_url.");
      }

      await downloadHeyGenVideo(video.video_url, submission.assetPath, request.config);
      return submission;
    }

    if (video.status === "failed") {
      throw new Error(video.failure_message ?? video.failure_code ?? "HeyGen video generation failed.");
    }

    await sleep(5000);
  }

  throw new Error("Timed out while waiting for HeyGen to finish rendering the reaction video.");
}

export async function normalizeHeyGenAvatarReactionVideo(
  submission: AvatarReactionSubmission,
  request: AvatarReactionRequest
): Promise<void> {
  await normalizeReactionVideo(submission.assetPath, request.outputVideoPath, request.config, "HeyGen avatar provider");
}
