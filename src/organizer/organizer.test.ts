import { describe, expect, test } from 'vitest';
import { dueItems, markDone, nextAlarm, STALE_MS } from './due';
import { DEFAULT_ORGANIZER, normalizeOrganizer, sampleOrganizer, type Organizer } from './schema';

const at = (iso: string) => new Date(iso);
const org = (patch: Partial<Organizer>): Organizer => ({ ...structuredClone(DEFAULT_ORGANIZER), ...patch });
const event = (id: string, iso: string, notified = false) => ({ id, title: id, at: new Date(iso).toISOString(), notified });
const alarm = (id: string, time: string, patch = {}) => ({ id, label: '', time, enabled: true, lastFiredOn: null, ...patch });

describe('normalizeOrganizer', () => {
  test.each([null, 'x', [], { version: 2 }])('falls back to defaults for %j', (raw) => {
    expect(normalizeOrganizer(raw)).toEqual(DEFAULT_ORGANIZER);
  });

  test('first-run samples are valid and all still ahead', () => {
    const now = new Date('2026-10-21T23:50:00');
    const sample = sampleOrganizer(now);
    expect(normalizeOrganizer(sample)).toEqual(sample);
    expect(sample.events.every((e) => Date.parse(e.at) > now.getTime())).toBe(true);
    expect(dueItems(sample, now).events).toEqual([]);
  });

  test('keeps valid items and drops broken ones', () => {
    const raw = {
      version: 1,
      events: [event('ok', '2026-10-20T10:00'), { id: 'x', title: '', at: '2026-10-20' }, { id: 'y', title: 'bad date', at: 'soon' }, 'junk'],
      alarms: [alarm('a', '06:30'), alarm('b', '25:00'), { id: 'c' }],
      focus: { minutes: 999, endsAt: 'never' },
    };
    const o = normalizeOrganizer(raw);
    expect(o.events.map((e) => e.id)).toEqual(['ok']);
    expect(o.alarms.map((a) => a.id)).toEqual(['a']);
    expect(o.focus).toEqual({ minutes: 180, endsAt: null });
  });
});

describe('dueItems', () => {
  const now = at('2026-10-20T14:00:00');

  test('rings past, fresh events once and skips future ones', () => {
    const o = org({ events: [event('past', '2026-10-20T14:00'), event('future', '2026-10-20T14:01'), event('done', '2026-10-20T13:59', true)] });
    const due = dueItems(o, now);
    expect(due.events.map((e) => e.id)).toEqual(['past']);
    expect(dueItems(markDone(o, due, now), now).events).toEqual([]);
  });

  test('marks stale events done without ringing', () => {
    const o = org({ events: [event('old', new Date(now.getTime() - STALE_MS - 1).toISOString())] });
    const due = dueItems(o, now);
    expect(due.events).toEqual([]);
    expect(markDone(o, due, now).events[0].notified).toBe(true);
  });

  test('rings an enabled alarm at its minute, once per day', () => {
    const o = org({ alarms: [alarm('on', '14:00'), alarm('off', '14:00', { enabled: false }), alarm('later', '14:01')] });
    const due = dueItems(o, now);
    expect(due.alarms.map((a) => a.id)).toEqual(['on']);
    const after = markDone(o, due, now);
    expect(dueItems(after, now).alarms).toEqual([]);
    expect(dueItems(after, at('2026-10-21T14:00:00')).alarms.map((a) => a.id)).toEqual(['on']);
  });
});

test('nextAlarm wraps to tomorrow', () => {
  const o = org({ alarms: [alarm('morning', '06:30'), alarm('night', '22:00')] });
  expect(nextAlarm(o, at('2026-10-20T14:00:00'))?.id).toBe('night');
  expect(nextAlarm(o, at('2026-10-20T23:00:00'))?.id).toBe('morning');
});
