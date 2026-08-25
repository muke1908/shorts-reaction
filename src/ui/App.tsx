import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ShortsTable } from "./components/ShortsTable";
import { ServerRuntimePanel } from "./components/ServerRuntimePanel";
import { DirectUrlProcessPanel } from "./components/DirectUrlProcessPanel";
import { CopilotStatusPanel } from "./components/CopilotStatusPanel";
import { AdvancedUserReactionPage } from "./components/AdvancedUserReactionPage";
import { FeatureLandingPage } from "./components/FeatureLandingPage";
import { useProcessingJobs } from "./features/processing/useProcessingJobs";
import { formatRelativeDaysAgo } from "./lib/format";
import type {
  AvatarReactionProviderKind,
  CategoryIndexDocument,
  DeleteShortResponse,
  DumpDocument,
  ProcessShortRequest,
  ReactionJobRecord,
  ShortRecord
} from "../shared/types";

const DIRECT_IMPORTS_CATEGORY_SLUG = "direct-imports";
const PIPELINE_PATHS = new Set(["/pipeline", "/dashboard"]);
const ADVANCED_REACTION_PATHS = new Set(["/quick-reaction/advanced", "/advanced/user-reaction"]);

type AppRoute =
  | { kind: "feature-landing" }
  | { kind: "pipeline" }
  | {
    kind: "advanced-user-reaction";
    provider: AvatarReactionProviderKind;
    shortId: string | null;
    requestedDay: string | null;
    categorySlug: string | null;
    sourceUrl: string | null;
  };

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

function parseAppRoute(location: Location): AppRoute {
  if (location.pathname === "/") {
    return { kind: "feature-landing" };
  }

  if (PIPELINE_PATHS.has(location.pathname)) {
    return { kind: "pipeline" };
  }

  if (!ADVANCED_REACTION_PATHS.has(location.pathname)) {
    return { kind: "feature-landing" };
  }

  const search = new URLSearchParams(location.search);
  const provider = search.get("provider") as AvatarReactionProviderKind | null;
  if (!provider) {
    return { kind: "pipeline" };
  }

  return {
    kind: "advanced-user-reaction",
    provider,
    shortId: search.get("shortId"),
    requestedDay: search.get("day"),
    categorySlug: search.get("categorySlug"),
    sourceUrl: search.get("sourceUrl")
  };
}

function routeToPath(route: AppRoute): string {
  if (route.kind === "feature-landing") {
    return "/";
  }

  if (route.kind === "pipeline") {
    return "/pipeline";
  }

  const search = new URLSearchParams({
    provider: route.provider
  });
  if (route.shortId) {
    search.set("shortId", route.shortId);
  }
  if (route.requestedDay) {
    search.set("day", route.requestedDay);
  }
  if (route.categorySlug) {
    search.set("categorySlug", route.categorySlug);
  }
  if (route.sourceUrl) {
    search.set("sourceUrl", route.sourceUrl);
  }

  return `/advanced/user-reaction?${search.toString()}`;
}

