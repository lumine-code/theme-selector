const path = require("path");

const packageRoot = path.resolve(__dirname, "..");

describe("theme-selector", () => {
  const primaryModifier = process.platform === "darwin" ? "cmd" : "ctrl";
  let selector;

  beforeEach(async () => {
    jasmine.attachToDOM(lumine.views.getView(lumine.workspace));
    lumine.config.set("theme.mode", "light");
    lumine.config.set("theme.light", ["one-day-ui", "one-day-syntax"]);
    lumine.config.set("theme.dark", ["one-night-ui", "one-night-syntax"]);

    await lumine.packages.activatePackage("one-theme");
    await lumine.packages.activatePackage("aura-theme");
    await lumine.packages.activatePackage("vscode-theme");
    await lumine.packages.activatePackage("settings-view");
    const pack = await lumine.packages.activatePackage(packageRoot);
    selector = pack.mainModule.getSelector();
  });

  afterEach(async () => {
    await lumine.packages.deactivatePackage("theme-selector");
    await lumine.packages.deactivatePackage("settings-view");
    await lumine.packages.deactivatePackage("vscode-theme");
    await lumine.packages.deactivatePackage("aura-theme");
    await lumine.packages.deactivatePackage("one-theme");
  });

  it("lists registered packs and marks the configured pack as active", async () => {
    await selector.show();

    expect(selector.selectList.getItems().map(({ name }) => name)).toEqual([
      "One",
      "Aura",
      "VS Code Modern",
    ]);
    const activeItem = selector.selectList.getElement().querySelector("li.active");
    expect(activeItem.textContent).toContain("One");
    const status = activeItem.querySelector(".primary-line > .theme-pack-status.icon.icon-check");
    const title = activeItem.querySelector(".primary-line > .theme-pack-title");
    expect(status).not.toBeNull();
    expect(title.textContent).toBe("One");
    expect(status.offsetTop).toBe(title.offsetTop);
    expect(getComputedStyle(status).visibility).toBe("visible");
    expect(activeItem.querySelector(".secondary-line.no-icon")).not.toBeNull();
    expect(
      getComputedStyle(
        selector.selectList.getElement().querySelector("li:not(.active) .theme-pack-status"),
      ).visibility,
    ).toBe("hidden");
  });

  it("leaves the theme alone while navigating", async () => {
    await selector.show();
    const aura = lumine.themes.getThemePacks().find(({ name }) => name === "Aura");

    await selector.selectList.selectItem(aura);

    // Moving the selection is not a decision; the window keeps the theme it
    // had until the pack is previewed or confirmed.
    expect(lumine.config.get("theme.light")).toEqual(["one-day-ui", "one-day-syntax"]);
    expect(lumine.config.get("theme.dark")).toEqual(["one-night-ui", "one-night-syntax"]);
  });

  it("previews the selected pack on demand and restores config when cancelled", async () => {
    await selector.show();
    const aura = lumine.themes.getThemePacks().find(({ name }) => name === "Aura");

    await selector.selectList.selectItem(aura);
    await lumine.commands.dispatch(selector.selectList.getElement(), "theme-selector:preview");
    expect(lumine.config.get("theme.light")).toEqual(["aura-day-ui", "aura-day-syntax"]);
    expect(lumine.config.get("theme.dark")).toEqual(["aura-night-ui", "aura-night-syntax"]);

    selector.selectListHost.cancel();
    expect(lumine.config.get("theme.light")).toEqual(["one-day-ui", "one-day-syntax"]);
    expect(lumine.config.get("theme.dark")).toEqual(["one-night-ui", "one-night-syntax"]);
  });

  it("moves the tick onto the previewed pack", async () => {
    await selector.show();
    const aura = lumine.themes.getThemePacks().find(({ name }) => name === "Aura");

    await selector.selectList.selectItem(aura);
    await lumine.commands.dispatch(selector.selectList.getElement(), "theme-selector:preview");
    await selector.selectList.refresh();

    expect(selector.selectList.getElement().querySelector("li.active").textContent).toContain(
      "Aura",
    );
  });

  it("offers the primary, preview, and appearance-mode actions with their keybindings", async () => {
    await selector.show();

    const actions = selector.selectList.getAvailableActions();
    const byCommand = new Map(actions.map((action) => [action.command, action]));
    expect(
      [...byCommand.keys()].filter((command) => command !== "select-list:toggle-keep-open"),
    ).toEqual([
      "theme-selector:use-selected-theme-pack",
      "theme-selector:preview",
      "settings-view:use-system-mode",
      "settings-view:use-light-mode",
      "settings-view:use-dark-mode",
    ]);

    const primary = byCommand.get("theme-selector:use-selected-theme-pack");
    expect(primary.description).toBe("Apply and keep the selected theme pack.");
    expect(primary.primary).toBe(true);

    const preview = byCommand.get("theme-selector:preview");
    expect(preview.name).toBe("Preview");
    expect(preview.keystrokes).toEqual(["shift-enter"]);
    expect(preview.context).toBe("item");

    expect(byCommand.get("settings-view:use-system-mode").keystrokes).toEqual([
      `${primaryModifier}-1`,
    ]);
    expect(byCommand.get("settings-view:use-light-mode").keystrokes).toEqual([
      `${primaryModifier}-2`,
    ]);
    expect(byCommand.get("settings-view:use-dark-mode").keystrokes).toEqual([
      `${primaryModifier}-3`,
    ]);
    expect(byCommand.get("settings-view:use-system-mode").context).toBe("dialog");
  });

  it("keeps only appearance-mode actions when no pack is selected", async () => {
    await selector.show();
    await selector.selectList.setItems([]);

    expect(
      selector.selectList
        .getAvailableActions()
        .map((action) => action.command)
        .filter((command) => command !== "select-list:toggle-keep-open"),
    ).toEqual([
      "settings-view:use-system-mode",
      "settings-view:use-light-mode",
      "settings-view:use-dark-mode",
    ]);
  });

  it("keeps the previewed pack when confirmed", async () => {
    await selector.show();
    const vscode = lumine.themes.getThemePacks().find(({ name }) => name === "VS Code Modern");

    await selector.selectList.selectItem(vscode);
    await selector.selectList.confirmSelection();

    expect(lumine.config.get("theme.light")).toEqual(["vscode-day-ui", "vscode-day-syntax"]);
    expect(lumine.config.get("theme.dark")).toEqual(["vscode-night-ui", "vscode-night-syntax"]);
    expect(selector.selectListHost.isVisible()).toBe(false);
  });

  it("restores the latest committed pack after further previews in keep-open mode", async () => {
    await selector.show();
    const model = selector.selectList;
    await model.runAction("select-list:toggle-keep-open");
    const packs = lumine.themes.getThemePacks();
    for (const name of ["Aura", "VS Code Modern"]) {
      await model.selectItem(packs.find((pack) => pack.name === name));
      await model.confirmSelection();
      expect(selector.selectListHost.isVisible()).toBe(true);
      expect(model.getElement().querySelector("li.active").textContent).toContain(name);
    }

    await model.selectItem(packs.find((pack) => pack.name === "One"));
    await model.runAction("theme-selector:preview");
    expect(lumine.config.get("theme.light")).toEqual(["one-day-ui", "one-day-syntax"]);
    selector.selectListHost.cancel();
    expect(lumine.config.get("theme.light")).toEqual(["vscode-day-ui", "vscode-day-syntax"]);
    expect(lumine.config.get("theme.dark")).toEqual(["vscode-night-ui", "vscode-night-syntax"]);
  });

  for (const back of ["breadcrumb", "shift-escape"]) {
    it(`restores the committed pack after a later preview and ${back} back`, async () => {
      const parent = lumine.workspace.addInputDialog({}, { crumb: "Parent" });
      try {
        await parent.show();
        await selector.selectListHost.show({ crumb: "Themes" });
        const model = selector.selectList;
        await model.runAction("select-list:toggle-keep-open");
        const packs = lumine.themes.getThemePacks();
        await model.selectItem(packs.find((pack) => pack.name === "Aura"));
        await model.confirmSelection();
        await model.selectItem(packs.find((pack) => pack.name === "VS Code Modern"));
        await model.runAction("theme-selector:preview");
        expect(lumine.config.get("theme.light")).toEqual(["vscode-day-ui", "vscode-day-syntax"]);

        if (back === "breadcrumb") {
          expect(lumine.workspace.popModal()).toBe(true);
        } else {
          const target = model.getQueryEditor().getElement();
          expect(
            lumine.keymaps.findKeyBindings({ keystrokes: "shift-escape", target })[0].command,
          ).toBe("modal:go-back");
          await lumine.commands.dispatch(target, "modal:go-back");
        }

        expect(parent.isVisible()).toBe(true);
        expect(selector.selectListHost.isVisible()).toBe(false);
        expect(lumine.config.get("theme.light")).toEqual(["aura-day-ui", "aura-day-syntax"]);
        expect(lumine.config.get("theme.dark")).toEqual(["aura-night-ui", "aura-night-syntax"]);
        selector.selectListHost.cancel();
        expect(lumine.config.get("theme.light")).toEqual(["aura-day-ui", "aura-day-syntax"]);
      } finally {
        await parent.destroy();
      }
    });
  }

  it("keeps the selected mode when cancelled", async () => {
    await selector.show();
    const aura = lumine.themes.getThemePacks().find(({ name }) => name === "Aura");

    await selector.selectList.selectItem(aura);
    await lumine.commands.dispatch(selector.selectList.getElement(), "settings-view:use-dark-mode");

    selector.selectListHost.cancel();
    expect(lumine.config.get("theme.mode")).toBe("dark");
    expect(lumine.config.get("theme.light")).toEqual(["one-day-ui", "one-day-syntax"]);
    expect(lumine.config.get("theme.dark")).toEqual(["one-night-ui", "one-night-syntax"]);
  });

  it("selects system, light, and dark modes with shared settings commands", async () => {
    await selector.show();

    // Resolved against the query editor, which is where focus is and where
    // the package's keymap points.
    const commandFor = (keystrokes) =>
      lumine.keymaps.findKeyBindings({
        keystrokes,
        target: selector.selectList.getQueryEditor().element,
      })[0]?.command;
    expect(commandFor(`${primaryModifier}-1`)).toBe("settings-view:use-system-mode");
    expect(commandFor(`${primaryModifier}-2`)).toBe("settings-view:use-light-mode");
    expect(commandFor(`${primaryModifier}-3`)).toBe("settings-view:use-dark-mode");

    await lumine.commands.dispatch(selector.selectList.getElement(), "settings-view:use-dark-mode");
    expect(lumine.config.get("theme.mode")).toBe("dark");

    await lumine.commands.dispatch(
      selector.selectList.getElement(),
      "settings-view:use-light-mode",
    );
    expect(lumine.config.get("theme.mode")).toBe("light");

    await lumine.commands.dispatch(
      selector.selectList.getElement(),
      "settings-view:use-system-mode",
    );
    expect(lumine.config.get("theme.mode")).toBe("system");

    selector.selectListHost.cancel();
    expect(lumine.config.get("theme.mode")).toBe("system");
  });
});
