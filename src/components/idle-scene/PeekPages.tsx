import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type KeyboardEvent } from 'react';
import type { Config, WidgetId } from '../../config/schema';
import type { ProviderUsage } from '../../providers/ai';
import { fetchLyrics, lineAt, type LyricLine, type Lyrics } from '../../providers/lyrics';
import type { Media } from '../../providers/media';
import { Settings } from '../settings/Settings';
import { ClipboardPage, ShelfPage } from '../widgets/Clipboard';
import { NoteIcon, WIDGET_LABEL, WidgetView } from '../widgets/Widgets';

export type Page = WidgetId | 'lyrics' | 'clipboard' | 'shelf';

/** Swipe order: music controls, then its lyrics, then every other widget, then the clipboard tools (pages, not widgets: no notch status). */
export const pagesFor = (widgets: WidgetId[]): Page[] => [
  ...(widgets.includes('music') ? ['music' as const, 'lyrics' as const, ...widgets.filter((w) => w !== 'music')] : widgets),
  'clipboard',
  'shelf',
];

const PAGE_LABEL: Record<Page, string> = { ...WIDGET_LABEL, lyrics: 'Lyrics', clipboard: 'Clipboard', shelf: 'Shelf' };

interface Props {
  pages: Page[];
  index: number;
  onIndex: (index: number) => void;
  /** Settings take the page's place; any page dot brings the feature back. */
  settings: boolean;
  onToggleSettings: () => void;
  config: Config;
  update: (patch: Partial<Config>) => Config;
  /** Reports the page's natural width, so the notch can fit each page instead of one fixed size. */
  onWidth: (width: number) => void;
  media: Media | undefined;
  usage: ProviderUsage[] | null;
  onMediaChange: () => void;
}

