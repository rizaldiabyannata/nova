import { useState, type FormEvent, type ReactNode } from 'react';
import { openPath } from '@tauri-apps/plugin-opener';
import { CLIP_TEXT_MAX, type Clip, type ShelfFile } from '../../clipboard/schema';
import { useClipboardContext } from '../../hooks/useClipboard';
import { localDate, localTime } from '../../organizer/due';

const GLYPH: Record<string, ReactNode> = {
  copy: <><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V3H3v13h5" /></>,
  pin: <path d="m9 3 9 3-3 4v4l-4 2-3-3-4-1 4-3Zm2 13-5 6" />,
  search: <><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6" /></>,
  file: <><path d="M14 3H6v18h12V7Z" /><path d="M14 3v4h4" /></>,
  drop: <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />,
  open: <path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" />,
  plus: <path d="M12 4v16M4 12h16" />,
  back: <path d="m14 6-6 6 6 6" />,
  trash: <path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7" />,
};

function Glyph({ name }: { name: keyof typeof GLYPH }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {GLYPH[name]}
    </svg>
  );
}

const firstLine = (text: string) => text.split('\n').find((l) => l.trim())?.trim() ?? text;
const copiedAt = (at: string, now: Date) => {
  const d = new Date(at);
  return localDate(d) === localDate(now) ? `Copied ${localTime(d)}` : `Copied ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
};

/** Text you copied, newest and pinned first; a click puts it back on the clipboard. */
export function ClipboardPage() {
  const { clipboard, update, paste, copy } = useClipboardContext();
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const now = new Date();
  const { clips } = clipboard;

  if (adding) return <ClipForm onAdd={(text) => (void copy(text), setAdding(false))} onCancel={() => setAdding(false)} />;

  const q = query.trim().toLowerCase();
  const matches = clips
    .filter((c) => (!pinnedOnly || c.pinned) && c.text.toLowerCase().includes(q))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned));
  const setClips = (change: (clips: Clip[]) => Clip[]) => update((c) => ({ ...c, clips: change(c.clips) }));
  const again = (clip: Clip) => {
    void copy(clip.text);
    setCopied(clip.id);
  };

  return (
    <section className="feature clipboard-feature" aria-label="Clipboard">
      <div className="tool-toolbar">
        <div className="tool-tabs" role="group" aria-label="Show">
          <button type="button" aria-pressed={!pinnedOnly} onClick={() => setPinnedOnly(false)}>
            All <span>{clips.length}</span>
          </button>
          <button type="button" aria-pressed={pinnedOnly} onClick={() => setPinnedOnly(true)}>
            <Glyph name="pin" />
            Pinned
          </button>
        </div>
        <div className="tool-toolbar-actions">
          <button
            type="button"
            className="icon-btn small"
            aria-label="Clear unpinned items"
            title="Clear unpinned"
            disabled={!clips.some((c) => !c.pinned)}
            onClick={() => setClips((cs) => cs.filter((c) => c.pinned))}
          >
            <Glyph name="trash" />
          </button>
          <button type="button" className="text-btn small" onClick={() => void paste()}>Paste</button>
          <button type="button" className="icon-btn small" aria-label="Add text by hand" title="Add text by hand" onClick={() => setAdding(true)}>
            <Glyph name="plus" />
          </button>
        </div>
      </div>
      <label className="clip-search">
        <Glyph name="search" />
        <input aria-label="Search clipboard" placeholder="Search what you copied…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      {matches.length ? (
        <ul className="rows clip-list">
          {matches.map((c) => (
            <li key={c.id} className="row clip-row">
              <button type="button" className="clip-content" title="Copy again" onClick={() => again(c)}>
                <span className="clip-type" aria-hidden="true">Aa</span>
                <span className="clip-text">
                  <strong>{firstLine(c.text)}</strong>
                  <span>{copied === c.id ? 'Copied to clipboard' : copiedAt(c.at, now)}</span>
                </span>
              </button>
              <button
                type="button"
                className="icon-btn small clip-pin"
                aria-label={`${c.pinned ? 'Unpin' : 'Pin'} ${firstLine(c.text)}`}
                aria-pressed={c.pinned}
                onClick={() => setClips((cs) => cs.map((x) => (x.id === c.id ? { ...x, pinned: !x.pinned } : x)))}
              >
                <Glyph name="pin" />
              </button>
              <button
                type="button"
                className="icon-btn small row-remove"
                aria-label={`Remove ${firstLine(c.text)}`}
                onClick={() => setClips((cs) => cs.filter((x) => x.id !== c.id))}
              >
                <Glyph name="trash" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="clip-empty">
          <Glyph name="copy" />
          {q ? 'No matches. Try another search.' : pinnedOnly ? 'Pin something to keep it close.' : 'Copy some text and it shows up here.'}
        </p>
      )}
      <p className="tool-note">Kept on this computer · the 50 most recent, plus anything pinned.</p>
    </section>
  );
}

function ClipForm({ onAdd, onCancel }: { onAdd: (text: string) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (draft.trim()) onAdd(draft);
  };
  return (
    <form
      className="feature entry-form"
      aria-label="New clipboard item"
      onSubmit={submit}
      onKeyDown={(e) => e.key === 'Escape' && (e.preventDefault(), e.stopPropagation(), onCancel())}
    >
      <div className="entry-heading">
        <strong>New clipboard item</strong>
        <span>Plain text</span>
      </div>
      <label className="field">
        <span className="field-label">
          Clipboard text
          <small>{draft.length}/{CLIP_TEXT_MAX}</small>
        </span>
        <textarea
          rows={3}
          maxLength={CLIP_TEXT_MAX}
          autoFocus
          placeholder="Type a note, link, or snippet you reuse…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      </label>
      <div className="entry-actions">
        <button type="button" className="text-btn quiet" onClick={onCancel}>Cancel</button>
        <button type="submit" className="text-btn" disabled={!draft.trim()}>Add to clipboard</button>
      </div>
    </form>
  );
}

const sizeLabel = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 ** 2 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`;
const kindLabel = (name: string) => {
  const ext = name.includes('.') ? name.split('.').pop()!.toUpperCase() : '';
  return ext ? `${ext} file` : 'File';
};

/** Files dropped on Nova, kept at hand: open one, copy its path, or let it go. */
export function ShelfPage() {
  const { clipboard, update, copy, dragging } = useClipboardContext();
  const [open, setOpen] = useState<string | null>(null);
  const files = clipboard.shelf;
  const preview = files.find((f) => f.path === open);
  const remove = (f: ShelfFile) => {
    update((c) => ({ ...c, shelf: c.shelf.filter((x) => x.path !== f.path) }));
    setOpen(null);
  };
  const launch = (f: ShelfFile) => void openPath(f.path).catch((err) => console.warn('[nova] open file:', err));

  return (
    <section className="feature shelf-feature" aria-label="Shelf">
      <div className="shelf-header">
        <div>
          <strong>Shelf</strong>
          <button type="button" className="text-btn quiet small" disabled={!files.length} onClick={() => (update((c) => ({ ...c, shelf: [] })), setOpen(null))}>
            Clear
          </button>
        </div>
        <span>{files.length} {files.length === 1 ? 'file' : 'files'}</span>
      </div>
      {preview ? (
        <div className="shelf-preview">
          <button type="button" className="icon-btn small" aria-label="Back to shelf" onClick={() => setOpen(null)}>
            <Glyph name="back" />
          </button>
          <Thumb file={preview} />
          <div className="shelf-preview-detail">
            <strong title={preview.path}>{preview.name}</strong>
            <span>{sizeLabel(preview.size)} · {kindLabel(preview.name)}</span>
            <div className="shelf-file-actions">
              <button type="button" className="icon-btn small" title="Open" aria-label={`Open ${preview.name}`} onClick={() => launch(preview)}>
                <Glyph name="open" />
              </button>
              <button type="button" className="icon-btn small" title="Copy path" aria-label={`Copy path of ${preview.name}`} onClick={() => void copy(preview.path)}>
                <Glyph name="copy" />
              </button>
              <button type="button" className="icon-btn small" title="Remove from shelf" aria-label={`Remove ${preview.name} from shelf`} onClick={() => remove(preview)}>
                <Glyph name="trash" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="shelf-body">
          <div className="shelf-files" role="region" aria-label="Files on shelf" tabIndex={0}>
            {files.length ? (
              files.map((f) => (
                <button type="button" className="shelf-file" key={f.path} title={`Open ${f.name}`} onClick={() => setOpen(f.path)}>
                  <Thumb file={f} />
                  <strong>{f.name}</strong>
                  <span>{sizeLabel(f.size)}</span>
                </button>
              ))
            ) : (
              <span className="shelf-empty">A little room<br />for your next find.</span>
            )}
          </div>
          <div className="shelf-drop" data-dragging={dragging || undefined} aria-hidden="true">
            <Glyph name="drop" />
            <strong>{dragging ? 'Let it land here' : 'Drop files here'}</strong>
            <span>from Files or the desktop</span>
          </div>
        </div>
      )}
    </section>
  );
}

function Thumb({ file }: { file: ShelfFile }) {
  return file.image ? (
    <img className="shelf-thumb" src={file.image} alt="" />
  ) : (
    <span className="shelf-thumb shelf-thumb-file" aria-hidden="true"><Glyph name="file" /></span>
  );
}
