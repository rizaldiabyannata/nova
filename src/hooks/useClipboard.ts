import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager';
import { addClip, toSaved, type Clipboard, type ShelfFile } from '../clipboard/schema';
import { isTauri, save } from '../config/storage';

export const CLIPBOARD_KEY = 'nova.clipboard';

export interface ClipboardApi {
  clipboard: Clipboard;
  update: (change: (c: Clipboard) => Clipboard) => void;
  /** Reads the system clipboard now (the Paste button); polling does the same on its own. */
  paste: () => Promise<void>;
  copy: (text: string) => Promise<void>;
  /** A file is being dragged over the window. */
  dragging: boolean;
}

export const ClipboardContext = createContext<ClipboardApi | null>(null);

export function useClipboardContext(): ClipboardApi {
  const api = useContext(ClipboardContext);
  if (!api) throw new Error('useClipboardContext needs a ClipboardContext provider');
  return api;
}

// The browser preview has no plugin; navigator.clipboard asks for permission and only works with focus.
const read = () => (isTauri ? readText() : navigator.clipboard.readText());
const write = (text: string) => (isTauri ? writeText(text) : navigator.clipboard.writeText(text));

const shelfFile = (path: string) => invoke<ShelfFile>('shelf_file', { path });

/** Clipboard history (saved on change, fed by polling the system clipboard) and the file shelf (fed by drops). */
export function useClipboard(initial: Clipboard) {
  const [clipboard, setClipboard] = useState(initial);
  const update = useCallback((change: (c: Clipboard) => Clipboard) => setClipboard(change), []);
  const [dragging, setDragging] = useState(false);

  const loaded = useRef(initial);
  useEffect(() => {
    if (clipboard !== loaded.current) void save(CLIPBOARD_KEY, toSaved(clipboard));
  }, [clipboard]);

  const take = useCallback((text: string | null | undefined) => {
    if (text) setClipboard((c) => addClip(c, text));
  }, []);

  // ponytail: polls the clipboard every 1 s (local, no network); switch to an X11/Wayland owner-change watch if idle CPU shows up.
  // Empty or non-text clipboards throw; that is not an error worth logging every second.
  useEffect(() => {
    if (!isTauri) return;
    const id = setInterval(() => void readText().then(take, () => {}), 1000);
    return () => clearInterval(id);
  }, [take]);

  const paste = useCallback(async () => {
    try {
      take(await read());
    } catch (err) {
      console.warn('[nova] clipboard read:', err);
    }
  }, [take]);

  const copy = useCallback(async (text: string) => {
    try {
      await write(text);
      take(text);
    } catch (err) {
      console.warn('[nova] clipboard write:', err);
    }
  }, [take]);

  // Thumbnails are not saved, and a saved file may have moved: ask again once at start, dropping what is gone.
  useEffect(() => {
    if (!isTauri || !initial.shelf.length) return;
    void Promise.allSettled(initial.shelf.map((f) => shelfFile(f.path))).then((results) => {
      const shelf = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
      setClipboard((c) => ({ ...c, shelf }));
    });
  }, [initial]);

  // Files dropped anywhere on Nova land on the shelf (Tauri hands over paths; the page's own drop events never see files).
  useEffect(() => {
    if (!isTauri) return;
    const off = getCurrentWebview().onDragDropEvent(async ({ payload }) => {
      if (payload.type === 'enter' || payload.type === 'over') return setDragging(true);
      setDragging(false);
      if (payload.type !== 'drop') return;
      const results = await Promise.allSettled(payload.paths.map(shelfFile));
      const added = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
      for (const r of results) if (r.status === 'rejected') console.warn('[nova] shelf drop:', r.reason);
      setClipboard((c) => ({ ...c, shelf: [...added, ...c.shelf.filter((f) => !added.some((a) => a.path === f.path))] }));
    });
    return () => void off.then((f) => f());
  }, []);

  return useMemo<ClipboardApi>(() => ({ clipboard, update, paste, copy, dragging }), [clipboard, update, paste, copy, dragging]);
}
