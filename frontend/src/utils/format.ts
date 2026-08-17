// Compact number formatting for play counts / social-proof stats.
// 950 -> "950", 1200 -> "1.2K", 3_400_000 -> "3.4M"
export function formatCount(n?: number | null): string {
  const v = Number(n) || 0;
  if (v < 1000) return String(v);
  if (v < 1_000_000) {
    const k = v / 1000;
    return `${k >= 100 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")}K`;
  }
  const m = v / 1_000_000;
  return `${m >= 100 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, "")}M`;
}
