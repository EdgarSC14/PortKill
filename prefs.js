import Gtk from "gi://Gtk";
import Adw from "gi://Adw";

import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

export default class PortKillerPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const settings = this.getSettings();

    const page = new Adw.PreferencesPage({
      title: "General",
      icon_name: "preferences-system-symbolic",
    });

    const group = new Adw.PreferencesGroup({
      title: "Port list",
      description: "Configure how often ports are scanned and how many rows are shown.",
    });

    const refreshRow = new Adw.SpinRow({
      title: "Refresh interval (seconds)",
      adjustment: new Gtk.Adjustment({
        lower: 2,
        upper: 60,
        step_increment: 1,
        page_increment: 5,
        value: settings.get_int("refresh-interval-seconds"),
      }),
    });
    settings.bind(
      "refresh-interval-seconds",
      refreshRow,
      "value",
      0
    );

    const maxRowsRow = new Adw.SpinRow({
      title: "Maximum visible ports",
      adjustment: new Gtk.Adjustment({
        lower: 5,
        upper: 100,
        step_increment: 1,
        page_increment: 5,
        value: settings.get_int("max-visible-items"),
      }),
    });
    settings.bind(
      "max-visible-items",
      maxRowsRow,
      "value",
      0
    );

    group.add(refreshRow);
    group.add(maxRowsRow);
    page.add(group);
    window.add(page);
  }
}
