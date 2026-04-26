export type RestTimerState =
  | { status: 'idle' }
  | { status: 'running'; startedAt: number; durationMs: number };

export type RestTimerEvent =
  | { type: 'START';   now: number; durationMs: number }
  | { type: 'TICK';    now: number }
  | { type: 'ADD_30S' }
  | { type: 'SKIP' };

export function reduce(state: RestTimerState, event: RestTimerEvent): RestTimerState {
  switch (event.type) {
    case 'START':
      return { status: 'running', startedAt: event.now, durationMs: event.durationMs };
    case 'TICK':
      return state;
    case 'ADD_30S':
      if (state.status !== 'running') return state;
      return { status: 'running', startedAt: state.startedAt, durationMs: state.durationMs + 30_000 };
    case 'SKIP':
      if (state.status !== 'running') return state;
      return { status: 'idle' };
  }
}

export function remainingMs(state: RestTimerState, now: number): number {
  if (state.status !== 'running') return 0;
  return Math.max(0, state.durationMs - (now - state.startedAt));
}

export function isOvertime(state: RestTimerState, now: number): boolean {
  if (state.status !== 'running') return false;
  return now - state.startedAt >= state.durationMs;
}
