export const ORGANIZER_VERSION = 1;

export interface AgendaEvent {
  id: string;
  title: string;
  /** ISO timestamp of when it starts. */
  at: string;
  notified: boolean;
}

export interface Alarm {
  id: string;
  label: string;
  /** Local wall-clock time, HH:MM, fired every day while enabled. */
  time: string;
  enabled: boolean;
  /** Local date (YYYY-MM-DD) it last rang, so a restart in the same minute does not ring twice. */
  lastFiredOn: string | null;
}

export interface Organizer {
  version: typeof ORGANIZER_VERSION;
  events: AgendaEvent[];
  alarms: Alarm[];
  focus: { minutes: number; endsAt: string | null };
}

export const TITLE_MAX = 60;
export const FOCUS_MIN = 1;
export const FOCUS_MAX = 180;

export const DEFAULT_ORGANIZER: Organizer = {
  version: ORGANIZER_VERSION,
  events: [],
  alarms: [],
  focus: { minutes: 25, endsAt: null },
};

/**
 * First-run examples, so a fresh Nova shows what Agenda and Alarm do; they are removed like any other item.
 * Events sit ahead of `now`, so none is already due (and notified) the moment Nova starts.
 */
export function sampleOrganizer(now: Date): Organizer {
  const after = (minutes: number) => {
    const d = new Date(now.getTime() + minutes * 60_000);
    d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
    return d.toISOString();
  };
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(9, 30, 0, 0);
  const event = (title: string, at: string): AgendaEvent => ({ id: crypto.randomUUID(), title, at, notified: false });
  const alarm = (time: string, label: string, enabled: boolean): Alarm => ({ id: crypto.randomUUID(), label, time, enabled, lastFiredOn: null });
  return {
    ...structuredClone(DEFAULT_ORGANIZER),
    events: [
      event('Design catch-up', after(45)),
      event('A little room to think', after(180)),
      event('Weekly planning', tomorrow.toISOString()),
    ],
    alarms: [alarm('07:30', 'A gentle start', true), alarm('09:00', 'Make something good', false)],
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const text = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, TITLE_MAX) : '');
const isIso = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v));
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Turns anything read from disk into a valid Organizer; a bad item is dropped instead of losing the rest (NFR-004). */
export function normalizeOrganizer(raw: unknown): Organizer {
  if (!isRecord(raw) || raw.version !== ORGANIZER_VERSION) return structuredClone(DEFAULT_ORGANIZER);
  const list = (v: unknown) => (Array.isArray(v) ? v.filter(isRecord) : []);

  const events = list(raw.events).flatMap((e): AgendaEvent[] => {
    const title = text(e.title);
    return typeof e.id === 'string' && title && isIso(e.at)
      ? [{ id: e.id, title, at: e.at, notified: e.notified === true }]
      : [];
  });
  const alarms = list(raw.alarms).flatMap((a): Alarm[] =>
    typeof a.id === 'string' && typeof a.time === 'string' && TIME_RE.test(a.time)
      ? [{
          id: a.id,
          label: text(a.label),
          time: a.time,
          enabled: a.enabled !== false,
          lastFiredOn: typeof a.lastFiredOn === 'string' ? a.lastFiredOn : null,
        }]
      : [],
  );
  const focus = isRecord(raw.focus) ? raw.focus : {};
  const minutes = focus.minutes;
  return {
    version: ORGANIZER_VERSION,
    events,
    alarms,
    focus: {
      minutes:
        typeof minutes === 'number' && Number.isFinite(minutes)
          ? Math.min(FOCUS_MAX, Math.max(FOCUS_MIN, Math.round(minutes)))
          : DEFAULT_ORGANIZER.focus.minutes,
      endsAt: isIso(focus.endsAt) ? focus.endsAt : null,
    },
  };
}
