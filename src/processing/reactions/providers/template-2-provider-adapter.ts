import type {
  AvatarReactionRequest,
  AvatarReactionSubmission,
  ReactionCompositionPlan
} from "../provider";
import { LocalAvatarReactionProviderAdapter } from "./local-avatar-reaction-provider-adapter";
import { buildTemplate2CompositionPlan, createTemplate2ReactionVideo } from "./static-template-provider";

export class Template2AvatarReactionProviderAdapter extends LocalAvatarReactionProviderAdapter {
  public async submitRender(request: AvatarReactionRequest): Promise<AvatarReactionSubmission> {
    await createTemplate2ReactionVideo({
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
    return buildTemplate2CompositionPlan(request);
  }
}
