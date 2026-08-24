import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { PipelineConfig, ShortRecord } from "../../shared/types";

function formatTimestamp(timestamp: string): string {
  return timestamp.replaceAll(":", "-").replaceAll(".", "-");
}

export async function writeMarkdownReport(
  records: ShortRecord[],
  generatedAt: string,
  config: PipelineConfig,
  llmReport?: string
): Promise<string> {
  await mkdir(config.reportsDir, { recursive: true });
  const path = resolve(config.reportsDir, `${formatTimestamp(generatedAt)}.md`);

  const fallback = [
    `# Scan report`,
    ``,
    `Generated at: ${generatedAt}`,
    ``,
    `## Top 10`,
    ...records.map((record, index) =>
      `${index + 1}. **${record.title}** — ${record.channel}  \n   Score: ${record.score}  \n   Reason: ${record.llmReview?.reason ?? "Heuristic fallback"}  \n   Evidence: ${record.llmReview?.evidenceSummary ?? record.scoreBreakdown.reasons.join(", ")}`
    )
  ].join("\n");

  await writeFile(path, `${llmReport?.trim() || fallback}\n`, "utf8");
  return path;
}
