const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const historyApi = require('../src/newtab/bookmark-move-history');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');
const { extractFunction: extractFunctionFrom } = require('./helpers/extract-function');

const source = readNewtabRuntimeSource();
function extractFunction(name) {
  return extractFunctionFrom(source, name);
}
function createRuntime() {
  const history = historyApi.createBookmarkMoveHistory();
  const context = vm.createContext({
    newtabShortcuts: [
      { id: 'one', url: 'https://one.example/', title: 'One', createdAt: 123, iconSource: 'custom' },
      { id: 'folder', type: 'folder', folderId: '42', title: 'Folder', createdAt: 456 },
      { id: 'two', url: 'https://two.example/', title: 'Two', createdAt: 789 }
    ],
    newtabShortcutIcons: { one: 'data:image/png;base64,original' },
    bookmarkMoveHistory: history,
    bookmarkMoveHistoryBusy: false,
    NEWTAB_BOOKMARK_MOVE_HISTORY: historyApi,
    MAX_NEWTAB_SHORTCUTS: 10,
    bookmarkCascadeRuntime: null,
    shortcutFolderRuntime: { getNode: () => ({ id: '42' }) },
    bookmarkCalls: [], toasts: [], failPersistence: false,
    persistShortcuts(items, _message, iconChange) {
      if (context.failPersistence) return Promise.resolve(false);
      context.newtabShortcuts = Array.from(items);
      const ids = new Set(items.map((item) => item.id));
      context.newtabShortcutIcons = Object.fromEntries(Object.entries(context.newtabShortcutIcons).filter(([id]) => ids.has(id)));
      if (iconChange) context.newtabShortcutIcons[iconChange.shortcutId] = iconChange.dataUrl;
      return Promise.resolve(true);
    },
    bookmarksRuntime: {
      getNodeMap: () => new Map(),
      runControlledMutation: (operation) => Promise.resolve().then(operation),
      move: (id, destination) => { context.bookmarkCalls.push({ id, destination }); return Promise.resolve(); }
    },
    showToast(message) { context.toasts.push(message); },
    t: (_key, fallback) => fallback,
    formatMessage: (_key, fallback, values) => fallback.replace('{shortcut}', values.shortcut),
    getBookmarkUndoShortcutLabel: () => 'Ctrl+Z',
    getBookmarkRedoShortcutLabel: () => 'Ctrl+Shift+Z',
    markBookmarkTreeDirty() {}, loadBookmarks() {},
    console
  });
  vm.runInContext(`${extractFunction('removeShortcutById')}\n${extractFunction('performBookmarkMoveHistoryAction')}`, context);
  return context;
}
const json = (value) => JSON.parse(JSON.stringify(value));
const settle = () => new Promise((resolve) => setImmediate(resolve));

