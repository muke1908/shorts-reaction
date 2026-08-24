import type { AvatarReactionProviderKind, UserMediaAnonymizerKind } from "./types";

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
