export const CONFIG_VERSION = 1;

export const WIDGET_IDS = ['ai', 'music', 'agenda', 'alarm', 'focus'] as const;
export type WidgetId = (typeof WIDGET_IDS)[number];

export const ANIMATIONS = ['playful', 'gentle', 'minimal'] as const;
export type Animation = (typeof ANIMATIONS)[number];

export interface Config {
  version: typeof CONFIG_VERSION;
  idleDisplay: WidgetId;
  animation: Animation;
  rotationEnabled: boolean;
  rotationIntervalSeconds: number;
  widgets: WidgetId[];
  mascot: { name: string; emoji: string; accent: string };
  reduceMotion: boolean;
  /** Date and time in the notch, standing in for the top-bar clock the GNOME extension hides. */
  showClock: boolean;
}

export const INTERVAL_MIN = 5;
export const INTERVAL_MAX = 60;
// PRD sets no name limit; 24 keeps the idle pill readable.
export const NAME_MAX = 24;

export const DEFAULT_CONFIG: Config = {
  version: CONFIG_VERSION,
  idleDisplay: 'ai',
  animation: 'playful',
  rotationEnabled: true,
  rotationIntervalSeconds: 15,
  widgets: ['ai', 'music', 'agenda', 'alarm', 'focus'],
  // The accent emoji is a user setting the PRD requires (FR-011); this is only its default.
  mascot: { name: 'Lumi', emoji: '✦', accent: '#c1a7ff' }, // taste-skill-ignore
  reduceMotion: false,
  showClock: true,
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const oneOf = <T extends string>(list: readonly T[], v: unknown, fallback: T): T =>
  (list as readonly unknown[]).includes(v) ? (v as T) : fallback;

const graphemes = (s: string) => [...new Intl.Segmenter().segment(s)].length;

/** Turns anything read from disk into a valid Config, field by field (FR-005). */
export function normalizeConfig(raw: unknown): Config {
  // No migrations exist yet, so any version other than 1 falls back to defaults.
  if (!isRecord(raw) || raw.version !== CONFIG_VERSION) return structuredClone(DEFAULT_CONFIG);

  const d = DEFAULT_CONFIG;
  const mascot = isRecord(raw.mascot) ? raw.mascot : {};
  const name = typeof mascot.name === 'string' ? mascot.name.trim() : '';
  const emoji = typeof mascot.emoji === 'string' ? mascot.emoji.trim() : '';
  const accent = typeof mascot.accent === 'string' ? mascot.accent : '';
  const interval = raw.rotationIntervalSeconds;
  const widgets = Array.isArray(raw.widgets)
    ? [...new Set(raw.widgets.filter((w) => (WIDGET_IDS as readonly unknown[]).includes(w)))]
    : [];

  return {
    version: CONFIG_VERSION,
    idleDisplay: oneOf(WIDGET_IDS, raw.idleDisplay, d.idleDisplay),
    animation: oneOf(ANIMATIONS, raw.animation, d.animation),
    rotationEnabled: typeof raw.rotationEnabled === 'boolean' ? raw.rotationEnabled : d.rotationEnabled,
    rotationIntervalSeconds:
      typeof interval === 'number' && Number.isFinite(interval)
        ? Math.min(INTERVAL_MAX, Math.max(INTERVAL_MIN, Math.round(interval)))
        : d.rotationIntervalSeconds,
    widgets: widgets.length ? (widgets as WidgetId[]) : [...d.widgets],
    mascot: {
      name: name && name.length <= NAME_MAX ? name : d.mascot.name,
      emoji: emoji && graphemes(emoji) === 1 ? emoji : d.mascot.emoji,
      accent: /^#[0-9a-f]{6}$/i.test(accent) ? accent.toLowerCase() : d.mascot.accent,
    },
    reduceMotion: typeof raw.reduceMotion === 'boolean' ? raw.reduceMotion : d.reduceMotion,
    showClock: typeof raw.showClock === 'boolean' ? raw.showClock : d.showClock,
  };
}
