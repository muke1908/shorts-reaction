export function extractYoutubeVideoId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const hostname = parsed.hostname.replace(/^www\./, "");
  if (hostname === "youtu.be") {
    const candidate = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
    return /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null;
  }

  if (hostname !== "youtube.com" && hostname !== "m.youtube.com") {
    return null;
  }

  if (parsed.pathname === "/watch") {
    const candidate = parsed.searchParams.get("v") ?? "";
    return /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null;
  }

  if (parsed.pathname.startsWith("/shorts/")) {
    const candidate = parsed.pathname.split("/").filter(Boolean)[1] ?? "";
    return /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null;
  }

  return null;
}
