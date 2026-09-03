const path = require("path");

const packageRoot = path.resolve(__dirname, "..");

describe("theme-selector", () => {
  let selector;

  beforeEach(async () => {
    jasmine.attachToDOM(lumine.views.getView(lumine.workspace));
    lumine.config.set("theme.mode", "light");
    lumine.config.set("theme.light", ["one-day-ui", "one-day-syntax"]);
    lumine.config.set("theme.dark", ["one-night-ui", "one-night-syntax"]);

    await lumine.packages.activatePackage("one-theme");
    await lumine.packages.activatePackage("aura-theme");
    await lumine.packages.activatePackage("nova-theme");
    await lumine.packages.activatePackage("vscode-theme");
    const pack = await lumine.packages.activatePackage(packageRoot);
    selector = pack.mainModule.getSelector();
  });

  afterEach(async () => {
    await lumine.packages.deactivatePackage("theme-selector");
    await lumine.packages.deactivatePackage("vscode-theme");
    await lumine.packages.deactivatePackage("nova-theme");
    await lumine.packages.deactivatePackage("aura-theme");
    await lumine.packages.deactivatePackage("one-theme");
  });

  it("lists registered packs and marks the configured pack as active", async () => {
    await selector.show();

    expect(selector.selectList.getItems().map(({ name }) => name)).toEqual([
      "One",
      "Aura",
      "Nova",
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
    const nova = lumine.themes.getThemePacks().find(({ name }) => name === "Nova");

    await selector.selectList.selectItem(nova);

    // Moving the selection is not a decision; the window keeps the theme it
    // had until the pack is previewed or confirmed.
    expect(lumine.config.get("theme.light")).toEqual(["one-day-ui", "one-day-syntax"]);
    expect(lumine.config.get("theme.dark")).toEqual(["one-night-ui", "one-night-syntax"]);
  });

  it("previews the selected pack on demand and restores config when cancelled", async () => {
    await selector.show();
    const nova = lumine.themes.getThemePacks().find(({ name }) => name === "Nova");

    await selector.selectList.selectItem(nova);
    await lumine.commands.dispatch(selector.selectList.getElement(), "theme-selector:preview");
    expect(lumine.config.get("theme.light")).toEqual(["nova-day-ui", "nova-day-syntax"]);
    expect(lumine.config.get("theme.dark")).toEqual(["nova-night-ui", "nova-night-syntax"]);

    selector.selectList.cancelSelection();
    expect(lumine.config.get("theme.light")).toEqual(["one-day-ui", "one-day-syntax"]);
    expect(lumine.config.get("theme.dark")).toEqual(["one-night-ui", "one-night-syntax"]);
  });

  it("moves the tick onto the previewed pack", async () => {
    await selector.show();
    const nova = lumine.themes.getThemePacks().find(({ name }) => name === "Nova");

    await selector.selectList.selectItem(nova);
    await lumine.commands.dispatch(selector.selectList.getElement(), "theme-selector:preview");
    await selector.selectList.refresh();

    expect(selector.selectList.getElement().querySelector("li.active").textContent).toContain(
      "Nova",
    );
  });

  it("offers the primary, preview, and appearance-mode actions with their keybindings", async () => {
    await selector.show();

    const actions = selector.selectList.getAvailableActions();
    const byCommand = new Map(actions.map((action) => [action.command, action]));
    expect([...byCommand.keys()]).toEqual([
      "theme-selector:use-selected-theme-pack",
      "theme-selector:preview",
      "theme-selector:use-system-mode",
      "theme-selector:use-light-mode",
      "theme-selector:use-dark-mode",
    ]);

    const primary = byCommand.get("theme-selector:use-selected-theme-pack");
    expect(primary.description).toBe(
      "Apply the selected theme pack, keep it, and close the picker.",
    );
    expect(primary.primary).toBe(true);

    const preview = byCommand.get("theme-selector:preview");
    expect(preview.name).toBe("Preview");
    expect(preview.keystrokes).toEqual(["shift-enter"]);
    expect(preview.context).toBe("item");

    expect(byCommand.get("theme-selector:use-system-mode").keystrokes).toEqual(["ctrl-1"]);
    expect(byCommand.get("theme-selector:use-light-mode").keystrokes).toEqual(["ctrl-2"]);
    expect(byCommand.get("theme-selector:use-dark-mode").keystrokes).toEqual(["ctrl-3"]);
    expect(byCommand.get("theme-selector:use-system-mode").context).toBe("dialog");
  });

  it("keeps only appearance-mode actions when no pack is selected", async () => {
    await selector.show();
    await selector.selectList.setItems([]);

    expect(selector.selectList.getAvailableActions().map((action) => action.command)).toEqual([
      "theme-selector:use-system-mode",
      "theme-selector:use-light-mode",
      "theme-selector:use-dark-mode",
    ]);
  });

  it("keeps the previewed pack when confirmed", async () => {
    await selector.show();
    const vscode = lumine.themes.getThemePacks().find(({ name }) => name === "VS Code Modern");

    await selector.selectList.selectItem(vscode);
    await selector.selectList.confirmSelection();

    expect(lumine.config.get("theme.light")).toEqual(["vscode-day-ui", "vscode-day-syntax"]);
    expect(lumine.config.get("theme.dark")).toEqual(["vscode-night-ui", "vscode-night-syntax"]);
    expect(selector.selectList.isVisible()).toBe(false);
  });

  it("keeps the selected mode when cancelled", async () => {
    await selector.show();
    const nova = lumine.themes.getThemePacks().find(({ name }) => name === "Nova");

    await selector.selectList.selectItem(nova);
    await lumine.commands.dispatch(
      selector.selectList.getElement(),
      "theme-selector:use-dark-mode",
    );

    selector.selectList.cancelSelection();
    expect(lumine.config.get("theme.mode")).toBe("dark");
    expect(lumine.config.get("theme.light")).toEqual(["one-day-ui", "one-day-syntax"]);
    expect(lumine.config.get("theme.dark")).toEqual(["one-night-ui", "one-night-syntax"]);
  });

  it("selects system, light, and dark modes with selector commands", async () => {
    await selector.show();

    // Resolved against the query editor, which is where focus is and where
    // the package's keymap points.
    const commandFor = (keystrokes) =>
      lumine.keymaps.findKeyBindings({
        keystrokes,
        target: selector.selectList.getQueryEditor().element,
      })[0]?.command;
    expect(commandFor("ctrl-1")).toBe("theme-selector:use-system-mode");
    expect(commandFor("ctrl-2")).toBe("theme-selector:use-light-mode");
    expect(commandFor("ctrl-3")).toBe("theme-selector:use-dark-mode");

    await lumine.commands.dispatch(
      selector.selectList.getElement(),
      "theme-selector:use-dark-mode",
    );
    expect(lumine.config.get("theme.mode")).toBe("dark");

    await lumine.commands.dispatch(
      selector.selectList.getElement(),
      "theme-selector:use-light-mode",
    );
    expect(lumine.config.get("theme.mode")).toBe("light");

    await lumine.commands.dispatch(
      selector.selectList.getElement(),
      "theme-selector:use-system-mode",
    );
    expect(lumine.config.get("theme.mode")).toBe("system");

    selector.selectList.cancelSelection();
    expect(lumine.config.get("theme.mode")).toBe("system");
  });
});
