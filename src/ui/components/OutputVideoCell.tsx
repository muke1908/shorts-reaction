import type { GeneratedVideoSummary } from "../../shared/types";

interface OutputVideoCellProps {
  summary: GeneratedVideoSummary | null;
}

export function OutputVideoCell({ summary }: OutputVideoCellProps): JSX.Element {
  if (!summary?.outputUrl) {
    return <div className="output-video output-video--empty small-text">No output yet</div>;
  }

  return (
    <div className="output-video">
      <video
        className="output-video__player"
        controls
        playsInline
        preload="metadata"
        poster={summary.posterUrl ?? undefined}
        src={summary.outputUrl}
      />
      <a
        className="output-video__link small-text"
        href={summary.outputUrl}
        target="_blank"
        rel="noreferrer"
      >
        Open video
      </a>
    </div>
  );
}
