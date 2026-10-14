const { CompositeDisposable } = require("lumine");
const ThemeSelector = require("./theme-selector");

const selectors = new Map();
const previewState = {};
let subscriptions = null;

function getSelector(window = lumine.workspace.getMainWindow()) {
  let record = selectors.get(window);
  if (!record) {
    const selector = new ThemeSelector(window, previewState);
    const lease = window.onWillDestroy(() => {
      selectors.delete(window);
      lease.dispose();
      void selector.destroy();
    });
    record = { selector, lease };
    selectors.set(window, record);
  }
  return record.selector;
}

module.exports = {
  provideBackgroundTips() {
    return {
      packageName: "theme-selector",
      tips: [
        "{% if keys['theme-selector:toggle'] %}You can preview light and dark theme packs live with {{ 'theme-selector:toggle' | keystroke }}{% else %}You can preview light and dark theme packs live in the theme selector and keep the one you like.{% endif %}",
      ],
    };
  },

  activate() {
    subscriptions = new CompositeDisposable(
      lumine.commands.add("lumine-workspace", {
        "theme-selector:toggle": (event) => getSelector(event.context?.window).toggle(),
      }),
    );
  },

  async deactivate() {
    subscriptions?.dispose();
    subscriptions = null;
    const records = [...selectors.values()];
    selectors.clear();
    for (const record of records) record.lease.dispose();
    await Promise.all(records.map(({ selector }) => selector.destroy()));
    previewState.owner = previewState.snapshot = previewState.applied = null;
  },

  getSelector,
};
