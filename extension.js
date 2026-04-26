import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import St from "gi://St";
import Clutter from "gi://Clutter";

import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as ModalDialog from "resource:///org/gnome/shell/ui/modalDialog.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

function runCommand(argv) {
  const proc = Gio.Subprocess.new(
    argv,
    Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
  );

  const [, stdout, stderr] = proc.communicate_utf8(null, null);
  const ok = proc.get_successful();

  return {
    ok,
    stdout: stdout ?? "",
    stderr: stderr ?? "",
  };
}

function parseSsLine(line) {
  const segments = line.trim().split(/\s+/);
  if (segments.length < 5) {
    return null;
  }

  const localAddress = segments[3];
  const processInfo = segments.slice(5).join(" ");
  const portMatch = localAddress.match(/:(\d+)\s*$/);
  const pidMatch = processInfo.match(/pid=(\d+)/);
  const nameMatch = processInfo.match(/"([^"]+)"/);

  if (!portMatch || !pidMatch) {
    return null;
  }

  return {
    port: Number.parseInt(portMatch[1], 10),
    pid: Number.parseInt(pidMatch[1], 10),
    processName: nameMatch ? nameMatch[1] : "unknown",
    rawAddress: localAddress,
  };
}

const PortKillerIndicator = GObject.registerClass(
class PortKillerIndicator extends PanelMenu.Button {
  _init(extension) {
    super._init(0.0, "PortKiller");

    this._extension = extension;
    this._settings = extension.getSettings();
    this._ports = [];
    this._refreshSourceId = null;
    this._settingsSignals = [];
    this._searchQuery = "";
    this._searchTextSignalId = null;

    this.add_style_class_name("portkiller-panel-button");

    const icon = new St.Icon({
      icon_name: "network-server-symbolic",
      style_class: "system-status-icon",
    });
    this.add_child(icon);

    this._buildMenu();
    this._bindSettings();
    this._startRefreshTimer();
    this._refreshNow();
  }

  _bindSettings() {
    this._settingsSignals.push(
      this._settings.connect("changed::refresh-interval-seconds", () => {
        this._startRefreshTimer();
      })
    );
    this._settingsSignals.push(
      this._settings.connect("changed::max-visible-items", () => {
        this._renderPorts();
      })
    );
  }

  _buildMenu() {
    this.menu.removeAll();

    const titleItem = new PopupMenu.PopupMenuItem("PortKiller", {
      reactive: false,
      can_focus: false,
    });
    titleItem.label.add_style_class_name("portkiller-menu-title");
    this.menu.addMenuItem(titleItem);

    this._statusItem = new PopupMenu.PopupMenuItem("Scanning ports...", {
      reactive: false,
      can_focus: false,
    });
    this._statusItem.label.add_style_class_name("portkiller-menu-subtitle");
    this.menu.addMenuItem(this._statusItem);

    const searchRow = new PopupMenu.PopupBaseMenuItem({
      reactive: false,
      can_focus: false,
    });
    this._searchEntry = new St.Entry({
      hint_text: "Search by port or process",
      can_focus: true,
      x_expand: true,
      style_class: "portkiller-search-entry",
    });
    this._searchTextSignalId = this._searchEntry
      .get_clutter_text()
      .connect("text-changed", () => {
        this._searchQuery = this._searchEntry.get_text().trim().toLowerCase();
        this._renderPorts();
      });
    searchRow.add_child(this._searchEntry);
    this.menu.addMenuItem(searchRow);

    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    this._portsSection = new PopupMenu.PopupMenuSection();
    this.menu.addMenuItem(this._portsSection);

    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    const refreshItem = new PopupMenu.PopupMenuItem("Refresh now");
    refreshItem.connect("activate", () => this._refreshNow());
    this.menu.addMenuItem(refreshItem);

    const preferencesItem = new PopupMenu.PopupMenuItem("Preferences");
    preferencesItem.connect("activate", () => this._extension.openPreferences());
    this.menu.addMenuItem(preferencesItem);
  }

  _startRefreshTimer() {
    this._stopRefreshTimer();

    const refreshSeconds = this._settings.get_int("refresh-interval-seconds");
    this._refreshSourceId = GLib.timeout_add_seconds(
      GLib.PRIORITY_DEFAULT,
      Math.max(2, refreshSeconds),
      () => {
        this._refreshNow();
        return GLib.SOURCE_CONTINUE;
      }
    );
  }

  _stopRefreshTimer() {
    if (this._refreshSourceId) {
      GLib.source_remove(this._refreshSourceId);
      this._refreshSourceId = null;
    }
  }

  _refreshNow() {
    const result = runCommand(["/usr/bin/ss", "-ltnpH"]);
    if (!result.ok) {
      this._ports = [];
      this._renderPorts();
      this._statusItem.label.text = "Could not run ss. Install iproute2.";
      return;
    }

    const lines = result.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const parsedPorts = lines
      .map((line) => parseSsLine(line))
      .filter((item) => item !== null);

    parsedPorts.sort((a, b) => a.port - b.port);

    this._ports = parsedPorts;
    this._renderPorts();
    this._statusItem.label.text = `${this._ports.length} listening TCP ports`;
  }

  _renderPorts() {
    this._portsSection.removeAll();

    const filtered = this._ports.filter((item) => {
      if (this._searchQuery.length === 0) {
        return true;
      }
      return (
        String(item.port).includes(this._searchQuery) ||
        item.processName.toLowerCase().includes(this._searchQuery)
      );
    });

    if (filtered.length === 0) {
      const emptyItem = new PopupMenu.PopupMenuItem("No listening TCP ports", {
        reactive: false,
        can_focus: false,
      });
      emptyItem.label.add_style_class_name("portkiller-menu-subtitle");
      this._portsSection.addMenuItem(emptyItem);
      return;
    }

    const maxItems = this._settings.get_int("max-visible-items");
    const visible = filtered.slice(0, Math.max(1, maxItems));

    for (const item of visible) {
      const row = new PopupMenu.PopupBaseMenuItem({
        reactive: true,
        can_focus: true,
      });
      row.add_style_class_name("portkiller-port-row");

      const info = new St.BoxLayout({
        vertical: true,
        x_expand: true,
      });

      const title = new St.Label({
        text: `:${item.port}  ${item.processName}`,
        x_align: Clutter.ActorAlign.START,
      });
      title.add_style_class_name("portkiller-port-title");

      const subtitle = new St.Label({
        text: `pid ${item.pid} • ${item.rawAddress}`,
        x_align: Clutter.ActorAlign.START,
      });
      subtitle.add_style_class_name("portkiller-port-subtitle");

      info.add_child(title);
      info.add_child(subtitle);

      const killButton = new St.Button({
        label: "Kill",
        style_class: "portkiller-kill-button",
      });
      killButton.connect("clicked", () => this._confirmKillProcess(item));

      row.add_child(info);
      row.add_child(killButton);

      this._portsSection.addMenuItem(row);
    }

    if (filtered.length > visible.length) {
      const moreCount = filtered.length - visible.length;
      const moreItem = new PopupMenu.PopupMenuItem(`+${moreCount} more ports`, {
        reactive: false,
        can_focus: false,
      });
      moreItem.label.add_style_class_name("portkiller-menu-subtitle");
      this._portsSection.addMenuItem(moreItem);
    }
  }

  _confirmKillProcess(item) {
    const dialog = new ModalDialog.ModalDialog({
      styleClass: "prompt-dialog",
    });
    const message = new St.Label({
      text: `Close port ${item.port} by terminating ${item.processName} (pid ${item.pid})?`,
      style_class: "portkiller-confirm-text",
    });
    dialog.contentLayout.add_child(message);
    dialog.setButtons([
      {
        label: "Cancel",
        action: () => {
          dialog.close();
          dialog.destroy();
        },
      },
      {
        label: "Close port",
        action: () => {
          dialog.close();
          dialog.destroy();
          this._killProcess(item);
        },
      },
    ]);
    dialog.open();
  }

  _killProcess(item) {
    const result = runCommand([
      "/usr/bin/kill",
      "-TERM",
      String(item.pid),
    ]);

    if (!result.ok) {
      Main.notifyError(
        "PortKiller",
        `Could not kill pid ${item.pid}. Try running with enough permissions.`
      );
      return;
    }

    Main.notify(
      "PortKiller",
      `Sent SIGTERM to ${item.processName} (pid ${item.pid}) on port ${item.port}`
    );
    this._refreshNow();
  }

  destroy() {
    if (this._searchTextSignalId && this._searchEntry) {
      this._searchEntry.get_clutter_text().disconnect(this._searchTextSignalId);
      this._searchTextSignalId = null;
    }
    for (const signalId of this._settingsSignals) {
      this._settings.disconnect(signalId);
    }
    this._settingsSignals = [];
    this._stopRefreshTimer();
    super.destroy();
  }
});

export default class PortKillerExtension extends Extension {
  enable() {
    this._indicator = new PortKillerIndicator(this);
    Main.panel.addToStatusArea(this.uuid, this._indicator);
  }

  disable() {
    if (this._indicator) {
      this._indicator.destroy();
      this._indicator = null;
    }
  }
}
