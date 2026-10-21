import { useEffect, useState } from 'react';
import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart';
import { ANIMATIONS, INTERVAL_MAX, INTERVAL_MIN, NAME_MAX, type Animation, type Config } from '../../config/schema';
import { isTauri } from '../../config/storage';
import { hasKey, saveKey } from '../../providers/ai';

interface Props {
  config: Config;
  update: (patch: Partial<Config>) => Config;
}

const ANIMATION_LABEL: Record<Animation, string> = { playful: 'Playful · lively', gentle: 'Gentle · subtle', minimal: 'Minimal · still' };
const TABS = { appearance: 'Appearance', behaviour: 'Behaviour', ai: 'AI' };
type Tab = keyof typeof TABS;

/** Text that is only committed on blur/Enter, so clearing a field mid-edit does not snap it back to the default. */
function TextSetting(props: { label: string; meta: (draft: string) => string; value: string; maxLength: number; placeholder: string; onCommit: (v: string) => string }) {
  const [draft, setDraft] = useState(props.value);
  useEffect(() => setDraft(props.value), [props.value]);
  return (
    <label className="field">
      <span className="field-label">
        {props.label}
        <small>{props.meta(draft)}</small>
      </span>
      <input
        value={draft}
        maxLength={props.maxLength}
        placeholder={props.placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => setDraft(props.onCommit(draft))}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
    </label>
  );
}

/** A labelled switch with its state written beside it, so on/off never rests on colour alone. */
function Toggle({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="toggle">
      <span>{label}</span>
      <span className="toggle-control">
        <input type="checkbox" role="switch" className="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span className="toggle-value" aria-hidden="true">
          {checked ? 'On' : 'Off'}
        </span>
      </span>
    </label>
  );
}

/** The OS autostart entry is the source of truth, so this is not part of Config. */
function StartOnLogin() {
  const [on, setOn] = useState<boolean>();
  useEffect(() => {
    isEnabled().then(setOn, (err) => console.warn('[nova] autostart unreadable:', err));
  }, []);
  const toggle = (next: boolean) =>
    (next ? enable() : disable()).then(() => setOn(next), (err) => console.warn('[nova] autostart not changed:', err));
  return <Toggle label="Start on login" checked={!!on} disabled={on === undefined} onChange={(next) => void toggle(next)} />;
}

/**
 * One admin key per provider. The field is never filled from storage: a saved key goes to the OS keyring
 * and only "Saved" comes back, so the key is never on screen or in the page's memory after saving.
 */
function AdminKey({ provider, label, placeholder }: { provider: string; label: string; placeholder: string }) {
  const [saved, setSaved] = useState<boolean>();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    hasKey(provider).then(setSaved, () => setError('The system keyring is not available.'));
  }, [provider]);
  const store = (key: string) =>
    saveKey(provider, key).then(
      () => {
        setSaved(!!key.trim());
        setDraft('');
        setError('');
      },
      () => setError('Could not reach the system keyring.'),
    );
  return (
    <div className="field">
      <label className="field-label" htmlFor={`key-${provider}`}>
        {label}
        <small>{saved === undefined ? '' : saved ? 'Saved in keyring' : 'Not set'}</small>
      </label>
      <span className="key-control">
        <input
          id={`key-${provider}`}
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={draft}
          placeholder={saved ? 'Replace key…' : placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && draft.trim() && void store(draft)}
        />
        <button type="button" className="text-btn quiet" disabled={!draft.trim()} onClick={() => void store(draft)}>
          Save
        </button>
        {saved && (
          <button type="button" className="text-btn quiet" onClick={() => void store('')}>
            Remove
          </button>
        )}
      </span>
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

export function Settings({ config, update }: Props) {
  const { mascot } = config;
  const [tab, setTab] = useState<Tab>('appearance');
  return (
    <form className="settings" aria-label="Settings" onSubmit={(e) => e.preventDefault()}>
      <div className="tabs" role="group" aria-label="Settings section">
        {(Object.keys(TABS) as Tab[]).map((t) => (
          <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)}>
            {TABS[t]}
          </button>
        ))}
      </div>
      {tab === 'appearance' ? (
        <div className="settings-fields">
          <TextSetting
            label="Companion name"
            meta={(draft) => `${draft.length}/${NAME_MAX}`}
            value={mascot.name}
            maxLength={NAME_MAX}
            placeholder="e.g. Lumi"
            onCommit={(name) => update({ mascot: { ...mascot, name } }).mascot.name}
          />
          <label className="field">
            <span className="field-label">
              Accent colour
              <small>Click to edit</small>
            </span>
            <span className="accent-control">
              <input type="color" value={mascot.accent} onChange={(e) => update({ mascot: { ...mascot, accent: e.target.value } })} />
              <code>{mascot.accent.toUpperCase()}</code>
            </span>
          </label>
          <TextSetting
            label="Badge symbol"
            meta={() => '1 symbol'}
            value={mascot.emoji}
            maxLength={16}
            placeholder="✦"
            onCommit={(emoji) => update({ mascot: { ...mascot, emoji } }).mascot.emoji}
          />
          <label className="field">
            <span className="field-label">Lumi animation</span>
            <span className="select">
              <select value={config.animation} onChange={(e) => update({ animation: e.target.value as Animation })}>
                {ANIMATIONS.map((a) => (
                  <option key={a} value={a}>
                    {ANIMATION_LABEL[a]}
                  </option>
                ))}
              </select>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="m4 6 4 4 4-4" />
              </svg>
            </span>
          </label>
        </div>
      ) : tab === 'ai' ? (
        <div className="settings-fields">
          {isTauri ? (
            <>
              <AdminKey provider="anthropic" label="Anthropic Admin key" placeholder="sk-ant-admin…" />
              <AdminKey provider="openai" label="OpenAI Admin key" placeholder="sk-admin-…" />
              <p className="hint">
                Admin keys read your organization's API usage and cost. Nova keeps them in the system keyring and sends them only to
                Anthropic or OpenAI. This is not your ChatGPT or Claude plan limit.
              </p>
            </>
          ) : (
            <p className="hint">API keys can only be added in the desktop app.</p>
          )}
        </div>
      ) : (
        <div className="settings-fields">
          <Toggle label="Rotate widgets" checked={config.rotationEnabled} onChange={(rotationEnabled) => update({ rotationEnabled })} />
          <Toggle label="Show clock" checked={config.showClock} onChange={(showClock) => update({ showClock })} />
          <Toggle label="Reduce motion" checked={config.reduceMotion} onChange={(reduceMotion) => update({ reduceMotion })} />
          {isTauri && <StartOnLogin />}
          <label className="field rotation" data-disabled={!config.rotationEnabled || undefined}>
            <span className="field-label">
              Rotate every
              <output>{config.rotationIntervalSeconds} seconds</output>
            </span>
            <input
              type="range"
              min={INTERVAL_MIN}
              max={INTERVAL_MAX}
              step={1}
              value={config.rotationIntervalSeconds}
              disabled={!config.rotationEnabled}
              onChange={(e) => update({ rotationIntervalSeconds: Number(e.target.value) })}
            />
            <span className="range-ends" aria-hidden="true">
              <span>{INTERVAL_MIN} sec</span>
              <span>{INTERVAL_MAX} sec</span>
            </span>
          </label>
          <p className="hint">Your system's reduced-motion setting is always respected.</p>
        </div>
      )}
    </form>
  );
}
