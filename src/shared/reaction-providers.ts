import type { AvatarReactionProviderKind, UserMediaAnonymizerKind } from "./types";

export interface ReactionProviderOption {
  value: AvatarReactionProviderKind;
  label: string;
}

export const REACTION_PROVIDER_OPTIONS: ReactionProviderOption[] = [
  { value: "ai-character", label: "AI character (static)" },
  { value: "user-media", label: "User media" },
  { value: "user-media-sunglasses", label: "User media + sunglasses" },
  { value: "user-media-pixelated", label: "User media + pixelated" },
  { value: "heygen-avatar", label: "HeyGen avatar" }
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
