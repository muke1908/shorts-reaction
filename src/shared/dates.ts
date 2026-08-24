export function toDayBucket(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

export function hoursSince(timestamp: string, now = Date.now()): number {
  const then = new Date(timestamp).getTime();
  return Math.max((now - then) / 3_600_000, 1);
}

export function parseIsoDuration(value: string): number | null {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value);
  if (!match) {
    return null;
  }

  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return hours * 3600 + minutes * 60 + seconds;
}

export function isSameUtcDay(timestamp: string, day: string): boolean {
  return toDayBucket(timestamp) === day;
}
