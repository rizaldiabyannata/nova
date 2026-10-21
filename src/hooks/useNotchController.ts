import { useEffect, useReducer } from 'react';

export type NotchMode = 'compact' | 'peek' | 'expanded';
export type LumiExpression = 'idle' | 'happy' | 'surprised' | 'thinking' | 'sleepy';

export interface NotchState {
  mode: NotchMode;
  expression: LumiExpression;
}

export type NotchEvent =
  | { type: 'pointer-enter' }
  | { type: 'pointer-leave' }
  | { type: 'toggle' }
  | { type: 'close' }
  | { type: 'react'; expression: LumiExpression }
  | { type: 'settle' };

/** Every notch transition lives here. Events only change Lumi's face; only the user opens the panel. */
export function notchReducer(state: NotchState, event: NotchEvent): NotchState {
  switch (event.type) {
    case 'pointer-enter':
      return state.mode === 'compact' ? { ...state, mode: 'peek' } : state;
    case 'pointer-leave':
      return state.mode === 'peek' ? { ...state, mode: 'compact' } : state;
    case 'toggle':
      return state.mode === 'expanded' ? { ...state, mode: 'compact' } : { mode: 'expanded', expression: 'happy' };
    case 'close':
      return state.mode === 'expanded' ? { ...state, mode: 'compact' } : state;
    case 'react':
      return { ...state, expression: event.expression };
    case 'settle':
      return { ...state, expression: 'idle' };
  }
}

const REACTION_MS = 1600;

export function useNotchController() {
  const [state, dispatch] = useReducer(notchReducer, { mode: 'compact', expression: 'idle' });

  // A reaction plays once, then Lumi goes back to idle.
  useEffect(() => {
    if (state.expression === 'idle') return;
    const id = setTimeout(() => dispatch({ type: 'settle' }), REACTION_MS);
    return () => clearTimeout(id);
  }, [state.expression]);

  return [state, dispatch] as const;
}
