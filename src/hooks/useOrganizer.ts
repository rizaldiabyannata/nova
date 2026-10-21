import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { save } from '../config/storage';
import { dueItems, localTime, markDone } from '../organizer/due';
import { notify } from '../organizer/notify';
import type { Organizer } from '../organizer/schema';
import { useMinute } from './useMinute';
import type { NotchEvent } from './useNotchController';

export const ORGANIZER_KEY = 'nova.organizer';

export interface OrganizerApi {
  organizer: Organizer;
  update: (change: (o: Organizer) => Organizer) => void;
}

// Shared through context: WidgetView renders in both the panel and the hover pages.
export const OrganizerContext = createContext<OrganizerApi | null>(null);

export function useOrganizerContext(): OrganizerApi {
  const api = useContext(OrganizerContext);
  if (!api) throw new Error('useOrganizerContext needs an OrganizerContext provider');
  return api;
}

/** Organizer state, saved on change, ringing events/alarms on each minute and focus at its end. */
export function useOrganizer(initial: Organizer, dispatch: (event: NotchEvent) => void) {
  const [organizer, setOrganizer] = useState(initial);
  const update = useCallback((change: (o: Organizer) => Organizer) => setOrganizer(change), []);

  const loaded = useRef(initial);
  useEffect(() => {
    if (organizer !== loaded.current) void save(ORGANIZER_KEY, organizer);
  }, [organizer]);

  // One wake-up per minute boundary (no polling); also catches up after suspend on the next tick.
  const now = useMinute(true);
  useEffect(() => {
    const due = dueItems(organizer, now);
    if (!due.events.length && !due.alarms.length && !due.stale.length) return;
    for (const e of due.events) void notify(e.title, `Starts at ${localTime(new Date(e.at))}`);
    for (const a of due.alarms) void notify(a.label || 'Alarm', a.time);
    if (due.events.length || due.alarms.length) dispatch({ type: 'react', expression: 'surprised' });
    setOrganizer((o) => markDone(o, due, now));
  }, [organizer, now, dispatch]);

  const endsAt = organizer.focus.endsAt;
  useEffect(() => {
    if (!endsAt) return;
    const stop = () => setOrganizer((o) => ({ ...o, focus: { ...o.focus, endsAt: null } }));
    const ms = Date.parse(endsAt) - Date.now();
    // Ended while Nova was closed: clear it quietly rather than ring late.
    if (ms <= 0) return stop();
    // ponytail: a timeout pauses during suspend, so after resume focus rings late; fine for a 25-min timer.
    const id = setTimeout(() => {
      void notify('Focus done', 'Time for a break.');
      dispatch({ type: 'react', expression: 'happy' });
      stop();
    }, ms);
    return () => clearTimeout(id);
  }, [endsAt, dispatch]);

  return { organizer, update, now };
}
