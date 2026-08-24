import test from "node:test";
import assert from "node:assert/strict";
import { extractYoutubeVideoId } from "../src/processing/sources/direct-youtube-source";

test("extractYoutubeVideoId supports shorts URLs", () => {
  assert.equal(
    extractYoutubeVideoId("https://www.youtube.com/shorts/abc123DEF45"),
    "abc123DEF45"
  );
});

test("extractYoutubeVideoId supports watch URLs", () => {
  assert.equal(
    extractYoutubeVideoId("https://www.youtube.com/watch?v=abc123DEF45&feature=share"),
    "abc123DEF45"
  );
});

test("extractYoutubeVideoId supports youtu.be URLs", () => {
  assert.equal(
    extractYoutubeVideoId("https://youtu.be/abc123DEF45"),
    "abc123DEF45"
  );
});

test("extractYoutubeVideoId rejects non-youtube URLs", () => {
  assert.equal(
    extractYoutubeVideoId("https://example.com/watch?v=abc123DEF45"),
    null
  );
});
