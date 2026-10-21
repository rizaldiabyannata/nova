import { useEffect, useState, type CSSProperties, type FocusEvent, type Ref } from 'react';
import type { Config, WidgetId } from '../../config/schema';
import { useMinute } from '../../hooks/useMinute';
import { useSwipe } from '../../hooks/useSwipe';
import type { LumiExpression, NotchEvent, NotchMode } from '../../hooks/useNotchController';
import type { ProviderUsage } from '../../providers/ai';
import type { Media } from '../../providers/media';
import { Lumi } from '../lumi/Lumi';
import { WIDGET_LABEL, type Status } from '../widgets/Widgets';
import { PeekPages, pagesFor } from './PeekPages';

interface Props {
  config: Config;
  widgets: WidgetId[];
  /** The widget the status line speaks for. */
  widget: WidgetId;
  status: Status;
  mode: NotchMode;
  expression: LumiExpression;
  dispatch: (event: NotchEvent) => void;
  update: (patch: Partial<Config>) => Config;
  media: Media | undefined;
  usage: ProviderUsage[] | null;
  onMediaChange: () => void;
  buttonRef: Ref<HTMLButtonElement>;
}

// Peek fits its page: never narrower than the name row needs, never wider than the window allows.
// 300 leaves the status line ~90px beside the name and clock; at 260 it shrank to one word.
const PEEK_MIN = 300;
const PEEK_MAX = 390; // --notch-expanded-width
const PEEK_INSET = 32; // open pill padding (2 × 16)

/** A field in use keeps the notch open: typing an event must survive the pointer drifting off. */
export const editing = () => !!document.activeElement?.matches('.pill input, .pill select, .pill textarea');

/**
 * The notch pill: one element for compact, peek and expanded; app.css lays it out per `data-mode` (UC-01, UC-02).
 * Peek (hover) and expanded (click) show the same page; expanded only pins it open.
 */
export function IdleScene(props: Props) {
  const { config, widgets, widget, status, mode, expression, dispatch, buttonRef } = props;
  const { mascot } = config;
  const expanded = mode === 'expanded';
  const open = mode !== 'compact';
  const [settings, setSettings] = useState(false);
  // Folding the notch also leaves Settings, so the next open shows a feature again.
  useEffect(() => {
    if (!open) setSettings(false);
  }, [open]);
  const toggle = () => dispatch({ type: 'toggle' });
  const now = useMinute(config.showClock);
  const pages = pagesFor(widgets);
  const [page, setPage] = useState(0);
  const pageIndex = Math.min(page, pages.length - 1);
  const goTo = (i: number) => {
    setPage(i);
    setSettings(false);
  };
  // Two-finger swipe turns the pages, wrapping around at either end.
  const onWheel = useSwipe((step) => goTo((pageIndex + step + pages.length) % pages.length));
  const [pageWidth, setPageWidth] = useState(0);
  const peekWidth = Math.min(PEEK_MAX, Math.max(PEEK_MIN, Math.ceil(pageWidth) + PEEK_INSET));
  // Moving focus between the pill's own buttons must not collapse it. Neither must a clicked button that unmounts
  // (Lyrics, Remove, Cancel): WebKit then blurs with no relatedTarget while the pointer is still on the pill.
  const onBlur = (e: FocusEvent) => {
    const pill = e.currentTarget;
    if (!pill.contains(e.relatedTarget) && !pill.matches(':hover') && !editing()) dispatch({ type: 'pointer-leave' });
  };
  return (
    <div
      className="pill"
      style={{ '--peek-width': `${peekWidth}px` } as CSSProperties}
      onPointerEnter={() => dispatch({ type: 'pointer-enter' })}
      onPointerLeave={() => !editing() && dispatch({ type: 'pointer-leave' })}
      onFocus={() => dispatch({ type: 'pointer-enter' })}
      onBlur={onBlur}
      onWheel={open ? onWheel : undefined}
    >
      <button
        ref={buttonRef}
        type="button"
        className="pill-main"
        aria-expanded={expanded}
        aria-controls="nova-page"
        aria-label={`${mascot.name}, ${WIDGET_LABEL[widget]}: ${status.label}. ${expanded ? 'Unpin' : 'Pin'} Nova open`}
        onClick={toggle}
      >
        <span className="pill-mascot">
          <Lumi accent={mascot.accent} expression={expression} />
          <span className="pill-emoji" aria-hidden="true">
            {mascot.emoji}
          </span>
        </span>
        <span className="pill-text">
          <span className="pill-name">{mascot.name}</span>
          <span className="pill-status">
            <span className="chip-dot" data-tone={status.tone} aria-hidden="true" />
            <span className="pill-status-label">{status.label}</span>
            {/* key re-mounts the label so each rotation fades in */}
            <span className="pill-widget" key={widget}>
              {WIDGET_LABEL[widget]}
            </span>
          </span>
        </span>
        {config.showClock && (
          <time className="pill-clock" dateTime={now.toISOString()}>
            <span className="pill-time">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <span className="pill-date">{now.toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
          </time>
        )}
      </button>
      {open && (
        <PeekPages
          pages={pages}
          index={pageIndex}
          onIndex={goTo}
          onWidth={setPageWidth}
          settings={settings}
          onToggleSettings={() => setSettings((s) => !s)}
          config={config}
          update={props.update}
          media={props.media}
          usage={props.usage}
          onMediaChange={props.onMediaChange}
        />
      )}
    </div>
  );
}
