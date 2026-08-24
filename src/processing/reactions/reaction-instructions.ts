import { writeFile } from "node:fs/promises";
import type { PipelineConfig, ReactionInstructions, ReactionJobRecord } from "../../shared/types";
import { probeMediaDurationSeconds } from "../media/probe-media";

function expressionDirectionForJob(job: ReactionJobRecord): string {
  if (job.reactionProvider === "ai-character") {
    return "React silently with facial expressions and body language only. Do not speak.";
  }

  if (job.reactionProvider === "heygen-avatar") {
    return "React silently with facial expression only. Do not speak or narrate.";
  }

  if (job.reactionProvider === "user-media") {
    return "Preserve the recorded user reaction faithfully.";
  }

  return "Use a lightweight synthetic reaction layer that matches the tone of the source.";
}

function timingGuidanceForJob(job: ReactionJobRecord): string[] {
  return [
    "Start in a neutral state for the first beat of the clip.",
    "Increase expression during politically charged or emphatic moments.",
    job.reactionProvider === "ai-character"
      ? "Stay silent throughout the entire reaction."
      : "Avoid overpowering the source clip visually or rhythmically."
  ];
}

export async function writeReactionInstructions(
  job: ReactionJobRecord,
  sourceVideoPath: string,
  outputPath: string,
  config: PipelineConfig
): Promise<ReactionInstructions> {
  const sourceDurationSeconds = await probeMediaDurationSeconds(sourceVideoPath, config);
  const instructions: ReactionInstructions = {
    sourceTitle: job.short.title,
    sourceChannel: job.short.channel,
    sourceDurationSeconds,
    providerKind: job.reactionProvider,
    speechMode: job.reactionProvider === "ai-character" || job.reactionProvider === "heygen-avatar" ? "silent" : "mix-when-available",
    reactionSummary: `Generate a reaction layer for "${job.short.title}" from ${job.short.channel}. Keep the reaction visually aligned with a political news/commentary short.`,
    expressionDirection: expressionDirectionForJob(job),
    timingGuidance: timingGuidanceForJob(job)
  };

  await writeFile(outputPath, `${JSON.stringify(instructions, null, 2)}\n`, "utf8");
  return instructions;
}
