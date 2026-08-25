import { useEffect, useMemo, useRef, useState } from "react";
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
  const [changeTick, setChangeTick] = useState(0);
  const previousStatusRef = useRef<string | null>(null);

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

  const changeSignature = useMemo(() => JSON.stringify({
    active: status?.active ?? false,
    phase: status?.phase ?? status?.lastInvocation?.phase ?? "idle",
    pid: status?.pid ?? status?.lastInvocation?.pid ?? null,
    model: status?.model ?? status?.lastInvocation?.model ?? "default",
    startedAt: status?.startedAt ?? status?.lastInvocation?.startedAt ?? null,
    completedInvocations: status?.completedInvocations ?? 0,
    totals: status?.totals ?? null,
    error: status?.error ?? null
  }), [status]);

  useEffect(() => {
    if (!status) {
      return;
    }

    if (previousStatusRef.current !== null && previousStatusRef.current !== changeSignature) {
      setChangeTick((current) => current + 1);
    }

    previousStatusRef.current = changeSignature;
  }, [changeSignature, status]);

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
          <div className={`copilot-monitor__brain-ring copilot-monitor__brain-ring--outer${status?.active ? " copilot-monitor__brain-ring--animated" : ""}`} />
          <div className={`copilot-monitor__brain-ring copilot-monitor__brain-ring--mid${status?.active ? " copilot-monitor__brain-ring--animated" : ""}`} />
          <div className={`copilot-monitor__brain-ring copilot-monitor__brain-ring--inner${status?.active ? " copilot-monitor__brain-ring--animated" : ""}`} />
          <div className={`copilot-monitor__brain-pulse copilot-monitor__brain-pulse--one${status?.active ? " copilot-monitor__brain-pulse--animated" : ""}`} />
          <div className={`copilot-monitor__brain-pulse copilot-monitor__brain-pulse--two${status?.active ? " copilot-monitor__brain-pulse--animated" : ""}`} />
          <div className="copilot-monitor__brain-grid" />
        </div>
        <div className="copilot-monitor__stats">
          <div key={`phase-${changeTick}-${phase}`} className="copilot-monitor__stat copilot-monitor__stat--changed">
            <span className="copilot-monitor__stat-label">phase</span>
            <strong>{phase}</strong>
          </div>
          <div key={`pid-${changeTick}-${pid ?? "na"}`} className="copilot-monitor__stat copilot-monitor__stat--changed">
            <span className="copilot-monitor__stat-label">pid</span>
            <strong>{pid ? formatNumber(pid) : "n/a"}</strong>
          </div>
          <div key={`model-${changeTick}-${model}`} className="copilot-monitor__stat copilot-monitor__stat--changed">
            <span className="copilot-monitor__stat-label">model</span>
            <strong>{model}</strong>
          </div>
          <div key={`started-${changeTick}-${startedAt ?? "na"}`} className="copilot-monitor__stat copilot-monitor__stat--changed">
            <span className="copilot-monitor__stat-label">started</span>
            <strong>{startedAt ? formatDate(startedAt) : "n/a"}</strong>
          </div>
          <div key={`calls-${changeTick}-${completedInvocations}`} className="copilot-monitor__stat copilot-monitor__stat--changed">
            <span className="copilot-monitor__stat-label">completed calls</span>
            <strong>{formatNumber(completedInvocations)}</strong>
          </div>
          <div key={`duration-${changeTick}-${totals.apiDurationMs}`} className="copilot-monitor__stat copilot-monitor__stat--changed">
            <span className="copilot-monitor__stat-label">api duration</span>
            <strong>{formatNumber(totals.apiDurationMs)} ms</strong>
          </div>
        </div>
      </div>
      <div className="copilot-monitor__metrics">
        <div key={`input-${changeTick}-${totals.inputTokens}`} className="copilot-monitor__metric copilot-monitor__metric--changed"><strong>Input</strong> {formatNumber(totals.inputTokens)}</div>
        <div key={`output-${changeTick}-${totals.outputTokens}`} className="copilot-monitor__metric copilot-monitor__metric--changed"><strong>Output</strong> {formatNumber(totals.outputTokens)}</div>
        <div key={`reasoning-${changeTick}-${totals.reasoningTokens}`} className="copilot-monitor__metric copilot-monitor__metric--changed"><strong>Reasoning</strong> {formatNumber(totals.reasoningTokens)}</div>
        <div key={`cache-${changeTick}-${totals.cacheReadTokens}`} className="copilot-monitor__metric copilot-monitor__metric--changed"><strong>Cache read</strong> {formatNumber(totals.cacheReadTokens)}</div>
        <div key={`aiu-${changeTick}-${totals.nanoAiu}`} className="copilot-monitor__metric copilot-monitor__metric--changed"><strong>AIU nano</strong> {formatNumber(totals.nanoAiu)}</div>
        <div key={`premium-${changeTick}-${totals.premiumRequests}`} className="copilot-monitor__metric copilot-monitor__metric--changed"><strong>Premium req</strong> {formatNumber(totals.premiumRequests)}</div>
      </div>
      {status?.error ? <div className="copilot-monitor__error small-text">Copilot error: {status.error}</div> : null}
      {loadError ? <div className="copilot-monitor__error small-text">Status polling error: {loadError}</div> : null}
    </section>
  );
}
