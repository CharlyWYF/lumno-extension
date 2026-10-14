// A shortcut drag moves React-rendered tiles by hand, so renders asked for
// while it runs (favicons resolving, storage changes) must wait and run once
// after the drag ends.
const assert = require('assert');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const NEWTAB_SHORTCUTS_STORE = require(path.join(repoRoot, 'src/newtab/shortcuts-store.js'));
require(path.join(repoRoot, 'src/newtab/shortcuts-controller.js'));

global.document = { body: { getAttribute: () => '1' } };
global.window = global;

function createElementStub() {
  return { setAttribute() {}, addEventListener() {}, getAttribute: () => null };
}

let dragActive = false;
let renders = 0;
const pageState = {
  newtabShortcuts: [],
  shortcutGrid: null,
  shortcutSection: null,
  addShortcutButton: null
};
const noop = () => {};
const controller = globalThis.LumnoNewtabShortcutsController.createShortcutsController({
  NEWTAB_SHORTCUTS_STORE,
  isShortcutDragActive: () => dragActive,
  shortcutFolderRuntime: { visibleItems: (items) => items, flush: () => Promise.resolve() },
  bookmarksRuntime: { getNodeMap: () => new Map() },
  pageStructureRuntime: { shortcut: { section: createElementStub(), grid: createElementStub() } },
  NEWTAB_SHORTCUTS_VIEW: {
    createShortcutsView: () => ({
      render: () => { renders += 1; },
      getAddButton: () => null
    })
  },
  t: (key, fallback) => fallback,
  formatMessage: (key, fallback) => fallback,
  getRiSvg: () => '',
  hideShortcutTooltip: noop,
  closeShortcutContextMenu: noop,
  syncOpenBookmarkCascadeAnchorVisual: noop,
  applyNewtabShortcutsVisibility: noop,
  updateShortcutLanguageStrings: noop,
  updateBookmarkSectionPosition: noop,
  applyNewtabShortcutDockMagnification: noop,
  scheduleWallpaperAdaptiveToneUpdate: noop,
  pageState
});

controller.createShortcutsSection();
const afterSetup = renders;

controller.renderShortcuts();
assert.strictEqual(renders, afterSetup + 1, 'renders right away while no drag runs');

dragActive = true;
controller.renderShortcuts();
controller.renderShortcuts();
assert.strictEqual(renders, afterSetup + 1, 'renders wait while a shortcut drag runs');

controller.flushDeferredShortcutRender();
assert.strictEqual(renders, afterSetup + 1, 'a flush during the drag still waits');

dragActive = false;
controller.flushDeferredShortcutRender();
assert.strictEqual(renders, afterSetup + 2, 'the held renders run once after the drag');

controller.flushDeferredShortcutRender();
assert.strictEqual(renders, afterSetup + 2, 'nothing is left to flush afterwards');

dragActive = true;
controller.renderShortcuts();
dragActive = false;
controller.renderShortcuts();
controller.flushDeferredShortcutRender();
assert.strictEqual(renders, afterSetup + 3, 'a render after the drag clears the held one');

console.log('newtab shortcut render deferral tests passed');
