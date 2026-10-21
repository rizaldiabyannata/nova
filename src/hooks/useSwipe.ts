import { useRef, type WheelEvent } from 'react';

/** Horizontal travel (px) a two-finger swipe needs before it turns the page. */
const THRESHOLD = 60;
/** A pause this long (ms) between wheel events ends the gesture, including its kinetic tail. */
const GESTURE_GAP = 300;

export interface SwipeState {
  acc: number;
  locked: boolean;
  last: number;
}

export const SWIPE_START: SwipeState = { acc: 0, locked: false, last: -Infinity };

/** One wheel event in; at most one page step (+1 next, -1 previous) per gesture out. */
export function swipeStep(state: SwipeState, dx: number, dy: number, t: number): [SwipeState, -1 | 0 | 1] {
  const s = t - state.last > GESTURE_GAP ? { ...SWIPE_START } : { ...state };
  s.last = t;
  if (s.locked || Math.abs(dx) <= Math.abs(dy)) return [s, 0];
  s.acc += dx;
  if (Math.abs(s.acc) < THRESHOLD) return [s, 0];
  const step = s.acc > 0 ? 1 : -1;
  return [{ acc: 0, locked: true, last: t }, step];
}

/**
 * Touchpad two-finger swipes reach the webview as horizontal wheel events.
 * With natural scrolling, fingers moving left give dx > 0, which reads as "next".
 */
export function useSwipe(onStep: (step: -1 | 1) => void) {
  const state = useRef(SWIPE_START);
  return (e: WheelEvent) => {
    const [next, step] = swipeStep(state.current, e.deltaX, e.deltaY, e.timeStamp);
    state.current = next;
    if (step) onStep(step);
  };
}
