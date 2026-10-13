const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const historyApi = require('../src/newtab/bookmark-move-history');
const dragApi = require('../src/newtab/cross-surface-drag');
const store = require('../src/newtab/shortcuts-store');
const references = require('../src/shared/bookmark-folder-reference');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');
const { extractFunction: extractFunctionFrom } = require('./helpers/extract-function');

const source = readNewtabRuntimeSource();
function extractFunction(name) {
  return extractFunctionFrom(source, name);
}
const json = (value) => JSON.parse(JSON.stringify(value));
const settle = () => new Promise((resolve) => setImmediate(resolve));

function createRuntime() {
  const nodes = new Map();
  let created = 0;
  const context = vm.createContext({
    newtabShortcuts: store.normalizeShortcuts([
      { id: 'one', title: 'One', url: 'https://one.example/', createdAt: 123, iconSource: 'custom' },
      { id: 'two', title: 'Two', url: 'https://two.example/', createdAt: 456 }
    ], { now: 456 }),
    newtabShortcutIcons: { one: 'data:image/png;base64,original' },
    bookmarkMoveHistory: historyApi.createBookmarkMoveHistory(),
    bookmarkMoveHistoryBusy: false,
    NEWTAB_BOOKMARK_MOVE_HISTORY: historyApi,
    NEWTAB_CROSS_SURFACE_DRAG: dragApi,
    FOLDER_REFERENCES: references,
    MAX_NEWTAB_SHORTCUTS: 10,
    bookmarkCascadeRuntime: null,
    shortcutDragState: null,
    shortcutGrid: null, bookmarkGrid: null,
    document: { body: { removeAttribute() {} } },
    window: { setTimeout() {} },
    bookmarkPendingLayoutAnimation: null,
    calls: [], toasts: [], bindings: new Map(),
    domOrder: ['one', 'two'], tileMoves: [], hiddenShortcutIds: new Set(),
    failSave: 0, failRemove: 0, failCreate: 0, failMove: 0,
    getShortcutById(id) { return context.newtabShortcuts.find((item) => item.id === id); },
    getShortcutFolderId(item) { return item && (item.folderId || context.bindings.get(item.id)) || ''; },
    isValidExternalBookmarkDropTarget() { return true; },
    shortcutFolderRuntime: {
      ready: Promise.resolve(),
      bind(id, folderId) { context.bindings.set(id, folderId); },
      flush: () => Promise.resolve(),
      reconcile(items) { context.referenceRefreshes += 1; return items; }
    },
    referenceRefreshes: 0,
    isShortcutDragActive: () => false,
    persistShortcuts(items, message, iconChange) {
      context.calls.push({ kind: 'save', ids: items.map((item) => item.id) });
      if (context.failSave > 0) {
        context.failSave -= 1;
        return Promise.resolve(false);
      }
      context.newtabShortcuts = store.normalizeShortcuts(items, { now: 456 });
      const ids = new Set(items.map((item) => item.id));
      context.newtabShortcutIcons = Object.fromEntries(Object.entries(context.newtabShortcutIcons)
        .filter(([id]) => ids.has(id)));
      if (iconChange) context.newtabShortcutIcons[iconChange.shortcutId] = iconChange.dataUrl;
      if (message) context.toasts.push(message);
      return Promise.resolve(true);
    },
    showToast(message) { context.toasts.push(message); },
    t: (_key, fallback) => fallback,
    formatMessage: (_key, fallback, values) => fallback.replace('{shortcut}', values.shortcut),
    getBookmarkUndoShortcutLabel: () => 'Ctrl+Z',
    getBookmarkRedoShortcutLabel: () => 'Ctrl+Shift+Z',
    queueBookmarkLayoutAnimation() {}, markBookmarkTreeDirty() {}, loadBookmarks() {},
    detachShortcutDragDocumentListeners() {}, flushShortcutDragMove() {},
    clearBookmarkDragPageSwitch() {}, clearBookmarkDragFolderSwitch() {}, clearDragDropTarget() {},
    closeBookmarkCascadeMenu() {}, getDragClickGuard: () => ({ armAfterDrag() {} }), renderCurrentBookmarkPage() {},
    flushDeferredShortcutRender() {},
    refreshOpenBookmarkCascadeMenu() {}, settleShortcutDragTile() {},
    persistShortcutOrder: () => Promise.resolve(true), renderShortcuts() {},
    animateShortcutLayoutChange(change) { return change(); },
    resetShortcutDockHover() {},
    getShortcutTileById(id) { return context.hiddenShortcutIds.has(id) ? null : { id }; },
    moveShortcutTileElement(tile, index) {
      context.tileMoves.push({ id: tile.id, index });
      context.domOrder.splice(context.domOrder.indexOf(tile.id), 1);
      context.domOrder.splice(index, 0, tile.id);
    },
    scheduleWallpaperAdaptiveToneUpdate() {},
    console: { warn() {} }
  });
  function reindex(parentId) {
    const parent = nodes.get(parentId);
    parent.children.forEach((node, index) => { node.index = index; node.parentId = parentId; });
  }
  function add(node) {
    const item = { title: '', ...node, ...(!node.url ? { children: node.children || [] } : {}) };
    nodes.set(item.id, item);
    if (item.parentId) {
      const children = nodes.get(item.parentId).children;
      children.splice(Math.min(item.index ?? children.length, children.length), 0, item);
      reindex(item.parentId);
    }
    return item;
  }
  add({ id: '0' });
  add({ id: '1', parentId: '0', title: 'Bookmarks bar' });
  add({ id: '2', parentId: '0', title: 'Other bookmarks' });
  add({ id: 'left', parentId: '1', title: 'Left', url: 'https://left.example/' });
  add({ id: 'link', parentId: '1', title: 'Link', url: 'https://link.example/' });
  add({ id: 'folder', parentId: '1', title: 'Design' });
  add({ id: 'child', parentId: 'folder', title: 'Child', url: 'https://child.example/' });
  add({ id: 'right', parentId: '1', title: 'Right', url: 'https://right.example/' });
  context.bookmarksRuntime = {
    getNodeMap: () => nodes,
    getNode: (id) => nodes.has(String(id)) ? json(nodes.get(String(id))) : null,
    getFolderItems: (id) => nodes.get(String(id)).children,
    ensureReady: () => Promise.resolve(true),
    runControlledMutation: (operation) => Promise.resolve().then(operation),
    create(details) {
      context.calls.push({ kind: 'create', ...details });
      if (context.failCreate > 0) { context.failCreate -= 1; return Promise.reject(new Error('create failed')); }
      return Promise.resolve(json(add({ ...details, id: `created-${++created}` })));
    },
    remove(id) {
      context.calls.push({ kind: 'remove', id });
      if (context.failRemove > 0) { context.failRemove -= 1; return Promise.reject(new Error('remove failed')); }
      const node = nodes.get(String(id));
      assert.ok(node, `Cannot remove missing ${id}`);
      assert.ok(node.url, 'transfers must never remove a folder tree');
      const parent = nodes.get(node.parentId);
      parent.children.splice(node.index, 1);
      nodes.delete(node.id);
      reindex(parent.id);
      return Promise.resolve(true);
    },
    move(id, destination) {
      context.calls.push({ kind: 'move', id, ...destination });
      if (context.failMove > 0) { context.failMove -= 1; return Promise.reject(new Error('move failed')); }
      const node = nodes.get(String(id));
      assert.ok(node, `Cannot move missing ${id}`);
      const previousParent = nodes.get(node.parentId);
      const index = historyApi.normalizeMoveDestinationIndex({
        sourceParentId: node.parentId, sourceIndex: node.index,
        targetParentId: destination.parentId, targetIndex: destination.index
      });
      previousParent.children.splice(node.index, 1);
      reindex(previousParent.id);
      nodes.get(destination.parentId).children.splice(index, 0, node);
      reindex(destination.parentId);
      return Promise.resolve(json(node));
    }
  };
  vm.runInContext(['refreshShortcutFolderReferences', 'applyBookmarkShortcutTransfer', 'moveBookmarkToShortcuts',
    'moveShortcutToBookmarks', 'performBookmarkMoveHistoryAction', 'removeShortcutById',
    'getShortcutGroupHeader', 'restoreShortcutDragOrder', 'persistShortcutOrder', 'finishShortcutDrag', 'endShortcutDrag']
    .map(extractFunction).join('\n'), context);
  context.nodes = nodes;
  context.link = () => [...nodes.values()].find((node) => node.url === 'https://link.example/');
  context.bar = () => nodes.get('1').children.map((node) => node.title);
  context.toShortcuts = (id = 'link', index = 1) => {
    const node = nodes.get(id);
    const record = store.createShortcutRecord(node.url
      ? { title: node.title, url: node.url }
      : { type: 'folder', title: node.title, folderId: node.id }, { now: 789 });
    return context.moveBookmarkToShortcuts({ bookmarkId: id }, { record, index });
  };
  context.toBookmarks = (id, folderId = '1', index = 1) => context.moveShortcutToBookmarks({
    shortcutId: id, tile: {}, originalShortcuts: context.newtabShortcuts.slice()
  }, { kind: 'insertion', folderId, index });
  context.action = async (direction) => {
    assert.strictEqual(context.performBookmarkMoveHistoryAction(direction), true);
    await settle();
    assert.strictEqual(context.bookmarkMoveHistoryBusy, false);
  };
  context.reorder = async (order) => {
    const state = {
      originalShortcuts: context.newtabShortcuts.slice(), isDragging: true, hasReordered: true,
      dropTarget: null, tile: { removeAttribute() {} }
    };
    const byId = new Map(context.newtabShortcuts.map((item) => [item.id, item]));
    context.newtabShortcuts = order.map((id) => byId.get(id));
    context.domOrder = order.filter((id) => !context.hiddenShortcutIds.has(id));
    context.shortcutDragState = state;
    context.finishShortcutDrag(null);
    await settle();
    assert.strictEqual(context.shortcutDragState, null);
    assert.strictEqual(context.bookmarkMoveHistoryBusy, false);
  };
  return context;
}

