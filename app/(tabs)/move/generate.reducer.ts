import type { GeneratedRoutine } from '../../../lib/pal/types';

export type State =
  | { phase: 'idle';    prompt: string }
  | { phase: 'loading'; prompt: string }
  | { phase: 'error';   prompt: string; message: string }
  | { phase: 'result';  prompt: string; data: GeneratedRoutine };

export type Action =
  | { type: 'edit_prompt'; value: string }
  | { type: 'submit' }
  | { type: 'succeeded'; data: GeneratedRoutine }
  | { type: 'failed'; message: string }
  | { type: 'reset' };

export const initialState: State = { phase: 'idle', prompt: '' };

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'edit_prompt':
      // Allow editing in idle and error; ignore otherwise.
      if (state.phase === 'idle' || state.phase === 'error') {
        return { ...state, prompt: action.value };
      }
      return state;

    case 'submit':
      if (state.phase !== 'idle' && state.phase !== 'error') return state;
      if (state.prompt.trim().length === 0) return state;
      return { phase: 'loading', prompt: state.prompt };

    case 'succeeded':
      if (state.phase !== 'loading') return state;
      return { phase: 'result', prompt: state.prompt, data: action.data };

    case 'failed':
      if (state.phase !== 'loading') return state;
      return { phase: 'error', prompt: state.prompt, message: action.message };

    case 'reset':
      if (state.phase !== 'result') return state;
      return { phase: 'idle', prompt: '' };
  }
}
