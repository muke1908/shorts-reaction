import type {
  AvatarReactionRequest,
  AvatarReactionSubmission,
  ReactionCompositionPlan
} from "../provider";
import { LocalAvatarReactionProviderAdapter } from "./local-avatar-reaction-provider-adapter";
import { buildAiCharacterCompositionPlan, createAiCharacterReactionVideo } from "./ai-character-provider";

export class AiCharacterAvatarReactionProviderAdapter extends LocalAvatarReactionProviderAdapter {
  public async submitRender(request: AvatarReactionRequest): Promise<AvatarReactionSubmission> {
    await createAiCharacterReactionVideo({
      ...request,
      outputVideoPath: request.providerRenderPath
    });

    return {
      providerJobId: null,
      assetPath: request.providerRenderPath
    };
  }

  public override async buildCompositionPlan(
    _submission: AvatarReactionSubmission,
    request: AvatarReactionRequest
  ): Promise<ReactionCompositionPlan> {
    return buildAiCharacterCompositionPlan(request);
  }
}
