import test from "node:test";
import assert from "node:assert/strict";
import {
  providerRequiresUserMedia,
  providerUserMediaAnonymizer
} from "../src/shared/reaction-providers";

test("providerRequiresUserMedia covers all user-media variants", () => {
  assert.equal(providerRequiresUserMedia("user-media"), true);
  assert.equal(providerRequiresUserMedia("user-media-sunglasses"), true);
  assert.equal(providerRequiresUserMedia("user-media-pixelated"), true);
  assert.equal(providerRequiresUserMedia("template-1"), false);
  assert.equal(providerRequiresUserMedia("template-2"), false);
});

test("providerUserMediaAnonymizer maps providers to recorder anonymizer strategies", () => {
  assert.equal(providerUserMediaAnonymizer("user-media"), "none");
  assert.equal(providerUserMediaAnonymizer("user-media-sunglasses"), "sunglasses");
  assert.equal(providerUserMediaAnonymizer("user-media-pixelated"), "pixelated");
  assert.equal(providerUserMediaAnonymizer("template-1"), "none");
  assert.equal(providerUserMediaAnonymizer("template-2"), "none");
});
