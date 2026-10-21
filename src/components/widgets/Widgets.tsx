import { useEffect, useRef, useState } from 'react';
import type { WidgetId } from '../../config/schema';
import { AI_PROVIDERS, fetchAllUsage, PERIOD_LABEL, STATE_LABEL, type Period, type ProviderState, type ProviderUsage } from '../../providers/ai';
import { controlMedia, fetchArt, type Media } from '../../providers/media';
import type { Organizer } from '../../organizer/schema';
import { AgendaCard, AlarmCard, FocusCard, Lead, liveOrganizer, organizerStatus } from './Organizer';

export const WIDGET_LABEL: Record<WidgetId, string> = { ai: 'AI usage', music: 'Music', agenda: 'Agenda', alarm: 'Alarm', focus: 'Focus' };

type Tone = 'ok' | 'demo' | 'off' | 'bad';
export interface Status {
  label: string;
  tone: Tone;
}

const TONE: Record<ProviderState, Tone> = {
  connected: 'ok',
  demo: 'demo',
  unavailable: 'off',
  'permission-required': 'bad',
  'rate-limited': 'bad',
  error: 'bad',
};

/** One-line status for the idle notch. Always text, never colour alone (UC-01). */
export function statusOf(
  widget: WidgetId,
  usage: ProviderUsage[] | null,
  media?: Media,
  organizer?: Organizer,
  now = new Date(),
): Status {
  if (widget === 'music') return mediaStatus(media);
  if (widget !== 'ai') return organizer ? organizerStatus(widget, organizer, now) : { label: 'Loading', tone: 'off' };
  if (!usage) return { label: 'Loading', tone: 'off' };
  const states = new Set(usage.map((u) => u.state));
  if (states.size === 1) {
    const [state] = states;
    return { label: STATE_LABEL[state], tone: TONE[state] };
  }
  const connected = usage.filter((u) => u.state === 'connected').length;
  return { label: `${connected}/${usage.length} connected`, tone: 'off' };
}

/**
 * The one thing that needs attention now, for the compact notch: a running focus, then a playing track,
 * then an event within 15 minutes. Null when nothing is live, so the notch stays Lumi and the clock.
 */
export function liveStatus(media: Media | undefined, organizer: Organizer, now = new Date()): { widget: WidgetId; status: Status } | null {
  const org = liveOrganizer(organizer, now);
  if (org?.widget === 'focus') return org;
  const music = mediaStatus(media);
  return music.tone === 'ok' ? { widget: 'music', status: music } : org;
}

function mediaStatus(media: Media | undefined): Status {
  if (media === undefined) return { label: 'Loading', tone: 'off' };
  if (media === 'unavailable') return { label: 'Unavailable', tone: 'bad' };
  if (!media) return { label: 'Nothing playing', tone: 'off' };
  return media.playing ? { label: media.title || 'Playing', tone: 'ok' } : { label: 'Paused', tone: 'off' };
}

export function StatusChip({ status }: { status: Status }) {
  return (
    <span className="chip">
      <span className="chip-dot" data-tone={status.tone} aria-hidden="true" />
      <span className="chip-label">{status.label}</span>
    </span>
  );
}

