export const CLIPBOARD_VERSION = 1;

export interface Clip {
  id: string;
  text: string;
  pinned: boolean;
  /** ISO timestamp of when it was last copied. */
  at: string;
}

export interface ShelfFile {
  path: string;
  name: string;
  size: number;
  /** A data URL thumbnail for images, from `shelf_file`. Not saved: it is read again from the file. */
  image?: string | null;
}

export interface Clipboard {
  version: typeof CLIPBOARD_VERSION;
  clips: Clip[];
  shelf: ShelfFile[];
}

export const CLIP_MAX = 50;
export const CLIP_TEXT_MAX = 5000;

export const DEFAULT_CLIPBOARD: Clipboard = { version: CLIPBOARD_VERSION, clips: [], shelf: [] };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Newest first. An equal text moves to the top instead of repeating; unpinned clips past CLIP_MAX fall off. */
export function addClip(cb: Clipboard, text: string, now = new Date()): Clipboard {
  const t = text.trim().slice(0, CLIP_TEXT_MAX);
  if (!t) return cb;
  const old = cb.clips.find((c) => c.text === t);
  if (old && cb.clips[0] === old) return cb;
  const clip: Clip = { id: old?.id ?? crypto.randomUUID(), text: t, pinned: old?.pinned ?? false, at: now.toISOString() };
  let unpinned = 0;
  const clips = [clip, ...cb.clips.filter((c) => c !== old)].filter((c) => c.pinned || ++unpinned <= CLIP_MAX);
  return { ...cb, clips };
}

/** Turns anything read from disk into a valid Clipboard; a bad item is dropped instead of losing the rest (NFR-004). */
export function normalizeClipboard(raw: unknown): Clipboard {
  if (!isRecord(raw) || raw.version !== CLIPBOARD_VERSION) return structuredClone(DEFAULT_CLIPBOARD);
  const list = (v: unknown) => (Array.isArray(v) ? v.filter(isRecord) : []);
  const clips = list(raw.clips).flatMap((c): Clip[] =>
    typeof c.id === 'string' && typeof c.text === 'string' && c.text.trim() && typeof c.at === 'string' && !Number.isNaN(Date.parse(c.at))
      ? [{ id: c.id, text: c.text.slice(0, CLIP_TEXT_MAX), pinned: c.pinned === true, at: c.at }]
      : [],
  );
  const shelf = list(raw.shelf).flatMap((f): ShelfFile[] =>
    typeof f.path === 'string' && f.path && typeof f.name === 'string' && typeof f.size === 'number' && Number.isFinite(f.size)
      ? [{ path: f.path, name: f.name, size: f.size }]
      : [],
  );
  return { version: CLIPBOARD_VERSION, clips, shelf };
}

/** What is saved: thumbnails stay out, so the store does not grow with every dropped image. */
export const toSaved = (cb: Clipboard): Clipboard => ({ ...cb, shelf: cb.shelf.map(({ path, name, size }) => ({ path, name, size })) });
