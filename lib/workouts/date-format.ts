const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function startOfDay(at: number): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dayDiff(now: number, ts: number): number {
  return Math.round((startOfDay(now) - startOfDay(ts)) / (24 * 60 * 60 * 1000));
}

export function formatRelativeDate(timestamp: number, now: number): string {
  const ms = now - timestamp;
  if (ms < 60_000) return 'Just now';

  const days = dayDiff(now, timestamp);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days >= 2 && days <= 7) {
    return WEEKDAYS[new Date(timestamp).getDay()];
  }

  const d = new Date(timestamp);
  const sameYear = new Date(now).getFullYear() === d.getFullYear();
  const monthDay = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return sameYear ? monthDay : `${monthDay}, ${d.getFullYear()}`;
}
