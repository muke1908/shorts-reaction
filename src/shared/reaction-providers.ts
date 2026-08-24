import type { AvatarReactionProviderKind, UserMediaAnonymizerKind } from "./types";

export interface ReactionProviderOption {
  value: AvatarReactionProviderKind;
  label: string;
  description?: string;
}

export const REACTION_PROVIDER_OPTIONS: ReactionProviderOption[] = [
  {
    value: "ai-character",
    label: "AI character (static)",
    description: "Generate a provider-led reaction clip without recording yourself."
  },
  {
    value: "user-media",
    label: "User media",
    description: "Use your camera feed as-is for the fastest record-and-react path."
  },
  {
    value: "user-media-sunglasses",
    label: "User media + sunglasses",
    description: "Record yourself while the browser adds a face-following sunglasses mask."
  },
  {
    value: "user-media-pixelated",
    label: "User media + pixelated",
    description: "Keep the same flow but add stronger identity masking with pixelation."
  },
  {
    value: "heygen-avatar",
    label: "HeyGen avatar",
    description: "Send the job through the HeyGen-backed provider flow for avatar output."
  }
];

export function getQuickReactionProviderOptions(): ReactionProviderOption[] {
  return REACTION_PROVIDER_OPTIONS.filter((option) => providerRequiresUserMedia(option.value));
}

export function providerRequiresUserMedia(provider: AvatarReactionProviderKind): boolean {
  return provider === "user-media" || provider === "user-media-sunglasses" || provider === "user-media-pixelated";
}

export function providerUserMediaAnonymizer(provider: AvatarReactionProviderKind): UserMediaAnonymizerKind {
  switch (provider) {
    case "user-media-sunglasses":
      return "sunglasses";
    case "user-media-pixelated":
      return "pixelated";
    default:
      return "none";
  }
}
