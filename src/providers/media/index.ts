import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '../../config/storage';

/** Mirrors `Track` in src-tauri/src/lib.rs. */
export interface Track {
  title: string;
  artist: string;
  player: string;
  playing: boolean;
  canNext: boolean;
  canPrev: boolean;
  /** Playback position when polled; 0 when the player does not report one. */
  positionMs: number;
  lengthMs: number;
  album: string;
  /** The player's cover URL; only used to notice a new cover, `fetchArt` returns the image itself. */
  artUrl: string;
  canSeek: boolean;
  /** 0–1; null when the player does not expose volume. */
  volume: number | null;
}

/** null = no MPRIS player running; 'unavailable' = D-Bus failed or browser preview. */
export type Media = Track | null | 'unavailable';

export async function fetchMedia(): Promise<Media> {
  if (!isTauri) return 'unavailable';
  try {
    return await invoke<Track | null>('media_now');
  } catch (err) {
    console.warn('[nova] media unavailable:', err);
    return 'unavailable';
  }
}

/** `value`: position in ms for 'seek', 0–1 for 'volume'. */
export async function controlMedia(action: 'toggle' | 'next' | 'previous' | 'seek' | 'volume', value?: number): Promise<void> {
  try {
    await invoke('media_control', { action, value });
  } catch (err) {
    console.warn('[nova] media control failed:', err);
  }
}

/** The current cover as a data URL, or null when there is none or it can't be read. */
export async function fetchArt(): Promise<string | null> {
  if (!isTauri) return null;
  try {
    return await invoke<string | null>('media_art');
  } catch (err) {
    console.warn('[nova] cover unavailable:', err);
    return null;
  }
}
