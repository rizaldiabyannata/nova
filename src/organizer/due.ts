import type { AgendaEvent, Alarm, Organizer } from './schema';

const pad = (n: number) => String(n).padStart(2, '0');
export const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Older than this when first seen (Nova was closed), an event is marked done without ringing. */
export const STALE_MS = 60 * 60 * 1000;

export interface Due {
  events: AgendaEvent[];
  alarms: Alarm[];
  /** Past events too old to announce. */
  stale: AgendaEvent[];
}

/** What should ring at `now`. Pure, so the minute tick only has to act on the answer. */
export function dueItems(org: Organizer, now: Date): Due {
  const pending = org.events.filter((e) => !e.notified && Date.parse(e.at) <= now.getTime());
  const today = localDate(now);
  const time = localTime(now);
  return {
    events: pending.filter((e) => now.getTime() - Date.parse(e.at) <= STALE_MS),
    stale: pending.filter((e) => now.getTime() - Date.parse(e.at) > STALE_MS),
    alarms: org.alarms.filter((a) => a.enabled && a.time === time && a.lastFiredOn !== today),
  };
}

/** Marks what `dueItems` returned as handled. */
export function markDone(org: Organizer, due: Due, now: Date): Organizer {
  const doneEvents = new Set([...due.events, ...due.stale].map((e) => e.id));
  const doneAlarms = new Set(due.alarms.map((a) => a.id));
  const today = localDate(now);
  return {
    ...org,
    events: org.events.map((e) => (doneEvents.has(e.id) ? { ...e, notified: true } : e)),
    alarms: org.alarms.map((a) => (doneAlarms.has(a.id) ? { ...a, lastFiredOn: today } : a)),
  };
}

/** Upcoming events in start order; past ones from earlier today stay so the day reads complete. */
export function upcomingEvents(org: Organizer, now: Date): AgendaEvent[] {
  const today = localDate(now);
  return org.events
    .filter((e) => Date.parse(e.at) >= now.getTime() || localDate(new Date(e.at)) === today)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

/** The enabled alarm that rings next, counting from `now`. */
export function nextAlarm(org: Organizer, now: Date): Alarm | undefined {
  const time = localTime(now);
  const enabled = org.alarms.filter((a) => a.enabled).sort((a, b) => a.time.localeCompare(b.time));
  return enabled.find((a) => a.time > time) ?? enabled[0];
}
