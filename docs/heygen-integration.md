# HeyGen integration

## Current status

HeyGen is **not** part of the active **Process** flow right now.

The current shipped Process pipeline does this instead:

1. download the selected YouTube Short
2. create a **9:16** output canvas
3. place the source video in the **top 60%**
4. reserve the **bottom 40%** as a plain black placeholder panel
5. preserve source audio and export `output.mp4`

## Why this document still exists

This document remains as a staging note for the later phase where the black placeholder panel will be replaced with a generated reaction character.

## Future intended direction

In a later phase, the lower placeholder area can be replaced with HeyGen-driven reaction media so the overall layout stays stable:

- top region: original Short
- bottom region: generated reaction character video

## Placeholder-era generated job workspace

```text
data/generated/jobs/<job-id>/
  source.mp4
  output.mp4
  poster.jpg
  manifest.json
```

## Future configuration placeholders

These env vars are intentionally still reserved for later work:

- `HEYGEN_REACTION_VIDEO_URL`
- `HEYGEN_API_KEY`
- `HEYGEN_API_URL`
- `HEYGEN_TEMPLATE_ID`
- `HEYGEN_AVATAR_ID`
- `HEYGEN_VOICE_ID`
- `HEYGEN_OVERLAY_CHROMA_KEY_COLOR`