(async () => {
  const bookmark = createRuntime();
  const bar = bookmark.bar();
  const shortcuts = json(bookmark.newtabShortcuts);
  assert.strictEqual(await bookmark.toShortcuts(), true);
  assert.strictEqual(bookmark.link(), undefined);
  const alias = bookmark.newtabShortcuts[1].id;
  assert.strictEqual(bookmark.bookmarkMoveHistory.peekUndo().kind, 'transfer');
  for (let cycle = 0; cycle < 3; cycle += 1) {
    await bookmark.action('undo');
    assert.deepStrictEqual(bookmark.bar(), bar);
    assert.deepStrictEqual(json(bookmark.newtabShortcuts), shortcuts);
    assert.strictEqual(bookmark.link().index, 1);
    await bookmark.action('redo');
    assert.strictEqual(bookmark.link(), undefined);
    assert.strictEqual(bookmark.newtabShortcuts[1].id, alias);
  }
  assert.deepStrictEqual(bookmark.toasts, [], 'website moves, undo and redo must be silent');
  assert.deepStrictEqual(bookmark.calls.slice(0, 2).map((call) => call.kind), ['save', 'remove']);

  const shortcut = createRuntime();
  const original = json(shortcut.newtabShortcuts);
  assert.strictEqual(await shortcut.toBookmarks('one', '2', 0), true);
  assert.strictEqual(shortcut.newtabShortcutIcons.one, undefined);
  for (let cycle = 0; cycle < 3; cycle += 1) {
    await shortcut.action('undo');
    assert.deepStrictEqual(json(shortcut.newtabShortcuts), original);
    assert.strictEqual(shortcut.newtabShortcutIcons.one, 'data:image/png;base64,original');
    assert.strictEqual(shortcut.nodes.get('2').children.length, 0);
    await shortcut.action('redo');
    assert.deepStrictEqual(shortcut.newtabShortcuts.map((item) => item.id), ['two']);
    assert.strictEqual(shortcut.nodes.get('2').children[0].url, original[0].url);
  }
  assert.deepStrictEqual(shortcut.toasts, []);
  assert.deepStrictEqual(shortcut.calls.slice(0, 2).map((call) => call.kind), ['create', 'save']);

  const folder = createRuntime();
  folder.bookmarkMoveHistoryBusy = true;
  assert.strictEqual(await folder.refreshShortcutFolderReferences(), false);
  assert.strictEqual(folder.referenceRefreshes, 0, 'folder references must not write over a transfer in flight');
  folder.bookmarkMoveHistoryBusy = false;
  const originalFolder = json(folder.nodes.get('folder'));
  await folder.toShortcuts('folder');
  const folderAlias = folder.newtabShortcuts[1].id;
  assert.strictEqual(folder.bindings.get(folderAlias), 'folder');
  assert.deepStrictEqual(json(folder.nodes.get('folder')), originalFolder);
  await folder.action('undo');
  await folder.action('redo');
  assert.deepStrictEqual(json(folder.nodes.get('folder')), originalFolder);
  assert.strictEqual(await folder.toBookmarks(folderAlias, '2', 0), true);
  assert.strictEqual(folder.nodes.get('folder').parentId, '2');
  await folder.action('undo');
  assert.deepStrictEqual(json(folder.nodes.get('folder')), originalFolder);
  assert.strictEqual(folder.newtabShortcuts[1].id, folderAlias);
  await folder.action('redo');
  assert.strictEqual(folder.nodes.get('folder').parentId, '2');
  assert.strictEqual(folder.nodes.get('child').parentId, 'folder');
  assert.ok(folder.toasts.length >= 6, 'folder success messages remain visible');
  assert.ok(!folder.calls.some((call) => call.kind === 'create' || call.kind === 'remove'));

  const returned = createRuntime();
  await returned.toShortcuts('folder');
  const returnId = returned.newtabShortcuts[1].id;
  const beforeReturn = json(returned.nodes.get('folder'));
  await returned.moveShortcutToBookmarks({ shortcutId: returnId, tile: {} }, { kind: 'return', folderId: '1' });
  await returned.action('undo');
  await returned.action('redo');
  assert.deepStrictEqual(json(returned.nodes.get('folder')), beforeReturn);
  assert.ok(!returned.calls.some((call) => call.kind === 'move'));

  const duplicate = createRuntime();
  duplicate.newtabShortcuts[0] = store.normalizeShortcutItem({
    ...duplicate.newtabShortcuts[0], title: 'Custom title', url: 'https://link.example/'
  }, { now: 456 });
  const originalDuplicate = json(duplicate.newtabShortcuts);
  duplicate.MAX_NEWTAB_SHORTCUTS = 2;
  await duplicate.toShortcuts('link', 2);
  assert.deepStrictEqual(duplicate.newtabShortcuts.map((item) => item.id), ['two', 'one']);
  assert.strictEqual(duplicate.newtabShortcutIcons.one, 'data:image/png;base64,original');
  await duplicate.action('undo');
  assert.deepStrictEqual(json(duplicate.newtabShortcuts), originalDuplicate);
  assert.strictEqual(duplicate.link().index, 1);
  await duplicate.action('redo');
  assert.strictEqual(duplicate.newtabShortcuts[1].title, 'Custom title');

  const mixed = createRuntime();
  const beforeMixed = mixed.bar();
  const moved = await mixed.bookmarksRuntime.move('link', { parentId: '2', index: 0 });
  mixed.bookmarkMoveHistory.push(historyApi.createMoveRecord({
    bookmarkId: 'link', from: { parentId: '1', index: 1 }, to: { parentId: '2', index: moved.index }
  }));
  await mixed.toShortcuts();
  await mixed.toBookmarks(mixed.newtabShortcuts[1].id, '1', 0);
  for (let cycle = 0; cycle < 2; cycle += 1) {
    await mixed.action('undo');
    await mixed.action('undo');
    await mixed.action('undo');
    assert.deepStrictEqual(mixed.bar(), beforeMixed, 'older moves must resolve recreated bookmark ids');
    await mixed.action('redo');
    await mixed.action('redo');
    await mixed.action('redo');
    assert.strictEqual(mixed.link().parentId, '1');
    assert.strictEqual(mixed.link().index, 0);
  }

  for (const failure of ['failSave', 'failRemove']) {
    const failed = createRuntime();
    const before = json(failed.newtabShortcuts);
    failed[failure] = 1;
    assert.strictEqual(await failed.toShortcuts(), false);
    assert.deepStrictEqual(json(failed.newtabShortcuts), before);
    assert.strictEqual(failed.link().id, 'link');
    assert.strictEqual(failed.bookmarkMoveHistory.canUndo(), false);
    assert.strictEqual(failed.bookmarkMoveHistoryBusy, false);
  }
  for (const failure of ['failSave', 'failCreate']) {
    const failed = createRuntime();
    const before = json(failed.newtabShortcuts);
    failed[failure] = 1;
    assert.strictEqual(await failed.toBookmarks('one'), false);
    assert.deepStrictEqual(json(failed.newtabShortcuts), before);
    assert.strictEqual(failed.newtabShortcutIcons.one, 'data:image/png;base64,original');
    assert.strictEqual([...failed.nodes.values()].filter((node) => node.url === before[0].url).length, 0);
    assert.strictEqual(failed.bookmarkMoveHistory.canUndo(), false);
  }
  const folderFailure = createRuntime();
  await folderFailure.toShortcuts('folder');
  const beforeFailure = json(folderFailure.nodes.get('folder'));
  const previousRecord = folderFailure.bookmarkMoveHistory.peekUndo();
  folderFailure.failSave = 1;
  assert.strictEqual(await folderFailure.toBookmarks(folderFailure.newtabShortcuts[1].id, '1', 4), false);
  assert.deepStrictEqual(json(folderFailure.nodes.get('folder')), beforeFailure,
    'failed same-parent folder transfers must roll back the exact index');
  assert.strictEqual(folderFailure.bookmarkMoveHistory.peekUndo(), previousRecord);

  const undoFailure = createRuntime();
  await undoFailure.toBookmarks('one');
  const undoRecord = undoFailure.bookmarkMoveHistory.peekUndo();
  undoFailure.failRemove = 1;
  await undoFailure.action('undo');
  assert.deepStrictEqual(undoFailure.newtabShortcuts.map((item) => item.id), ['two']);
  assert.strictEqual(undoFailure.bookmarkMoveHistory.peekUndo(), undoRecord);
  await undoFailure.action('undo');
  undoFailure.failSave = 1;
  await undoFailure.action('redo');
  assert.strictEqual(undoFailure.bookmarkMoveHistory.peekRedo(), undoRecord);
  assert.strictEqual([...undoFailure.nodes.values()].filter((node) => node.url === 'https://one.example/').length, 0);
  await undoFailure.action('redo');

  const unrelated = createRuntime();
  await unrelated.toShortcuts();
  unrelated.newtabShortcuts.push(store.createShortcutRecord({ id: 'later', url: 'https://later.example/' }));
  await unrelated.action('undo');
  assert.strictEqual(unrelated.newtabShortcuts.at(-1).id, 'later', 'undo preserves unrelated newer shortcuts');
  await unrelated.toShortcuts(unrelated.link().id);
  assert.strictEqual(unrelated.bookmarkMoveHistory.canRedo(), false);

  const reordered = createRuntime();
  const beforeReorder = json(reordered.newtabShortcuts);
  reordered.newtabShortcuts.reverse();
  await reordered.moveShortcutToBookmarks({
    shortcutId: 'one', tile: {}, originalShortcuts: beforeReorder, hasReordered: true
  }, { kind: 'insertion', folderId: '1', index: 0 });
  await reordered.action('undo');
  assert.deepStrictEqual(json(reordered.newtabShortcuts), beforeReorder,
    'undo restores the shortcut position from before the entire drag gesture');

  const boundedHistory = historyApi.createBookmarkMoveHistory({ maxEntries: 2 });
  for (let index = 0; index < 8; index += 1) {
    boundedHistory.push(historyApi.createMoveRecord({
      bookmarkId: `old-${index}`, from: { parentId: '1', index: 0 }, to: { parentId: '2', index: 0 }
    }));
    boundedHistory.remapBookmarkId(`old-${index}`, `restored-${index}`);
    boundedHistory.remapBookmarkId(`old-${index}`, `restored-again-${index}`);
  }
  assert.strictEqual(boundedHistory.resolveBookmarkId('old-7'), 'restored-again-7');
  assert.strictEqual(boundedHistory.resolveBookmarkId('old-6'), 'restored-again-6');
  assert.strictEqual(boundedHistory.resolveBookmarkId('old-5'), 'old-5', 'trimmed history releases bookmark id mappings');
  boundedHistory.clear();
  assert.strictEqual(boundedHistory.resolveBookmarkId('old-7'), 'old-7');

  const conflict = createRuntime();
  await conflict.toBookmarks('one');
  conflict.MAX_NEWTAB_SHORTCUTS = 1;
  const conflictRecord = conflict.bookmarkMoveHistory.peekUndo();
  await conflict.action('undo');
  assert.strictEqual(conflict.bookmarkMoveHistory.peekUndo(), conflictRecord);
  assert.strictEqual(conflict.newtabShortcuts.length, 1);
  conflict.MAX_NEWTAB_SHORTCUTS = 10;
  conflict.newtabShortcuts.push(store.createShortcutRecord({ id: 'replacement', url: 'https://one.example/' }));
  await conflict.action('undo');
  assert.strictEqual(conflict.newtabShortcuts.at(-1).id, 'replacement');
  assert.strictEqual(conflict.bookmarkMoveHistory.peekUndo(), conflictRecord);

  const sorting = createRuntime();
  await sorting.toShortcuts('folder');
  const sortedOriginal = json(sorting.newtabShortcuts);
  const sortingIds = sortedOriginal.map((item) => item.id);
  const sortedOrder = [sortingIds[1], sortingIds[2], sortingIds[0]];
  const savedIcons = json(sorting.newtabShortcutIcons);
  const savedFolder = json(sorting.nodes.get('folder'));
  await sorting.reorder(sortedOrder);
  assert.strictEqual(sorting.bookmarkMoveHistory.peekUndo().kind, 'shortcut-reorder');
  const sortToasts = sorting.toasts.slice();
  for (let cycle = 0; cycle < 3; cycle += 1) {
    await sorting.action('undo');
    assert.deepStrictEqual(json(sorting.newtabShortcuts), sortedOriginal);
    await sorting.action('redo');
    assert.deepStrictEqual(sorting.newtabShortcuts.map((item) => item.id), sortedOrder);
    assert.deepStrictEqual(json(sorting.newtabShortcutIcons), savedIcons);
    assert.deepStrictEqual(json(sorting.nodes.get('folder')), savedFolder);
    assert.deepStrictEqual(sorting.toasts, sortToasts, 'shortcut sorting, undo and redo remain silent');
  }
  await sorting.reorder(sortingIds);
  await sorting.action('undo');
  assert.deepStrictEqual(sorting.newtabShortcuts.map((item) => item.id), sortedOrder);
  await sorting.action('undo');
  assert.deepStrictEqual(sorting.newtabShortcuts.map((item) => item.id), sortingIds);

  const mixedSorting = createRuntime();
  await mixedSorting.reorder(['two', 'one']);
  await mixedSorting.toBookmarks('one', '2', 0);
  await mixedSorting.removeShortcutById('two');
  await mixedSorting.action('undo');
  assert.deepStrictEqual(mixedSorting.newtabShortcuts.map((item) => item.id), ['two']);
  await mixedSorting.action('undo');
  assert.deepStrictEqual(mixedSorting.newtabShortcuts.map((item) => item.id), ['two', 'one']);
  await mixedSorting.action('undo');
  assert.deepStrictEqual(mixedSorting.newtabShortcuts.map((item) => item.id), ['one', 'two']);
  await mixedSorting.action('redo');
  await mixedSorting.action('redo');
  await mixedSorting.action('redo');
  assert.deepStrictEqual(mixedSorting.newtabShortcuts, []);
  assert.strictEqual(mixedSorting.nodes.get('2').children[0].url, 'https://one.example/');

  const failedSorting = createRuntime();
  const beforeSort = json(failedSorting.newtabShortcuts);
  failedSorting.failSave = 1;
  await failedSorting.reorder(['two', 'one']);
  assert.deepStrictEqual(json(failedSorting.newtabShortcuts), beforeSort);
  assert.deepStrictEqual(failedSorting.domOrder, ['one', 'two'], 'failed saves restore manually moved DOM nodes');
  assert.strictEqual(failedSorting.bookmarkMoveHistory.canUndo(), false);
  await failedSorting.reorder(['two', 'one']);
  const sortRecord = failedSorting.bookmarkMoveHistory.peekUndo();
  failedSorting.failSave = 1;
  await failedSorting.action('undo');
  assert.strictEqual(failedSorting.bookmarkMoveHistory.peekUndo(), sortRecord);
  assert.deepStrictEqual(failedSorting.newtabShortcuts.map((item) => item.id), ['two', 'one']);
  await failedSorting.action('undo');
  const saveCount = failedSorting.calls.length;
  await failedSorting.reorder(['one', 'two']);
  assert.strictEqual(failedSorting.calls.length, saveCount, 'dragging back to the starting order must not save or add history');
  assert.strictEqual(failedSorting.bookmarkMoveHistory.peekRedo(), sortRecord);
  await failedSorting.reorder(['two', 'one']);
  assert.strictEqual(failedSorting.bookmarkMoveHistory.canRedo(), false);

  const newerSorting = createRuntime();
  await newerSorting.reorder(['two', 'one']);
  newerSorting.newtabShortcuts[1] = { ...newerSorting.newtabShortcuts[1], title: 'Renamed after sorting' };
  newerSorting.newtabShortcutIcons.one = 'data:image/png;base64,new-icon';
  newerSorting.newtabShortcuts.splice(1, 0, store.createShortcutRecord({ id: 'later-sort', url: 'https://later-sort.example/' }));
  await newerSorting.action('undo');
  assert.deepStrictEqual(newerSorting.newtabShortcuts.map((item) => item.id), ['one', 'later-sort', 'two']);
  assert.strictEqual(newerSorting.newtabShortcuts[0].title, 'Renamed after sorting');
  assert.strictEqual(newerSorting.newtabShortcutIcons.one, 'data:image/png;base64,new-icon');
  await newerSorting.action('redo');
  assert.deepStrictEqual(newerSorting.newtabShortcuts.map((item) => item.id), ['two', 'later-sort', 'one']);

  const hiddenSorting = createRuntime();
  await hiddenSorting.toShortcuts('folder');
  const hiddenId = hiddenSorting.newtabShortcuts[1].id;
  hiddenSorting.hiddenShortcutIds.add(hiddenId);
  await hiddenSorting.reorder(['two', 'one', hiddenId]);
  await hiddenSorting.action('undo');
  assert.deepStrictEqual(hiddenSorting.newtabShortcuts.map((item) => item.id), ['one', hiddenId, 'two']);
  hiddenSorting.failSave = 1;
  await hiddenSorting.reorder(['two', 'one', hiddenId]);
  assert.deepStrictEqual(hiddenSorting.domOrder, ['one', 'two']);
  assert.deepStrictEqual(hiddenSorting.tileMoves.slice(-2), [{ id: 'one', index: 0 }, { id: 'two', index: 1 }],
    'hidden folders must not consume visible DOM sorting indexes');

  const sortConflict = createRuntime();
  await sortConflict.reorder(['two', 'one']);
  const conflictSortRecord = sortConflict.bookmarkMoveHistory.peekUndo();
  sortConflict.newtabShortcuts = sortConflict.newtabShortcuts.filter((item) => item.id !== 'one');
  await sortConflict.action('undo');
  assert.deepStrictEqual(sortConflict.newtabShortcuts.map((item) => item.id), ['two']);
  assert.strictEqual(sortConflict.bookmarkMoveHistory.peekUndo(), conflictSortRecord,
    'sorting history must not recreate externally removed shortcuts');

  console.log('Shortcut reorder and bookmark transfer history passed: repeated undo/redo, mixed deletion and moves, icons, folders, hidden entries, recreated ids, rollback and conflicts.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
