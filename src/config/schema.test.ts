import { describe, expect, test } from 'vitest';
import { DEFAULT_CONFIG, normalizeConfig } from './schema';

const valid = (patch: Record<string, unknown> = {}) => ({ ...structuredClone(DEFAULT_CONFIG), ...patch });

describe('normalizeConfig', () => {
  test.each([null, undefined, 'x', 42, [], { version: 2 }, { animation: 'gentle' }])(
    'falls back to defaults for %j',
    (raw) => expect(normalizeConfig(raw)).toEqual(DEFAULT_CONFIG),
  );

  test('keeps a valid config as is', () => {
    const cfg = valid({ animation: 'gentle', rotationEnabled: false, reduceMotion: true, showClock: false, widgets: ['music', 'ai'] });
    expect(normalizeConfig(cfg)).toEqual(cfg);
  });

  test('returns a copy, never the shared default', () => {
    normalizeConfig(null).mascot.name = 'changed';
    expect(DEFAULT_CONFIG.mascot.name).toBe('Lumi');
  });

  test.each([
    [1, 5],
    [999, 60],
    [12.6, 13],
    [Number.NaN, 15],
    ['20', 15],
  ])('clamps interval %j to %j', (input, expected) => {
    expect(normalizeConfig(valid({ rotationIntervalSeconds: input })).rotationIntervalSeconds).toBe(expected);
  });

  test.each([
    [[], DEFAULT_CONFIG.widgets],
    [['bogus'], DEFAULT_CONFIG.widgets],
    ['ai', DEFAULT_CONFIG.widgets],
    [['agenda', 'bogus', 'agenda'], ['agenda']],
  ])('widgets %j become %j', (input, expected) => {
    expect(normalizeConfig(valid({ widgets: input })).widgets).toEqual(expected);
  });

  test('validates mascot fields one by one', () => {
    const m = (mascot: unknown) => normalizeConfig(valid({ mascot })).mascot;
    expect(m({ name: '  Lumi ', emoji: '👩‍💻', accent: '#ABCDEF' })).toEqual({ name: 'Lumi', emoji: '👩‍💻', accent: '#abcdef' }); // taste-skill-ignore: test data
    expect(m({ name: '', emoji: 'ab', accent: 'red' })).toEqual(DEFAULT_CONFIG.mascot);
    expect(m({ name: 'x'.repeat(25) }).name).toBe('Lumi');
    expect(m('broken')).toEqual(DEFAULT_CONFIG.mascot);
  });

  test('rejects unknown enum and boolean values', () => {
    const cfg = normalizeConfig(valid({ animation: 'wild', idleDisplay: 'weather', reduceMotion: 'yes', rotationEnabled: 1, showClock: 0 }));
    expect(cfg.animation).toBe('playful');
    expect(cfg.idleDisplay).toBe('ai');
    expect(cfg.reduceMotion).toBe(false);
    expect(cfg.rotationEnabled).toBe(true);
    expect(cfg.showClock).toBe(true);
  });
});
