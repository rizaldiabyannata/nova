import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import { normalizeConfig, type Config, type WidgetId } from '../config/schema';
import { isTauri, load, loadConfig, saveConfig } from '../config/storage';
import { normalizeOrganizer, sampleOrganizer, type Organizer } from '../organizer/schema';
import { ORGANIZER_KEY, OrganizerContext, useOrganizer } from '../hooks/useOrganizer';
import { normalizeClipboard, type Clipboard } from '../clipboard/schema';
import { CLIPBOARD_KEY, ClipboardContext, useClipboard } from '../hooks/useClipboard';
import { editing, IdleScene } from '../components/idle-scene/IdleScene';
import { liveStatus, statusOf } from '../components/widgets/Widgets';
import { useNotchController } from '../hooks/useNotchController';
import { useRotation } from '../hooks/useRotation';
import { AI_PROVIDERS, fetchAllUsage, type ProviderUsage } from '../providers/ai';
import { fetchMedia, type Media } from '../providers/media';
import { inkFor } from '../styles/color';

export function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [organizer, setOrganizer] = useState<Organizer | null>(null);
  const [clipboard, setClipboard] = useState<Clipboard | null>(null);
  useEffect(() => {
    void load(CLIPBOARD_KEY, normalizeClipboard).then(setClipboard);
    void loadConfig().then(setConfig);
    // Nothing saved yet (or unreadable): start with examples instead of empty pages.
    void load(ORGANIZER_KEY, (raw) => (raw == null ? sampleOrganizer(new Date()) : normalizeOrganizer(raw))).then(setOrganizer);
  }, []);
  // Render nothing until the saved data is in, so defaults never flash.
  return config && organizer && clipboard ? (
    <Nova config={config} setConfig={setConfig} initialOrganizer={organizer} initialClipboard={clipboard} />
  ) : null;
}

// ponytail: a fixed order; config.widgets (the saved choice) is not wired to a picker yet.
const widgets: WidgetId[] = ['music', 'agenda', 'alarm', 'focus', 'ai'];
const WINDOW_WIDTH = 420;

interface NovaProps {
  config: Config;
  setConfig: (c: Config) => void;
  initialOrganizer: Organizer;
  initialClipboard: Clipboard;
}