(async () => {
  const runtime = createRuntime();
  const original = json(runtime.newtabShortcuts);
  assert.strictEqual(await runtime.removeShortcutById('one'), true);
  assert.deepStrictEqual(runtime.newtabShortcuts.map((item) => item.id), ['folder', 'two']);
  assert.strictEqual(runtime.newtabShortcutIcons.one, undefined);
  const record = runtime.bookmarkMoveHistory.peekUndo();
  assert.strictEqual(record.kind, 'shortcut-delete');
  assert.ok(Object.isFrozen(record.snapshot));
  assert.match(runtime.toasts.at(-1), /Ctrl\+Z/);
  assert.strictEqual(runtime.performBookmarkMoveHistoryAction('undo'), true);
  await settle();
  assert.deepStrictEqual(json(runtime.newtabShortcuts), original);
  assert.strictEqual(runtime.newtabShortcutIcons.one, 'data:image/png;base64,original');
  assert.match(runtime.toasts.at(-1), /Ctrl\+Shift\+Z/);
  runtime.performBookmarkMoveHistoryAction('redo');
  await settle();
  assert.deepStrictEqual(runtime.newtabShortcuts.map((item) => item.id), ['folder', 'two']);
  runtime.performBookmarkMoveHistoryAction('undo');
  await settle();
  assert.deepStrictEqual(json(runtime.newtabShortcuts), original);

  await runtime.removeShortcutById('folder');
  runtime.performBookmarkMoveHistoryAction('undo');
  await settle();
  assert.deepStrictEqual(json(runtime.newtabShortcuts), original);
  assert.deepStrictEqual(runtime.bookmarkCalls, [], 'folder shortcut restoration must not recreate or mutate its bookmark tree');

  const portable = createRuntime();
  const reference = { version: 1, root: 'bookmarks-bar', scope: 'unknown', path: ['Folder'], fingerprint: '0123456789abcdef' };
  portable.newtabShortcuts[1] = { id: 'folder', type: 'folder', folderRef: reference, title: 'Folder' };
  await portable.removeShortcutById('folder');
  portable.newtabShortcuts.push({ id: 'another-folder-alias', type: 'folder', folderRef: reference, title: 'Another alias' });
  reference.path.push('changed externally');
  assert.deepStrictEqual(json(portable.bookmarkMoveHistory.peekUndo().snapshot.folderRef.path), ['Folder']);
  portable.performBookmarkMoveHistoryAction('undo'); await settle();
  assert.deepStrictEqual(json(portable.newtabShortcuts[1].folderRef.path), ['Folder']);
  assert.strictEqual(portable.newtabShortcuts.at(-1).id, 'another-folder-alias');

  const mixed = createRuntime();
  mixed.bookmarkMoveHistory.push(historyApi.createMoveRecord({ bookmarkId: 'bookmark', from: { parentId: '1', index: 0 }, to: { parentId: '2', index: 1 } }));
  await mixed.removeShortcutById('one');
  await mixed.removeShortcutById('two');
  mixed.performBookmarkMoveHistoryAction('undo'); await settle();
  assert.deepStrictEqual(mixed.newtabShortcuts.map((item) => item.id), ['folder', 'two']);
  mixed.performBookmarkMoveHistoryAction('undo'); await settle();
  assert.deepStrictEqual(json(mixed.newtabShortcuts), original);
  mixed.performBookmarkMoveHistoryAction('undo'); await settle();
  assert.strictEqual(mixed.bookmarkCalls.at(-1).id, 'bookmark');
  assert.strictEqual(mixed.bookmarkCalls.at(-1).destination.parentId, '1');
  await mixed.removeShortcutById('folder');
  assert.strictEqual(mixed.bookmarkMoveHistory.canRedo(), false, 'a new deletion clears redo history');

  const failed = createRuntime();
  failed.failPersistence = true;
  assert.strictEqual(await failed.removeShortcutById('one'), false);
  assert.strictEqual(failed.bookmarkMoveHistory.canUndo(), false);
  assert.strictEqual(failed.bookmarkMoveHistoryBusy, false);
  failed.failPersistence = false;
  await failed.removeShortcutById('one');
  failed.failPersistence = true;
  failed.performBookmarkMoveHistoryAction('undo'); await settle();
  assert.strictEqual(failed.bookmarkMoveHistory.peekUndo().snapshot.id, 'one');
  assert.strictEqual(failed.bookmarkMoveHistoryBusy, false);
  failed.failPersistence = false;
  failed.performBookmarkMoveHistoryAction('undo'); await settle();
  assert.deepStrictEqual(json(failed.newtabShortcuts), original);

  const full = createRuntime();
  await full.removeShortcutById('one');
  full.MAX_NEWTAB_SHORTCUTS = 2;
  full.performBookmarkMoveHistoryAction('undo'); await settle();
  assert.deepStrictEqual(full.newtabShortcuts.map((item) => item.id), ['folder', 'two']);
  assert.strictEqual(full.bookmarkMoveHistory.peekUndo().snapshot.id, 'one');
  full.MAX_NEWTAB_SHORTCUTS = 10;
  full.newtabShortcuts.push({ id: 'newer', url: original[0].url, title: 'Newer shortcut' });
  full.performBookmarkMoveHistoryAction('undo'); await settle();
  assert.strictEqual(full.newtabShortcuts.at(-1).title, 'Newer shortcut', 'undo must not replace a newer shortcut with the same URL');

  console.log('Shortcut deletion undo/redo, original order and icons, mixed history, failures and conflicts passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
