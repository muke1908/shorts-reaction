import type {
  AvatarReactionRequest,
  AvatarReactionSubmission,
  ReactionCompositionPlan
} from "../provider";
import { LocalAvatarReactionProviderAdapter } from "./local-avatar-reaction-provider-adapter";
import { buildTemplate1CompositionPlan, createTemplate1ReactionVideo } from "./static-template-provider";

export class Template1AvatarReactionProviderAdapter extends LocalAvatarReactionProviderAdapter {
  public async submitRender(request: AvatarReactionRequest): Promise<AvatarReactionSubmission> {
    await createTemplate1ReactionVideo({
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
    return buildTemplate1CompositionPlan(request);
  }
}
