import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ShortsTable } from "./components/ShortsTable";
import { ServerRuntimePanel } from "./components/ServerRuntimePanel";
import { DirectUrlProcessPanel } from "./components/DirectUrlProcessPanel";
import { CopilotStatusPanel } from "./components/CopilotStatusPanel";
import { useProcessingJobs } from "./features/processing/useProcessingJobs";
import { formatRelativeDaysAgo } from "./lib/format";
import type {
  CategoryIndexDocument,
  DeleteShortResponse,
  DumpDocument,
  ProcessShortRequest,
  ReactionJobRecord,
  ShortRecord
} from "../shared/types";

const DIRECT_IMPORTS_CATEGORY_SLUG = "direct-imports";

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

export function App(): JSX.Element {
  const [document, setDocument] = useState<DumpDocument | null>(null);
  const [categories, setCategories] = useState<CategoryIndexDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanQuery, setScanQuery] = useState("");
  const categoryRequestIdRef = useRef(0);

  useEffect(() => {
    setInitialLoading(true);
    setError(null);
    Promise.all([
      fetchJson<DumpDocument>("/api/dump"),
      fetchJson<CategoryIndexDocument>("/api/categories")
    ])
      .then(([dump, categoryIndex]) => {
        setDocument(dump);
        setCategories(categoryIndex);
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => setInitialLoading(false));
  }, []);

  const handleError = useCallback((message: string) => {
    setError(message);
  }, []);

  const rankedRecords = useMemo(() => document?.records ?? [], [document]);
  const {
    processingByShortId,
    startProcessing
  } = useProcessingJobs(rankedRecords, handleError);

  const handleScan = useCallback(async (): Promise<void> => {
    const trimmedQuery = scanQuery.trim();
    if (!trimmedQuery) {
      setError("Enter a scan query before starting.");
      return;
    }

    setScanning(true);
    setError(null);

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ query: trimmedQuery })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `Scan request failed with ${response.status}`);
      }
      const dump = (await response.json()) as DumpDocument;
      setDocument(dump);
      setScanQuery("");
      setCategories(await fetchJson<CategoryIndexDocument>("/api/categories"));
    } finally {
      setScanning(false);
    }
  }, [scanQuery]);

  const handleProcess = useCallback(async (record: ShortRecord, request: ProcessShortRequest): Promise<void> => {
    setError(null);
    await startProcessing(record, {
      ...request,
      categorySlug: document?.categorySlug ?? null
    });
  }, [document?.categorySlug, startProcessing]);

  const handleDelete = useCallback(async (record: ShortRecord): Promise<void> => {
    if (!window.confirm(`Delete "${record.title}" and its generated artifacts?`)) {
      return;
    }

    setError(null);
    const response = await fetch(`/api/shorts/${record.id}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? `Delete request failed with ${response.status}`);
    }

    await response.json() as DeleteShortResponse;
    setDocument((current) => current ? {
      ...current,
      records: current.records.filter((entry) => entry.id !== record.id),
      metadata: {
        ...current.metadata,
        itemCount: Math.max(0, current.metadata.itemCount - 1)
      }
    } : current);
    setCategories(await fetchJson<CategoryIndexDocument>("/api/categories"));
  }, []);

  const handleSelectCategory = useCallback(async (categorySlug: string): Promise<void> => {
    if (document?.categorySlug === categorySlug) {
      return;
    }

    const requestId = categoryRequestIdRef.current + 1;
    categoryRequestIdRef.current = requestId;
    setError(null);
    setCategoryLoading(true);
    try {
      const dump = await fetchJson<DumpDocument>(`/api/dump?category=${encodeURIComponent(categorySlug)}`);
      if (categoryRequestIdRef.current === requestId) {
        setDocument(dump);
      }
    } finally {
      if (categoryRequestIdRef.current === requestId) {
        setCategoryLoading(false);
      }
    }
  }, [document?.categorySlug]);

  const handleProcessUrl = useCallback(async (request: ProcessShortRequest): Promise<ReactionJobRecord> => {
    setError(null);
    const response = await fetch("/api/process-url", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? `Direct URL process request failed with ${response.status}`);
    }

    const job = await response.json() as ReactionJobRecord;

    try {
      const nextCategories = await fetchJson<CategoryIndexDocument>("/api/categories");
      setCategories(nextCategories);

      if (document?.categorySlug === DIRECT_IMPORTS_CATEGORY_SLUG) {
        setDocument(await fetchJson<DumpDocument>(`/api/dump?category=${encodeURIComponent(DIRECT_IMPORTS_CATEGORY_SLUG)}`));
      }
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }

    return job;
  }, [document?.categorySlug]);

  return (
    <main className="layout">
      <header className="hero">
        <p className="eyebrow">YouTube short reaction maker</p>
        <p>
          Run a fresh scan, rank the top 10 likely viral Shorts, archive each scan iteration with its timestamp, and generate stacked 9:16 reaction-layout videos from the latest list.
        </p>
      </header>
      <section className="panel action-bar">
        <div className="action-bar__summary">
          <strong>Last scan</strong>
          <div className="small-text">
            {document ? formatRelativeDaysAgo(document.generatedAt) : "No scan loaded yet."}
          </div>
          {document?.categoryName ? (
            <div className="small-text">Category: {document.categoryName}</div>
          ) : null}
        </div>
        <div className="scan-controls">
          <input
            className="scan-input"
            type="text"
            placeholder="Type a topic, e.g. Indian politics, AI startups, IPL drama..."
            value={scanQuery}
            onChange={(event) => {
              setScanQuery(event.target.value);
            }}
            disabled={scanning}
          />
          <button className="scan-button" disabled={scanning} onClick={() => {
            handleScan().catch((reason: unknown) => {
              setError(reason instanceof Error ? reason.message : String(reason));
            });
          }}>
            {scanning ? "Scanning..." : "Scan"}
          </button>
        </div>
      </section>
      <DirectUrlProcessPanel onProcessUrl={(request) => handleProcessUrl(request).catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason));
        throw reason;
      })} />
      {initialLoading ? <section className="panel">Loading dump...</section> : null}
      {error ? <section className="panel error">{error}</section> : null}
      <ServerRuntimePanel />
      <CopilotStatusPanel />
      {!initialLoading && !error && document ? (
        <>
          {categories?.categories.length ? (
            <section className="category-strip" aria-label="Parent categories">
              <div className="category-strip__rail">
                {categories.categories.map((category) => (
                  <button
                    key={category.slug}
                    type="button"
                    className={`category-bookmark${document.categorySlug === category.slug ? " category-bookmark--active" : ""}`}
                    onClick={() => {
                      handleSelectCategory(category.slug).catch((reason: unknown) => {
                        setError(reason instanceof Error ? reason.message : String(reason));
                      });
                    }}
                  >
                    <span className="category-bookmark__title">{category.name}</span>
                    <span className="category-bookmark__meta">{category.recordCount}</span>
                  </button>
                ))}
              </div>
              {categoryLoading ? <div className="category-strip__status small-text">Switching category…</div> : null}
            </section>
          ) : null}
          <ShortsTable
            records={rankedRecords}
            processingByShortId={processingByShortId}
            onDelete={handleDelete}
            onProcess={handleProcess}
          />
        </>
      ) : null}
    </main>
  );
}
