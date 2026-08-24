import { runCopilotWorkflow } from "../src/agents/copilot-trigger";

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  await runCopilotWorkflow({
    requestedDay: readArg("--day") ?? null,
    serveUi: hasFlag("--serve-ui"),
    maxResultsPerQuery: readArg("--max-results") ? Number(readArg("--max-results")) : undefined
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