const gear = { width: 16, height: 16, viewBox: '0 0 24 24', 'aria-hidden': true, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' } as const;

/**
 * Each feature's one view, under the pill: hover shows it, a click pins it open. Same page either way,
 * so nothing exists twice. One page at a time, dots to show where you are (swipe lives on the pill).
 */
export function PeekPages(props: Props) {
  const { pages, index, onIndex, onWidth, media, usage, onMediaChange, settings } = props;
  const page = pages[index];
  const bodyRef = useRef<HTMLDivElement>(null);
  // The body sizes to its content (app.css), so its width is what this page needs.
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    // Measure before paint, so a new page never shows a frame at the old page's width.
    onWidth(el.offsetWidth);
    const observer = new ResizeObserver(() => onWidth(el.offsetWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, [page, settings, onWidth]);
  const turn = (step: number) => onIndex((index + step + pages.length) % pages.length);
  const show = (p: Page) => pages.includes(p) && onIndex(pages.indexOf(p));
  const onKeyDown = (e: KeyboardEvent) => {
    // Arrows inside a field move the caret, not the page.
    if ((e.target as HTMLElement).matches('input, select, textarea')) return;
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (step) turn(step);
  };
  return (
    <div id="nova-page" className="pill-page" onKeyDown={onKeyDown}>
      {/* key re-mounts the page so each switch fades in */}
      <div className="pill-page-body" key={settings ? 'settings' : page} ref={bodyRef}>
        {settings ? (
          <Settings config={props.config} update={props.update} />
        ) : page === 'lyrics' ? (
          <LyricsPage media={media} onMusic={() => show('music')} />
        ) : page === 'clipboard' ? (
          <ClipboardPage />
        ) : page === 'shelf' ? (
          <ShelfPage />
        ) : (
          <WidgetView
            widget={page}
            usage={usage}
            media={media}
            onMediaChange={onMediaChange}
            onLyrics={pages.includes('lyrics') ? () => show('lyrics') : undefined}
          />
        )}
      </div>
      <div className="pager-row">
        {pages.length > 1 && (
          <button type="button" className="icon-btn small page-arrow" aria-label="Previous page" onClick={() => turn(-1)}>
            <svg {...gear}><path d="m15 5-7 7 7 7" /></svg>
          </button>
        )}
        <div className="pager" role="group" aria-label="Pages">
          {pages.length > 1 &&
            pages.map((p, i) => (
              <button
                key={p}
                type="button"
                aria-label={PAGE_LABEL[p]}
                aria-current={!settings && i === index ? 'page' : undefined}
                onClick={() => onIndex(i)}
              />
            ))}
        </div>
        <div className="pager-tools">
          {pages.length > 1 && (
            <button type="button" className="icon-btn small page-arrow" aria-label="Next page" onClick={() => turn(1)}>
              <svg {...gear}><path d="m9 5 7 7-7 7" /></svg>
            </button>
          )}
          <button type="button" className="icon-btn small" aria-label="Settings" aria-pressed={settings} onClick={props.onToggleSettings}>
            <svg {...gear}>
              <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
              <circle cx="16" cy="7" r="2" />
              <circle cx="10" cy="17" r="2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function LyricsPage({ media, onMusic }: { media: Media | undefined; onMusic: () => void }) {
  const track = media && media !== 'unavailable' ? media : null;
  const title = track?.title ?? '';
  const artist = track?.artist ?? '';
  const lengthMs = track?.lengthMs ?? 0;
  const [lyrics, setLyrics] = useState<Lyrics>();

  // Fetched only while this page is open, once per track (fetchLyrics caches).
  useEffect(() => {
    if (!title) return;
    let live = true;
    setLyrics(undefined);
    void fetchLyrics(title, artist, lengthMs).then((l) => live && setLyrics(l));
    return () => {
      live = false;
    };
  }, [title, artist, lengthMs]);

  // Media is polled every 2 s; between polls, advance the position locally so lines change on time.
  const positionMs = track?.positionMs ?? 0;
  const anchor = useMemo(() => ({ ms: positionMs, at: performance.now() }), [positionMs]);
  const synced = lyrics && lyrics !== 'unavailable' && 'synced' in lyrics ? lyrics.synced : null;
  const playing = !!track?.playing;
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!synced || !playing) return;
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [synced, playing]);

  if (!track) return <p className="hint lyrics">Play something to see its lyrics.</p>;
  return (
    <div className="lyrics-page">
      {/* The track heads its lyrics and leads back to the player. */}
      <button type="button" className="lyrics-track" aria-label={`Back to music: ${title}`} onClick={onMusic}>
        <span className="lyrics-track-icon">
          <NoteIcon />
        </span>
        <span className="lyrics-track-text">
          <strong>{title || 'Untitled track'}</strong>
          <span>{[artist, track.album].filter(Boolean).join(' · ')}</span>
        </span>
        <span className="lyrics-track-state">{playing ? 'Playing' : 'Paused'}</span>
      </button>
      <LyricLines lyrics={lyrics} synced={synced} at={anchor.ms + (playing ? performance.now() - anchor.at : 0)} />
    </div>
  );
}

function LyricLines({ lyrics, synced, at }: { lyrics: Lyrics | undefined; synced: LyricLine[] | null; at: number }) {
  if (lyrics === undefined) return <p className="hint lyrics">Looking for lyrics…</p>;
  if (lyrics === 'unavailable') return <p className="hint lyrics">Lyrics need an internet connection.</p>;
  if (lyrics === null) return <p className="hint lyrics">No lyrics found for this song.</p>;
  if (!synced) return <p className="lyrics lyrics-plain">{'plain' in lyrics ? lyrics.plain : ''}</p>;
  const now = lineAt(synced, at);
  return (
    <div className="lyrics">
      {/* Always rendered, so the block keeps its height before the first line. */}
      <p className="lyric-prev">{synced[now - 1]?.text || ' '}</p>
      <p className="lyric-now">{synced[now]?.text || 'Instrumental'}</p>
      <p className="lyric-next">{synced[now + 1]?.text || ' '}</p>
    </div>
  );
}
