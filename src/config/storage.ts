import { LazyStore } from '@tauri-apps/plugin-store';
import { normalizeConfig, type Config } from './schema';

const KEY = 'nova.config';

export const isTauri = '__TAURI_INTERNALS__' in window;

// Desktop uses Tauri Store, browser preview uses localStorage (FR-006). Preferences and organizer data only — never credentials.
const store = isTauri ? new LazyStore('nova-config.json', { autoSave: false }) : null;

/** Reads `key` and normalizes it; anything unreadable becomes `normalize(null)` so startup never blocks (NFR-004). */
export async function load<T>(key: string, normalize: (raw: unknown) => T): Promise<T> {
  try {
    const raw = store ? await store.get(key) : JSON.parse(localStorage.getItem(key) ?? 'null');
    return normalize(raw);
  } catch (err) {
    // The store holds no secrets, so logging is safe.
    console.warn(`[nova] ${key} unreadable, using defaults:`, err);
    return normalize(null);
  }
}

export async function save(key: string, value: unknown): Promise<void> {
  try {
    if (store) {
      await store.set(key, value);
      await store.save();
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch (err) {
    console.warn(`[nova] ${key} not saved:`, err);
  }
}

export const loadConfig = () => load(KEY, normalizeConfig);
export const saveConfig = (config: Config) => save(KEY, config);
