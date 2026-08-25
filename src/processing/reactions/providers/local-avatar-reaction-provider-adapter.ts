import { copyFile } from "node:fs/promises";
import type {
  AvatarReactionProviderAdapter,
  AvatarReactionRequest,
  AvatarReactionSubmission,
  ReactionCompositionPlan
} from "../provider";

export abstract class LocalAvatarReactionProviderAdapter implements AvatarReactionProviderAdapter {
  public validateRequest(_request: AvatarReactionRequest): void {
    // Local adapters only need request-specific validation in subclasses.
  }

  public async prepareAssets(_request: AvatarReactionRequest): Promise<void> {
    // Local adapters have no extra pre-submit step yet.
  }

  public async waitForRender(submission: AvatarReactionSubmission): Promise<AvatarReactionSubmission> {
    return submission;
  }

  public async normalizeResult(submission: AvatarReactionSubmission, request: AvatarReactionRequest): Promise<void> {
    if (submission.assetPath === request.outputVideoPath) {
      return;
    }

    await copyFile(submission.assetPath, request.outputVideoPath);
  }

  public async buildCompositionPlan(
    _submission: AvatarReactionSubmission,
    request: AvatarReactionRequest
  ): Promise<ReactionCompositionPlan> {
    return this.buildDefaultCompositionPlan(request);
  }

  protected buildDefaultCompositionPlan(request: AvatarReactionRequest): ReactionCompositionPlan {
    return {
      top: {
        videoPath: request.sourceVideoPath,
        startTimeSeconds: 4
      },
      bottomStart: {
        videoPath: request.outputVideoPath,
        startTimeSeconds: 0
      },
      bottomEnd: null
    };
  }

  public abstract submitRender(request: AvatarReactionRequest): Promise<AvatarReactionSubmission>;
}
