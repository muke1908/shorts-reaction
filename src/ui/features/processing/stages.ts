import type { GeneratedVideoSummary, ProcessingStatus } from "../../../shared/types";

export interface ProcessingStage {
  key: "pending" | "downloading" | "rendering-reaction" | "compositing" | "completed";
  label: string;
  description: string;
}

export type ProcessingStageState = "pending" | "active" | "done" | "failed";

export interface ProcessingStageViewModel extends ProcessingStage {
  state: ProcessingStageState;
}

export const PROCESSING_STAGES: ProcessingStage[] = [
  {
    key: "pending",
    label: "Queued",
    description: "Job has been created and is waiting to start."
  },
  {
    key: "downloading",
    label: "Downloading source",
    description: "The selected YouTube Short is being downloaded."
  },
  {
    key: "rendering-reaction",
    label: "Rendering reaction layer",
    description: "The Avatar Reaction Provider is generating a dummy reaction video for the lower panel."
  },
  {
    key: "compositing",
    label: "Compositing 9:16 layout",
    description: "The source video and reaction layer are being combined into the final two-layer canvas."
  },
  {
    key: "completed",
    label: "Export ready",
    description: "The two-layer reaction video and poster are ready."
  }
];

function stageIndex(status: ProcessingStatus): number {
  return PROCESSING_STAGES.findIndex((stage) => stage.key === status);
}

export function isActiveProcessingStatus(status: ProcessingStatus): boolean {
  return status === "pending" || status === "downloading" || status === "rendering-reaction" || status === "compositing";
}

export function statusLabel(status: ProcessingStatus): string {
  switch (status) {
    case "pending":
      return "Queued";
    case "downloading":
      return "Downloading source";
    case "rendering-reaction":
      return "Rendering reaction layer";
    case "compositing":
      return "Compositing layout";
    case "completed":
      return "Ready";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

export function buildStageViewModels(summary: GeneratedVideoSummary): ProcessingStageViewModel[] {
  const currentIndex = stageIndex(summary.status);

  return PROCESSING_STAGES.map((stage, index) => {
    let state: ProcessingStageState = "pending";

    if (summary.status === "failed") {
      const failedAt = summary.outputUrl ? PROCESSING_STAGES.length - 1 : Math.max(currentIndex, 0);
      state = index < failedAt ? "done" : index === failedAt ? "failed" : "pending";
    } else if (summary.status === "completed") {
      state = "done";
    } else if (index < currentIndex) {
      state = "done";
    } else if (index === currentIndex) {
      state = "active";
    }

    return {
      ...stage,
      state
    };
  });
}
