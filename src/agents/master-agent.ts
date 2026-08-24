import { writeFile } from "node:fs/promises";
import { loadWorkflowBundle } from "./workflow-loader";
import { runPipeline } from "../pipeline/run-pipeline";
import { buildScanReportPrompt, buildWorkflowSystemPrompt } from "../copilot/prompts";
import { requestTextFromCopilot } from "../copilot/client";
import { writeMarkdownReport } from "../pipeline/writers/write-report";
import type { PipelineConfig, PipelineResult } from "../shared/types";

async function persistUpdatedDump(result: PipelineResult): Promise<void> {
  const content = `${JSON.stringify(result.dump, null, 2)}\n`;
  await writeFile(result.latestFile, content, "utf8");
  await writeFile(result.iterationFile, content, "utf8");
}

export async function runMasterAgent(config: PipelineConfig, scanQuery: string): Promise<PipelineResult> {
  const workflow = await loadWorkflowBundle(config);
  const result = await runPipeline(config, scanQuery, workflow);

  const reportMarkdown = await requestTextFromCopilot(
    buildWorkflowSystemPrompt(workflow),
    buildScanReportPrompt(
      workflow,
      scanQuery,
      result.dump.categoryName ?? "Uncategorized",
      result.dump.records.map((record) => ({
        id: record.id,
        title: record.title,
        channel: record.channel,
        score: record.score,
        reason: record.llmReview?.reason ?? "Copilot review unavailable",
        confidence: record.llmReview?.confidence ?? 0.5,
        evidenceSummary: record.llmReview?.evidenceSummary ?? record.scoreBreakdown.reasons.join(", ")
      }))
    ),
    config,
    "scan-report"
  );

  const reportFile = await writeMarkdownReport(result.dump.records, result.dump.generatedAt, config, reportMarkdown);
  result.reportFile = reportFile;
  if (!result.dump.metadata.outputFiles.includes(reportFile)) {
    result.dump.metadata.outputFiles.push(reportFile);
  }
  await persistUpdatedDump(result);
  return result;
}
