/** ISO-like local-day key, e.g. "2026-04-28". */
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function dayKeyForMs(ms: number): string {
  return dayKey(new Date(ms));
}

export function previousDayKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  // Construct at noon to dodge DST hour shifts.
  const prev = new Date(y, m - 1, d - 1, 12, 0, 0, 0);
  return dayKey(prev);
}
