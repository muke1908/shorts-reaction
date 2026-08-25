import type { AvatarReactionProviderKind, PipelineConfig, ReactionJobRecord } from "../../shared/types";
import { Template1AvatarReactionProviderAdapter } from "./providers/template-1-provider-adapter";
import { Template2AvatarReactionProviderAdapter } from "./providers/template-2-provider-adapter";
import { UserMediaAvatarReactionProviderAdapter } from "./providers/user-media-provider-adapter";

export interface AvatarReactionRequest {
  job: ReactionJobRecord;
  sourceVideoPath: string;
  providerRenderPath: string;
  outputVideoPath: string;
  config: PipelineConfig;
}

export interface ReactionCompositionTrackPlan {
  videoPath: string;
  startTimeSeconds?: number;
  startAtTopEndOffsetSeconds?: number;
  overlayImageBeforeStartPath?: string | null;
}

export interface ReactionCompositionEndTrackPlan {
  videoPath: string;
  startAtTopEndOffsetSeconds: number;
}

export interface ReactionCompositionPlan {
  top: ReactionCompositionTrackPlan;
  bottomStart: ReactionCompositionTrackPlan;
  bottomEnd?: ReactionCompositionEndTrackPlan | null;
}

export interface AvatarReactionSubmission {
  providerJobId: string | null;
  assetPath: string;
}

export interface AvatarReactionProviderAdapter {
  validateRequest(request: AvatarReactionRequest): void;
  prepareAssets(request: AvatarReactionRequest): Promise<void>;
  submitRender(request: AvatarReactionRequest): Promise<AvatarReactionSubmission>;
  waitForRender(submission: AvatarReactionSubmission, request: AvatarReactionRequest): Promise<AvatarReactionSubmission>;
  normalizeResult(submission: AvatarReactionSubmission, request: AvatarReactionRequest): Promise<void>;
  buildCompositionPlan(submission: AvatarReactionSubmission, request: AvatarReactionRequest): Promise<ReactionCompositionPlan>;
}

export function getAvatarReactionProvider(kind: AvatarReactionProviderKind): AvatarReactionProviderAdapter {
  switch (kind) {
    case "user-media":
    case "user-media-sunglasses":
    case "user-media-pixelated":
      return new UserMediaAvatarReactionProviderAdapter();
    case "template-2":
      return new Template2AvatarReactionProviderAdapter();
    case "template-1":
    default:
      return new Template1AvatarReactionProviderAdapter();
  }
}
