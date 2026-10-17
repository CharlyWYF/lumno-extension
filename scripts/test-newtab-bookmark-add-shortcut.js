const assert = require('assert');
const path = require('path');

// Right-clicking a bookmarked site offers "Add to shortcuts", which copies it
// into the shortcuts and leaves the bookmark in place.
global.LumnoNewtabDismissStack = { getDismissStack: () => ({ register() {} }) };
require(path.join(__dirname, '..', 'src', 'newtab', 'bookmark-context-menu.js'));

const shortcutUrls = new Set(['https://already.example/']);
const pageState = {
  bookmarkContextMenu: { control: {}, menu: { contains: () => true } },
  bookmarkContextMenuSelectController: {
    isOpen: () => true,
    setOpen() {},
    setOptions() {}
  }
};
const menu = globalThis.LumnoNewtabBookmarkContextMenu.createBookmarkContextMenu({
  bookmarksRuntime: { getNode: () => null },
  NEWTAB_BOOKMARKS_STORE: { collectFolderBookmarkUrls: () => [] },
  BOOKMARK_CONTEXT_MENU_OPEN_GROUP_VALUE: 'open-group',
  t: (key, fallback) => fallback,
  NEWTAB_CONTEXT_MENU_OPEN_VALUE: 'open',
  FOLDER_COLOR_CONTEXT_MENU_VALUE: 'color',
  BOOKMARK_CONTEXT_MENU_EDIT_VALUE: 'edit',
  openFolderColorPicker() {},
  openExternalNewTabUrl() {},
  openBookmarkEditor() {},
  openBookmarkFolderTabGroupConfirmation() {},
  deleteBookmarkFromContextTarget() {},
  hasShortcutForSite: (site) => shortcutUrls.has(site.url),
  addSiteToShortcuts() {},
  closeShortcutContextMenu() {},
  closeRecentContextMenu() {},
  hideCursorTooltip() {},
  pageState
});

const site = { bookmarkId: '7', title: 'Example', url: 'https://example.com/', isFolder: false };
const options = menu.getBookmarkContextMenuOptions(site);
assert.deepStrictEqual(options.map((option) => option.value), ['open', 'add-shortcut', 'edit', 'remove']);
const addOption = options.find((option) => option.value === 'add-shortcut');
assert.strictEqual(addOption.label, 'Add to shortcuts');
assert.strictEqual(addOption.disabled, false);

const existing = menu.getBookmarkContextMenuOptions({ ...site, url: 'https://already.example/' })
  .find((option) => option.value === 'add-shortcut');
assert.strictEqual(existing.label, 'Already in shortcuts');
assert.strictEqual(existing.disabled, true, 'a site already in the shortcuts cannot be added twice');

const folderValues = menu.getBookmarkContextMenuOptions({ bookmarkId: '8', title: 'Folder', isFolder: true })
  .map((option) => option.value);
assert.strictEqual(folderValues.includes('add-shortcut'), false, 'folders keep their own menu');

console.log('bookmark add-to-shortcut menu tests passed');
