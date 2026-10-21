// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useRotation } from './useRotation';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const tick = (ms: number) => act(() => vi.advanceTimersByTime(ms));

test('advances every interval and wraps around', () => {
  const { result } = renderHook(() => useRotation(3, 15, true));
  tick(14_999);
  expect(result.current[0]).toBe(0);
  tick(1);
  expect(result.current[0]).toBe(1);
  tick(30_000);
  expect(result.current[0]).toBe(0);
});

test('pauses while inactive (panel or settings open) and resumes after', () => {
  const { result, rerender } = renderHook(({ active }) => useRotation(3, 15, active), {
    initialProps: { active: true },
  });
  rerender({ active: false });
  tick(60_000);
  expect(result.current[0]).toBe(0);
  rerender({ active: true });
  tick(15_000);
  expect(result.current[0]).toBe(1);
});

test('keeps a single timer across changes and clears it on unmount', () => {
  const { rerender, unmount } = renderHook(({ s }) => useRotation(3, s, true), { initialProps: { s: 15 } });
  expect(vi.getTimerCount()).toBe(1);
  rerender({ s: 30 });
  expect(vi.getTimerCount()).toBe(1);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

test('does not run a timer for a single widget', () => {
  renderHook(() => useRotation(1, 15, true));
  expect(vi.getTimerCount()).toBe(0);
});
