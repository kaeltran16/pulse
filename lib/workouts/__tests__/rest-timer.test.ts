/** @jest-environment node */
import { reduce, type RestTimerState } from '../rest-timer';

describe('rest timer reducer', () => {
  const idle: RestTimerState = { status: 'idle' };
  const running = (startedAt: number, durationMs: number): RestTimerState =>
    ({ status: 'running', startedAt, durationMs });

  it('START from idle → running', () => {
    const next = reduce(idle, { type: 'START', now: 1000, durationMs: 90_000 });
    expect(next).toEqual(running(1000, 90_000));
  });

  it('START from running → running (replaces)', () => {
    const next = reduce(running(1000, 90_000), { type: 'START', now: 5000, durationMs: 60_000 });
    expect(next).toEqual(running(5000, 60_000));
  });

  it('TICK while running and not yet expired → unchanged', () => {
    const state = running(1000, 90_000);
    const next = reduce(state, { type: 'TICK', now: 5000 });
    expect(next).toBe(state);
  });

  it('TICK while running and expired → unchanged (banner persists)', () => {
    const state = running(1000, 90_000);
    const next = reduce(state, { type: 'TICK', now: 200_000 });
    expect(next).toBe(state);
  });

  it('TICK from idle → unchanged (no-op)', () => {
    const next = reduce(idle, { type: 'TICK', now: 5000 });
    expect(next).toBe(idle);
  });

  it('ADD_30S while running → durationMs +30000', () => {
    const next = reduce(running(1000, 60_000), { type: 'ADD_30S' });
    expect(next).toEqual(running(1000, 90_000));
  });

  it('ADD_30S from idle → unchanged', () => {
    const next = reduce(idle, { type: 'ADD_30S' });
    expect(next).toBe(idle);
  });

  it('SKIP from running → idle', () => {
    const next = reduce(running(1000, 60_000), { type: 'SKIP' });
    expect(next).toEqual(idle);
  });

  it('SKIP from idle → unchanged', () => {
    const next = reduce(idle, { type: 'SKIP' });
    expect(next).toBe(idle);
  });

  it('handles a realistic sequence: START → TICK → ADD_30S → TICK → SKIP', () => {
    let s: RestTimerState = idle;
    s = reduce(s, { type: 'START', now: 1000, durationMs: 60_000 });
    s = reduce(s, { type: 'TICK', now: 30_000 });
    s = reduce(s, { type: 'ADD_30S' });
    s = reduce(s, { type: 'TICK', now: 60_000 });
    expect(s).toEqual(running(1000, 90_000));
    s = reduce(s, { type: 'SKIP' });
    expect(s).toEqual(idle);
  });
});