export function App(): JSX.Element {
  const [document, setDocument] = useState<DumpDocument | null>(null);
  const [categories, setCategories] = useState<CategoryIndexDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(false);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanQuery, setScanQuery] = useState("");
  const [route, setRoute] = useState<AppRoute>(() => parseAppRoute(window.location));
  const categoryRequestIdRef = useRef(0);

  const loadPipelineData = useCallback(async (): Promise<void> => {
    setInitialLoading(true);
    setError(null);
    try {
      const categoryIndex = await fetchJson<CategoryIndexDocument>("/api/categories");
      const firstCategorySlug = categoryIndex.categories[0]?.slug;
      const dump = await fetchJson<DumpDocument>(
        firstCategorySlug
          ? `/api/dump?category=${encodeURIComponent(firstCategorySlug)}`
          : "/api/dump"
      );
      setDocument(dump);
      setCategories(categoryIndex);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    if (route.kind !== "pipeline" || (document && categories)) {
      return;
    }

    void loadPipelineData();
  }, [categories, document, loadPipelineData, route.kind]);

  const handleError = useCallback((message: string) => {
    setError(message);
  }, []);

  const rankedRecords = useMemo(() => document?.records ?? [], [document]);
  const {
    processingByShortId,
    startProcessing
  } = useProcessingJobs(rankedRecords, handleError);

  const navigate = useCallback((nextRoute: AppRoute) => {
    window.history.pushState(null, "", routeToPath(nextRoute));
    setRoute(nextRoute);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setRoute(parseAppRoute(window.location));
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

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

  if (route.kind === "advanced-user-reaction") {
    return (
      <AdvancedUserReactionPage
        provider={route.provider}
        shortId={route.shortId}
        requestedDay={route.requestedDay}
        categorySlug={route.categorySlug}
        sourceUrl={route.sourceUrl}
        onBack={() => {
          navigate({ kind: "pipeline" });
        }}
      />
    );
  }

  if (route.kind === "feature-landing") {
    return (
      <FeatureLandingPage
        onGetStarted={() => {
          navigate({ kind: "pipeline" });
        }}
      />
    );
  }

  return (
    <main className="layout">
      <header className="hero">
        <div className="hero__header-row">
          <div>
            <h1 className="hero__title">Reaction studio</h1>
            <p className="hero__copy">
              Run quick reactions from a single YouTube link, discover trend-worthy Shorts, and manage your reaction workflows from one place.
            </p>
          </div>
        </div>
      </header>

      <section className="studio-section">
        <div className="studio-section__header">
          <h2 className="studio-section__title">Quick reaction</h2>
          <p className="studio-section__copy">Start with a specific Short, pick the reaction pipeline you want, and move directly into recording or automated generation.</p>
        </div>
        <DirectUrlProcessPanel
          onProcessUrl={(request) => handleProcessUrl(request).catch((reason: unknown) => {
            setError(reason instanceof Error ? reason.message : String(reason));
            throw reason;
          })}
          onOpenAdvanced={(provider, sourceUrl) => {
            navigate({
              kind: "advanced-user-reaction",
              provider,
              shortId: null,
              requestedDay: null,
              categorySlug: null,
              sourceUrl
            });
          }}
        />
      </section>

      <div className="studio-divider" aria-hidden="true" />
      <section className="studio-section">
        <div className="studio-section__header">
          <h2 className="studio-section__title">Trend discovery workspace</h2>
          <p className="studio-section__copy">Scan fresh topics, watch studio activity, and review the Shorts library by category before launching the next reaction flow.</p>
        </div>
        <section className="panel studio-workspace">
          <div className="studio-workspace__top">
            <div className="studio-workspace__summary">
              <strong>Latest scan</strong>
              <div className="small-text">
                {document ? formatRelativeDaysAgo(document.generatedAt) : "No scan loaded yet."}
              </div>
              {document?.categoryName ? (
                <div className="small-text">Current category: {document.categoryName}</div>
              ) : null}
            </div>
            <div className="scan-controls">
              <input
                className="scan-input"
                type="text"
                placeholder="Scan a topic, e.g. Indian politics, AI startups, IPL drama..."
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
          </div>
          <div className="studio-workspace__monitors">
            <ServerRuntimePanel embedded compact title="System health" />
            <CopilotStatusPanel embedded compact title="Copilot activity" />
          </div>
        </section>
        {initialLoading ? <section className="panel">Loading dump...</section> : null}
        {error ? <section className="panel error">{error}</section> : null}
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
              onOpenAdvanced={(record, provider) => {
                navigate({
                  kind: "advanced-user-reaction",
                  provider,
                  shortId: record.id,
                  requestedDay: document.requestedDay,
                  categorySlug: document.categorySlug ?? null,
                  sourceUrl: null
                });
              }}
            />
          </>
        ) : null}
      </section>
    </main>
  );
}