function ProviderCard({ usage }: { usage: ProviderUsage }) {
  const source = usage.sourceType === 'demo' ? 'Demo data' : 'Organization API usage';
  const updated = usage.updatedAt
    ? `Last updated ${new Date(usage.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'No data yet';
  return (
    <article className="card">
      <div className="card-head">
        <h3>{usage.title}</h3>
        <StatusChip status={{ label: STATE_LABEL[usage.state], tone: TONE[usage.state] }} />
      </div>
      <p className="card-value">{usage.primaryValue}</p>
      <p className="card-detail">{usage.detail}</p>
      <p className="card-meta">
        {[source, usage.usagePeriod, updated].filter(Boolean).join(' · ')}
      </p>
    </article>
  );
}

const icon = { width: 18, height: 18, viewBox: '0 0 24 24', 'aria-hidden': true, fill: 'currentColor' } as const;
const line = { width: 16, height: 16, viewBox: '0 0 24 24', 'aria-hidden': true, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export function NoteIcon({ size = 16 }: { size?: number }) {
  return (
    <svg {...line} width={size} height={size}>
      <path d="M9 18V5l11-2v13M9 8l11-2M9 18a3 2 0 1 1-6 0a3 2 0 1 1 6 0M20 16a3 2 0 1 1-6 0a3 2 0 1 1 6 0" />
    </svg>
  );
}

const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** The cover for the playing track, fetched again only when the player reports a new one. */
function useCover(artUrl: string | undefined) {
  const [cover, setCover] = useState<string | null>(null);
  useEffect(() => {
    setCover(null);
    if (!artUrl) return;
    let live = true;
    void fetchArt().then((c) => live && setCover(c));
    return () => {
      live = false;
    };
  }, [artUrl]);
  return cover;
}

function MusicCard({ media, onChange, onLyrics }: { media: Media | undefined; onChange: () => void; onLyrics?: () => void }) {
  const track = media && media !== 'unavailable' ? media : null;
  const act = (action: 'toggle' | 'next' | 'previous' | 'seek' | 'volume', value?: number) => void controlMedia(action, value).then(onChange);
  const cover = useCover(track?.artUrl);
  // While the thumb is held, show where it is rather than the 2 s poll, so the two never fight.
  const [dragMs, setDragMs] = useState<number | null>(null);
  const commitSeek = () => {
    if (dragMs === null) return;
    act('seek', dragMs);
    setDragMs(null);
  };
  // MPRIS has no mute; remember the level to come back to.
  const unmuteTo = useRef(1);
  if (!track) {
    return (
      <section className="feature" aria-label="Music">
        {media === 'unavailable' ? (
          <Lead value="Can't reach your player" caption="Nova reads players over MPRIS on the desktop." />
        ) : (
          <Lead value="Nothing playing" caption="Play something in Spotify, a browser or any MPRIS player." />
        )}
      </section>
    );
  }
  // Two rows, two columns: the track beside its controls, the time beside the tools.
  return (
    <section className="feature music" aria-label="Music">
      <div className="track">
        <span className="track-art" aria-hidden="true">
          {cover ? <img src={cover} alt="" /> : <NoteIcon size={22} />}
        </span>
        <Lead value={track.title || 'Untitled track'} caption={[track.artist, track.player].filter(Boolean).join(' · ')} />
        <span className="equalizer" data-playing={track.playing || undefined} aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
      </div>
      <div className="media-controls">
        <button type="button" className="icon-btn small" aria-label="Previous" disabled={!track.canPrev} onClick={() => act('previous')}>
          <svg {...icon}><path d="M6 5h2v14H6zM20 5v14L9 12z" /></svg>
        </button>
        <button type="button" className="icon-btn primary" aria-label={track.playing ? 'Pause' : 'Play'} onClick={() => act('toggle')}>
          <svg {...icon}>{track.playing ? <path d="M7 5h4v14H7zM13 5h4v14h-4z" /> : <path d="M8 5v14l11-7z" />}</svg>
        </button>
        <button type="button" className="icon-btn small" aria-label="Next" disabled={!track.canNext} onClick={() => act('next')}>
          <svg {...icon}><path d="M16 5h2v14h-2zM4 5v14l11-7z" /></svg>
        </button>
      </div>
      {track.lengthMs > 0 && (
        <div className="track-time">
          <span className="row-meta">{clock(dragMs ?? track.positionMs)}</span>
          <div className="seek">
            <div className="progress" aria-hidden="true">
              {/* Polled every 2 s; the linear 2 s transition carries the bar between polls. */}
              <span
                style={{
                  transform: `scaleX(${Math.min(1, (dragMs ?? track.positionMs) / track.lengthMs)})`,
                  transitionDuration: track.playing && dragMs === null ? '2s' : '0s',
                }}
              />
            </div>
            {track.canSeek && (
              <input
                type="range"
                min={0}
                max={track.lengthMs}
                step={1000}
                value={dragMs ?? track.positionMs}
                aria-label="Seek"
                aria-valuetext={clock(dragMs ?? track.positionMs)}
                onChange={(e) => setDragMs(Number(e.target.value))}
                onPointerUp={commitSeek}
                onKeyUp={commitSeek}
                onBlur={commitSeek}
              />
            )}
          </div>
          <span className="row-meta">−{clock(Math.max(0, track.lengthMs - (dragMs ?? track.positionMs)))}</span>
        </div>
      )}
      {(onLyrics || track.volume !== null) && (
        <div className="music-tools">
          {onLyrics && (
            <button type="button" className="icon-btn small" aria-label="Open lyrics" onClick={onLyrics}>
              <svg {...line}><path d="M5 5h14M5 10h14M5 15h9M5 20h6" /></svg>
            </button>
          )}
          {track.volume !== null && (
            <button
              type="button"
              className="icon-btn small"
              aria-label="Mute"
              aria-pressed={track.volume === 0}
              onClick={() => {
                if (track.volume === 0) return act('volume', unmuteTo.current);
                unmuteTo.current = track.volume ?? 1;
                act('volume', 0);
              }}
            >
              <svg {...line}>
                <path d="m11 4-6 5H2v6h3l6 5Z" />
                {track.volume === 0 ? <path d="m16 9 6 6m0-6-6 6" /> : <path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />}
              </svg>
            </button>
          )}
        </div>
      )}
    </section>
  );
}

interface ViewProps {
  widget: WidgetId;
  usage: ProviderUsage[] | null;
  media: Media | undefined;
  onMediaChange: () => void;
  /** Turns to the lyrics page, when there is one. */
  onLyrics?: () => void;
}

export function WidgetView({ widget, usage, media, onMediaChange, onLyrics }: ViewProps) {
  if (widget === 'music') return <MusicCard media={media} onChange={onMediaChange} onLyrics={onLyrics} />;
  if (widget === 'agenda') return <AgendaCard />;
  if (widget === 'alarm') return <AlarmCard />;
  if (widget === 'focus') return <FocusCard />;
  return <AiUsage today={usage} />;
}

/**
 * Fetches only while this page is open (the shell caches each answer for 5 min), starting from the
 * notch's own "today" result so the cards never flash empty.
 */
function AiUsage({ today }: { today: ProviderUsage[] | null }) {
  const [period, setPeriod] = useState<Period>('today');
  const [usage, setUsage] = useState(today);
  useEffect(() => {
    let live = true;
    void fetchAllUsage(AI_PROVIDERS, period).then((u) => live && setUsage(u));
    return () => {
      live = false;
    };
  }, [period]);
  return (
    <section className="feature ai" aria-label="AI usage">
      <label className="field inline">
        <span className="field-label">Period</span>
        <span className="select">
          <select value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
            {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
              <option key={p} value={p}>
                {PERIOD_LABEL[p]}
              </option>
            ))}
          </select>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="m4 6 4 4 4-4" />
          </svg>
        </span>
      </label>
      {usage ? (
        <div className="cards">
          {usage.map((u) => (
            <ProviderCard key={u.providerId} usage={u} />
          ))}
        </div>
      ) : (
        <p className="hint">Loading usage…</p>
      )}
      <p className="hint">Organization API usage, not ChatGPT or Claude plan limits.</p>
    </section>
  );
}
