import { useEffect, useId, useReducer, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import type { WidgetId } from '../../config/schema';
import { useOrganizerContext } from '../../hooks/useOrganizer';
import { localDate, localTime, nextAlarm, upcomingEvents } from '../../organizer/due';
import { FOCUS_MAX, FOCUS_MIN, TITLE_MAX, type Organizer } from '../../organizer/schema';
import type { Status } from './Widgets';

const hm = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const whenLabel = (at: string, now: Date) => {
  const d = new Date(at);
  return localDate(d) === localDate(now) ? hm(d) : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${hm(d)}`;
};
const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** A distance in time in words, always naming its baseline ("in 9 min", "in 7 h 40 min"). */
export function inWords(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000));
  if (min < 1) return 'now';
  if (min < 60) return `in ${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `in ${h} h ${m} min` : `in ${h} h`;
}

/** An event this close is live: it may take over the compact notch. */
export const SOON_MS = 15 * 60_000;

const nextEvent = (org: Organizer, now: Date) => upcomingEvents(org, now).find((e) => Date.parse(e.at) >= now.getTime());

/** When an alarm at HH:MM next rings, counting from `now` (today if still ahead, else tomorrow). */
function nextRing(time: string, now: Date): Date {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
  return d;
}

/** One-line idle status for the organizer widgets. Always text (UC-01); `ok` only while it needs attention. */
export function organizerStatus(widget: 'agenda' | 'alarm' | 'focus', org: Organizer, now: Date): Status {
  if (widget === 'agenda') {
    const next = nextEvent(org, now);
    if (!next) return { label: 'Nothing planned', tone: 'off' };
    const soon = Date.parse(next.at) - now.getTime() <= SOON_MS;
    return { label: `${whenLabel(next.at, now)} ${next.title}`, tone: soon ? 'ok' : 'off' };
  }
  if (widget === 'alarm') {
    const next = nextAlarm(org, now);
    return next ? { label: `Next ${next.time}`, tone: 'off' } : { label: 'No alarms', tone: 'off' };
  }
  const { endsAt } = org.focus;
  if (!endsAt) return { label: 'Ready', tone: 'off' };
  return { label: `Focus ${Math.max(1, Math.ceil((Date.parse(endsAt) - now.getTime()) / 60_000))}m left`, tone: 'ok' };
}

/** What the compact notch shows, most urgent first: a running focus, then an event within 15 minutes. */
export function liveOrganizer(org: Organizer, now: Date): { widget: WidgetId; status: Status } | null {
  if (org.focus.endsAt) return { widget: 'focus', status: organizerStatus('focus', org, now) };
  const agenda = organizerStatus('agenda', org, now);
  return agenda.tone === 'ok' ? { widget: 'agenda', status: agenda } : null;
}

const newId = () => crypto.randomUUID();
const svg = { width: 16, height: 16, viewBox: '0 0 24 24', 'aria-hidden': true, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' } as const;

/** Every feature opens with its one fact, set large, and a plain line saying what it means. */
export function Lead({ value, caption, figure = false }: { value: ReactNode; caption?: ReactNode; figure?: boolean }) {
  return (
    <div className="lead">
      <p className={figure ? 'lead-value figure' : 'lead-value'}>{value}</p>
      {caption && <p className="lead-caption">{caption}</p>}
    </div>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="icon-btn small row-remove" aria-label={label} onClick={onClick}>
      <svg {...svg}><path d="M6 6l12 12M18 6L6 18" /></svg>
    </button>
  );
}

function AddToggle({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="add-toggle" onClick={onClick}>
      <svg {...svg}><path d="M12 5v14M5 12h14" /></svg>
      {label}
    </button>
  );
}

interface Entry {
  title: string;
  time: string;
  /** YYYY-MM-DD; events only. */
  date: string;
}

/**
 * The add form takes the page while open, so the list reads first and the form gets the room.
 * Labels stay above their fields; errors are written out, not left to browser bubbles.
 */
function EntryForm({ kind, onAdd, onCancel }: { kind: 'event' | 'alarm'; onAdd: (entry: Entry) => void; onCancel: () => void }) {
  const [error, setError] = useState<{ field: keyof Entry; message: string } | null>(null);
  const errorId = useId();
  const now = new Date();
  // An event defaults to the next whole hour, which is always ahead (and may be tomorrow).
  const next = new Date(now);
  next.setHours(now.getHours() + 1, 0, 0, 0);
  const event = kind === 'event';
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const entry = { title: String(data.get('title') ?? '').trim(), time: String(data.get('time') ?? ''), date: String(data.get('date') ?? '') };
    if (event && !entry.title) return setError({ field: 'title', message: 'Give your event a name.' });
    if (event && !entry.date) return setError({ field: 'date', message: 'Pick a date.' });
    if (!entry.time) return setError({ field: 'time', message: 'Pick a time.' });
    // datetime strings without a zone parse as local time.
    if (event && Date.parse(`${entry.date}T${entry.time}`) < Date.now()) return setError({ field: 'time', message: 'Pick a time that is still ahead.' });
    onAdd(entry);
  };
  // Only the field at fault turns red and points at the message.
  const invalid = (field: keyof Entry) => (error?.field === field ? { 'aria-invalid': true, 'aria-describedby': errorId } : {});
  return (
    <form
      className={`feature entry-form entry-${kind}`}
      aria-label={`New ${kind}`}
      noValidate
      onSubmit={submit}
      onChange={() => setError(null)}
      onKeyDown={(e) => e.key === 'Escape' && (e.preventDefault(), e.stopPropagation(), onCancel())}
    >
      <div className="entry-heading">
        <strong>New {kind}</strong>
        <span>Local time</span>
      </div>
      <div className="entry-fields">
        <label className="field">
          <span className="field-label">
            {event ? 'Event name' : 'Alarm label'}
            {!event && <small>Optional</small>}
          </span>
          <input name="title" placeholder={event ? 'e.g. Design catch-up' : 'e.g. A gentle start'} maxLength={TITLE_MAX} autoFocus {...invalid('title')} />
        </label>
        {event && (
          <label className="field">
            <span className="field-label">Date</span>
            <input name="date" type="date" min={localDate(now)} defaultValue={localDate(next)} {...invalid('date')} />
          </label>
        )}
        <label className="field">
          <span className="field-label">Time</span>
          <input name="time" type="time" defaultValue={event ? localTime(next) : '07:30'} {...invalid('time')} />
        </label>
        {/* Above the buttons, so it is in view the moment Add is pressed. */}
        {error && (
          <p className="field-error" role="alert" id={errorId}>
            {error.message}
          </p>
        )}
        <div className="entry-actions">
          <button type="button" className="text-btn quiet" onClick={onCancel}>Cancel</button>
          <button type="submit" className="text-btn">Add {kind}</button>
        </div>
      </div>
    </form>
  );
}

// Noon, so a day key never slips a day across DST changes.
const fromKey = (key: string) => new Date(`${key}T12:00:00`);
// Built once: toLocaleDateString with options makes a new formatter per call, and the grid labels ~42 cells a render.
const FULL_DATE = new Intl.DateTimeFormat([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
const fullDate = (key: string) => FULL_DATE.format(fromKey(key));
const monthOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const STEPS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };

/** The day's add form: the date is the one picked, so only a name and a time are asked. */
function DayComposer({ date, onAdd, onCancel }: { date: string; onAdd: (entry: Entry) => void; onCancel: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const entry = { title: String(data.get('title') ?? '').trim(), time: String(data.get('time') ?? ''), date };
    if (!entry.title) return setError('Give your event a name.');
    if (!entry.time) return setError('Pick a time.');
    // datetime strings without a zone parse as local time.
    if (Date.parse(`${date}T${entry.time}`) < Date.now()) return setError('Pick a time that is still ahead.');
    onAdd(entry);
  };
  const described = error ? { 'aria-describedby': errorId } : {};
  return (
    <form
      className="calendar-composer"
      aria-label="New event"
      noValidate
      onSubmit={submit}
      onChange={() => setError(null)}
      onKeyDown={(e) => e.key === 'Escape' && (e.preventDefault(), e.stopPropagation(), onCancel())}
    >
      <label className="field">
        <span className="field-label">Event name</span>
        <input name="title" placeholder="e.g. Design review" maxLength={TITLE_MAX} autoFocus {...described} />
      </label>
      <div className="calendar-compose-bottom">
        <label className="field">
          <span className="field-label">Time</span>
          <input name="time" type="time" defaultValue="14:30" {...described} />
        </label>
        <button type="submit" className="text-btn calendar-add">Add</button>
      </div>
      {error && (
        <p className="field-error" role="alert" id={errorId}>
          {error}
        </p>
      )}
    </form>
  );
}

/** A month grid beside the picked day's events; picking a date opens its add form. */
export function AgendaCard() {
  const { organizer, update } = useOrganizerContext();
  const today = localDate(new Date());
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(() => monthOf(new Date()));
  const [adding, setAdding] = useState(false);
  const datesRef = useRef<HTMLDivElement>(null);
  const focusAfterMove = useRef(false);

  const picked = fromKey(selected);
  const inMonth = picked.getFullYear() === month.getFullYear() && picked.getMonth() === month.getMonth();
  // Weeks start on Monday.
  const offset = (month.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, i) => {
    const d = new Date(month.getFullYear(), month.getMonth(), i - offset + 1);
    return { key: localDate(d), day: d.getDate(), outside: d.getMonth() !== month.getMonth() };
  });
  const counts: Record<string, number> = {};
  for (const e of organizer.events) {
    const key = localDate(new Date(e.at));
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const entries = organizer.events
    .filter((e) => localDate(new Date(e.at)) === selected)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const tabStop = inMonth ? selected : localDate(month);

  // After a keyboard move, focus follows the picked date (it may be in a newly shown month).
  useEffect(() => {
    const box = datesRef.current;
    if (!box) return;
    if (focusAfterMove.current && inMonth) {
      box.querySelector<HTMLButtonElement>(`[data-date="${selected}"]`)?.focus({ preventScroll: true });
      focusAfterMove.current = false;
    }
  }, [selected, month]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (key: string, open = true) => {
    setSelected(key);
    setMonth((m) => (fromKey(key).getMonth() === m.getMonth() && fromKey(key).getFullYear() === m.getFullYear() ? m : monthOf(fromKey(key))));
    setAdding(open);
  };
  const shiftMonth = (by: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + by, 1));
  const arrows = (e: KeyboardEvent<HTMLButtonElement>, key: string) => {
    if (!(e.key in STEPS)) return;
    // Arrows walk the grid, not the pager.
    e.preventDefault();
    e.stopPropagation();
    const d = fromKey(key);
    d.setDate(d.getDate() + STEPS[e.key]);
    focusAfterMove.current = true;
    pick(localDate(d), false);
  };
  const add = ({ title, time, date }: Entry) => {
    const event = { id: newId(), title, at: new Date(`${date}T${time}`).toISOString(), notified: false };
    update((o) => ({ ...o, events: [...o.events, event] }));
    setAdding(false);
  };

  return (
    <section className="feature agenda-calendar" aria-label="Agenda">
      <div className="calendar-pane" role="group" aria-label="Choose an agenda date">
        <div className="calendar-month-heading">
          <button type="button" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
            <svg {...svg} width={12} height={12}><path d="M15 6l-6 6 6 6" /></svg>
          </button>
          <strong aria-live="polite">{month.toLocaleDateString([], { month: 'short', year: 'numeric' })}</strong>
          <button type="button" aria-label="Next month" onClick={() => shiftMonth(1)}>
            <svg {...svg} width={12} height={12}><path d="M9 6l6 6-6 6" /></svg>
          </button>
          <button type="button" className="calendar-today" onClick={() => pick(today, false)}>Today</button>
        </div>
        <div className="calendar-weekdays" aria-hidden="true">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}
        </div>
        <div className="calendar-days" ref={datesRef}>
            {cells.map((c) => (
              <button
                type="button"
                key={c.key}
                data-date={c.key}
                className={[c.outside && 'outside', c.key === selected && 'selected', c.key === today && 'today'].filter(Boolean).join(' ')}
                aria-label={`${fullDate(c.key)}, ${counts[c.key] ? `${counts[c.key]} events` : 'no events'}, add event`}
                aria-pressed={c.key === selected}
                aria-current={c.key === today ? 'date' : undefined}
                tabIndex={c.key === tabStop ? 0 : -1}
                onKeyDown={(e) => arrows(e, c.key)}
                onClick={() => pick(c.key)}
              >
                {c.day}
                {counts[c.key] > 0 && <i />}
              </button>
            ))}
        </div>
        <span className="calendar-helper">Click a date to add</span>
      </div>
      <div className="calendar-day-panel" role="group" aria-label="Agenda for selected date">
        <div className="calendar-day-heading">
          <strong title={fullDate(selected)}>{picked.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</strong>
          {adding ? (
            <button type="button" className="calendar-edit-cancel" onClick={() => setAdding(false)}>Cancel</button>
          ) : (
            <span>{entries.length} {entries.length === 1 ? 'event' : 'events'}</span>
          )}
        </div>
        {adding ? (
          <DayComposer key={selected} date={selected} onAdd={add} onCancel={() => setAdding(false)} />
        ) : (
          <>
            {entries.length ? (
              <ul className="calendar-day-events">
                {entries.map((ev) => (
                  <li key={ev.id} className="calendar-event" data-dim={Date.parse(ev.at) < Date.now() || undefined}>
                    <time dateTime={ev.at}>{hm(new Date(ev.at))}</time>
                    <span title={ev.title}>{ev.title}</span>
                    <RemoveButton label={`Remove ${ev.title}`} onClick={() => update((o) => ({ ...o, events: o.events.filter((x) => x.id !== ev.id) }))} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="calendar-day-empty">
                A little breathing room.<span>Add something worth making time for.</span>
              </p>
            )}
            <button type="button" className="calendar-new-event" onClick={() => setAdding(true)}>
              <svg {...svg} width={14} height={14}><path d="M12 5v14M5 12h14" /></svg>
              New agenda
            </button>
          </>
        )}
      </div>
    </section>
  );
}

export function AlarmCard() {
  const { organizer, update } = useOrganizerContext();
  const now = new Date();
  const [adding, setAdding] = useState(false);
  const sorted = [...organizer.alarms].sort((a, b) => a.time.localeCompare(b.time));
  const next = nextAlarm(organizer, now);

  if (adding) {
    const add = ({ title, time }: Entry) => {
      const alarm = { id: newId(), label: title, time, enabled: true, lastFiredOn: null };
      update((o) => ({ ...o, alarms: [...o.alarms, alarm] }));
      setAdding(false);
    };
    return <EntryForm kind="alarm" onAdd={add} onCancel={() => setAdding(false)} />;
  }

  const toggle = (id: string, enabled: boolean) =>
    update((o) => ({ ...o, alarms: o.alarms.map((x) => (x.id === id ? { ...x, enabled } : x)) }));

  return (
    <section className="feature" aria-label="Alarm">
      <div className="feature-head">
        {next ? (
          <Lead figure value={next.time} caption={`${inWords(nextRing(next.time, now).getTime() - now.getTime())} · ${next.label || 'Daily alarm'}`} />
        ) : (
          <Lead value="No alarm set" caption={sorted.length ? 'Every alarm is switched off.' : 'Alarms ring daily at their time.'} />
        )}
      </div>
      {sorted.length > 0 && (
        <ul className="rows">
          {sorted.map((a) => (
            <li key={a.id} className="row" data-dim={!a.enabled || undefined}>
              <span className="row-figure">{a.time}</span>
              <span className="row-text">{a.label || 'Daily'}</span>
              <input
                type="checkbox"
                role="switch"
                className="switch"
                checked={a.enabled}
                aria-label={`Alarm ${a.time} ${a.enabled ? 'on' : 'off'}`}
                onChange={(e) => toggle(a.id, e.target.checked)}
              />
              <RemoveButton label={`Remove alarm ${a.time}`} onClick={() => update((o) => ({ ...o, alarms: o.alarms.filter((x) => x.id !== a.id) }))} />
            </li>
          ))}
        </ul>
      )}
      <AddToggle label="New alarm" onClick={() => setAdding(true)} />
    </section>
  );
}

const STEP = 5;
const BREAK = 5;

export function FocusCard() {
  const { organizer, update } = useOrganizerContext();
  const { minutes, endsAt } = organizer.focus;
  // Ticks every second only while this card is on screen and running.
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  const setFocus = (focus: Partial<Organizer['focus']>) => update((o) => ({ ...o, focus: { ...o.focus, ...focus } }));
  const start = () => setFocus({ endsAt: new Date(Date.now() + minutes * 60_000).toISOString() });
  const left = endsAt ? Date.parse(endsAt) - Date.now() : minutes * 60_000;
  const nudge = (d: number) => setFocus({ minutes: Math.min(FOCUS_MAX, Math.max(FOCUS_MIN, minutes + d)) });

  const remaining = endsAt ? Math.max(0, left / (minutes * 60_000)) : 1;

  // Dial and time on the left, the actions stacked on the right; length or progress below.
  return (
    <section className="feature focus" aria-label="Focus">
      <div className="focus-overview">
        <span className="dial" aria-hidden="true">
          <svg viewBox="0 0 88 88">
            <circle className="dial-track" cx="44" cy="44" r="38" />
            <circle className="dial-value" cx="44" cy="44" r="38" pathLength={100} strokeDasharray="100" strokeDashoffset={100 - remaining * 100} />
          </svg>
          <svg {...svg} width={20} height={20}><path d="M20 13a8 8 0 1 1-16 0a8 8 0 1 1 16 0M12 9v4l2 2M9 2h6m-3 0v3" /></svg>
        </span>
        <Lead
          figure
          value={<span role="timer" aria-label={endsAt ? `${mmss(left)} left` : `${minutes} minute block`}>{mmss(left)}</span>}
          caption={endsAt ? `Ends at ${hm(new Date(endsAt))}` : `A ${minutes}-minute block`}
        />
      </div>
      <div className="focus-actions">
        <button type="button" className="text-btn" onClick={endsAt ? () => setFocus({ endsAt: null }) : start}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d={endsAt ? 'M7 5h4v14H7zM13 5h4v14h-4z' : 'M8 5v14l11-7z'} />
          </svg>
          {endsAt ? 'End session' : 'Start focus'}
        </button>
        {/* ponytail: the way back is always 25 min, not the length set before the break. */}
        <button type="button" className="text-btn quiet" disabled={!!endsAt} onClick={() => setFocus({ minutes: minutes === BREAK ? 25 : BREAK })}>
          {minutes === BREAK ? 'Focus time' : 'Short break'}
        </button>
      </div>
      {endsAt ? (
        <div className="progress" aria-hidden="true">
          <span style={{ transform: `scaleX(${Math.min(1, 1 - left / (minutes * 60_000))})` }} />
        </div>
      ) : (
          <div className="stepper" role="group" aria-label="Block length">
            <button type="button" className="icon-btn small" aria-label={`${STEP} minutes shorter`} disabled={minutes <= FOCUS_MIN} onClick={() => nudge(-STEP)}>
              <svg {...svg}><path d="M5 12h14" /></svg>
            </button>
            <span className="stepper-value">{minutes} min</span>
            <button type="button" className="icon-btn small" aria-label={`${STEP} minutes longer`} disabled={minutes >= FOCUS_MAX} onClick={() => nudge(STEP)}>
              <svg {...svg}><path d="M12 5v14M5 12h14" /></svg>
            </button>
          </div>
      )}
    </section>
  );
}
