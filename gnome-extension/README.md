# Nova Top Bar (optional GNOME extension)

While Nova runs, the middle of the top bar turns transparent (clock and centre indicators hidden),
the left and right of the bar stay, and the Nova notch is docked top-centre in the gap.
Nova works without it (PRD AC-12). Tested target: GNOME Shell 50.

Install (link, so edits in the repo apply after the next login):

```sh
ln -s "$PWD/gnome-extension/nova-topbar@nova.dev" ~/.local/share/gnome-shell/extensions/
# Wayland only loads new extensions after logging out and back in, then:
gnome-extensions enable nova-topbar@nova.dev
```

Debug: `journalctl -f -o cat /usr/bin/gnome-shell` shows errors from the extension.
Remove: `gnome-extensions disable nova-topbar@nova.dev` and delete the link.
