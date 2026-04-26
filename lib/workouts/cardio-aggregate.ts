export function paceMinPerKm(durationSeconds: number, distanceKm: number): number | null {
  if (distanceKm <= 0 || durationSeconds <= 0) return null;
  return (durationSeconds / 60) / distanceKm;
}

export function formatPace(minPerKm: number | null): string {
  if (minPerKm === null) return '—';
  const min = Math.floor(minPerKm);
  const sec = Math.round((minPerKm - min) * 60);
  if (sec === 60) return `${min + 1}:00`;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}
