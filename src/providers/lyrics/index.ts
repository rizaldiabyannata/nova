export interface LyricLine {
  ms: number;
  text: string;
}

/** synced = timed lines; plain = untimed text; null = no lyrics found; 'unavailable' = offline or LRCLIB failed. */
export type Lyrics = { synced: LyricLine[] } | { plain: string } | null | 'unavailable';

interface LrclibHit {
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

/** Parses LRC (`[mm:ss.xx] text`, several stamps per line allowed) into lines sorted by time. */
export function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const row of lrc.split('\n')) {
    const stamps = [...row.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    const text = row.replace(/\[[^\]]*\]/g, '').trim();
    for (const [, min, sec] of stamps) lines.push({ ms: Math.round((Number(min) * 60 + Number(sec)) * 1000), text });
  }
  return lines.sort((a, b) => a.ms - b.ms);
}

/** Index of the line being sung at `ms`, or -1 before the first line. */
export function lineAt(lines: LyricLine[], ms: number): number {
  let i = -1;
  while (i + 1 < lines.length && lines[i + 1].ms <= ms) i++;
  return i;
}

/** Prefers synced lyrics whose duration matches the track (±3 s), then any synced, then plain. */
export function pickLyrics(hits: LrclibHit[], lengthMs: number): Lyrics {
  const fits = (h: LrclibHit) => !lengthMs || Math.abs(h.duration * 1000 - lengthMs) <= 3000;
  const synced = hits.find((h) => h.syncedLyrics && fits(h)) ?? hits.find((h) => h.syncedLyrics);
  if (synced?.syncedLyrics) return { synced: parseLrc(synced.syncedLyrics) };
  const plain = hits.find((h) => h.plainLyrics);
  return plain?.plainLyrics ? { plain: plain.plainLyrics } : null;
}

// One request per track for the whole session; failures are not cached so they retry next time.
const cache = new Map<string, Lyrics>();

export async function fetchLyrics(title: string, artist: string, lengthMs: number): Promise<Lyrics> {
  const key = `${artist}\n${title}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const url = `https://lrclib.net/api/search?${new URLSearchParams({ track_name: title, artist_name: artist })}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`LRCLIB ${res.status}`);
    const lyrics = pickLyrics((await res.json()) as LrclibHit[], lengthMs);
    cache.set(key, lyrics);
    return lyrics;
  } catch (err) {
    console.warn('[nova] lyrics unavailable:', err);
    return 'unavailable';
  }
}
