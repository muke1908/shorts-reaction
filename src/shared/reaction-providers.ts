import type { AvatarReactionProviderKind, UserMediaAnonymizerKind } from "./types";

export interface ReactionProviderOption {
  value: AvatarReactionProviderKind;
  label: string;
  description?: string;
}

export const REACTION_PROVIDER_OPTIONS: ReactionProviderOption[] = [
  {
    value: "template-1",
    label: "Template-1",
    description: "Static template with the source delayed on top, start clip below, and optional end outro."
  },
  {
    value: "template-2",
    label: "Template-2",
    description: "Static template with the source on top and the end clip driving the full bottom lane."
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
