import os from "node:os";
import process from "node:process";
import type { ServerRuntimeStatus } from "../shared/types";

interface RuntimeSample {
  timestampMs: number;
  cpuUsage: NodeJS.CpuUsage;
}

let previousSample: RuntimeSample | null = null;

function round(value: number, digits: number): number {
  return Number(value.toFixed(digits));
}

export function getServerRuntimeStatus(): ServerRuntimeStatus {
  const nowMs = Date.now();
  const currentCpuUsage = process.cpuUsage();
  let cpuPercent = 0;

  if (previousSample) {
    const elapsedMicros = (nowMs - previousSample.timestampMs) * 1000;
    const cpuMicros =
      currentCpuUsage.user -
      previousSample.cpuUsage.user +
      currentCpuUsage.system -
      previousSample.cpuUsage.system;

    if (elapsedMicros > 0) {
      cpuPercent = round((cpuMicros / elapsedMicros) * 100, 1);
    }
  }

  previousSample = {
    timestampMs: nowMs,
    cpuUsage: currentCpuUsage
  };

  const memory = process.memoryUsage();

  return {
    pid: process.pid,
    sampledAt: new Date(nowMs).toISOString(),
    uptimeSeconds: round(process.uptime(), 1),
    cpuPercent,
    cpuCoreCount: os.cpus().length,
    rssBytes: memory.rss,
    heapUsedBytes: memory.heapUsed,
    heapTotalBytes: memory.heapTotal,
    externalBytes: memory.external,
    arrayBuffersBytes: memory.arrayBuffers,
    loadAverage: os.loadavg() as [number, number, number],
    nodeVersion: process.version,
    platform: process.platform
  };
}
