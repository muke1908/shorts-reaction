import test from "node:test";
import assert from "node:assert/strict";
import { shouldLoopReactionVideo } from "../src/processing/reactions/providers/normalize-reaction-video";

test("shouldLoopReactionVideo returns true when the provider clip is shorter than target duration", () => {
  assert.equal(shouldLoopReactionVideo(7.8, 10), true);
});

test("shouldLoopReactionVideo returns false when the provider clip already covers the target duration", () => {
  assert.equal(shouldLoopReactionVideo(10, 10), false);
  assert.equal(shouldLoopReactionVideo(10.03, 10), false);
  assert.equal(shouldLoopReactionVideo(10.2, 10), false);
});
