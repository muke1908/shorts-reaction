import type { DumpDocument, ShortRecord } from "./types";

function assertShortRecord(record: ShortRecord): void {
  const requiredStrings = [
    record.id,
    record.title,
    record.url,
    record.channel,
    record.publishedAt,
    record.captureTimestamp,
    record.keywordSeed,
    record.source
  ];

  if (requiredStrings.some((value) => typeof value !== "string" || value.length === 0)) {
    throw new Error("Invalid ShortRecord: missing required string fields.");
  }

  if (!Array.isArray(record.matchedKeywords)) {
    throw new Error("Invalid ShortRecord: matchedKeywords must be an array.");
  }
}

export function assertDumpDocument(document: DumpDocument): DumpDocument {
  if (!document.generatedAt || !Array.isArray(document.records)) {
    throw new Error("Invalid dump document.");
  }

  document.records.forEach(assertShortRecord);
  return document;
}
