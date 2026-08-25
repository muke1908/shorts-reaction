import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import type { SentimentLabel, ShortRecord } from "../src/shared/types";
import {
  DIRECT_IMPORTS_CATEGORY_NAME,
  DIRECT_IMPORTS_CATEGORY_SLUG,
  REACTION_LIMBO_CATEGORY_NAME,
  REACTION_LIMBO_CATEGORY_SLUG,
  rewriteSemanticCategoryDumps,
  upsertDirectImportRecord,
  upsertReactionLimboRecord
} from "../src/server/category-store";
import type { RecategorizedCategory } from "../src/shared/types";

function createRecord(id: string, captureTimestamp: string): ShortRecord {
  return {
    id,
    title: `Title ${id}`,
    url: `https://www.youtube.com/shorts/${id}`,
    channel: "Channel",
    channelId: null,
    description: "",
    publishedAt: captureTimestamp,
    captureTimestamp,
    views: 1,
    likes: 1,
    comments: 1,
    commentsEnabled: true,
    durationSeconds: 20,
    keywordSeed: "direct-url",
    matchedKeywords: [],
    llmReview: null,
    score: 0,
    scoreBreakdown: {
      reach: 0,
      viewVelocity: 0,
      engagement: 0,
      conversation: 0,
      freshness: 0,
      sourceCompletenessPenalty: 0,
      total: 0,
      reasons: []
    },
    source: "youtube-web"
  };
}

function createSentimentRecord(id: string, captureTimestamp: string, label: SentimentLabel): ShortRecord {
  return {
    ...createRecord(id, captureTimestamp),
    llmReview: {
      keep: true,
      relevant: true,
      spam: false,
      viralityScore: 88,
      confidence: 0.91,
      reason: "Strong engagement and clear relevance.",
      evidenceSummary: "Picked as a strong sample for category regrouping.",
      sentiment: {
        label,
        confidence: 0.82,
        reason: `Tone reads as ${label}.`
      }
    }
  };
}

test("upsertDirectImportRecord creates the direct-import category and caps it at 20 records", async () => {
  const outputDir = join(tmpdir(), `avatar-category-${randomUUID()}`);

  for (let index = 0; index < 21; index += 1) {
    const stamp = new Date(Date.UTC(2026, 7, 24, 0, 0, index)).toISOString();
    await upsertDirectImportRecord(outputDir, createRecord(`video-${index}`, stamp));
  }

  const dumpPath = join(outputDir, "categories", `${DIRECT_IMPORTS_CATEGORY_SLUG}.json`);
  const indexPath = join(outputDir, "categories", "index.json");
  const dump = JSON.parse(await readFile(dumpPath, "utf8")) as {
    categorySlug: string;
    categoryName: string;
    records: ShortRecord[];
  };
  const categoryIndex = JSON.parse(await readFile(indexPath, "utf8")) as {
    categories: Array<{ slug: string; name: string; recordCount: number }>;
  };

  assert.equal(dump.categorySlug, DIRECT_IMPORTS_CATEGORY_SLUG);
  assert.equal(dump.categoryName, DIRECT_IMPORTS_CATEGORY_NAME);
  assert.equal(dump.records.length, 20);
  assert.equal(dump.records[0]?.id, "video-20");
  assert.equal(dump.records.at(-1)?.id, "video-1");
  assert.equal(categoryIndex.categories[0]?.slug, DIRECT_IMPORTS_CATEGORY_SLUG);
  assert.equal(categoryIndex.categories[0]?.name, DIRECT_IMPORTS_CATEGORY_NAME);
  assert.equal(categoryIndex.categories[0]?.recordCount, 20);
});

test("upsertDirectImportRecord replaces an existing direct import instead of duplicating it", async () => {
  const outputDir = join(tmpdir(), `avatar-category-${randomUUID()}`);
  await upsertDirectImportRecord(outputDir, createRecord("same-video", "2026-08-24T00:00:00.000Z"));
  await upsertDirectImportRecord(outputDir, createRecord("same-video", "2026-08-24T00:10:00.000Z"));

  const dumpPath = join(outputDir, "categories", `${DIRECT_IMPORTS_CATEGORY_SLUG}.json`);
  const dump = JSON.parse(await readFile(dumpPath, "utf8")) as { records: ShortRecord[] };

  assert.equal(dump.records.length, 1);
  assert.equal(dump.records[0]?.captureTimestamp, "2026-08-24T00:10:00.000Z");
});

test("upsertReactionLimboRecord keeps preview-only downloads in a dedicated limbo category", async () => {
  const outputDir = join(tmpdir(), `avatar-category-${randomUUID()}`);
  await upsertReactionLimboRecord(outputDir, createRecord("preview-video", "2026-08-24T00:15:00.000Z"));

  const dumpPath = join(outputDir, "categories", `${REACTION_LIMBO_CATEGORY_SLUG}.json`);
  const indexPath = join(outputDir, "categories", "index.json");
  const dump = JSON.parse(await readFile(dumpPath, "utf8")) as {
    categorySlug: string;
    categoryName: string;
    records: ShortRecord[];
  };
  const categoryIndex = JSON.parse(await readFile(indexPath, "utf8")) as {
    categories: Array<{ slug: string; name: string; recordCount: number }>;
  };

  assert.equal(dump.categorySlug, REACTION_LIMBO_CATEGORY_SLUG);
  assert.equal(dump.categoryName, REACTION_LIMBO_CATEGORY_NAME);
  assert.equal(dump.records.length, 1);
  assert.equal(dump.records[0]?.id, "preview-video");
  assert.equal(categoryIndex.categories[0]?.slug, REACTION_LIMBO_CATEGORY_SLUG);
  assert.equal(categoryIndex.categories[0]?.name, REACTION_LIMBO_CATEGORY_NAME);
  assert.equal(categoryIndex.categories[0]?.recordCount, 1);
});

