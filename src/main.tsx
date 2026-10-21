import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { error, warn } from '@tauri-apps/plugin-log';
import { App } from './app/App';
import { isTauri } from './config/storage';
import './styles/app.css';

// The browser preview paints a stand-in wallpaper; the desktop window stays transparent.
document.documentElement.dataset.shell = isTauri ? 'tauri' : 'browser';

// Every console.warn/error also lands in the log file. Nothing logged here holds secrets.
if (isTauri) {
  const text = (args: unknown[]) => args.map((a) => (a instanceof Error ? a.message : String(a))).join(' ');
  for (const [level, write] of [['warn', warn], ['error', error]] as const) {
    const original = console[level];
    console[level] = (...args: unknown[]) => {
      original(...args);
      void write(text(args)).catch(() => {});
    };
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
