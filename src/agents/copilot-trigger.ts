import { spawn } from "node:child_process";
import { runMasterAgent } from "./master-agent";
import { loadConfig } from "../config/env";
import { startServer } from "../server/index";
import type { PipelineConfig, PipelineResult } from "../shared/types";

export interface CopilotWorkflowOptions {
  requestedDay: string | null;
  serveUi: boolean;
  maxResultsPerQuery?: number;
  scanQuery: string;
}

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: process.platform === "win32" });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code ?? "unknown"}`));
    });
  });
}

function printSummary(result: PipelineResult): void {
  console.log(`Latest dump: ${result.latestFile}`);
  console.log(`Scan report: ${result.reportFile}`);
  console.log(`Per-day dumps: ${result.byDayFiles.length}`);
  console.log(`Ranked Shorts: ${result.dump.records.length}`);
}

export async function runCopilotWorkflow(options: CopilotWorkflowOptions): Promise<void> {
  if (!options.scanQuery.trim()) {
    throw new Error("Provide a scan query with --query.");
  }

  const config: PipelineConfig = loadConfig({
    requestedDay: options.requestedDay,
    serveUi: options.serveUi,
    maxResultsPerQuery: options.maxResultsPerQuery ?? loadConfig().maxResultsPerQuery
  });

  const result = await runMasterAgent(config, options.scanQuery.trim());
  printSummary(result);

  if (!options.serveUi) {
    return;
  }

  await runCommand(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"]);
  await startServer(config);
}
