import test from "node:test";
import assert from "node:assert/strict";
import {
  hasCommentsEnabled,
  hasEligibleShortDuration,
  isEligibleShortCandidate,
  toShortsUrl
} from "../src/pipeline/sources/shorts-eligibility";

test("hasEligibleShortDuration enforces 10 to 180 seconds inclusive", () => {
  assert.equal(hasEligibleShortDuration(9), false);
  assert.equal(hasEligibleShortDuration(10), true);
  assert.equal(hasEligibleShortDuration(180), true);
  assert.equal(hasEligibleShortDuration(181), false);
  assert.equal(hasEligibleShortDuration(null), false);
});

test("hasCommentsEnabled uses the explicit comments-enabled flag", () => {
  assert.equal(hasCommentsEnabled(true), true);
  assert.equal(hasCommentsEnabled(false), false);
});

test("isEligibleShortCandidate requires both valid duration and comments", () => {
  assert.equal(isEligibleShortCandidate({ durationSeconds: 25, commentsEnabled: true }), true);
  assert.equal(isEligibleShortCandidate({ durationSeconds: 25, commentsEnabled: false }), false);
  assert.equal(isEligibleShortCandidate({ durationSeconds: 7, commentsEnabled: true }), false);
});

test("toShortsUrl normalizes a video id to the shorts URL", () => {
  assert.equal(toShortsUrl("abc12345678"), "https://www.youtube.com/shorts/abc12345678");
});
