import type { AvatarReactionProviderKind, PipelineConfig, ReactionJobRecord } from "../../shared/types";
import { createDummyAvatarReactionVideo } from "./providers/dummy-avatar-reaction";
import { createUserMediaReactionVideo } from "./providers/user-media-provider";

export interface AvatarReactionRequest {
  job: ReactionJobRecord;
  sourceVideoPath: string;
  outputVideoPath: string;
  config: PipelineConfig;
}

export interface AvatarReactionProvider {
  generateReactionVideo(request: AvatarReactionRequest): Promise<void>;
}

class DummyAvatarReactionProvider implements AvatarReactionProvider {
  async generateReactionVideo(request: AvatarReactionRequest): Promise<void> {
    await createDummyAvatarReactionVideo(request);
  }
}

class UserMediaAvatarReactionProvider implements AvatarReactionProvider {
  async generateReactionVideo(request: AvatarReactionRequest): Promise<void> {
    await createUserMediaReactionVideo(request);
  }
}

export function getAvatarReactionProvider(kind: AvatarReactionProviderKind): AvatarReactionProvider {
  if (kind === "user-media") {
    return new UserMediaAvatarReactionProvider();
  }

  return new DummyAvatarReactionProvider();
}
