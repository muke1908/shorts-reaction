import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { CategoryIndexDocument, DumpDocument, ShortRecord } from "../shared/types";
import { loadCategoryDump, loadCategoryIndex } from "./category-store";

function createEmptyDump(): DumpDocument {
  const timestamp = new Date().toISOString();
  return {
    generatedAt: timestamp,
    requestedDay: null,
    records: [],
    metadata: {
      startedAt: timestamp,
      completedAt: timestamp,
      keywordSeeds: [],
      scanQuery: null,
      parentCategorySlug: null,
      parentCategoryName: null,
      sourceStrategy: "hybrid",
      usedFallback: false,
      itemCount: 0,
      outputFiles: [],
      workflowFiles: []
    }
  };
}

async function readJson(path: string): Promise<DumpDocument> {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as DumpDocument;
}

export async function loadLatestDump(outputDir: string): Promise<DumpDocument> {
  try {
    return await readJson(resolve(outputDir, "latest.json"));
  } catch {
    return createEmptyDump();
  }
}

export async function loadDumpByDay(outputDir: string, day: string): Promise<DumpDocument> {
  return readJson(resolve(outputDir, "by-day", `${day}.json`));
}

export async function loadDumpByCategory(outputDir: string, categorySlug: string): Promise<DumpDocument> {
  return loadCategoryDump(outputDir, categorySlug);
}

export async function loadCategories(outputDir: string): Promise<CategoryIndexDocument> {
  return loadCategoryIndex(outputDir);
}

export async function listAvailableDays(outputDir: string): Promise<string[]> {
  const directory = resolve(outputDir, "by-day");
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name.replace(/\.json$/, ""))
    .sort((left, right) => right.localeCompare(left));
}

export async function findShortRecord(
  outputDir: string,
  shortId: string,
  day?: string,
  categorySlug?: string | null
): Promise<ShortRecord | null> {
  const dump = day
    ? await loadDumpByDay(outputDir, day)
    : categorySlug
      ? await loadDumpByCategory(outputDir, categorySlug)
      : await loadLatestDump(outputDir);
  return dump.records.find((record) => record.id === shortId) ?? null;
}
