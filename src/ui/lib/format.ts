export function formatNumber(value: number | null): string {
  if (value === null) {
    return "n/a";
  }

  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
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
