const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days left to reverse a merge (part of a day counts), 0 once the window has closed. */
export function reversalDaysLeft(reversibleUntil: number | null, nowMs: number): number {
  const leftMs = (reversibleUntil ?? 0) - nowMs;
  return leftMs > 0 ? Math.ceil(leftMs / DAY_MS) : 0;
}
