import { describe, expect, test } from 'vitest';
import { addClip, CLIP_MAX, DEFAULT_CLIPBOARD, normalizeClipboard, toSaved, type Clipboard } from './schema';

const empty = (): Clipboard => structuredClone(DEFAULT_CLIPBOARD);
const texts = (cb: Clipboard) => cb.clips.map((c) => c.text);

describe('addClip', () => {
  test('adds newest first and ignores blank text', () => {
    const cb = addClip(addClip(addClip(empty(), 'a'), '  '), 'b');
    expect(texts(cb)).toEqual(['b', 'a']);
  });

  test('moves an equal text to the top, keeping its id and pin', () => {
    let cb = addClip(addClip(empty(), 'a'), 'b');
    cb = { ...cb, clips: cb.clips.map((c) => (c.text === 'a' ? { ...c, pinned: true } : c)) };
    const id = cb.clips[1].id;
    const next = addClip(cb, ' a ');
    expect(texts(next)).toEqual(['a', 'b']);
    expect(next.clips[0]).toMatchObject({ id, pinned: true });
  });

  test('returns the same object when the top clip is copied again', () => {
    const cb = addClip(empty(), 'a');
    expect(addClip(cb, 'a')).toBe(cb);
  });

  test('drops the oldest unpinned past the cap, never a pinned one', () => {
    let cb = addClip(empty(), 'keep');
    cb = { ...cb, clips: [{ ...cb.clips[0], pinned: true }] };
    for (let i = 0; i < CLIP_MAX + 5; i++) cb = addClip(cb, `t${i}`);
    expect(cb.clips.filter((c) => !c.pinned)).toHaveLength(CLIP_MAX);
    expect(texts(cb)).toContain('keep');
    expect(texts(cb)).not.toContain('t0');
  });
});

describe('normalizeClipboard', () => {
  test.each([null, 'x', [], { version: 2 }])('falls back to empty for %j', (raw) => {
    expect(normalizeClipboard(raw)).toEqual(DEFAULT_CLIPBOARD);
  });

  test('keeps good items and drops bad ones', () => {
    const at = new Date().toISOString();
    const cb = normalizeClipboard({
      version: 1,
      clips: [{ id: '1', text: 'hi', pinned: true, at }, { id: '2', text: '', at }, { id: 3, text: 'x', at }, 'junk'],
      shelf: [{ path: '/a.png', name: 'a.png', size: 10, image: 'data:x' }, { path: '', name: 'b', size: 1 }],
    });
    expect(cb.clips).toEqual([{ id: '1', text: 'hi', pinned: true, at }]);
    expect(cb.shelf).toEqual([{ path: '/a.png', name: 'a.png', size: 10 }]);
  });

  test('saved form leaves thumbnails out', () => {
    const cb = { ...empty(), shelf: [{ path: '/a.png', name: 'a.png', size: 1, image: 'data:x' }] };
    expect(toSaved(cb).shelf[0]).not.toHaveProperty('image');
  });
});
