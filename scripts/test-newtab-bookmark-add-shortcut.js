const assert = require('assert');
const path = require('path');

// Right-clicking a bookmarked site or folder offers "Add to shortcuts", which
// adds it to the shortcuts and leaves the bookmark in place.
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
  hasShortcutForBookmarkFolder: (id) => id === '9',
  addBookmarkFolderToShortcuts() {},
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

// Folders add themselves as folder shortcuts.
const folderOptions = menu.getBookmarkContextMenuOptions({ bookmarkId: '8', title: 'Folder', isFolder: true });
assert.deepStrictEqual(folderOptions.map((option) => option.value), ['open-group', 'add-shortcut', 'color', 'edit', 'remove']);
assert.strictEqual(folderOptions[1].label, 'Add to shortcuts');
const addedFolder = menu.getBookmarkContextMenuOptions({ bookmarkId: '9', title: 'Added', isFolder: true })
  .find((option) => option.value === 'add-shortcut');
assert.strictEqual(addedFolder.label, 'Already in shortcuts');
assert.strictEqual(addedFolder.disabled, true);

console.log('bookmark add-to-shortcut menu tests passed');
