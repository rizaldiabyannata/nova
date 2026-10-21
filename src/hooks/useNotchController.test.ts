import { describe, expect, it } from 'vitest';
import { notchReducer, type NotchEvent, type NotchState } from './useNotchController';

const compact: NotchState = { mode: 'compact', expression: 'idle' };
const run = (state: NotchState, ...events: NotchEvent['type'][]) =>
  events.reduce((s, type) => notchReducer(s, { type } as NotchEvent), state);

describe('notchReducer', () => {
  it('peeks on hover and shrinks back', () => {
    expect(run(compact, 'pointer-enter').mode).toBe('peek');
    expect(run(compact, 'pointer-enter', 'pointer-leave').mode).toBe('compact');
  });

  it('expands on click with a happy Lumi, and collapses on click or close', () => {
    expect(run(compact, 'toggle')).toEqual({ mode: 'expanded', expression: 'happy' });
    expect(run(compact, 'pointer-enter', 'toggle').mode).toBe('expanded');
    expect(run(compact, 'toggle', 'toggle').mode).toBe('compact');
    expect(run(compact, 'toggle', 'close').mode).toBe('compact');
  });

  it('keeps the panel open while the pointer moves', () => {
    expect(run(compact, 'toggle', 'pointer-leave', 'pointer-enter').mode).toBe('expanded');
  });

  it('lets events change the face but never the layout', () => {
    const next = notchReducer(compact, { type: 'react', expression: 'surprised' });
    expect(next).toEqual({ mode: 'compact', expression: 'surprised' });
    expect(notchReducer(next, { type: 'settle' }).expression).toBe('idle');
  });
});
