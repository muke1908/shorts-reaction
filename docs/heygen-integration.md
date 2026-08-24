# HeyGen integration

## Current status

HeyGen is now part of the active **Process** flow through the **HeyGen avatar** provider.

This first cut is intentionally basic and now prefers the **HeyGen CLI** when it is installed and authenticated:

1. download the selected YouTube Short
2. write `reaction-instructions.json`
3. if HeyGen CLI auth is available, create/poll/download a basic `avatar` render through `heygen video ...`
4. otherwise fall back to `POST /v3/videos` and `GET /v3/videos/{video_id}`
5. download the resulting video to the local job workspace
6. normalize it into the standard `reaction.mp4` contract
7. composite it into the bottom 40% of the final 9:16 output

## Current constraints

- This provider currently targets **scripted avatar video generation**, not user-media transformation.
- It uses a configured `HEYGEN_AVATAR_ID`.
- It uses a minimal expression-marker script such as bracketed reaction cues rather than a full spoken narration script.
- When the HeyGen render includes audio, the final compositor keeps it at full level while mixing the original YouTube source at 90%.
- CLI/OAuth is preferred because it can use the account-level HeyGen entitlement instead of raw API wallet credits.
- It does **not** yet use templates, uploaded assets, webhooks, or transparent-background output.
- It still relies on the local compositor, so the final stacked output stays consistent with the other providers.

## Required configuration

- `HEYGEN_API_KEY`
- `HEYGEN_AVATAR_ID`

Optional:

- `HEYGEN_API_URL` (defaults to `https://api.heygen.com`)
- `HEYGEN_CLI_BINARY`
- `HEYGEN_VOICE_ID`

Currently unused by the basic integration:

- `HEYGEN_TEMPLATE_ID`
- `HEYGEN_REACTION_VIDEO_URL`
- `HEYGEN_OVERLAY_CHROMA_KEY_COLOR`

## Generated job workspace

```text
data/generated/jobs/<job-id>/
  source.mp4
  reaction-instructions.json
  provider-render.mp4
  reaction.mp4
  output.mp4
  poster.jpg
  manifest.json
```

## Next likely HeyGen upgrades

- switch from polling to webhooks
- support transparent-background WebM when the avatar supports matting
- add a real HeyGen-backed user overlay flow
- allow richer prompt/script generation from the reaction brief

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
