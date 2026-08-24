import { useEffect, useState } from "react";
import type { ServerRuntimeStatus } from "../../shared/types";

interface SparklineProps {
  label: string;
  colorClassName: string;
  values: number[];
}

function buildSparklinePoints(values: number[], width: number, height: number): string {
  if (values.length === 0) {
    return "";
  }

  const maxValue = Math.max(...values, 1);
  return values
    .map((value, index) => {
      const x = values.length === 1 ? width : (index / (values.length - 1)) * width;
      const y = height - (value / maxValue) * height;
      return `${x},${y}`;
    })
    .join(" ");
}

function Sparkline({ label, colorClassName, values }: SparklineProps): JSX.Element {
  const points = buildSparklinePoints(values, 220, 52);

  return (
    <article className="runtime-monitor__chart">
      <div className="runtime-monitor__chart-header">
        <span>{label}</span>
      </div>
      <svg className="runtime-monitor__sparkline" viewBox="0 0 220 52" preserveAspectRatio="none" aria-hidden="true">
        <path className="runtime-monitor__sparkline-grid" d="M0 13 H220 M0 26 H220 M0 39 H220" />
        <polyline className={colorClassName} points={points} />
      </svg>
    </article>
  );
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

export function ServerRuntimePanel(): JSX.Element | null {
  const [history, setHistory] = useState<ServerRuntimeStatus[]>([]);

  useEffect(() => {
    let cancelled = false;

    const loadStatus = () => {
      fetchJson<ServerRuntimeStatus>("/api/server/status")
        .then((payload) => {
          if (!cancelled) {
            setHistory((current) => [...current.slice(-29), payload]);
          }
        })
        .catch(() => {
          // Runtime panel is best-effort; keep main UI usable.
        });
    };

    loadStatus();
    const timer = window.setInterval(loadStatus, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (history.length === 0) {
    return null;
  }

  const cpuValues = history.map((item) => item.cpuPercent);
  const rssValues = history.map((item) => item.rssBytes / (1024 * 1024));
  const heapValues = history.map((item) => item.heapUsedBytes / (1024 * 1024));
  const loadValues = history.map((item) => item.loadAverage[0]);

  return (
    <section className="panel runtime-monitor">
      <div className="runtime-monitor__header">
        <div>
          <div className="eyebrow">tech-focused-monitor-ui</div>
          <h2 className="runtime-monitor__title">Server runtime telemetry</h2>
        </div>
        <div className="runtime-monitor__status-pill">LIVE</div>
      </div>
      <div className="runtime-monitor__charts">
        <Sparkline label="CPU %" colorClassName="runtime-monitor__sparkline-line runtime-monitor__sparkline-line--cpu" values={cpuValues} />
        <Sparkline label="RSS MB" colorClassName="runtime-monitor__sparkline-line runtime-monitor__sparkline-line--rss" values={rssValues} />
        <Sparkline label="Heap MB" colorClassName="runtime-monitor__sparkline-line runtime-monitor__sparkline-line--heap" values={heapValues} />
        <Sparkline label="Load avg (1m)" colorClassName="runtime-monitor__sparkline-line runtime-monitor__sparkline-line--load" values={loadValues} />
      </div>
    </section>
  );
}
