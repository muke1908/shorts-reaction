import test from "node:test";
import assert from "node:assert/strict";
import { scoreShort } from "../src/shared/scoring";
import type { SourceItem } from "../src/shared/types";

test("scoreShort returns a positive score for a high-engagement recent short", () => {
  const item: SourceItem = {
    id: "abc12345678",
    title: "Parliament debate short",
    url: "https://www.youtube.com/watch?v=abc12345678",
    channel: "Public Affairs",
    channelId: "channel-1",
    description: "Indian politics update",
    publishedAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
    captureTimestamp: new Date().toISOString(),
    views: 150000,
    likes: 12000,
    comments: 2500,
    commentsEnabled: true,
    durationSeconds: 55,
    keywordSeed: "indian politics shorts",
    source: "youtube-api"
  };

  const scored = scoreShort(item, ["indian politics"], null);
  assert.ok(scored.score > 0);
  assert.equal(scored.scoreBreakdown.total, scored.score);
});

test("scoreShort favors fast recent traction over stale raw reach", () => {
  const recentFast: SourceItem = {
    id: "recent123456",
    title: "Recent fast traction",
    url: "https://www.youtube.com/shorts/recent123456",
    channel: "Politics Fast",
    channelId: "channel-2",
    description: "Rapid traction",
    publishedAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
    captureTimestamp: new Date().toISOString(),
    views: 45000,
    likes: 5500,
    comments: 900,
    commentsEnabled: true,
    durationSeconds: 35,
    keywordSeed: "lok sabha shorts",
    source: "youtube-api"
  };

  const staleLarge: SourceItem = {
    id: "stale1234567",
    title: "Older large reach",
    url: "https://www.youtube.com/shorts/stale1234567",
    channel: "Politics Slow",
    channelId: "channel-3",
    description: "Large but old",
    publishedAt: new Date(Date.now() - 72 * 3_600_000).toISOString(),
    captureTimestamp: new Date().toISOString(),
    views: 150000,
    likes: 4000,
    comments: 200,
    commentsEnabled: true,
    durationSeconds: 50,
    keywordSeed: "lok sabha shorts",
    source: "youtube-api"
  };

  const recentScore = scoreShort(recentFast, ["lok sabha"], null);
  const staleScore = scoreShort(staleLarge, ["lok sabha"], null);
  assert.ok(recentScore.score > staleScore.score);
});
