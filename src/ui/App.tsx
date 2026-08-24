import { useEffect, useMemo, useState } from "react";
import { ShortsTable } from "./components/ShortsTable";
import { SummaryCards } from "./components/SummaryCards";
import { useProcessingJobs } from "./features/processing/useProcessingJobs";
import { formatRelativeDaysAgo } from "./lib/format";
import type {
  CopilotRuntimeStatus,
  DumpDocument,
  ProcessShortRequest,
  ShortRecord
} from "../shared/types";

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

export function App(): JSX.Element {
  const [document, setDocument] = useState<DumpDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [copilotStatus, setCopilotStatus] = useState<CopilotRuntimeStatus | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchJson<DumpDocument>("/api/dump")
      .then((payload) => setDocument(payload))
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => setLoading(false));
  }, []);

  const rankedRecords = useMemo(() => document?.records ?? [], [document]);
  const {
    processingByShortId,
    refreshSummaries,
    startProcessing
  } = useProcessingJobs(rankedRecords, (message) => setError(message));

  useEffect(() => {
    fetchJson<CopilotRuntimeStatus>("/api/copilot/status")
      .then((payload) => setCopilotStatus(payload))
      .catch(() => {
        // Status panel is best-effort; keep main UI usable.
      });
  }, []);

  useEffect(() => {
    if (!scanning && !copilotStatus?.active) {
      return;
    }

    const timer = window.setInterval(() => {
      fetchJson<CopilotRuntimeStatus>("/api/copilot/status")
        .then((payload) => setCopilotStatus(payload))
        .catch(() => {
          // Keep scan UX running even if the status probe fails.
        });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [scanning, copilotStatus?.active]);

  async function handleScan(): Promise<void> {
    setScanning(true);
    setError(null);
    fetchJson<CopilotRuntimeStatus>("/api/copilot/status")
      .then((payload) => setCopilotStatus(payload))
      .catch(() => undefined);

    try {
      const response = await fetch("/api/scan", {
        method: "POST"
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `Scan request failed with ${response.status}`);
      }

      const dump = (await response.json()) as DumpDocument;
      setDocument(dump);
      await refreshSummaries(dump.records);
    } finally {
      setScanning(false);
    }
  }

  async function handleProcess(record: ShortRecord, request: ProcessShortRequest): Promise<void> {
    setError(null);
    await startProcessing(record, request);
  }

  return (
    <main className="layout">
      <header className="hero">
        <p className="eyebrow">Indian politics / YouTube Shorts</p>
        <h1>Virality monitor</h1>
        <p>
          Run a fresh scan, rank the top 10 likely viral Shorts, archive each scan iteration with its timestamp, and generate stacked 9:16 reaction-layout videos from the latest list.
        </p>
      </header>
      <section className="panel action-bar">
        <div>
          <strong>Last scan</strong>
          <div className="small-text">
            {document ? formatRelativeDaysAgo(document.generatedAt) : "No scan loaded yet."}
          </div>
        </div>
        <button className="scan-button" disabled={scanning} onClick={() => {
          handleScan().catch((reason: unknown) => {
            setError(reason instanceof Error ? reason.message : String(reason));
          });
        }}>
          {scanning ? "Scanning..." : "Scan"}
        </button>
      </section>
      {loading ? <section className="panel">Loading dump...</section> : null}
      {error ? <section className="panel error">{error}</section> : null}
      {copilotStatus && (copilotStatus.startedAt || copilotStatus.active || copilotStatus.completedInvocations > 0) ? (
        <section className="panel meta">
          <div>Copilot active: {copilotStatus.active ? "yes" : "no"}</div>
          <div>Phase: {copilotStatus.phase ?? copilotStatus.lastInvocation?.phase ?? "idle"}</div>
          <div>PID: {copilotStatus.pid ?? copilotStatus.lastInvocation?.pid ?? "n/a"}</div>
          <div>Model: {copilotStatus.model ?? copilotStatus.lastInvocation?.model ?? "default"}</div>
          <div>Started: {copilotStatus.startedAt ?? copilotStatus.lastInvocation?.startedAt ?? "n/a"}</div>
          <div>Completed calls: {copilotStatus.completedInvocations}</div>
          <div>Input tokens: {copilotStatus.totals.inputTokens}</div>
          <div>Output tokens: {copilotStatus.totals.outputTokens}</div>
          <div>Reasoning tokens: {copilotStatus.totals.reasoningTokens}</div>
          <div>Cache read tokens: {copilotStatus.totals.cacheReadTokens}</div>
          <div>API duration ms: {copilotStatus.totals.apiDurationMs}</div>
          <div>AIU nano: {copilotStatus.totals.nanoAiu}</div>
          <div>Premium request cost: {copilotStatus.totals.premiumRequests}</div>
          {copilotStatus.error ? <div>Copilot error: {copilotStatus.error}</div> : null}
        </section>
      ) : null}
      {!loading && !error && document ? (
        <>
          <SummaryCards records={rankedRecords} />
          <section className="panel meta">
            <div>Generated: {document.generatedAt}</div>
            <div>Iteration file: {document.metadata.outputFiles.find((path) => path.includes("/iterations/")) ?? "n/a"}</div>
            <div>Report file: {document.metadata.outputFiles.find((path) => path.endsWith(".md")) ?? "n/a"}</div>
            <div>Fallback used: {document.metadata.usedFallback ? "yes" : "no"}</div>
            <div>Top list size: {document.records.length}</div>
            <div>Keyword seeds: {document.metadata.keywordSeeds.join(", ")}</div>
            <div>Workflow docs: {document.metadata.workflowFiles?.length ?? 0}</div>
          </section>
          <ShortsTable
            records={rankedRecords}
            processingByShortId={processingByShortId}
            onProcess={(record, request) => handleProcess(record, request).catch((reason: unknown) => {
                setError(reason instanceof Error ? reason.message : String(reason));
                throw reason;
              })}
          />
        </>
      ) : null}
    </main>
  );
}
