import { loadConfig } from "../src/config/env";
import { runMasterAgent } from "../src/agents/master-agent";

function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const requestedDay = readArg("--day") ?? null;
  const maxResults = readArg("--max-results");
  const scanQuery = readArg("--query");
  if (!scanQuery) {
    throw new Error("Provide a scan query with --query.");
  }
  const config = loadConfig({
    requestedDay,
    maxResultsPerQuery: maxResults ? Number(maxResults) : undefined
  });

  const result = await runMasterAgent(config, scanQuery);
  console.log(`Wrote latest dump to ${result.latestFile}`);
  console.log(`Wrote markdown report to ${result.reportFile}`);
  console.log(`Generated ${result.byDayFiles.length} day-bucketed dump files.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
