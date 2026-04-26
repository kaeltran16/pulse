/** @jest-environment node */
import { formatRelativeDate } from '../date-format';

// Anchor: Wednesday April 22, 2026 14:00 local
const NOW = new Date(2026, 3, 22, 14, 0, 0).getTime();

describe('formatRelativeDate', () => {
  it('returns "Just now" for < 60s ago', () => {
    expect(formatRelativeDate(NOW - 30_000, NOW)).toBe('Just now');
    expect(formatRelativeDate(NOW - 59_000, NOW)).toBe('Just now');
  });

  it('returns "Today" for same calendar day, > 60s ago', () => {
    const earlierToday = new Date(2026, 3, 22, 8, 0, 0).getTime();
    expect(formatRelativeDate(earlierToday, NOW)).toBe('Today');
  });

  it('returns "Yesterday" for previous calendar day', () => {
    const yesterday = new Date(2026, 3, 21, 23, 0, 0).getTime();
    expect(formatRelativeDate(yesterday, NOW)).toBe('Yesterday');
  });

  it('returns weekday short name for 2-7 days ago', () => {
    const monday = new Date(2026, 3, 20, 12, 0, 0).getTime();
    expect(formatRelativeDate(monday, NOW)).toBe('Mon');
    const lastWed = new Date(2026, 3, 15, 12, 0, 0).getTime();
    expect(formatRelativeDate(lastWed, NOW)).toBe('Wed');
  });

  it('returns "MMM d" for current year (> 7 days ago)', () => {
    const earlier = new Date(2026, 2, 14, 12, 0, 0).getTime(); // March 14
    expect(formatRelativeDate(earlier, NOW)).toBe('Mar 14');
  });

  it('returns "MMM d, yyyy" for prior years', () => {
    const lastYear = new Date(2025, 9, 14, 12, 0, 0).getTime(); // Oct 14 2025
    expect(formatRelativeDate(lastYear, NOW)).toBe('Oct 14, 2025');
  });

  it('uses calendar comparison, not 24h offset (DST-safe)', () => {
    // ts is 25h before NOW but on the previous calendar day -> "Yesterday"
    const ts = new Date(2026, 3, 21, 13, 0, 0).getTime();
    expect(formatRelativeDate(ts, NOW)).toBe('Yesterday');
  });
});
