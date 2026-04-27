import { useEffect, useState } from 'react';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export function formatRelative(timestamp: number, now: number): string {
  const diff = Math.max(0, now - timestamp);
  if (diff < MIN) return 'just now';
  if (diff < HOUR) {
    const m = Math.floor(diff / MIN);
    return `${m} min ago`;
  }
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR);
    return h === 1 ? '1 hr ago' : `${h} hrs ago`;
  }
  const d = Math.floor(diff / DAY);
  return d === 1 ? '1 day ago' : `${d} days ago`;
}

/**
 * Returns a relative-time string ("4 min ago") that re-renders on a 60s timer.
 * Returns null when timestamp is null/undefined.
 */
export function useRelativeTime(timestamp: number | null | undefined): string | null {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  if (timestamp == null) return null;
  return formatRelative(timestamp, Date.now());
}
