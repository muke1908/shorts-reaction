import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { assertDumpDocument } from "../../shared/schema";
import { toDayBucket } from "../../shared/dates";
import type { DumpDocument, PipelineConfig, PipelineResult, RunMetadata, ShortRecord } from "../../shared/types";

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function writeDumps(
  records: ShortRecord[],
  metadata: Omit<RunMetadata, "outputFiles" | "itemCount">,
  config: PipelineConfig
): Promise<PipelineResult> {
  await mkdir(config.outputDir, { recursive: true });
  await mkdir(config.byDayDir, { recursive: true });
  const iterationsDir = resolve(config.outputDir, "iterations");
  await mkdir(iterationsDir, { recursive: true });

  const baseDocument: Omit<DumpDocument, "metadata"> = {
    generatedAt: metadata.completedAt,
    requestedDay: config.requestedDay,
    records
  };

  const latestFile = resolve(config.outputDir, "latest.json");
  const iterationStamp = metadata.completedAt.replaceAll(":", "-").replaceAll(".", "-");
  const iterationFile = resolve(iterationsDir, `${iterationStamp}.json`);
  const byDayMap = new Map<string, ShortRecord[]>();
  for (const record of records) {
    const day = toDayBucket(record.publishedAt);
    byDayMap.set(day, [...(byDayMap.get(day) ?? []), record]);
  }

  const byDayFiles: string[] = [];
  const metadataWithOutputs: RunMetadata = {
    ...metadata,
    itemCount: records.length,
    outputFiles: [],
    sourceStrategy: "hybrid"
  };

  const latestDocument = assertDumpDocument({
    ...baseDocument,
    metadata: metadataWithOutputs
  });
  await writeJson(latestFile, latestDocument);
  await writeJson(iterationFile, latestDocument);

  for (const [day, dayRecords] of [...byDayMap.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const path = resolve(config.byDayDir, `${day}.json`);
    byDayFiles.push(path);
    await writeJson(
      path,
      assertDumpDocument({
        generatedAt: metadata.completedAt,
        requestedDay: day,
        records: dayRecords,
        metadata: metadataWithOutputs
      })
    );
  }

  metadataWithOutputs.outputFiles = [latestFile, iterationFile, ...byDayFiles];
  await writeJson(latestFile, assertDumpDocument({ ...baseDocument, metadata: metadataWithOutputs }));
  await writeJson(iterationFile, assertDumpDocument({ ...baseDocument, metadata: metadataWithOutputs }));

  return {
    latestFile,
    byDayFiles,
    iterationFile,
    reportFile: "",
    dump: {
      ...baseDocument,
      metadata: metadataWithOutputs
    }
  };
}
