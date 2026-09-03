const { CompositeDisposable } = require("lumine");

module.exports = class ThemeSelector {
  constructor() {
    this.snapshot = null;
    this.selectList = lumine.workspace.buildSelectList({
      className: "theme-selector",
      items: [],
      emptyMessage: "No theme packs are registered",
      placeholderText: "Select a theme",
      getItemId: (themePack) => themePack.name,
      search: {
        getFilterText: (themePack) =>
          [themePack.name, ...themePack.light, ...themePack.dark].join(" "),
      },
      source: {
        mode: "snapshot",
        load: () => this.loadThemePacks(),
      },
      renderItem: (themePack, { highlight }) => {
        const element = document.createElement("li");
        element.classList.add("theme-pack", "two-lines");
        if (lumine.themes.isThemePackActive(themePack)) {
          element.classList.add("active");
        }

        const primaryLine = document.createElement("div");
        primaryLine.classList.add("primary-line");
        const status = document.createElement("span");
        status.classList.add("theme-pack-status", "icon", "icon-check");
        primaryLine.appendChild(status);
        const title = document.createElement("span");
        title.classList.add("theme-pack-title");
        title.appendChild(highlight(themePack.name));
        primaryLine.appendChild(title);
        element.appendChild(primaryLine);

        const secondaryLine = document.createElement("div");
        secondaryLine.classList.add("secondary-line", "no-icon");
        secondaryLine.textContent = `Light: ${themePack.light.join(" + ")} · Dark: ${themePack.dark.join(" + ")}`;
        element.appendChild(secondaryLine);
        return element;
      },
      commands: {
        "theme-selector:use-selected-theme-pack": {
          description: "Apply the selected theme pack, keep it, and close the picker.",
          didDispatch: (event) => this.confirm(event.detail.item),
        },
        "theme-selector:preview": {
          description: "Apply the selected pack without closing, so it can be seen in place.",
          didDispatch: (event) => this.preview(event.detail.item),
        },
      },
      actions: [
        {
          command: "theme-selector:use-selected-theme-pack",
          context: "item",
          primary: true,
          group: "Theme Pack",
          disposition: "close",
          dispatch: "local",
        },
        {
          command: "theme-selector:preview",
          context: "item",
          group: "Theme Pack",
          disposition: "stay",
          dispatch: "local",
        },
        ...["system", "light", "dark"].map((mode) => ({
          command: `theme-selector:use-${mode}-mode`,
          context: "dialog",
          enabled: () => lumine.config.get("theme.mode") !== mode,
          disabledReason: `The ${mode} appearance mode is already selected.`,
          group: "Appearance",
          disposition: "stay",
          dispatch: "workspace",
        })),
      ],
    });

    this.subscriptions = new CompositeDisposable(
      this.selectList.onDidOpen(() => this.captureSnapshot()),
      this.selectList.onDidCancel(() => this.restoreSnapshot()),
      lumine.config.onDidChange("theme.mode", () => this.updateModeMessage()),
      lumine.themes.onDidChangeThemePacks(() => {
        if (this.selectList.isVisible()) this.selectList.reload();
      }),
    );
  }

  async destroy() {
    this.cancel();
    this.subscriptions.dispose();
    await this.selectList.destroy();
  }

  async toggle() {
    if (this.selectList.isVisible()) {
      this.cancel();
    } else {
      await this.show();
    }
  }

  async show() {
    if (this.selectList.isVisible()) return;
    await this.selectList.show();
  }

  captureSnapshot() {
    // The mode is deliberately absent: it is committed as soon as it is picked
    // and survives a cancellation. Only the previewed pack is restored.
    this.snapshot = {
      light: this.getConfiguredPair("theme.light"),
      dark: this.getConfiguredPair("theme.dark"),
    };
  }

  loadThemePacks() {
    const activeThemePack = lumine.themes.getActiveThemePack();
    const themePacks = [...lumine.themes.getThemePacks()];
    if (activeThemePack) {
      themePacks.splice(themePacks.indexOf(activeThemePack), 1);
      themePacks.unshift(activeThemePack);
    }

    return {
      items: themePacks,
      selection: {
        initial: activeThemePack ? { id: activeThemePack.name } : { mode: "none" },
      },
      infoMessage: this.getModeMessage(),
    };
  }

  preview(themePack) {
    if (!this.snapshot || !themePack) return;
    lumine.themes.setThemePack(themePack);
    // The tick marks whichever pack is applied, so it has to follow the
    // preview rather than stay on the one that was configured.
    this.selectList.refresh();
  }

  confirm(themePack) {
    if (!themePack) return;
    lumine.themes.setThemePack(themePack);
    this.snapshot = null;
  }

  cancel() {
    this.selectList.cancelSelection("toggle");
  }

  restoreSnapshot() {
    const snapshot = this.snapshot;
    this.snapshot = null;
    if (!snapshot) return;
    if (
      this.pairsMatch(this.getConfiguredPair("theme.light"), snapshot.light) &&
      this.pairsMatch(this.getConfiguredPair("theme.dark"), snapshot.dark)
    ) {
      return;
    }

    lumine.config.transact(() => {
      lumine.config.set("theme.light", snapshot.light);
      lumine.config.set("theme.dark", snapshot.dark);
    });
  }

  useSystemMode() {
    lumine.config.set("theme.mode", "system");
  }

  useLightMode() {
    lumine.config.set("theme.mode", "light");
  }

  useDarkMode() {
    lumine.config.set("theme.mode", "dark");
  }

  getConfiguredPair(keyPath) {
    const pair = lumine.config.get(keyPath);
    return Array.isArray(pair) ? pair.slice() : [];
  }

  pairsMatch(left, right) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
  }

  getModeMessage() {
    const mode = lumine.config.get("theme.mode");
    const effectiveMode = lumine.themes.isDarkThemeMode() ? "Dark" : "Light";
    const modeLabel = mode === "system" ? `System (${effectiveMode})` : effectiveMode;
    return `Mode: ${modeLabel} · Ctrl+1: system · Ctrl+2: light · Ctrl+3: dark · Shift+Enter: preview`;
  }

  updateModeMessage() {
    if (!this.selectList.isVisible()) return;
    this.selectList.setInfoMessage(this.getModeMessage());
  }
};
