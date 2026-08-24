export function formatNumber(value: number | null): string {
  if (value === null) {
    return "n/a";
  }

  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

export function formatDecimal(value: number, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits }).format(value);
}

export function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let size = value / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${formatDecimal(size)} ${units[unitIndex]}`;
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatRelativeDaysAgo(value: string): string {
  const timestamp = new Date(value).getTime();
  const now = Date.now();
  const diffDays = Math.max(0, Math.floor((now - timestamp) / (1000 * 60 * 60 * 24)));

  if (diffDays === 0) {
    return "today";
  }

  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}
