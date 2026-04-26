/** @jest-environment node */
import { initialState, reducer, type State } from '../generate.reducer';
import type { GeneratedRoutine } from '../../../../lib/pal/types';

const data: GeneratedRoutine = {
  tag: 'Upper', name: 'x', estMin: 30, rationale: 'r',
  exercises: [
    { id: 'bench', sets: [{ reps: 5, weight: 80 }, { reps: 5, weight: 80 }, { reps: 5, weight: 80 }] },
    { id: 'ohp',   sets: [{ reps: 8, weight: 40 }, { reps: 8, weight: 40 }, { reps: 8, weight: 40 }] },
    { id: 'tricep-rope', sets: [{ reps: 12, weight: 25 }, { reps: 12, weight: 25 }, { reps: 12, weight: 25 }] },
  ],
};

describe('generate reducer', () => {
  it('initialState is idle with empty prompt', () => {
    expect(initialState).toEqual({ phase: 'idle', prompt: '' });
  });

  it('edit_prompt updates the prompt while in idle', () => {
    const s = reducer({ phase: 'idle', prompt: '' }, { type: 'edit_prompt', value: 'push day' });
    expect(s).toEqual({ phase: 'idle', prompt: 'push day' });
  });

  it('edit_prompt updates the prompt while in error (so user can retry with edits)', () => {
    const s = reducer({ phase: 'error', prompt: 'old', message: 'oops' }, { type: 'edit_prompt', value: 'new' });
    expect(s).toEqual({ phase: 'error', prompt: 'new', message: 'oops' });
  });

  it('submit moves idle → loading', () => {
    const s = reducer({ phase: 'idle', prompt: 'push day' }, { type: 'submit' });
    expect(s).toEqual({ phase: 'loading', prompt: 'push day' });
  });

  it('submit moves error → loading (preserving prompt)', () => {
    const s = reducer({ phase: 'error', prompt: 'pull', message: 'oops' }, { type: 'submit' });
    expect(s).toEqual({ phase: 'loading', prompt: 'pull' });
  });

  it('submit is a no-op while already loading', () => {
    const before: State = { phase: 'loading', prompt: 'x' };
    expect(reducer(before, { type: 'submit' })).toBe(before);
  });

  it('submit is a no-op when prompt is empty / whitespace-only', () => {
    const before: State = { phase: 'idle', prompt: '   ' };
    expect(reducer(before, { type: 'submit' })).toBe(before);
  });

  it('succeeded moves loading → result', () => {
    const s = reducer({ phase: 'loading', prompt: 'push day' }, { type: 'succeeded', data });
    expect(s.phase).toBe('result');
    if (s.phase === 'result') expect(s.data).toBe(data);
  });

  it('succeeded is ignored outside loading', () => {
    const before: State = { phase: 'idle', prompt: 'x' };
    expect(reducer(before, { type: 'succeeded', data })).toBe(before);
  });

  it('failed moves loading → error', () => {
    const s = reducer({ phase: 'loading', prompt: 'push day' }, { type: 'failed', message: 'oops' });
    expect(s).toEqual({ phase: 'error', prompt: 'push day', message: 'oops' });
  });

  it('failed is ignored outside loading', () => {
    const before: State = { phase: 'idle', prompt: 'x' };
    expect(reducer(before, { type: 'failed', message: 'oops' })).toBe(before);
  });

  it('reset moves result → idle and clears prompt', () => {
    const s = reducer({ phase: 'result', prompt: 'push day', data }, { type: 'reset' });
    expect(s).toEqual({ phase: 'idle', prompt: '' });
  });

  it('reset is a no-op outside result', () => {
    const before: State = { phase: 'idle', prompt: 'x' };
    expect(reducer(before, { type: 'reset' })).toBe(before);
  });
});
