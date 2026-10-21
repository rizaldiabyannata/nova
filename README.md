# Nova

A Linux-first desktop notch: a small glass panel with a 2D mascot that shows AI usage status, music and agenda at a glance.

Requirements live in `NOVA_PRD_Technical_Specification_ID_v1.1.md`. This repo is at **M0 — prototype scaffold**: browser preview works, desktop shell is scaffolded but not yet built on a target machine.

## Run the browser preview

Needs Node.js LTS.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # config normalisation, rotation, provider failure
npm run build    # type-check + production bundle in dist/
```

The preview paints a stand-in wallpaper behind the notch; the desktop window is transparent. Settings are stored in `localStorage` under `nova.config`.

## Run the desktop shell (M1, Ubuntu 26.04 + GNOME Wayland)

Install the Tauri 2 prerequisites first:

```bash
sudo apt update
sudo apt install -y \
  build-essential curl wget file pkg-config git \
  libssl-dev libwebkit2gtk-4.1-dev libxdo-dev \
  libayatana-appindicator3-dev librsvg2-dev
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
```

Check them, then run:

```bash
rustc --version && cargo --version
pkg-config --modversion webkit2gtk-4.1
echo "$XDG_SESSION_TYPE"   # expected: wayland
npx tauri info             # should report no ✘

npm run tauri -- dev
npm run tauri -- build     # bundles in src-tauri/target/release/bundle/ (deb, AppImage)
```

If `apt` cannot find a package or `pkg-config` fails, stop and check package versions before reaching for a workaround. See the [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/).

### Install on this machine (deb)

```bash
npm run tauri -- build --bundles deb
sudo apt install ./src-tauri/target/release/bundle/deb/Nova_0.1.0_amd64.deb
```

Turn on **Settings → Start on login** to launch Nova with your session (it writes `~/.config/autostart/Nova.desktop`).

### Keyboard shortcut

A running Nova opens and closes its panel when started again with `--toggle`. Bind that to a key through GNOME (works on Wayland, no extension needed), here `Super+Alt+N`:

```bash
p=/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/nova/
k=org.gnome.settings-daemon.plugins.media-keys
gsettings set $k custom-keybindings "$(gsettings get $k custom-keybindings | sed "s#@as \[\]#[]#; s#\]#, '$p']#; s#\[, #[#")"
gsettings set $k.custom-keybinding:$p name 'Nova'
gsettings set $k.custom-keybinding:$p command 'nova --toggle'
gsettings set $k.custom-keybinding:$p binding '<Super><Alt>n'
```

Or add it by hand in Settings → Keyboard → Custom Shortcuts with the command `nova --toggle`.

### Data and logs

Settings and organizer data (agenda, alarms, focus) go to Tauri Store (`nova-config.json` in `~/.local/share/dev.nova.desktop/`). Credentials never go in that file. Warnings and errors are logged to `~/.local/share/dev.nova.desktop/logs/` (path from Tauri's log plugin) and to stdout.

## Layout

```
src/
  app/            App shell: view state, rotation, saving
  components/     idle-scene (notch + mascot), widgets (panel, cards), settings
  config/         schema v1, defaults, normalisation, storage
  hooks/          useRotation, useOrganizer (save + minute scheduler)
  organizer/      agenda/alarm/focus schema, due logic, notifications
  providers/ai/   ProviderUsage model, demo providers
  styles/         tokens, glass, motion
src-tauri/        Tauri 2 shell: window config, capabilities, store plugin
```

## Known limitations

- **The desktop shell has not been built yet.** `src-tauri/` was written without Rust or WebKitGTK installed; the first `tauri dev` is part of M1 and may need fixes.
- **AI usage is organization API usage only.** Add an Anthropic or OpenAI *Admin* key in Settings › AI; it is kept in the system keyring (Secret Service) and only the Rust shell sends it. Totals are per UTC day and cached 5 min. ChatGPT/Claude plan limits are not shown; no official API exposes them. The browser preview shows demo cards.
- **Music reads the active MPRIS player** (Spotify, browsers, …) over D-Bus every 2 s: cover, play/pause/next/previous, seek and mute, where the player supports them. No volume slider yet.
- **Organizer is local only.** Agenda events, daily alarms and a focus timer live in Nova; no calendar sync, repeating events, snooze or per-weekday alarms. Events and alarms are checked once a minute; anything that fell due while Nova was closed for over an hour is not announced.
- **Placement runs through XWayland.** Nova pins itself top-centre; the optional GNOME extension docks it into the top bar. Native Wayland placement elsewhere is best-effort (M2).
- **Glass does not blur the desktop.** `backdrop-filter` only blurs content inside the webview, so on the desktop the panel is a translucent tint. Without `backdrop-filter` it falls back to a solid surface.
- No tray or Windows/macOS adapters yet.

## Manual test checklist (Ubuntu Wayland)

Record OS, GNOME version, WebKitGTK version, GPU/session and the result of each item.

- [ ] Open/close the panel with mouse, Enter and Space; Escape closes it and focus returns to the notch.
- [ ] Tab through every control; each shows a focus ring.
- [ ] Change name, emoji, colour, animation, interval, rotation and reduced motion; restart; all are kept.
- [ ] Rotation changes the idle label every interval, stops while the panel or settings are open, resumes after.
- [ ] Turn on the OS "Reduce animation" setting; the mascot and transitions stop. Same with the in-app toggle.
- [ ] Transparent corners on a light and a dark wallpaper; solid fallback if blur misbehaves.
- [ ] Stacking while switching apps (do not assume always-on-top works because it is configured).
- [ ] Initial position after launch, other monitors/scaling if available, lock/unlock, suspend/resume, logging in again.
- [ ] Idle CPU/RSS after startup settles, with the panel open, and with animations on and off.
- [ ] `nova --toggle` and the bound shortcut open/close the panel while another app has focus; no second Nova starts.
- [ ] Start on login on/off creates/removes `~/.config/autostart/Nova.desktop`; Nova starts after logging in again.
- [ ] An event and an alarm one minute ahead each show a GNOME notification and Lumi reacts; a 1-minute focus timer does too.
- [ ] Agenda, alarms and a running focus timer are kept after a restart.
- [ ] The log file exists under `~/.local/share/dev.nova.desktop/logs/` and holds no secrets.

## Contributing

Contributions are welcome: bug reports, ideas, and pull requests. Start with [CONTRIBUTING.md](CONTRIBUTING.md), and please follow the [Code of Conduct](CODE_OF_CONDUCT.md). Security issues go through [SECURITY.md](SECURITY.md), not public issues.

## License

[MIT](LICENSE) © 2026 Rizaldi Abyannata
