import type { AvatarReactionProviderKind, PipelineConfig, ReactionJobRecord } from "../../shared/types";
import { copyFile } from "node:fs/promises";
import { createAiCharacterReactionVideo } from "./providers/ai-character-provider";
import {
  normalizeHeyGenAvatarReactionVideo,
  submitHeyGenAvatarReactionVideo,
  waitForHeyGenAvatarReactionVideo
} from "./providers/heygen-avatar-provider";
import { createUserMediaReactionVideo } from "./providers/user-media-provider";

export interface AvatarReactionRequest {
  job: ReactionJobRecord;
  sourceVideoPath: string;
  reactionInstructionsPath: string;
  providerRenderPath: string;
  outputVideoPath: string;
  config: PipelineConfig;
}

export interface AvatarReactionSubmission {
  providerJobId: string | null;
  assetPath: string;
  transport?: "heygen-api" | "heygen-cli";
}

export interface AvatarReactionProviderAdapter {
  validateRequest(request: AvatarReactionRequest): void;
  prepareAssets(request: AvatarReactionRequest): Promise<void>;
  submitRender(request: AvatarReactionRequest): Promise<AvatarReactionSubmission>;
  waitForRender(submission: AvatarReactionSubmission, request: AvatarReactionRequest): Promise<AvatarReactionSubmission>;
  normalizeResult(submission: AvatarReactionSubmission, request: AvatarReactionRequest): Promise<void>;
}

abstract class LocalAvatarReactionProviderAdapter implements AvatarReactionProviderAdapter {
  validateRequest(_request: AvatarReactionRequest): void {
    // Local adapters only need request-specific validation in subclasses.
  }

  async prepareAssets(_request: AvatarReactionRequest): Promise<void> {
    // Local adapters have no extra pre-submit step yet.
  }

  async waitForRender(submission: AvatarReactionSubmission): Promise<AvatarReactionSubmission> {
    return submission;
  }

  async normalizeResult(submission: AvatarReactionSubmission, request: AvatarReactionRequest): Promise<void> {
    if (submission.assetPath === request.outputVideoPath) {
      return;
    }

    await copyFile(submission.assetPath, request.outputVideoPath);
  }

  abstract submitRender(request: AvatarReactionRequest): Promise<AvatarReactionSubmission>;
}

class UserMediaAvatarReactionProviderAdapter extends LocalAvatarReactionProviderAdapter {
  validateRequest(request: AvatarReactionRequest): void {
    if (!request.job.providerInputVideoPath) {
      throw new Error("UserMediaProvider requires a recorded user video before processing can start.");
    }
  }

  async submitRender(request: AvatarReactionRequest): Promise<AvatarReactionSubmission> {
    await createUserMediaReactionVideo({
      ...request,
      outputVideoPath: request.providerRenderPath
    });
    return {
      providerJobId: null,
      assetPath: request.providerRenderPath
    };
  }
}

class AiCharacterAvatarReactionProviderAdapter extends LocalAvatarReactionProviderAdapter {
  async submitRender(request: AvatarReactionRequest): Promise<AvatarReactionSubmission> {
    await createAiCharacterReactionVideo({
      ...request,
      outputVideoPath: request.providerRenderPath
    });
    return {
      providerJobId: null,
      assetPath: request.providerRenderPath
    };
  }
}

class HeyGenAvatarProviderAdapter implements AvatarReactionProviderAdapter {
  validateRequest(request: AvatarReactionRequest): void {
    if (!request.config.heygenAvatarId) {
      throw new Error("HEYGEN_AVATAR_ID is required before using the HeyGen avatar provider.");
    }
  }

  async prepareAssets(_request: AvatarReactionRequest): Promise<void> {
    // The reaction-instructions artifact is already written by the runner.
  }

  async submitRender(request: AvatarReactionRequest): Promise<AvatarReactionSubmission> {
    return submitHeyGenAvatarReactionVideo(request);
  }

  async waitForRender(submission: AvatarReactionSubmission, request: AvatarReactionRequest): Promise<AvatarReactionSubmission> {
    return waitForHeyGenAvatarReactionVideo(submission, request);
  }

  async normalizeResult(submission: AvatarReactionSubmission, request: AvatarReactionRequest): Promise<void> {
    await normalizeHeyGenAvatarReactionVideo(submission, request);
  }
}

export function getAvatarReactionProvider(kind: AvatarReactionProviderKind): AvatarReactionProviderAdapter {
  switch (kind) {
    case "user-media":
    case "user-media-sunglasses":
    case "user-media-pixelated":
      return new UserMediaAvatarReactionProviderAdapter();
    case "ai-character":
      return new AiCharacterAvatarReactionProviderAdapter();
    case "heygen-avatar":
    default:
      return new HeyGenAvatarProviderAdapter();
  }
}
