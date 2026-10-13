describe("theme previews in editor windows", () => {
  beforeEach(async () => {
    jasmine.useRealClock();
    jasmine.attachToDOM(lumine.workspace.getElement());
    await lumine.packages.activatePackage("one-theme");
    await lumine.packages.activatePackage("aura-theme");
    await lumine.packages.activatePackage("theme-selector");
  });
  afterEach(async () => {
    await lumine.packages.deactivatePackage("theme-selector");
    await lumine.workspace.discardEditorWindows();
  });
  it("keeps window-local queries without letting an older cancellation undo a newer confirmation", async () => {
    const workspace = lumine.workspace;
    const first = await workspace.open();
    const extra = await workspace.openEditorWindow({ show: false });
    const second = workspace.buildTextEditor();
    extra.getEditorContainer().getActivePane().activateItem(second, { activatePane: true });
    await lumine.commands.dispatch(first.getElement(), "theme-selector:toggle");
    await lumine.commands.dispatch(second.getElement(), "theme-selector:toggle");
    const main = lumine.packages.getActivePackage("theme-selector").mainModule;
    const local = main.getSelector(workspace.getMainWindow());
    const remote = main.getSelector(extra);
    expect(local.selectListHost.isVisible()).toBe(true);
    expect(remote.selectList.getElement().ownerDocument).toBe(extra.getDocument());
    await local.selectList.setQuery("local");
    await remote.selectList.setQuery("remote");
    expect(local.selectList.getQuery()).toBe("local");
    const packs = lumine.themes.getThemePacks();
    local.preview(packs.find((pack) => pack.name === "One"));
    remote.preview(packs.find((pack) => pack.name === "Aura"));
    local.confirm(packs.find((pack) => pack.name === "One"));
    const light = [...lumine.config.get("theme.light")];
    const dark = [...lumine.config.get("theme.dark")];
    remote.cancel();
    expect(lumine.config.get("theme.light")).toEqual(light);
    expect(lumine.config.get("theme.dark")).toEqual(dark);
  });
});
