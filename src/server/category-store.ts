import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { assertDumpDocument } from "../shared/schema";
import type {
  CategoryIndexDocument,
  CategorySummary,
  DumpDocument,
  ExistingCategoryRecord,
  RecategorizedCategory,
  ShortRecord
} from "../shared/types";

export const DIRECT_IMPORTS_CATEGORY_SLUG = "direct-imports";
export const DIRECT_IMPORTS_CATEGORY_NAME = "Direct imports";
const DIRECT_IMPORTS_CATEGORY_QUERY = "Manual YouTube URL imports";
export const REACTION_LIMBO_CATEGORY_SLUG = "reaction-limbo";
export const REACTION_LIMBO_CATEGORY_NAME = "Reaction limbo";
const REACTION_LIMBO_CATEGORY_QUERY = "Previewed YouTube URL downloads";

function now(): string {
  return new Date().toISOString();
}

export function slugifyCategoryName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "uncategorized";
}

export function getCategoriesDir(outputDir: string): string {
  return resolve(outputDir, "categories");
}

export function getCategoryIndexPath(outputDir: string): string {
  return resolve(getCategoriesDir(outputDir), "index.json");
}

export function getCategoryDumpPath(outputDir: string, categorySlug: string): string {
  return resolve(getCategoriesDir(outputDir), `${categorySlug}.json`);
}

export async function loadCategoryIndex(outputDir: string): Promise<CategoryIndexDocument> {
  try {
    return JSON.parse(await readFile(getCategoryIndexPath(outputDir), "utf8")) as CategoryIndexDocument;
  } catch {
    return {
      generatedAt: now(),
      categories: []
    };
  }
}

export async function writeCategoryIndex(outputDir: string, index: CategoryIndexDocument): Promise<void> {
  await mkdir(getCategoriesDir(outputDir), { recursive: true });
  await writeFile(getCategoryIndexPath(outputDir), `${JSON.stringify(index, null, 2)}\n`, "utf8");
}

export async function loadCategoryDump(outputDir: string, categorySlug: string): Promise<DumpDocument> {
  return JSON.parse(await readFile(getCategoryDumpPath(outputDir, categorySlug), "utf8")) as DumpDocument;
}

export async function writeCategoryDump(outputDir: string, categorySlug: string, dump: DumpDocument): Promise<void> {
  await mkdir(getCategoriesDir(outputDir), { recursive: true });
  await writeFile(getCategoryDumpPath(outputDir, categorySlug), `${JSON.stringify(dump, null, 2)}\n`, "utf8");
}

