# Contributing to Nova

Thanks for helping. Nova is a small always-on desktop notch, so every change should stay **light and smooth**: no new dependency for what a few lines can do, no timers that run while nothing is visible, and animation on `transform`/`opacity` only.

## Getting started

```bash
npm install
npm run dev      # browser preview at http://localhost:5173
npm test         # vitest
npm run build    # type-check + production bundle
```

The desktop shell (Tauri 2) needs the system packages listed in the [README](README.md#run-the-desktop-shell-m1-ubuntu-2604--gnome-wayland), then `npm run tauri dev`.

## Making a change

1. Open an issue first for anything bigger than a small fix, so we can agree on the approach.
2. Fork, then branch from `main` (`fix/agenda-timezone`, `feat/weekly-alarms`).
3. Keep the change focused. Match the style of the code around it.
4. Add or update a test for new logic (see `src/**/*.test.ts`).
5. Run `npm test` and `npm run build` before opening the pull request. CI runs the same.
6. For UI changes, add a screenshot or short clip to the pull request.

## Commit messages

Short imperative subject (`Add month grid to agenda`), with a body explaining *why* when it is not obvious.

## Reporting bugs and ideas

Use the issue templates. For security problems, see [SECURITY.md](SECURITY.md) and do not open a public issue.

## Code of conduct

By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

By contributing, you agree your work is released under the [MIT License](LICENSE).
