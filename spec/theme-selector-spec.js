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
    const pack = await lumine.packages.activatePackage("theme-selector");
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

    expect(selector.selectList.items.map(({ name }) => name)).toEqual([
      "One",
      "Aura",
      "Nova",
      "VS Code Modern",
    ]);
    const activeItem = selector.selectList.element.querySelector("li.active");
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
        selector.selectList.element.querySelector("li:not(.active) .theme-pack-status"),
      ).visibility,
    ).toBe("hidden");
  });

  it("previews packs while navigating and restores config when cancelled", async () => {
    await selector.show();
    const nova = lumine.themes.getThemePacks().find(({ name }) => name === "Nova");

    await selector.selectList.selectItem(nova);
    expect(lumine.config.get("theme.light")).toEqual(["nova-day-ui", "nova-day-syntax"]);
    expect(lumine.config.get("theme.dark")).toEqual(["nova-night-ui", "nova-night-syntax"]);

    selector.selectList.cancelSelection();
    expect(lumine.config.get("theme.light")).toEqual(["one-day-ui", "one-day-syntax"]);
    expect(lumine.config.get("theme.dark")).toEqual(["one-night-ui", "one-night-syntax"]);
  });

  it("keeps the previewed pack when confirmed", async () => {
    await selector.show();
    const vscode = lumine.themes.getThemePacks().find(({ name }) => name === "VS Code Modern");

    selector.selectList.props.didChangeSelection(vscode);
    selector.selectList.props.didConfirmSelection(vscode);

    expect(lumine.config.get("theme.light")).toEqual(["vscode-day-ui", "vscode-day-syntax"]);
    expect(lumine.config.get("theme.dark")).toEqual(["vscode-night-ui", "vscode-night-syntax"]);
    expect(selector.selectList.isVisible()).toBe(false);
  });

  it("keeps the selected mode when cancelled", async () => {
    await selector.show();
    const nova = lumine.themes.getThemePacks().find(({ name }) => name === "Nova");

    await selector.selectList.selectItem(nova);
    lumine.commands.dispatch(selector.selectList.element, "theme-selector:use-dark-mode");

    selector.selectList.cancelSelection();
    expect(lumine.config.get("theme.mode")).toBe("dark");
    expect(lumine.config.get("theme.light")).toEqual(["one-day-ui", "one-day-syntax"]);
    expect(lumine.config.get("theme.dark")).toEqual(["one-night-ui", "one-night-syntax"]);
  });

  it("selects system, light, and dark modes with selector commands", async () => {
    await selector.show();

    const commandFor = (keystrokes) =>
      lumine.keymaps.findKeyBindings({
        keystrokes,
        target: selector.selectList.element,
      })[0]?.command;
    expect(commandFor("ctrl-1")).toBe("theme-selector:use-system-mode");
    expect(commandFor("ctrl-2")).toBe("theme-selector:use-light-mode");
    expect(commandFor("ctrl-3")).toBe("theme-selector:use-dark-mode");

    lumine.commands.dispatch(selector.selectList.element, "theme-selector:use-dark-mode");
    expect(lumine.config.get("theme.mode")).toBe("dark");

    lumine.commands.dispatch(selector.selectList.element, "theme-selector:use-light-mode");
    expect(lumine.config.get("theme.mode")).toBe("light");

    lumine.commands.dispatch(selector.selectList.element, "theme-selector:use-system-mode");
    expect(lumine.config.get("theme.mode")).toBe("system");

    selector.selectList.cancelSelection();
    expect(lumine.config.get("theme.mode")).toBe("system");
  });
});
