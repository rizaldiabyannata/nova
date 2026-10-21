import { expect, test } from 'vitest';
import { SWIPE_START, swipeStep, type SwipeState } from './useSwipe';

const run = (events: [dx: number, dy: number, t: number][]) => {
  let s: SwipeState = SWIPE_START;
  return events.map(([dx, dy, t]) => {
    const [next, step] = swipeStep(s, dx, dy, t);
    s = next;
    return step;
  });
};

test('one swipe turns exactly one page, kinetic tail included', () => {
  expect(run([[20, 0, 0], [30, 0, 16], [30, 0, 32], [40, 0, 48], [40, 0, 64]])).toEqual([0, 0, 1, 0, 0]);
});

test('swiping the other way goes back', () => {
  expect(run([[-70, 0, 0]])).toEqual([-1]);
});

test('a pause starts a new gesture', () => {
  expect(run([[70, 0, 0], [70, 0, 100], [70, 0, 500]])).toEqual([1, 0, 1]);
});

test('vertical scrolling never turns the page', () => {
  expect(run([[30, 40, 0], [30, 40, 16], [30, 40, 32]])).toEqual([0, 0, 0]);
});
