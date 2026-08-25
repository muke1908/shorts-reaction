import { useEffect, useState } from "react";
import type { CopilotRuntimeStatus } from "../../shared/types";
import { formatDate, formatNumber } from "../lib/format";

interface CopilotStatusPanelProps {
  embedded?: boolean;
  compact?: boolean;
  title?: string;
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

export function CopilotStatusPanel({
  embedded = false,
  compact = false,
  title = "Copilot activity"
}: CopilotStatusPanelProps): JSX.Element {
  const [status, setStatus] = useState<CopilotRuntimeStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    const poll = () => {
      fetchJson<CopilotRuntimeStatus>("/api/copilot/status")
        .then((payload) => {
          if (cancelled) {
            return;
          }

          setStatus(payload);
          setLoadError(null);
          timer = window.setTimeout(poll, payload.active ? 1000 : 2500);
        })
        .catch((reason: unknown) => {
          if (cancelled) {
            return;
          }

          setLoadError(reason instanceof Error ? reason.message : String(reason));
          timer = window.setTimeout(poll, 2500);
        });
    };

    poll();

    return () => {
      cancelled = true;
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  const phase = status?.phase ?? status?.lastInvocation?.phase ?? "idle";
  const pid = status?.pid ?? status?.lastInvocation?.pid ?? null;
  const model = status?.model ?? status?.lastInvocation?.model ?? "default";
  const startedAt = status?.startedAt ?? status?.lastInvocation?.startedAt ?? null;

  const completedInvocations = status?.completedInvocations ?? 0;
  const totals = status?.totals ?? {
    premiumRequests: 0,
    nanoAiu: 0,
    apiDurationMs: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    reasoningTokens: 0,
    lastCallInputTokens: 0,
    lastCallOutputTokens: 0
  };

  return (
    <section className={`panel copilot-monitor${compact ? " copilot-monitor--compact" : ""}${embedded ? " copilot-monitor--embedded" : ""}`}>
      <div className="copilot-monitor__header">
        <div>
          <h2 className="copilot-monitor__title">{title}</h2>
        </div>
        <div className={`copilot-monitor__status-pill${status?.active ? " copilot-monitor__status-pill--active" : ""}`}>
          {status?.active ? "ACTIVE" : "IDLE"}
        </div>
      </div>
      <div className="copilot-monitor__body">
        <div className="copilot-monitor__brain">
          <div className={`copilot-monitor__brain-core${status?.active ? " copilot-monitor__brain-core--active" : ""}`}>
            <span className="copilot-monitor__brain-label">AI</span>
          </div>
          <div className="copilot-monitor__brain-ring copilot-monitor__brain-ring--outer" />
          <div className="copilot-monitor__brain-ring copilot-monitor__brain-ring--mid" />
          <div className="copilot-monitor__brain-ring copilot-monitor__brain-ring--inner" />
          <div className="copilot-monitor__brain-pulse copilot-monitor__brain-pulse--one" />
          <div className="copilot-monitor__brain-pulse copilot-monitor__brain-pulse--two" />
          <div className="copilot-monitor__brain-grid" />
        </div>
        <div className="copilot-monitor__stats">
          <div className="copilot-monitor__stat">
            <span className="copilot-monitor__stat-label">phase</span>
            <strong>{phase}</strong>
          </div>
          <div className="copilot-monitor__stat">
            <span className="copilot-monitor__stat-label">pid</span>
            <strong>{pid ? formatNumber(pid) : "n/a"}</strong>
          </div>
          <div className="copilot-monitor__stat">
            <span className="copilot-monitor__stat-label">model</span>
            <strong>{model}</strong>
          </div>
          <div className="copilot-monitor__stat">
            <span className="copilot-monitor__stat-label">started</span>
            <strong>{startedAt ? formatDate(startedAt) : "n/a"}</strong>
          </div>
          <div className="copilot-monitor__stat">
            <span className="copilot-monitor__stat-label">completed calls</span>
            <strong>{formatNumber(completedInvocations)}</strong>
          </div>
          <div className="copilot-monitor__stat">
            <span className="copilot-monitor__stat-label">api duration</span>
            <strong>{formatNumber(totals.apiDurationMs)} ms</strong>
          </div>
        </div>
      </div>
      <div className="copilot-monitor__metrics">
        <div><strong>Input</strong> {formatNumber(totals.inputTokens)}</div>
        <div><strong>Output</strong> {formatNumber(totals.outputTokens)}</div>
        <div><strong>Reasoning</strong> {formatNumber(totals.reasoningTokens)}</div>
        <div><strong>Cache read</strong> {formatNumber(totals.cacheReadTokens)}</div>
        <div><strong>AIU nano</strong> {formatNumber(totals.nanoAiu)}</div>
        <div><strong>Premium req</strong> {formatNumber(totals.premiumRequests)}</div>
      </div>
      {status?.error ? <div className="copilot-monitor__error small-text">Copilot error: {status.error}</div> : null}
      {loadError ? <div className="copilot-monitor__error small-text">Status polling error: {loadError}</div> : null}
    </section>
  );
}
