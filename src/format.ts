import type { PortfolioData } from "./types.js";

// LAPRAS percentiles say how many people you are ahead of; "top N%" reads better.
export function topPercent(p: number | null): number | null {
  return p === null ? null : Math.max(1, Math.round(100 - p));
}

export function formatScore(n: number): string {
  return n.toFixed(2);
}

const letters = (words: string[]) =>
  words
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 3)
    .map((w) => w[0].toUpperCase())
    .join("");

export function initials(data: PortfolioData): string {
  return (
    letters(data.name.split(/\s+/)) || letters(data.laprasId.split(/[-_]/))
  );
}
