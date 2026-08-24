import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { PipelineConfig } from "../shared/types";

export interface WorkflowBundle {
  masterWorkflow: string;
  sourceDiscovery: string;
  politicalRelevance: string;
  spamRejection: string;
  viralityRanking: string;
  outputSchema: string;
  reactionVideo: string;
  files: string[];
}

async function readWorkflowFile(config: PipelineConfig, name: string): Promise<{ path: string; content: string }> {
  const path = resolve(config.workflowDir, name);
  const content = await readFile(path, "utf8");
  return { path, content };
}

export async function loadWorkflowBundle(config: PipelineConfig): Promise<WorkflowBundle> {
  const [
    masterWorkflow,
    sourceDiscovery,
    politicalRelevance,
    spamRejection,
    viralityRanking,
    outputSchema,
    reactionVideo
  ] = await Promise.all([
    readWorkflowFile(config, "master-workflow.md"),
    readWorkflowFile(config, "source-discovery.md"),
    readWorkflowFile(config, "political-relevance.md"),
    readWorkflowFile(config, "spam-rejection.md"),
    readWorkflowFile(config, "virality-ranking.md"),
    readWorkflowFile(config, "output-schema.md"),
    readWorkflowFile(config, "reaction-video.md")
  ]);

  return {
    masterWorkflow: masterWorkflow.content,
    sourceDiscovery: sourceDiscovery.content,
    politicalRelevance: politicalRelevance.content,
    spamRejection: spamRejection.content,
    viralityRanking: viralityRanking.content,
    outputSchema: outputSchema.content,
    reactionVideo: reactionVideo.content,
    files: [
      masterWorkflow.path,
      sourceDiscovery.path,
      politicalRelevance.path,
      spamRejection.path,
      viralityRanking.path,
      outputSchema.path,
      reactionVideo.path
    ]
  };
}
