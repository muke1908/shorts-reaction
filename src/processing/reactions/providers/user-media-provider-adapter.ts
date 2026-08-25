import type { AvatarReactionRequest, AvatarReactionSubmission } from "../provider";
import { LocalAvatarReactionProviderAdapter } from "./local-avatar-reaction-provider-adapter";
import { createUserMediaReactionVideo } from "./user-media-provider";

export class UserMediaAvatarReactionProviderAdapter extends LocalAvatarReactionProviderAdapter {
  public override validateRequest(request: AvatarReactionRequest): void {
    if (!request.job.providerInputVideoPath) {
      throw new Error("UserMediaProvider requires a recorded user video before processing can start.");
    }
  }

  public async submitRender(request: AvatarReactionRequest): Promise<AvatarReactionSubmission> {
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
