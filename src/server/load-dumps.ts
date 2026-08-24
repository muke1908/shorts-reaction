import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { DumpDocument, ShortRecord } from "../shared/types";

async function readJson(path: string): Promise<DumpDocument> {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as DumpDocument;
}

export async function loadLatestDump(outputDir: string): Promise<DumpDocument> {
  return readJson(resolve(outputDir, "latest.json"));
}

export async function loadDumpByDay(outputDir: string, day: string): Promise<DumpDocument> {
  return readJson(resolve(outputDir, "by-day", `${day}.json`));
}

export async function listAvailableDays(outputDir: string): Promise<string[]> {
  const directory = resolve(outputDir, "by-day");
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name.replace(/\.json$/, ""))
    .sort((left, right) => right.localeCompare(left));
}

export async function findShortRecord(outputDir: string, shortId: string, day?: string): Promise<ShortRecord | null> {
  const dump = day ? await loadDumpByDay(outputDir, day) : await loadLatestDump(outputDir);
  return dump.records.find((record) => record.id === shortId) ?? null;
}
