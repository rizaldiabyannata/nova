// Optional companion for Nova (PRD AC-12: Nova must work without it).
// While the Nova window exists: the top bar's centre box is hidden and the Nova window is docked
// top-centre in its place. The bar is transparent; while a window touches it (maximized, tiled) a black
// strip fills it in so the notch blends into it (switchable in the extension's preferences).
// Everything is undone when Nova closes or the extension is disabled.
import Meta from 'gi://Meta';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

// Tauri sets the Wayland app_id from the bundle identifier; the binary name and title are fallbacks.
const NOVA_ID = /^(dev\.nova\.desktop|nova)$/i;

const isNova = w =>
    NOVA_ID.test(w.get_gtk_application_id() ?? '') || NOVA_ID.test(w.get_wm_class() ?? '') || w.get_title() === 'Nova';

export default class NovaTopBar extends Extension {
    enable() {
        this._nova = null;
        this._novaSignals = [];
        this._hiddenForFullscreen = false;
        this._settings = this.getSettings();
        this._signals = [
            [this._settings, this._settings.connect('changed::solid-under-windows', () => this._syncBar())],
            [this._settings, this._settings.connect('changed::hide-in-fullscreen', () => this._syncFullscreen())],
            [global.display, global.display.connect('in-fullscreen-changed', () => this._syncFullscreen())],
            [global.display, global.display.connect('window-created', (_d, w) => this._watch(w))],
            [Main.layoutManager, Main.layoutManager.connect('monitors-changed', () => this._nova && this._dock())],
            [global.display, global.display.connect('restacked', () => this._syncBar())],
            [global.window_manager, global.window_manager.connect('size-changed', () => this._syncBar())],
            [global.window_manager, global.window_manager.connect('minimize', () => this._syncBar())],
            [global.workspace_manager, global.workspace_manager.connect('active-workspace-changed', () => this._syncBar())],
        ];
        for (const actor of global.get_window_actors())
            this._watch(actor.meta_window);
    }

    disable() {
        for (const [obj, id] of this._signals)
            obj.disconnect(id);
        this._signals = [];
        this._release();
        this._settings = null;
    }

    // Titles and app ids can arrive after creation, so decide once the first frame is drawn.
    _watch(w) {
        if (this._nova)
            return;
        const actor = w.get_compositor_private();
        const check = () => {
            if (!this._nova && isNova(w))
                this._claim(w);
        };
        if (w.get_title())
            check();
        else
            actor?.connect('first-frame', check);
    }

    _claim(w) {
        this._nova = w;
        this._novaSignals = [
            w.connect('size-changed', () => this._dock()),
            // Nova re-centres itself after resizing; mutter clamps that move below the bar, so take it back.
            w.connect('position-changed', () => this._dock()),
            w.connect('unmanaged', () => this._release()),
        ];

        const panel = Main.panel;
        panel.add_style_class_name('nova-topbar');
        panel._centerBox.hide();
        // The bar paints above every window, so a solid bar would cover Nova. Paint the black under all windows instead.
        this._underlay = new St.Widget({style: 'background-color: #000;', visible: false});
        // Inside the background group: mutter's restack lifts any other window_group child above all windows.
        // ponytail: a wallpaper change may stack the new background over the strip until Nova restarts.
        Main.layoutManager._backgroundGroup.add_child(this._underlay);
        // The bar is above all windows; without this it would swallow clicks meant for the notch.
        this._panelReactive = panel.reactive;
        panel.reactive = false;

        w.make_above();
        this._dock();
        this._syncBar();
        this._syncFullscreen();
    }

    _release() {
        if (!this._nova)
            return;
        for (const id of this._novaSignals)
            this._nova.disconnect(id);
        if (this._hiddenForFullscreen)
            this._nova.unminimize();
        this._hiddenForFullscreen = false;
        this._novaSignals = [];
        this._nova = null;
        this._underlay.destroy();
        this._underlay = null;

        const panel = Main.panel;
        panel.remove_style_class_name('nova-topbar');
        panel._centerBox.show();
        panel.reactive = this._panelReactive;
    }

    // Wayland apps cannot place themselves, so the shell centres Nova at the top of the primary monitor.
    _dock() {
        const m = Main.layoutManager.primaryMonitor;
        const rect = this._nova.get_frame_rect();
        const x = m.x + Math.round((m.width - rect.width) / 2);
        // user_op=true: a non-user move is clamped to the work area, which pushes Nova below the bar.
        if (rect.x !== x || rect.y !== m.y)
            this._nova.move_frame(true, x, m.y);
    }

    // Clear bar over the wallpaper; solid once a window on the primary monitor reaches up to it.
    _syncBar() {
        if (!this._nova)
            return;
        const m = Main.layoutManager.primaryMonitor;
        const barBottom = m.y + Main.panel.height;
        const touching = this._settings.get_boolean('solid-under-windows') && global.workspace_manager.get_active_workspace().list_windows().some(w =>
            w !== this._nova && !w.minimized && w.is_on_primary_monitor() && w.showing_on_its_workspace() &&
            w.get_window_type() === Meta.WindowType.NORMAL && w.get_frame_rect().y <= barBottom);
        this._underlay.set_position(m.x, m.y);
        this._underlay.set_size(m.width, Main.panel.height);
        this._underlay.visible = touching;
    }

    // The bar hides during fullscreen (F11, video), so Nova goes with it; minimized, its window takes no clicks either.
    _syncFullscreen() {
        if (!this._nova)
            return;
        const hide = this._settings.get_boolean('hide-in-fullscreen') && Main.layoutManager.primaryMonitor.inFullscreen;
        if (hide === this._hiddenForFullscreen)
            return;
        this._hiddenForFullscreen = hide;
        if (hide)
            this._nova.minimize();
        else
            this._nova.unminimize();
    }
}
