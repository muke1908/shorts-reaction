import { useEffect, useState } from "react";
import type {
  GeneratedVideoSummary,
  ProcessShortRequest,
  ReactionJobRecord,
  ShortRecord
} from "../../../shared/types";
import { isActiveProcessingStatus } from "./stages";

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

export interface UseProcessingJobsResult {
  processingByShortId: Record<string, GeneratedVideoSummary | null>;
  refreshSummaries: (records: ShortRecord[]) => Promise<void>;
  startProcessing: (record: ShortRecord, request: ProcessShortRequest) => Promise<void>;
}

export function useProcessingJobs(
  records: ShortRecord[],
  onError: (message: string) => void
): UseProcessingJobsResult {
  const [processingByShortId, setProcessingByShortId] = useState<Record<string, GeneratedVideoSummary | null>>({});

  async function refreshSummaries(nextRecords: ShortRecord[]): Promise<void> {
    if (nextRecords.length === 0) {
      setProcessingByShortId({});
      return;
    }

    const entries = await Promise.all(
      nextRecords.map(async (record) => ({
        shortId: record.id,
        summary: await fetchJson<GeneratedVideoSummary | null>(`/api/process/by-short/${record.id}`)
      }))
    );

    setProcessingByShortId(Object.fromEntries(entries.map((entry) => [entry.shortId, entry.summary])));
  }

  useEffect(() => {
    let cancelled = false;

    refreshSummaries(records).catch((reason: unknown) => {
      if (!cancelled) {
        onError(reason instanceof Error ? reason.message : String(reason));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [records, onError]);

  useEffect(() => {
    const activeShortIds = Object.entries(processingByShortId)
      .filter(([, summary]) => summary && isActiveProcessingStatus(summary.status))
      .map(([shortId]) => shortId);

    if (activeShortIds.length === 0) {
      return;
    }

    const timer = window.setInterval(() => {
      Promise.all(
        activeShortIds.map(async (shortId) => [
          shortId,
          await fetchJson<GeneratedVideoSummary | null>(`/api/process/by-short/${shortId}`)
        ] as const)
      )
        .then((pairs) => {
          setProcessingByShortId((current) => ({
            ...current,
            ...Object.fromEntries(pairs)
          }));
        })
        .catch((reason: unknown) => {
          onError(reason instanceof Error ? reason.message : String(reason));
        });
    }, 1500);

    return () => window.clearInterval(timer);
  }, [processingByShortId, onError]);

  async function startProcessing(record: ShortRecord, request: ProcessShortRequest): Promise<void> {
    const job = await fetchJson<ReactionJobRecord>(`/api/process/${record.id}`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(request)
    });

    setProcessingByShortId((current) => ({
      ...current,
      [record.id]: {
        latestJobId: job.id,
        status: job.status,
        outputUrl: null,
        posterUrl: null,
        updatedAt: job.updatedAt,
        error: job.error
      }
    }));
  }

  return {
    processingByShortId,
    refreshSummaries,
    startProcessing
  };
}
