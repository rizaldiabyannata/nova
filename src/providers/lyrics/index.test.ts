import { expect, test } from 'vitest';
import { lineAt, parseLrc, pickLyrics } from './index';

test('parses LRC lines, multiple stamps and blank lines, sorted by time', () => {
  expect(parseLrc('[ar:Band]\n[00:32.47]Look at the stars\n[00:40.36]\n[00:10.00][01:00.5]Chorus')).toEqual([
    { ms: 10000, text: 'Chorus' },
    { ms: 32470, text: 'Look at the stars' },
    { ms: 40360, text: '' },
    { ms: 60500, text: 'Chorus' },
  ]);
});

test('finds the line being sung', () => {
  const lines = parseLrc('[00:01.00]a\n[00:05.00]b');
  expect(lineAt(lines, 0)).toBe(-1);
  expect(lineAt(lines, 1000)).toBe(0);
  expect(lineAt(lines, 4999)).toBe(0);
  expect(lineAt(lines, 99999)).toBe(1);
});

test('prefers synced lyrics matching the track length, then plain', () => {
  const hit = (duration: number, syncedLyrics: string | null, plainLyrics: string | null = null) => ({
    duration,
    instrumental: false,
    syncedLyrics,
    plainLyrics,
  });
  expect(pickLyrics([hit(100, '[00:01.00]wrong'), hit(200, '[00:01.00]right')], 200_000)).toEqual({
    synced: [{ ms: 1000, text: 'right' }],
  });
  expect(pickLyrics([hit(100, '[00:01.00]only')], 200_000)).toEqual({ synced: [{ ms: 1000, text: 'only' }] });
  expect(pickLyrics([hit(100, null, 'words')], 0)).toEqual({ plain: 'words' });
  expect(pickLyrics([], 0)).toBeNull();
});
