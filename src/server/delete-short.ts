import { basename, resolve } from "node:path";
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import { assertDumpDocument } from "../shared/schema";
import type { DumpDocument, PipelineConfig, ReactionJobRecord } from "../shared/types";
import { listCategoryDumpPaths, loadCategoryIndex, writeCategoryIndex } from "./category-store";

export interface DeleteShortResult {
  deletedShortId: string;
  updatedDumpFiles: number;
  deletedDumpFiles: number;
  deletedJobDirectories: number;
}

async function readJson(path: string): Promise<DumpDocument> {
  return JSON.parse(await readFile(path, "utf8")) as DumpDocument;
}

async function writeJson(path: string, value: DumpDocument): Promise<void> {
  await writeFile(path, `${JSON.stringify(assertDumpDocument(value), null, 2)}\n`, "utf8");
}

async function collectDumpPaths(config: PipelineConfig): Promise<string[]> {
  const iterationDir = resolve(config.outputDir, "iterations");
  const [byDayEntries, iterationEntries, categoryDumpPaths] = await Promise.all([
    readdir(config.byDayDir, { withFileTypes: true }).catch(() => []),
    readdir(iterationDir, { withFileTypes: true }).catch(() => []),
    listCategoryDumpPaths(config.outputDir)
  ]);

  return [
    resolve(config.outputDir, "latest.json"),
    ...categoryDumpPaths,
    ...byDayEntries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => resolve(config.byDayDir, entry.name)),
    ...iterationEntries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => resolve(iterationDir, entry.name))
  ];
}

async function removeShortFromDump(path: string, shortId: string): Promise<"unchanged" | "updated" | "deleted"> {
  let dump: DumpDocument;
  try {
    dump = await readJson(path);
  } catch {
    return "unchanged";
  }

  const nextRecords = dump.records.filter((record) => record.id !== shortId);
  if (nextRecords.length === dump.records.length) {
    return "unchanged";
  }

  const isLatestDump = basename(path) === "latest.json";
  if (nextRecords.length === 0 && !isLatestDump) {
    await rm(path, { force: true });
    return "deleted";
  }

  await writeJson(path, {
    ...dump,
    records: nextRecords,
    metadata: {
      ...dump.metadata,
      itemCount: nextRecords.length
    }
  });
  return "updated";
}

async function rebuildCategoryIndex(config: PipelineConfig): Promise<void> {
  const categoryDumpPaths = await listCategoryDumpPaths(config.outputDir);
  const existingIndex = await loadCategoryIndex(config.outputDir);
  const categories = [];

  for (const path of categoryDumpPaths) {
    try {
      const dump = await readJson(path);
      if (!dump.categorySlug || !dump.categoryName) {
        continue;
      }

      categories.push({
        slug: dump.categorySlug,
        name: dump.categoryName,
        latestQuery: dump.searchQuery ?? dump.metadata.scanQuery ?? "",
        latestScanAt: dump.generatedAt,
        recordCount: dump.records.length,
        scanCount: existingIndex.categories.find((category) => category.slug === dump.categorySlug)?.scanCount ?? 1,
        queries: existingIndex.categories.find((category) => category.slug === dump.categorySlug)?.queries
          ?? (dump.searchQuery ? [dump.searchQuery] : [])
      });
    } catch {
      // Ignore malformed category dumps during index rebuild.
    }
  }

  await writeCategoryIndex(config.outputDir, {
    generatedAt: new Date().toISOString(),
    categories: categories.sort((left, right) => right.latestScanAt.localeCompare(left.latestScanAt))
  });
}

async function deleteGeneratedJobs(shortId: string, config: PipelineConfig): Promise<number> {
  const jobsRoot = resolve(config.generatedDir, "jobs");
  const entries = await readdir(jobsRoot, { withFileTypes: true }).catch(() => []);
  let deleted = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const manifestPath = resolve(jobsRoot, entry.name, "manifest.json");
    try {
      const job = JSON.parse(await readFile(manifestPath, "utf8")) as ReactionJobRecord;
      if (job.shortId !== shortId) {
        continue;
      }
    } catch {
      continue;
    }

    await rm(resolve(jobsRoot, entry.name), { recursive: true, force: true });
    deleted += 1;
  }

  return deleted;
}

export async function deleteShortAndArtifacts(shortId: string, config: PipelineConfig): Promise<DeleteShortResult> {
  const dumpPaths = await collectDumpPaths(config);
  let updatedDumpFiles = 0;
  let deletedDumpFiles = 0;

  for (const dumpPath of dumpPaths) {
    const outcome = await removeShortFromDump(dumpPath, shortId);
    if (outcome === "updated") {
      updatedDumpFiles += 1;
    } else if (outcome === "deleted") {
      deletedDumpFiles += 1;
    }
  }

  const deletedJobDirectories = await deleteGeneratedJobs(shortId, config);
  await rebuildCategoryIndex(config);
  return {
    deletedShortId: shortId,
    updatedDumpFiles,
    deletedDumpFiles,
    deletedJobDirectories
  };
}