export async function listCategoryDumpPaths(outputDir: string): Promise<string[]> {
  const entries = await readdir(getCategoriesDir(outputDir), { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json") && entry.name !== "index.json")
    .map((entry) => resolve(getCategoriesDir(outputDir), entry.name));
}

export async function loadSemanticCategoryRecords(outputDir: string): Promise<ExistingCategoryRecord[]> {
  const categoryDumpPaths = await listCategoryDumpPaths(outputDir);
  const records: ExistingCategoryRecord[] = [];

  for (const path of categoryDumpPaths) {
    if (basename(path) === `${DIRECT_IMPORTS_CATEGORY_SLUG}.json`) {
      continue;
    }

    try {
      const dump = JSON.parse(await readFile(path, "utf8")) as DumpDocument;
      if (!dump.categorySlug || !dump.categoryName) {
        continue;
      }

      if (dump.categorySlug === REACTION_LIMBO_CATEGORY_SLUG) {
        continue;
      }

      for (const record of dump.records) {
        records.push({
          record,
          categorySlug: dump.categorySlug,
          categoryName: dump.categoryName
        });
      }
    } catch {
      // Ignore malformed dumps while rebuilding semantic context.
    }
  }

  return records;
}

export function upsertCategorySummary(
  current: CategorySummary[],
  next: Omit<CategorySummary, "scanCount" | "queries">
): CategorySummary[] {
  const existing = current.find((category) => category.slug === next.slug);
  const updated: CategorySummary = existing
    ? {
        ...existing,
        ...next,
        scanCount: existing.scanCount + 1,
        queries: [next.latestQuery, ...existing.queries.filter((query) => query !== next.latestQuery)].slice(0, 20)
      }
    : {
        ...next,
        scanCount: 1,
        queries: [next.latestQuery]
      };

  return [
    updated,
    ...current.filter((category) => category.slug !== next.slug)
  ].sort((left, right) => right.latestScanAt.localeCompare(left.latestScanAt));
}

function sortCategoryRecords(records: ShortRecord[]): ShortRecord[] {
  const byRecency = [...records].sort((left, right) => {
    const capture = right.captureTimestamp.localeCompare(left.captureTimestamp);
    if (capture !== 0) {
      return capture;
    }

    return right.publishedAt.localeCompare(left.publishedAt);
  });

  return byRecency
    .slice(0, 20)
    .sort((left, right) => {
      const score = right.score - left.score;
      if (score !== 0) {
        return score;
      }

      return right.captureTimestamp.localeCompare(left.captureTimestamp);
    });
}

export async function rewriteSemanticCategoryDumps(
  outputDir: string,
  categories: RecategorizedCategory[],
  options: {
    generatedAt: string;
    latestQuery: string;
  }
): Promise<{ categoryDumpPaths: string[]; categoryIndexPath: string }> {
  const existingIndex = await loadCategoryIndex(outputDir);
  const currentDumpPaths = await listCategoryDumpPaths(outputDir);
  const semanticDumpPaths = currentDumpPaths.filter((path) => basename(path) !== `${DIRECT_IMPORTS_CATEGORY_SLUG}.json`);
  const categoryIndexPath = getCategoryIndexPath(outputDir);

  for (const path of semanticDumpPaths) {
    await rm(path, { force: true });
  }

  const categoryDumpPaths: string[] = [];
  for (const category of categories) {
    const dumpPath = getCategoryDumpPath(outputDir, category.slug);
    const existingSummary = existingIndex.categories.find((entry) => entry.slug === category.slug);
    const records = sortCategoryRecords(category.records);
    const dump = assertDumpDocument({
      generatedAt: options.generatedAt,
      requestedDay: null,
      categorySlug: category.slug,
      categoryName: category.name,
      searchQuery: category.touchedByCurrentScan ? options.latestQuery : existingSummary?.latestQuery ?? options.latestQuery,
      records,
      metadata: {
        startedAt: options.generatedAt,
        completedAt: options.generatedAt,
        keywordSeeds: [options.latestQuery],
        scanQuery: category.touchedByCurrentScan ? options.latestQuery : existingSummary?.latestQuery ?? options.latestQuery,
        parentCategorySlug: category.slug,
        parentCategoryName: category.name,
        sourceStrategy: "hybrid",
        usedFallback: false,
        itemCount: records.length,
        outputFiles: [dumpPath, categoryIndexPath],
        workflowFiles: []
      }
    });

    await writeCategoryDump(outputDir, category.slug, dump);
    categoryDumpPaths.push(dumpPath);
  }

  const directImportsDump = await loadCategoryDump(outputDir, DIRECT_IMPORTS_CATEGORY_SLUG).catch(() => null);
  const directImportsSummary = directImportsDump
    ? {
        slug: DIRECT_IMPORTS_CATEGORY_SLUG,
        name: directImportsDump.categoryName ?? DIRECT_IMPORTS_CATEGORY_NAME,
        latestQuery: directImportsDump.searchQuery ?? DIRECT_IMPORTS_CATEGORY_QUERY,
        latestScanAt: directImportsDump.generatedAt,
        recordCount: directImportsDump.records.length,
        scanCount: existingIndex.categories.find((entry) => entry.slug === DIRECT_IMPORTS_CATEGORY_SLUG)?.scanCount ?? 1,
        queries: existingIndex.categories.find((entry) => entry.slug === DIRECT_IMPORTS_CATEGORY_SLUG)?.queries
          ?? [directImportsDump.searchQuery ?? DIRECT_IMPORTS_CATEGORY_QUERY]
      }
    : null;
  const reactionLimboDump = await loadCategoryDump(outputDir, REACTION_LIMBO_CATEGORY_SLUG).catch(() => null);
  const reactionLimboSummary = reactionLimboDump
    ? {
        slug: REACTION_LIMBO_CATEGORY_SLUG,
        name: reactionLimboDump.categoryName ?? REACTION_LIMBO_CATEGORY_NAME,
        latestQuery: reactionLimboDump.searchQuery ?? REACTION_LIMBO_CATEGORY_QUERY,
        latestScanAt: reactionLimboDump.generatedAt,
        recordCount: reactionLimboDump.records.length,
        scanCount: existingIndex.categories.find((entry) => entry.slug === REACTION_LIMBO_CATEGORY_SLUG)?.scanCount ?? 1,
        queries: existingIndex.categories.find((entry) => entry.slug === REACTION_LIMBO_CATEGORY_SLUG)?.queries
          ?? [reactionLimboDump.searchQuery ?? REACTION_LIMBO_CATEGORY_QUERY]
      }
    : null;

  const semanticSummaries = categories.map((category) => {
    const existingSummary = existingIndex.categories.find((entry) => entry.slug === category.slug);
    return {
      slug: category.slug,
      name: category.name,
      latestQuery: category.touchedByCurrentScan ? options.latestQuery : existingSummary?.latestQuery ?? options.latestQuery,
      latestScanAt: category.touchedByCurrentScan ? options.generatedAt : existingSummary?.latestScanAt ?? options.generatedAt,
      recordCount: Math.min(category.records.length, 20),
      scanCount: (existingSummary?.scanCount ?? 0) + (category.touchedByCurrentScan ? 1 : 0),
      queries: category.touchedByCurrentScan
        ? [options.latestQuery, ...(existingSummary?.queries ?? []).filter((query) => query !== options.latestQuery)].slice(0, 20)
        : existingSummary?.queries ?? [options.latestQuery]
    };
  });

  await writeCategoryIndex(outputDir, {
    generatedAt: options.generatedAt,
    categories: [
      ...semanticSummaries,
      ...(directImportsSummary ? [directImportsSummary] : []),
      ...(reactionLimboSummary ? [reactionLimboSummary] : [])
    ]
      .sort((left, right) => right.latestScanAt.localeCompare(left.latestScanAt))
  });

  return {
    categoryDumpPaths,
    categoryIndexPath
  };
}

export async function upsertCategoryRecord(
  outputDir: string,
  short: ShortRecord,
  category: {
    slug: string;
    name: string;
    latestQuery: string;
    generatedAt?: string;
  }
): Promise<DumpDocument> {
  const generatedAt = category.generatedAt ?? now();
  const existing = await loadCategoryDump(outputDir, category.slug).catch(() => null);
  const records = [short, ...(existing?.records ?? []).filter((record) => record.id !== short.id)].slice(0, 20);
  const dumpPath = getCategoryDumpPath(outputDir, category.slug);
  const indexPath = getCategoryIndexPath(outputDir);
  const dump = assertDumpDocument({
    generatedAt,
    requestedDay: null,
    categorySlug: category.slug,
    categoryName: category.name,
    searchQuery: category.latestQuery,
    records,
    metadata: {
      startedAt: generatedAt,
      completedAt: generatedAt,
      keywordSeeds: [short.keywordSeed],
      scanQuery: category.latestQuery,
      parentCategorySlug: category.slug,
      parentCategoryName: category.name,
      sourceStrategy: "hybrid",
      usedFallback: false,
      itemCount: records.length,
      outputFiles: [dumpPath, indexPath],
      workflowFiles: []
    }
  });

  await writeCategoryDump(outputDir, category.slug, dump);
  const categoryIndex = await loadCategoryIndex(outputDir);
  await writeCategoryIndex(outputDir, {
    generatedAt,
    categories: upsertCategorySummary(categoryIndex.categories, {
      slug: category.slug,
      name: category.name,
      latestQuery: category.latestQuery,
      latestScanAt: generatedAt,
      recordCount: records.length
    })
  });

  return dump;
}

export async function upsertDirectImportRecord(outputDir: string, short: ShortRecord): Promise<DumpDocument> {
  return upsertCategoryRecord(outputDir, short, {
    slug: DIRECT_IMPORTS_CATEGORY_SLUG,
    name: DIRECT_IMPORTS_CATEGORY_NAME,
    latestQuery: DIRECT_IMPORTS_CATEGORY_QUERY,
    generatedAt: short.captureTimestamp
  });
}

export async function upsertReactionLimboRecord(outputDir: string, short: ShortRecord): Promise<DumpDocument> {
  return upsertCategoryRecord(outputDir, short, {
    slug: REACTION_LIMBO_CATEGORY_SLUG,
    name: REACTION_LIMBO_CATEGORY_NAME,
    latestQuery: REACTION_LIMBO_CATEGORY_QUERY,
    generatedAt: short.captureTimestamp
  });
}
