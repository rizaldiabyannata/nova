// @vitest-environment jsdom
import { expect, test } from 'vitest';
import { DEFAULT_ORGANIZER } from '../../organizer/schema';
import type { Track } from '../../providers/media';
import { liveStatus, statusOf } from './Widgets';

const track: Track = { title: 'Song', artist: 'Band', player: 'Spotify', playing: true, canNext: true, canPrev: true, positionMs: 0, lengthMs: 0, album: '', artUrl: '', canSeek: false, volume: null };

test.each([
  [undefined, { label: 'Loading', tone: 'off' }],
  ['unavailable' as const, { label: 'Unavailable', tone: 'bad' }],
  [null, { label: 'Nothing playing', tone: 'off' }],
  [track, { label: 'Song', tone: 'ok' }],
  [{ ...track, title: '' }, { label: 'Playing', tone: 'ok' }],
  [{ ...track, playing: false }, { label: 'Paused', tone: 'off' }],
])('music status for %j is %j', (media, expected) => {
  expect(statusOf('music', null, media)).toEqual(expected);
});

test('organizer statuses are text', () => {
  const now = new Date('2026-10-20T14:00:00');
  const empty = structuredClone(DEFAULT_ORGANIZER);
  expect(statusOf('agenda', null, undefined, empty, now).label).toBe('Nothing planned');
  expect(statusOf('alarm', null, undefined, empty, now).label).toBe('No alarms');
  expect(statusOf('focus', null, undefined, empty, now)).toEqual({ label: 'Ready', tone: 'off' });

  const busy = {
    ...empty,
    alarms: [{ id: 'a', label: '', time: '06:30', enabled: true, lastFiredOn: null }],
    focus: { minutes: 25, endsAt: new Date(now.getTime() + 12 * 60_000).toISOString() },
  };
  expect(statusOf('alarm', null, undefined, busy, now).label).toBe('Next 06:30');
  expect(statusOf('focus', null, undefined, busy, now)).toEqual({ label: 'Focus 12m left', tone: 'ok' });
});

test('compact shows the most urgent live item: focus, then a playing track, then an event soon', () => {
  const now = new Date('2026-10-20T14:00:00');
  const at = (min: number) => new Date(now.getTime() + min * 60_000).toISOString();
  const soon = { ...structuredClone(DEFAULT_ORGANIZER), events: [{ id: 'e', title: 'Standup', at: at(10), notified: false }] };
  const later = { ...soon, events: [{ ...soon.events[0], at: at(60) }] };
  const focusing = { ...soon, focus: { minutes: 25, endsAt: at(12) } };

  expect(liveStatus(null, structuredClone(DEFAULT_ORGANIZER), now)).toBeNull();
  expect(liveStatus(null, later, now)).toBeNull();
  expect(liveStatus(null, soon, now)?.widget).toBe('agenda');
  expect(liveStatus(track, soon, now)?.widget).toBe('music');
  expect(liveStatus({ ...track, playing: false }, soon, now)?.widget).toBe('agenda');
  expect(liveStatus(track, focusing, now)).toEqual({ widget: 'focus', status: { label: 'Focus 12m left', tone: 'ok' } });
});
