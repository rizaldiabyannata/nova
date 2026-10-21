import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class NovaTopBarPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const group = new Adw.PreferencesGroup();
        for (const [key, title, subtitle] of [
            ['solid-under-windows', 'Solid bar under full windows', 'Black top bar while a maximized or tiled window touches it'],
            ['hide-in-fullscreen', 'Hide in fullscreen', 'Hide Nova while a fullscreen app or video is showing, like the top bar'],
        ]) {
            const row = new Adw.SwitchRow({title, subtitle});
            settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
            group.add(row);
        }
        const page = new Adw.PreferencesPage();
        page.add(group);
        window.add(page);
    }
}
