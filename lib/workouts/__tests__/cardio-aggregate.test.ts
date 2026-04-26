/** @jest-environment node */
import { paceMinPerKm, formatPace, formatDuration } from '../cardio-aggregate';

describe('paceMinPerKm', () => {
  it('returns null when distance is 0 or negative', () => {
    expect(paceMinPerKm(1800, 0)).toBeNull();
    expect(paceMinPerKm(1800, -1)).toBeNull();
  });

  it('returns null when duration is 0 or negative', () => {
    expect(paceMinPerKm(0, 5)).toBeNull();
    expect(paceMinPerKm(-1, 5)).toBeNull();
  });

  it('computes min/km for a typical run (5k in 25 min → 5:00 pace)', () => {
    expect(paceMinPerKm(25 * 60, 5)).toBeCloseTo(5);
  });

  it('computes min/km for a slower run (3k in 18 min → 6:00 pace)', () => {
    expect(paceMinPerKm(18 * 60, 3)).toBeCloseTo(6);
  });
});

describe('formatPace', () => {
  it('formats null as em-dash', () => {
    expect(formatPace(null)).toBe('—');
  });

  it('formats whole minutes', () => {
    expect(formatPace(5)).toBe('5:00');
  });

  it('formats fractional minutes correctly', () => {
    expect(formatPace(5.5)).toBe('5:30');
  });

  it('rounds seconds to nearest', () => {
    expect(formatPace(5.25)).toBe('5:15');
    expect(formatPace(5.75)).toBe('5:45');
  });
});

describe('formatDuration', () => {
  it('formats sub-hour as mm:ss', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(45)).toBe('0:45');
    expect(formatDuration(60)).toBe('1:00');
    expect(formatDuration(125)).toBe('2:05');
    expect(formatDuration(60 * 30)).toBe('30:00');
  });

  it('formats one-hour-plus as h:mm:ss', () => {
    expect(formatDuration(60 * 60)).toBe('1:00:00');
    expect(formatDuration(60 * 60 + 125)).toBe('1:02:05');
  });
});