test("rewriteSemanticCategoryDumps can split an old broad category into new topic-specific categories", async () => {
  const outputDir = join(tmpdir(), `avatar-category-${randomUUID()}`);
  await upsertDirectImportRecord(outputDir, createRecord("manual-source", "2026-08-24T00:00:00.000Z"));

  const groups: RecategorizedCategory[] = [
    {
      parentCategorySlug: "politics",
      parentCategoryName: "Politics",
      slug: "political-party",
      name: "Political party",
      reason: "Party and election videos belong together.",
      touchedByCurrentScan: true,
      records: [
        createRecord("bjp-1", "2026-08-24T00:01:00.000Z"),
        createRecord("congress-1", "2026-08-24T00:02:00.000Z")
      ]
    },
    {
      parentCategorySlug: "politics",
      parentCategoryName: "Politics",
      slug: "political-abortion",
      name: "Political abortion",
      reason: "Abortion policy debate is a distinct topic cluster.",
      touchedByCurrentScan: true,
      records: [
        createRecord("abortion-1", "2026-08-24T00:03:00.000Z")
      ]
    }
  ];

  const result = await rewriteSemanticCategoryDumps(outputDir, groups, {
    generatedAt: "2026-08-24T00:10:00.000Z",
    latestQuery: "abortion politics"
  });

  const partyDump = JSON.parse(await readFile(join(outputDir, "categories", "political-party.json"), "utf8")) as {
    records: ShortRecord[];
  };
  const abortionDump = JSON.parse(await readFile(join(outputDir, "categories", "political-abortion.json"), "utf8")) as {
    records: ShortRecord[];
  };
  const categoryIndex = JSON.parse(await readFile(result.categoryIndexPath, "utf8")) as {
    categories: Array<{ slug: string }>;
  };

  assert.deepEqual(result.categoryDumpPaths.sort(), [
    join(outputDir, "categories", "political-abortion.json"),
    join(outputDir, "categories", "political-party.json")
  ]);
  assert.deepEqual(partyDump.records.map((record) => record.id), ["congress-1", "bjp-1"]);
  assert.deepEqual(abortionDump.records.map((record) => record.id), ["abortion-1"]);
  assert.deepEqual(
    categoryIndex.categories.map((category) => category.slug).sort(),
    ["direct-imports", "political-abortion", "political-party"]
  );
});

test("rewriteSemanticCategoryDumps persists parent hierarchy and sentiment summary", async () => {
  const outputDir = join(tmpdir(), `avatar-category-${randomUUID()}`);
  const groups: RecategorizedCategory[] = [
    {
      parentCategorySlug: "politics",
      parentCategoryName: "Politics",
      slug: "elections",
      name: "Elections",
      reason: "Election clips belong in the politics hierarchy.",
      touchedByCurrentScan: true,
      records: [
        createSentimentRecord("election-1", "2026-08-24T00:01:00.000Z", "negative"),
        createSentimentRecord("election-2", "2026-08-24T00:02:00.000Z", "negative"),
        createSentimentRecord("election-3", "2026-08-24T00:03:00.000Z", "neutral")
      ]
    }
  ];

  await rewriteSemanticCategoryDumps(outputDir, groups, {
    generatedAt: "2026-08-24T00:10:00.000Z",
    latestQuery: "indian election debate"
  });

  const dump = JSON.parse(await readFile(join(outputDir, "categories", "elections.json"), "utf8")) as {
    metadata: { parentCategorySlug: string | null; parentCategoryName: string | null };
  };
  const categoryIndex = JSON.parse(await readFile(join(outputDir, "categories", "index.json"), "utf8")) as {
    categories: Array<{
      slug: string;
      parentCategorySlug: string | null;
      parentCategoryName: string | null;
      dominantSentiment: string | null;
      sentimentTotals: Record<string, number>;
    }>;
  };

  assert.equal(dump.metadata.parentCategorySlug, "politics");
  assert.equal(dump.metadata.parentCategoryName, "Politics");
  assert.equal(categoryIndex.categories[0]?.slug, "elections");
  assert.equal(categoryIndex.categories[0]?.parentCategorySlug, "politics");
  assert.equal(categoryIndex.categories[0]?.parentCategoryName, "Politics");
  assert.equal(categoryIndex.categories[0]?.dominantSentiment, "negative");
  assert.deepEqual(categoryIndex.categories[0]?.sentimentTotals, {
    positive: 0,
    negative: 2,
    neutral: 1,
    mixed: 0
  });
});

test("rewriteSemanticCategoryDumps rejects more than 10 semantic categories", async () => {
  const outputDir = join(tmpdir(), `avatar-category-${randomUUID()}`);
  const groups: RecategorizedCategory[] = Array.from({ length: 11 }, (_, index) => ({
    parentCategorySlug: "politics",
    parentCategoryName: "Politics",
    slug: `topic-${index + 1}`,
    name: `Topic ${index + 1}`,
    reason: "Test category",
    touchedByCurrentScan: true,
    records: [createRecord(`video-${index + 1}`, `2026-08-24T00:0${Math.min(index, 9)}:00.000Z`)]
  }));

  await assert.rejects(
    () => rewriteSemanticCategoryDumps(outputDir, groups, {
      generatedAt: "2026-08-24T00:10:00.000Z",
      latestQuery: "indian politics"
    }),
    /semantic category limit is 10|limit is 10|Refusing to write 11 semantic categories/
  );
});