function Nova({ config, setConfig, initialOrganizer, initialClipboard }: NovaProps) {
  const [{ mode, expression }, dispatch] = useNotchController();
  // useOrganizer re-renders every minute; statuses read the real time, as a minute-old `now` overstates a fresh focus.
  const { organizer, update: updateOrganizer } = useOrganizer(initialOrganizer, dispatch);
  const now = new Date();
  const organizerApi = useMemo(() => ({ organizer, update: updateOrganizer }), [organizer, updateOrganizer]);
  const clipboardApi = useClipboard(initialClipboard);
  // Once at start for the notch's status; the AI page fetches its own while open, so an idle Nova makes no requests.
  const [usage, setUsage] = useState<ProviderUsage[] | null>(null);
  useEffect(() => void fetchAllUsage(AI_PROVIDERS).then(setUsage), []);
  const [media, setMedia] = useState<Media>();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const [index] = useRotation(
    widgets.length,
    config.rotationIntervalSeconds,
    // Only while compact, so the status line never changes under someone reading it.
    config.rotationEnabled && mode === 'compact',
    Math.max(0, widgets.indexOf(config.idleDisplay)),
  );
  const widget = widgets[index];

  // An unchanged poll keeps the old object, so a paused or absent player doesn't re-render the whole notch every 2 s.
  const refreshMedia = useCallback(
    () => void fetchMedia().then((next) => setMedia((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))),
    [],
  );
  // ponytail: polls local D-Bus every 2 s (no network, NFR-001); switch to MPRIS PropertiesChanged signals if idle CPU shows up.
  useEffect(() => {
    refreshMedia();
    if (!isTauri) return;
    const id = setInterval(refreshMedia, 2000);
    return () => clearInterval(id);
  }, [refreshMedia]);

  // A new track is an event: Lumi reacts, the panel stays as it is.
  const title = media && media !== 'unavailable' ? media.title : undefined;
  const lastTitle = useRef(title);
  useEffect(() => {
    if (title && lastTitle.current && title !== lastTitle.current) dispatch({ type: 'react', expression: 'surprised' });
    lastTitle.current = title;
  }, [title, dispatch]);

  // Clicking anywhere outside the window takes focus away, so shrink back then.
  useEffect(() => {
    const shrink = () => dispatch({ type: 'close' });
    window.addEventListener('blur', shrink);
    return () => window.removeEventListener('blur', shrink);
  }, [dispatch]);

  // The window only ever grows: resizing a transparent X11 window blinks a blank frame (page switches, hover),
  // and is slow over a fullscreen app. Its transparent rest lets clicks fall through to the desktop instead.
  useEffect(() => {
    const main = mainRef.current;
    if (!isTauri || !main) return;
    let height = window.innerHeight; // tauri.conf.json starts it tall enough for every page
    let sent = '';
    let last = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const send = () => {
      last = performance.now();
      // offset* ignores transforms, so the mount animations don't shrink the hit area.
      const rects = [...main.children].map((el) => {
        const e = el as HTMLElement;
        return { x: e.offsetLeft, y: e.offsetTop, width: e.offsetWidth, height: e.offsetHeight };
      });
      const key = JSON.stringify(rects);
      if (key === sent) return;
      sent = key;
      invoke('set_hit_region', { rects }).catch((err) => console.warn('[nova] hit region:', err));
    };
    const fit = () => {
      if (main.offsetHeight > height) {
        height = main.offsetHeight;
        void getCurrentWindow().setSize(new LogicalSize(WINDOW_WIDTH, Math.ceil(height)));
      }
      // The observer fires every frame of the width transition; an X11 shape change per frame stutters it.
      // At most one per 100 ms, plus a trailing one so the region ends exact.
      clearTimeout(timer);
      const wait = last + 100 - performance.now();
      if (wait <= 0) send();
      else timer = setTimeout(send, wait);
    };
    // The pill animates its width without resizing main, so watch it too.
    const observer = new ResizeObserver(fit);
    observer.observe(main);
    if (main.firstElementChild) observer.observe(main.firstElementChild);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, []);

  const update = (patch: Partial<Config>) => {
    const next = normalizeConfig({ ...config, ...patch });
    setConfig(next);
    void saveConfig(next);
    return next;
  };

  const close = () => {
    dispatch({ type: 'close' });
    triggerRef.current?.focus();
    // Focusing the pill opens it as peek; with the pointer elsewhere nothing would ever close that again.
    if (!triggerRef.current?.closest('.pill')?.matches(':hover')) dispatch({ type: 'pointer-leave' });
  };

  // Leaving Nova folds the peek away, unless a field is in use. A pinned Nova stays until a click elsewhere
  // (window blur), Escape or a click on the pill, so it never slips away while the pointer wanders.
  const leave = useCallback(() => {
    if (!editing()) dispatch({ type: 'pointer-leave' });
  }, [dispatch]);

  // Under XWayland the page never sees the pointer leave the window (see platform::watch_pointer_leave), so the shell tells it.
  useEffect(() => {
    if (!isTauri) return;
    const off = listen('pointer-left', leave);
    return () => void off.then((f) => f());
  }, [leave]);

  // `nova --toggle` (bound to a desktop shortcut) reaches the running instance as this event.
  useEffect(() => {
    if (!isTauri) return;
    const off = listen('toggle-panel', () => dispatch({ type: 'toggle' }));
    return () => void off.then((f) => f());
  }, [dispatch]);

  // Something live (focus, a playing track, an event soon) speaks for the notch; otherwise the rotating widget does.
  const live = liveStatus(media, organizer, now);
  const statusWidget = live?.widget ?? widget;
  const status = live?.status ?? statusOf(widget, usage, media, organizer, now);

  const ink = inkFor(config.mascot.accent);
  const style = { '--accent': config.mascot.accent, '--on-accent': ink } as CSSProperties;

  return (
    <OrganizerContext.Provider value={organizerApi}>
      <ClipboardContext.Provider value={clipboardApi}>
        <main
          ref={mainRef}
          className="nova"
          data-mode={mode}
          data-motion={config.reduceMotion ? 'none' : config.animation}
          style={style}
          onKeyDown={(e) => e.key === 'Escape' && mode === 'expanded' && close()}
          onPointerLeave={leave}
        >
          <IdleScene
            config={config}
            widgets={widgets}
            widget={statusWidget}
            status={status}
            mode={mode}
            expression={expression}
            dispatch={dispatch}
            update={update}
            media={media}
            usage={usage}
            onMediaChange={refreshMedia}
            buttonRef={triggerRef}
          />
        </main>
      </ClipboardContext.Provider>
    </OrganizerContext.Provider>
  );
}
