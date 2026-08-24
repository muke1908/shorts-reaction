import type { GeneratedVideoSummary } from "../../../shared/types";
import { buildStageViewModels } from "./stages";

interface InlineProcessingStageBarProps {
  summary: GeneratedVideoSummary;
}

export function InlineProcessingStageBar({ summary }: InlineProcessingStageBarProps): JSX.Element {
  const stages = buildStageViewModels(summary);
  const activeIndex = stages.findIndex((stage) => stage.state === "active");
  const failedIndex = stages.findIndex((stage) => stage.state === "failed");
  const completedIndex = [...stages].reverse().findIndex((stage) => stage.state === "done");
  const lastDoneIndex = completedIndex >= 0 ? stages.length - completedIndex - 1 : -1;
  const currentIndex =
    failedIndex >= 0
      ? failedIndex
      : activeIndex >= 0
        ? activeIndex
        : lastDoneIndex;
  const currentStage = stages[Math.max(currentIndex, 0)] ?? stages[0];
  const stepLabel =
    summary.status === "completed"
      ? `Step ${stages.length} of ${stages.length}`
      : `Step ${Math.max(currentIndex, 0) + 1} of ${stages.length}`;
  const summaryLabel =
    summary.status === "failed"
      ? `Failed during ${currentStage.label}`
      : `${stepLabel} · ${currentStage.label}`;

  return (
    <div className="processing-inline">
      <div className="processing-inline__segments" aria-label="Processing progress">
        {stages.map((stage) => (
          <div
            key={stage.key}
            className={`processing-inline__segment processing-inline__segment--${stage.state}`}
            title={`${stage.label}: ${stage.description}`}
          />
        ))}
      </div>
      <div
        className={`processing-inline__summary processing-inline__summary--${currentStage.state} small-text`}
        title={summaryLabel}
      >
        {summaryLabel}
      </div>
    </div>
  );
}
