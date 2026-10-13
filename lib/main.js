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
        "theme-selector:use-system-mode": {
          description: "Follow the operating system's light or dark setting.",
          didDispatch: (event) => getSelector(event.context?.window).useSystemMode(),
        },
        "theme-selector:use-light-mode": {
          description: "Keep the light theme, whatever the system is set to.",
          didDispatch: (event) => getSelector(event.context?.window).useLightMode(),
        },
        "theme-selector:use-dark-mode": {
          description: "Keep the dark theme, whatever the system is set to.",
          didDispatch: (event) => getSelector(event.context?.window).useDarkMode(),
        },
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
