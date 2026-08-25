import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { loadLatestDump } from "../src/server/load-dumps";

test("loadLatestDump returns an empty dump when latest.json is missing", async () => {
  const outputDir = join(tmpdir(), `avatar-load-dumps-${randomUUID()}`);
  await mkdir(outputDir, { recursive: true });

  const dump = await loadLatestDump(outputDir);

  assert.equal(dump.requestedDay, null);
  assert.deepEqual(dump.records, []);
  assert.equal(dump.metadata.itemCount, 0);
  assert.equal(dump.metadata.scanQuery, null);
  assert.deepEqual(dump.metadata.keywordSeeds, []);
});
