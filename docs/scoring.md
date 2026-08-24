# Scoring

## Goal

Rank Shorts by likely virality using public metadata rather than opaque heuristics.

## Current factors

### 1. Reach

The score still considers absolute scale, but with heavy compression so raw views alone do not dominate.

### 2. View velocity

The score strongly rewards getting views and engagement quickly:

- views per hour
- likes per hour
- comments per hour

### 3. Engagement quality

Likes and comments are normalized by views:

- comments are weighted more heavily than likes
- a highly engaged video can outrank a larger but flat video

### 4. Conversation intensity

Political virality often shows up as comments, not just passive likes. The score adds a dedicated conversation component so videos generating discussion rise faster.

### 5. Freshness

Recently published content receives a bonus, which helps surface fast-moving political clips before the window closes.

### 6. Completeness penalty

Fallback scraping may not provide every metric. Missing views, likes, or comments reduce the score to avoid over-ranking incomplete items.

## Output fields

The dump and UI expose:

- `score`
- `scoreBreakdown.reach`
- `scoreBreakdown.viewVelocity`
- `scoreBreakdown.engagement`
- `scoreBreakdown.conversation`
- `scoreBreakdown.freshness`
- `scoreBreakdown.sourceCompletenessPenalty`
- `scoreBreakdown.reasons`

This makes the rank explainable and easier to tune later.
