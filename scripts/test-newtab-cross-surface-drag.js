const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { readPageSource } = require('./helpers/page-source');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');

const repoRoot = path.resolve(__dirname, '..');
const newtabJs = readNewtabRuntimeSource();
const newtabHtml = readPageSource('newtab.html');
const {
  getInsertionGapNeighbors,
  getRowInsertionSlot,
  isBookmarkFolderDropTarget,
  planBookmarkToShortcut,
  setInsertionGap
} = require(path.join(repoRoot, 'src', 'newtab', 'cross-surface-drag.js'));

function getFunctionSource(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `${name} function should exist`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }
  assert.fail(`${name} function body should end`);
  return '';
}

function assertOrder(source, first, second, message) {
  const firstIndex = source.indexOf(first);
  const secondIndex = source.indexOf(second);
  assert.ok(firstIndex >= 0, `${message}: missing ${first}`);
  assert.ok(secondIndex >= 0, `${message}: missing ${second}`);
  assert.ok(firstIndex < secondIndex, message);
}

function rect(left, top, width = 60, height = 60) {
  return {
    rect: {
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height,
      centerX: left + (width / 2),
      centerY: top + (height / 2)
    }
  };
}

{
  const folders = [
    { id: 'design-entry', type: 'folder', folderId: '42' },
    { id: 'archive-entry', type: 'folder', folderId: '43' }
  ];
  const duplicatePlan = planBookmarkToShortcut({
    shortcuts: folders, record: { id: 'duplicate', type: 'folder', folderId: '42' },
    index: 2, maxShortcuts: 2
  });
  assert.deepStrictEqual(duplicatePlan.shortcuts.map((item) => item.id), ['archive-entry', 'design-entry']);
  assert.strictEqual(planBookmarkToShortcut({
    shortcuts: folders, record: { type: 'folder', folderId: '44' }, index: 0, maxShortcuts: 2
  }), null, 'new folders must not evict entries when the dock is full');
}

// A folder shortcut can return to its own bookmark card/row without moving the
// real folder into itself. Dropping inside that folder or a descendant remains
// invalid, and an ordinary bookmark drag cannot use the alias return path.
{
  const nodeMap = new Map([
    ['1', { id: '1', parentId: '0' }],
    ['42', { id: '42', parentId: '1' }],
    ['43', { id: '43', parentId: '42' }],
    ['44', { id: '44', parentId: '1' }]
  ]);
  const shortcut = { id: 'folder-entry', type: 'folder', folderId: '42' };
  const factory = new Function('nodeMap', 'shortcut', 'NEWTAB_CROSS_SURFACE_DRAG', 'NEWTAB_BOOKMARK_MOVE_HISTORY', `
    const bookmarksRuntime = { getNodeMap: () => nodeMap };
    const getShortcutById = (id) => id === shortcut.id ? shortcut : null;
    const getShortcutFolderId = (item) => item.folderId;
    ${getFunctionSource(newtabJs, 'isValidExternalBookmarkDropTarget')}
    ${getFunctionSource(newtabJs, 'resolveExternalBookmarkDropTarget')}
    return { resolveExternalBookmarkDropTarget, isValidExternalBookmarkDropTarget };
  `);
  const { resolveExternalBookmarkDropTarget: resolve, isValidExternalBookmarkDropTarget: valid } = factory(
    nodeMap, shortcut,
    require(path.join(repoRoot, 'src', 'newtab', 'cross-surface-drag.js')),
    require(path.join(repoRoot, 'src', 'newtab', 'bookmark-move-history.js'))
  );
  const state = { shortcutId: shortcut.id, bookmarkId: shortcut.folderId };
  const element = {};
  const returned = resolve(state, { kind: 'card', folderId: '42', element });
  assert.deepStrictEqual(returned, { kind: 'return', folderId: '1', bookmarkId: '42', element });
  assert.strictEqual(valid(state, returned), true, 'the original bookmark accepts the shortcut alias');
  assert.strictEqual(resolve(state, { kind: 'cascade', folderId: '42', element }).kind, 'return');
  ['breadcrumb', 'shortcut-folder', 'insertion'].forEach((kind) => {
    assert.strictEqual(resolve(state, { kind, folderId: '42' }).kind, 'blocked',
      'dropping inside the source folder must remain blocked');
  });
  assert.strictEqual(resolve(state, { kind: 'card', folderId: '43' }).kind, 'blocked',
    'dropping into a descendant remains blocked');
  assert.strictEqual(resolve({ bookmarkId: '42' }, { kind: 'card', folderId: '42' }).kind, 'blocked',
    'ordinary bookmark drags cannot return a shortcut alias');
  assert.strictEqual(resolve(state, { kind: 'card', folderId: '44' }).folderId, '44',
    'other folders remain actual destinations');
  nodeMap.get('42').parentId = '44';
  assert.strictEqual(valid(state, returned), false, 'a stale return target cannot move a folder back after an external move');
  nodeMap.delete('42');
  assert.strictEqual(resolve(state, { kind: 'card', folderId: '42' }).kind, 'blocked',
    'a deleted source folder cannot leave a valid return target');
}

// Escape must restore both persisted order and DOM nodes moved outside React.
{
  const originalShortcuts = [{ id: 'one' }, { id: 'two' }];
  const domOrder = ['two', 'one'];
  const tiles = new Map(originalShortcuts.map((item) => [item.id, { id: item.id, removeAttribute() {} }]));
  const state = { isDragging: true, hasReordered: true, originalShortcuts, tile: tiles.get('one'), dropTarget: null };
  const finish = new Function('initialState', 'tiles', 'domOrder', 'NEWTAB_CROSS_SURFACE_DRAG', `
    let shortcutDragState = initialState;
    let newtabShortcuts = initialState.originalShortcuts.slice().reverse();
    const document = { body: { removeAttribute() {} } };
    const window = { setTimeout() {} };
    const shortcutGrid = null, bookmarkGrid = null;
    const detachShortcutDragDocumentListeners = () => {};
    const flushShortcutDragMove = () => {};
    const clearBookmarkDragPageSwitch = () => {};
    const clearBookmarkDragFolderSwitch = () => {};
    const clearDragDropTarget = () => {};
    const closeBookmarkCascadeMenu = () => {};
    const settleShortcutDragTile = () => {};
    const resetShortcutDockHover = () => {};
    const getShortcutTileById = (id) => tiles.get(id);
    const moveShortcutTileElement = (tile, index) => {
      domOrder.splice(domOrder.indexOf(tile.id), 1);
      domOrder.splice(index, 0, tile.id);
    };
    const renderShortcuts = () => {};
    const suppressCanceledDragClick = () => {};
    ${getFunctionSource(newtabJs, 'getShortcutGroupHeader')}
    ${getFunctionSource(newtabJs, 'restoreShortcutDragOrder')}
    ${getFunctionSource(newtabJs, 'finishShortcutDrag')}
    finishShortcutDrag(null, { cancel: true });
    return { dataOrder: newtabShortcuts.map((item) => item.id), domOrder, activeState: shortcutDragState };
  `);
  const result = finish(state, tiles, domOrder, require('../src/newtab/cross-surface-drag'));
  assert.deepStrictEqual(result.dataOrder, ['one', 'two']);
  assert.deepStrictEqual(result.domOrder, ['one', 'two']);
  assert.strictEqual(result.activeState, null);
}

// Escape cancels before mouseup. Suppression must last until that release's
// click, even when the user keeps holding the mouse, then allow a fresh press.
{
  const listeners = new Map();
  const timers = [];
  const document = {
    addEventListener(type, handler) {
      if (!listeners.has(type)) { listeners.set(type, new Set()); }
      listeners.get(type).add(handler);
    },
    removeEventListener(type, handler) { listeners.get(type).delete(handler); }
  };
  const suppress = new Function('document', 'window', `
    ${getFunctionSource(newtabJs, 'suppressCanceledDragClick')}
    return suppressCanceledDragClick;
  `)(document, { setTimeout(callback) { timers.push(callback); } });
  const element = {};
  const dispatch = (type, pointerId) => {
    [...listeners.get(type)].forEach((handler) => handler({ pointerId }));
  };
  suppress(element, '_xShortcutSuppressClick', 7);
  assert.strictEqual(element._xShortcutSuppressClick, true);
  assert.strictEqual(timers.length, 0, 'holding the mouse cannot expire suppression');
  dispatch('pointerup', 8);
  assert.strictEqual(timers.length, 0, 'another pointer cannot end the gesture');
  dispatch('pointerup', 7);
  assert.strictEqual(element._xShortcutSuppressClick, true, 'the ensuing click stays suppressed');
  timers.shift()();
  assert.strictEqual(element._xShortcutSuppressClick, false);
  assert.ok([...listeners.values()].every((handlers) => handlers.size === 0));
  suppress(element, '_xBookmarkSuppressClick', 7);
  suppress(element, '_xBookmarkSuppressClick', 7);
  assert.strictEqual(listeners.get('pointerdown').size, 1, 'repeat cancellation replaces old listeners');
  dispatch('pointerdown', 9);
  assert.strictEqual(element._xBookmarkSuppressClick, false, 'a new intentional gesture remains usable');
  assert.ok([...listeners.values()].every((handlers) => handlers.size === 0));
}

// Holding a shortcut at the top-bar edge keeps scrolling without pointer
// movement; releasing cancels even the frame queued by that final scroll.
{
  const frames = new Map();
  let nextFrame = 0;
  let scrollCount = 0;
  let overCascade = false;
  const state = { isDragging: true, moveFrameId: 0, pendingPointerX: 900, pendingPointerY: 35 };
  const factory = new Function('state', 'window', 'bookmarkTopbarRuntime', 'isBookmarkCascadeSurfaceAtPoint', `
    const shortcutDragState = state;
    const document = { body: { removeAttribute() {} } };
    const isBookmarkTopbarMode = () => true;
    const getExternalBookmarkSurfacePoint = () => ({ x: 900, y: 30 });
    const setShortcutDragTileTransform = () => {};
    const updateShortcutDragBookmarkTarget = () => true;
    const isPointOverShortcutDropSurface = () => false;
    const autoScrollShortcutArea = () => false;
    ${getFunctionSource(newtabJs, 'cancelShortcutDragMoveFrame')}
    ${getFunctionSource(newtabJs, 'applyShortcutDragMove')}
    ${getFunctionSource(newtabJs, 'scheduleShortcutDragMove')}
    ${getFunctionSource(newtabJs, 'flushShortcutDragMove')}
    return { scheduleShortcutDragMove, flushShortcutDragMove };
  `);
  const scheduler = factory(state, {
    requestAnimationFrame(callback) { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame(id) { frames.delete(id); }
  }, {
    autoScroll(x, y) { assert.deepStrictEqual([x, y], [900, 30]); scrollCount += 1; return 18; }
  }, () => overCascade);
  const runFrame = () => {
    const [id, callback] = frames.entries().next().value;
    frames.delete(id);
    callback();
  };
  scheduler.scheduleShortcutDragMove(state, 900, 35);
  runFrame();
  runFrame();
  assert.strictEqual(scrollCount, 2, 'edge scrolling continues while the pointer is held still');
  assert.strictEqual(frames.size, 1);
  scheduler.flushShortcutDragMove(state);
  assert.strictEqual(frames.size, 0, 'release must stop edge scrolling');
  overCascade = true;
  scheduler.scheduleShortcutDragMove(state, 900, 35);
  runFrame();
  assert.strictEqual(scrollCount, 3, 'hovering a cascade must not scroll the bar behind it');
  assert.strictEqual(frames.size, 0);
}

// Two rows: three tiles on top, two below.
const tiles = [
  rect(0, 0), rect(70, 0), rect(140, 0),
  rect(0, 80), rect(70, 80)
];

assert.deepStrictEqual(
  getRowInsertionSlot([], 10, 10),
  { index: 0, anchorIndex: -1, markerPosition: 'before' },
  'an empty grid should insert at the first slot'
);
assert.deepStrictEqual(
  getRowInsertionSlot(tiles, 5, 30),
  { index: 0, anchorIndex: 0, markerPosition: 'before' },
  'the left half of the first tile should insert before it'
);
assert.deepStrictEqual(
  getRowInsertionSlot(tiles, 110, 30),
  { index: 2, anchorIndex: 2, markerPosition: 'before' },
  'a point between row tiles should insert before the next tile'
);
assert.deepStrictEqual(
  getRowInsertionSlot(tiles, 400, 30),
  { index: 3, anchorIndex: 2, markerPosition: 'after' },
  'the end of a wrapped row should insert after its last tile, not before the next row'
);
assert.deepStrictEqual(
  getRowInsertionSlot(tiles, 400, 500),
  { index: 5, anchorIndex: 4, markerPosition: 'after' },
  'points below the grid should snap to the nearest (last) row'
);
assert.deepStrictEqual(
  getRowInsertionSlot(tiles, 50, 70),
  { index: 1, anchorIndex: 1, markerPosition: 'before' },
  'row gaps should resolve to the nearest row without a dead zone'
);

const nodeMap = new Map([
  ['0', { id: '0' }],
  ['1', { id: '1', parentId: '0' }],
  ['work', { id: 'work', parentId: '1' }],
  ['link', { id: 'link', parentId: '1', url: 'https://example.com/' }]
]);
assert.strictEqual(isBookmarkFolderDropTarget('1', nodeMap), true, 'the bookmarks bar accepts drops');
assert.strictEqual(isBookmarkFolderDropTarget('work', nodeMap), true, 'nested folders accept drops');
assert.strictEqual(isBookmarkFolderDropTarget('0', nodeMap), false, 'the tree root never accepts drops');
assert.strictEqual(isBookmarkFolderDropTarget('link', nodeMap), false, 'URL bookmarks are not folders');
assert.strictEqual(isBookmarkFolderDropTarget('missing', nodeMap), false, 'unknown folders are rejected');
assert.strictEqual(isBookmarkFolderDropTarget('', nodeMap), false, 'empty folder ids are rejected');

const shortcuts = ['a', 'b', 'c', 'd'].map((id) => ({ id, url: `https://${id}.test/` }));
const record = { id: 'new', url: 'https://new.test/' };
assert.deepStrictEqual(
  planBookmarkToShortcut({ shortcuts, record, index: 1, maxShortcuts: 60 }).shortcuts.map((item) => item.id),
  ['a', 'new', 'b', 'c', 'd'],
  'a new bookmark URL should be inserted at the drop index'
);
assert.strictEqual(
  planBookmarkToShortcut({ shortcuts, record, index: 1, maxShortcuts: 60 }).shortcutId,
  'new',
  'the plan should report the inserted shortcut id for sync-limit warnings'
);
assert.strictEqual(
  planBookmarkToShortcut({ shortcuts, record, index: 1, maxShortcuts: 4 }),
  null,
  'a full shortcut list should reject new URLs'
);
assert.deepStrictEqual(
  planBookmarkToShortcut({
    shortcuts,
    record: { id: 'dup', url: 'https://a.test/' },
    index: 3,
    maxShortcuts: 4
  }).shortcuts.map((item) => item.id),
  ['b', 'c', 'a', 'd'],
  'an existing URL should move its shortcut forward instead of duplicating it, even when full'
);
assert.deepStrictEqual(
  planBookmarkToShortcut({
    shortcuts,
    record: { id: 'dup', url: 'https://d.test/' },
    index: 0,
    maxShortcuts: 60
  }).shortcuts.map((item) => item.id),
  ['d', 'a', 'b', 'c'],
  'an existing URL should move its shortcut backward to the drop index'
);
assert.strictEqual(
  planBookmarkToShortcut({ shortcuts, record: null, index: 0, maxShortcuts: 60 }),
  null,
  'bookmarks without a shortcut-compatible URL should be rejected'
);

// The shared insertion-line primitive renders both grid surfaces and keeps
// cascade rows on their own attribute.
{
  function createFakeElement() {
    const attributes = new Map();
    const styles = new Map();
    return {
      attributes,
      styles,
      getAttribute: (name) => (attributes.has(name) ? attributes.get(name) : null),
      setAttribute: (name, value) => attributes.set(name, String(value)),
      removeAttribute: (name) => attributes.delete(name),
      style: {
        setProperty: (name, value) => styles.set(name, value),
        removeProperty: (name) => styles.delete(name)
      }
    };
  }
  const factory = new Function(
    'bookmarkCascadeRuntime',
    `${getFunctionSource(newtabJs, 'isInsertLineDropTarget')}
    // Neighbour leaning reads live layout; it is covered by the gap tests below.
    function syncInsertionGap() {}
    ${getFunctionSource(newtabJs, 'clearDropTargetMarker')}
    ${getFunctionSource(newtabJs, 'clearDragDropTarget')}
    ${getFunctionSource(newtabJs, 'setDragDropTarget')}
    return { clearDragDropTarget, setDragDropTarget };`
  );
  const { clearDragDropTarget, setDragDropTarget } = factory(null);
  const shortcutGrid = createFakeElement();
  const cascadeRow = createFakeElement();
  const state = { dropTarget: null };
  setDragDropTarget(state, {
    kind: 'insertion',
    surface: 'shortcuts',
    index: 2,
    markerElement: shortcutGrid,
    markerPosition: 'before',
    markerOffsetPx: 132,
    markerTopPx: 18,
    markerHeightPx: 48
  });
  assert.strictEqual(shortcutGrid.getAttribute('data-insert-line-position'), 'before');
  assert.strictEqual(shortcutGrid.styles.get('--x-nt-insert-line-left'), '132px');
  assert.strictEqual(shortcutGrid.styles.get('--x-nt-insert-line-height'), '48px');
  assert.strictEqual(shortcutGrid.getAttribute('data-insert-line-motion'), 'a');
  assert.strictEqual(
    shortcutGrid.getAttribute('data-bookmark-insert-position'),
    null,
    'grid surfaces should not use the cascade row attribute'
  );
  setDragDropTarget(state, {
    kind: 'insertion',
    surface: 'shortcuts',
    index: 3,
    markerElement: shortcutGrid,
    markerPosition: 'before',
    markerOffsetPx: 196,
    markerTopPx: 18,
    markerHeightPx: 48
  });
  assert.strictEqual(
    shortcutGrid.getAttribute('data-insert-line-motion'),
    'b',
    'moving to a new boundary should restart the line motion'
  );
  setDragDropTarget(state, {
    kind: 'insertion',
    surface: 'cascade',
    markerElement: cascadeRow,
    markerPosition: 'after'
  });
  assert.strictEqual(cascadeRow.getAttribute('data-bookmark-insert-position'), 'after');
  assert.strictEqual(shortcutGrid.attributes.size, 0, 'leaving a surface should clear its line attributes');
  assert.strictEqual(shortcutGrid.styles.size, 0, 'leaving a surface should clear its line variables');
  clearDragDropTarget(state);
  assert.strictEqual(cascadeRow.attributes.size, 0);
  assert.strictEqual(state.dropTarget, null);

  for (const surface of ['grid', 'shortcuts', 'cascade']) {
    for (const position of ['before', 'after']) {
      const folder = createFakeElement();
      const marker = createFakeElement();
      const folderTarget = {
        kind: surface === 'cascade' ? 'cascade' : surface === 'shortcuts' ? 'shortcut-folder' : 'card',
        surface,
        element: folder,
        folderId: 'design'
      };
      const insertionTarget = {
        kind: 'insertion',
        surface,
        element: folder,
        folderId: '1',
        index: 2,
        markerElement: marker,
        markerPosition: position,
        markerOffsetPx: 132,
        markerTopPx: 18,
        markerHeightPx: 48
      };
      const markerAttribute = surface === 'cascade'
        ? 'data-bookmark-insert-position' : 'data-insert-line-position';
      const scenario = `${surface}/${position}`;

      setDragDropTarget(state, folderTarget);
      assert.strictEqual(folder.getAttribute('data-bookmark-drop-target'), 'true');
      setDragDropTarget(state, insertionTarget);
      assert.strictEqual(
        folder.getAttribute('data-bookmark-drop-target'), null,
        `${scenario}: inserting beside the same folder must clear its contents-drop highlight`
      );
      assert.strictEqual(marker.getAttribute(markerAttribute), position);
      assert.strictEqual(state.dropTarget, insertionTarget);

      const motion = marker.getAttribute('data-insert-line-motion');
      setDragDropTarget(state, insertionTarget);
      assert.strictEqual(folder.getAttribute('data-bookmark-drop-target'), null);
      assert.strictEqual(marker.getAttribute('data-insert-line-motion'), motion,
        `${scenario}: staying at the same boundary must preserve its line motion`);

      setDragDropTarget(state, folderTarget);
      assert.strictEqual(folder.getAttribute('data-bookmark-drop-target'), 'true',
        `${scenario}: returning to the folder center must restore its contents-drop highlight`);
      assert.strictEqual(marker.attributes.size, 0);
      assert.strictEqual(marker.styles.size, 0);
      clearDragDropTarget(state);
      assert.strictEqual(folder.attributes.size, 0);
      assert.strictEqual(state.dropTarget, null);
    }
  }
}

// Wiring contracts.
assertOrder(
  newtabHtml,
  '<script src="bookmark-drag.js"></script>',
  '<script src="cross-surface-drag.js"></script>',
  'the cross-surface helpers should load with the other drag helpers'
);
assertOrder(
  newtabHtml,
  '<script src="cross-surface-drag.js"></script>',
  'data-page-entry="../newtab/newtab.js"',
  'the cross-surface helpers should load before the page runtime'
);
assert.ok(
  newtabJs.includes('NEWTAB_CROSS_SURFACE_DRAG.planBookmarkToShortcut('),
  'the page runtime should use the cross-surface helpers'
);

const applyShortcutDragMoveSource = getFunctionSource(newtabJs, 'applyShortcutDragMove');
assertOrder(
  applyShortcutDragMoveSource,
  'if (updateShortcutDragBookmarkTarget(state, pointerX, pointerY)) {',
  'getShortcutDragInsertionSlot(pointerX, pointerY)',
  'hovering the bookmarks surface should pause shortcut reordering'
);
assert.ok(
  getFunctionSource(newtabJs, 'getShortcutDragInsertionSlot')
    .includes('getShortcutInsertionSlotAt(pointerX, pointerY, shortcutDragState.tile)'),
  'shortcut reordering and bookmark drops should share one slot calculation'
);

const updateShortcutDragBookmarkTargetSource = getFunctionSource(
  newtabJs,
  'updateShortcutDragBookmarkTarget'
);
assertOrder(
  updateShortcutDragBookmarkTargetSource,
  'getExternalBookmarkSurfacePoint(pointerX, pointerY)',
  'getExternalBookmarkDropTarget(pointerX, pointerY, state)',
  'shortcut drags should inspect visible bookmarks and cascade surfaces'
);
const externalTargetSource = getFunctionSource(newtabJs, 'getExternalBookmarkDropTarget');
assert.ok(
  externalTargetSource.includes('hitZonePx: folderTarget ? undefined : bookmarkGrid.getBoundingClientRect().width') &&
    !externalTargetSource.includes('getBookmarkCrossLevelDropTarget'),
  'external drops keep folder edge insertion zones and skip bookmark-only validators'
);
assert.ok(
  getFunctionSource(newtabJs, 'getBookmarkDropSurfaceElement').includes('currentBookmarkCount <= 0') &&
    getFunctionSource(newtabJs, 'isEmptyBookmarkRootHidden').includes('bookmarkAllItems.length === 0') &&
    getFunctionSource(newtabJs, 'renderBookmarks').includes('isShortcutDragActive()'),
  'an empty bookmarks bar should stay droppable during shortcut drags without reviving disabled bookmarks'
);

const finishShortcutDragSource = getFunctionSource(newtabJs, 'finishShortcutDrag');
assert.ok(
  finishShortcutDragSource.includes('!(options && options.cancel)'),
  'canceled shortcut drags should never convert'
);
assertOrder(
  finishShortcutDragSource,
  'moveShortcutToBookmarks(state, bookmarkDropTarget);',
  'persistShortcutOrder(state)',
  'dropping a shortcut on bookmarks should branch before persisting the shortcut order'
);
const moveShortcutToBookmarksSource = getFunctionSource(newtabJs, 'moveShortcutToBookmarks');
const applyTransferSource = getFunctionSource(newtabJs, 'applyBookmarkShortcutTransfer');
assertOrder(
  applyTransferSource,
  'bookmarksRuntime.create({',
  'persistShortcutState(nextShortcuts, destinationShortcut)',
  'the bookmark should exist before the shortcut is removed'
);
assert.ok(
  moveShortcutToBookmarksSource.includes("target.kind === 'insertion'") &&
    moveShortcutToBookmarksSource.includes('settleShortcutDragTile(state.tile);') &&
    moveShortcutToBookmarksSource.includes('bookmarkMoveHistory.push('),
  'shortcut-to-bookmark moves should settle the tile back on failure and record successful transfers'
);

const processBookmarkDragMoveSource = getFunctionSource(newtabJs, 'processBookmarkDragMove');
assertOrder(
  processBookmarkDragMoveSource,
  'isPointOverShortcutDropSurface(pointerX, pointerY)',
  'getBookmarkCrossLevelDropTarget(state, pointerX, pointerY)',
  'the shortcut grid should be checked before bookmark targets'
);
assert.ok(
  getFunctionSource(newtabJs, 'isPointOverShortcutDropSurface')
    .includes('!isBookmarkCascadeSurfaceAtPoint(pointerX, pointerY)'),
  'an open cascade menu above the shortcuts should keep its own drop targets'
);
const shortcutDropTargetSource = getFunctionSource(newtabJs, 'getBookmarkDragShortcutDropTarget') +
  getFunctionSource(newtabJs, 'getShortcutInsertionDropTarget');
assert.ok(
  shortcutDropTargetSource.includes("type: 'folder', folderId: node.id") &&
    shortcutDropTargetSource.includes('maxShortcuts: MAX_NEWTAB_SHORTCUTS') &&
    shortcutDropTargetSource.includes("surface: 'shortcuts'"),
  'folder references should be supported while respecting the shortcut capacity'
);
const finishBookmarkDragSource = getFunctionSource(newtabJs, 'finishBookmarkDrag');
assertOrder(
  finishBookmarkDragSource,
  "dropTarget.surface === 'shortcuts'",
  'persistBookmarkCrossLevelMove(state, dropTarget);',
  'dropping a bookmark on shortcuts should branch before bookmark moves'
);
const moveBookmarkToShortcutsSource = getFunctionSource(newtabJs, 'moveBookmarkToShortcuts');
assertOrder(
  applyTransferSource,
  'persistShortcutState(nextShortcuts, destinationShortcut)',
  'bookmarksRuntime.remove(bookmarkId)',
  'the shortcut should be saved before the bookmark is deleted'
);
assert.ok(
  moveBookmarkToShortcutsSource.includes('if (!saved) return false;') &&
    moveBookmarkToShortcutsSource.includes('bookmarkMoveHistory.push(record)'),
  'failed transfers should keep the bookmark and only successful transfers enter undo history'
);

assert.ok(
  getFunctionSource(newtabJs, 'handleShortcutDockPointerMove')
    .includes('isShortcutDragActive() || isBookmarkDragActive()') &&
    getFunctionSource(newtabJs, 'shouldSuppressBookmarkHover').includes('isShortcutDragActive()'),
  'dock magnification and bookmark hover should pause during either drag'
);
assert.ok(
  getFunctionSource(newtabJs, 'startShortcutDrag')
    .includes("document.body.setAttribute('data-drag-source', 'shortcut');") &&
    finishShortcutDragSource.includes("document.body.removeAttribute('data-drag-source');"),
  'shortcut drags should use the shared page-wide drag source attribute'
);

assert.ok(
  /\n\s*\[data-insert-line-position\]::after\s*\{[^}]*position:\s*absolute;[^}]*left:\s*calc\(var\(--x-nt-insert-line-left/s
    .test(newtabHtml),
  'both grids should share one attribute-driven insertion line'
);
assert.ok(
  /\.x-nt-shortcuts-grid\s*\{[^}]*position:\s*relative;/s.test(newtabHtml),
  'the shortcut grid should position its insertion line'
);
assert.ok(
  /body\[data-drag-source="shortcut"\] \.x-nt-shortcuts-section\s*\{[^}]*z-index:\s*10001;[^}]*pointer-events:\s*none;/s
    .test(newtabHtml),
  'a dragged shortcut should paint above the bottom dock and bookmarks bar without blocking hit tests'
);

['en', 'ja', 'zh_CN', 'zh_TW'].forEach((locale) => {
  const messages = JSON.parse(fs.readFileSync(
    path.join(repoRoot, '_locales', locale, 'messages.json'),
    'utf8'
  ));
  [
    'newtab_shortcuts_moved_to_bookmarks',
    'newtab_shortcuts_move_to_bookmarks_failed',
    'bookmarks_moved_to_shortcuts'
  ].forEach((key) => {
    assert.ok(
      messages[key] && messages[key].message,
      `${locale} should translate ${key}`
    );
  });
});

{
  const [a, b, c, d] = ['a', 'b', 'c', 'd'];
  const items = [a, b, c, d];
  assert.deepStrictEqual(getInsertionGapNeighbors(items, b, 'before'), { before: a, after: b },
    'a gap before an item leans its previous sibling and the item apart');
  assert.deepStrictEqual(getInsertionGapNeighbors(items, b, 'after'), { before: b, after: c },
    'a gap after an item leans the item and its next sibling apart');
  assert.deepStrictEqual(getInsertionGapNeighbors(items, a, 'before'), { before: null, after: a },
    'a gap at the start only moves the first item');
  assert.deepStrictEqual(getInsertionGapNeighbors(items, d, 'after'), { before: d, after: null },
    'a gap at the end only moves the last item');
  const rowOf = { a: 0, b: 0, c: 1, d: 1 };
  assert.deepStrictEqual(
    getInsertionGapNeighbors(items, b, 'after', (item, anchor) => rowOf[item] === rowOf[anchor]),
    { before: b, after: null },
    'a neighbour that wrapped to the next row stays put'
  );
  assert.deepStrictEqual(getInsertionGapNeighbors(items, 'x', 'before'), { before: null, after: null },
    'an anchor outside the list leans nothing');
}

{
  const makeElement = () => {
    const attributes = new Map();
    return {
      getAttribute: (name) => attributes.has(name) ? attributes.get(name) : null,
      setAttribute: (name, value) => attributes.set(name, String(value)),
      removeAttribute: (name) => attributes.delete(name)
    };
  };
  const [first, second, third] = [makeElement(), makeElement(), makeElement()];
  const owner = {};
  setInsertionGap(owner, first, second);
  assert.strictEqual(first.getAttribute('data-drag-gap'), 'before');
  assert.strictEqual(second.getAttribute('data-drag-gap'), 'after');
  setInsertionGap(owner, second, third);
  assert.strictEqual(first.getAttribute('data-drag-gap'), 'rest',
    'a released neighbour keeps its transition while it slides back');
  assert.strictEqual(second.getAttribute('data-drag-gap'), 'before',
    'a neighbour that stays adjacent switches sides without resting');
  assert.strictEqual(third.getAttribute('data-drag-gap'), 'after');
  setInsertionGap(owner, null, null);
  assert.strictEqual(second.getAttribute('data-drag-gap'), 'rest');
  assert.strictEqual(third.getAttribute('data-drag-gap'), 'rest');
  [first, second, third].forEach((element) => clearTimeout(element._xInsertionGapRestTimer));
}

// Shortcut groups: undo restores each entry's group, a move that only
// changes the group is still a recorded move, and a stacked folder takes the
// group of the site it was stacked onto.
{
  const crossSurface = require(path.join(repoRoot, 'src', 'newtab', 'cross-surface-drag.js'));
  const history = require(path.join(repoRoot, 'src', 'newtab', 'bookmark-move-history.js'));
  const shortcuts = [
    { id: 'a', url: 'https://a.example/', groupId: 'g0' },
    { id: 'b', url: 'https://b.example/', groupId: 'work' },
    { id: 'c', url: 'https://c.example/', groupId: 'work' }
  ];
  const regrouped = crossSurface.planShortcutReorder({
    shortcuts, order: ['a', 'b', 'c'], groups: ['work', 'work', 'g0']
  });
  assert.deepStrictEqual(regrouped.map((item) => [item.id, item.groupId]), [['a', 'work'], ['b', 'work'], ['c', 'g0']]);
  assert.strictEqual(regrouped[1], shortcuts[1], 'entries already in their group keep their object');
  assert.deepStrictEqual(crossSurface.planShortcutReorder({ shortcuts, order: ['c', 'a', 'b'] }).map((item) => item.groupId),
    ['work', 'g0', 'work'], 'an order without groups leaves memberships alone');

  const dropped = crossSurface.planBookmarkToShortcut({
    shortcuts, record: { id: 'new', url: 'https://new.example/' }, index: 1, groupId: 'work', maxShortcuts: 10
  });
  assert.deepStrictEqual(dropped.shortcuts.map((item) => [item.id, item.groupId]),
    [['a', 'g0'], ['new', 'work'], ['b', 'work'], ['c', 'work']], 'a dropped bookmark joins the group it was dropped in');
  const movedIn = crossSurface.planBookmarkToShortcut({
    shortcuts, record: { url: 'https://c.example/' }, index: 0, groupId: 'g0', maxShortcuts: 10
  });
  assert.deepStrictEqual(movedIn.shortcuts[0], { ...shortcuts[2], groupId: 'g0' },
    'dropping an existing site moves it into the drop group');

  const groupOnly = history.createShortcutReorderRecord({
    fromOrder: ['a', 'b'], toOrder: ['a', 'b'], fromGroups: ['g0', 'work'], toGroups: ['work', 'work']
  });
  assert.ok(groupOnly, 'moving a site into the next group without changing the order is recorded');
  assert.deepStrictEqual(groupOnly.fromGroups, ['g0', 'work']);
  assert.deepStrictEqual(groupOnly.toGroups, ['work', 'work']);
  assert.strictEqual(history.createShortcutReorderRecord({
    fromOrder: ['a', 'b'], toOrder: ['a', 'b'], fromGroups: ['g0', 'work'], toGroups: ['g0', 'work']
  }), null, 'nothing moved, nothing recorded');
  assert.strictEqual(history.createShortcutReorderRecord({ fromOrder: ['a', 'b'], toOrder: ['b', 'a'] }).fromGroups, undefined);

  const stacked = crossSurface.planShortcutStack({
    shortcuts,
    sources: [{ snapshot: shortcuts[1], index: 1 }, { snapshot: shortcuts[0], index: 0 }],
    folder: { snapshot: { id: 'folder', type: 'folder' }, index: 0, groupId: 'work' }
  });
  assert.deepStrictEqual(stacked.map((item) => [item.id, item.groupId]), [['folder', 'work'], ['c', 'work']]);
  const stackRecord = history.createShortcutStackRecord({
    snapshot: { title: 'New folder', children: [{ title: 'A', url: 'https://a.example/' }, { title: 'B', url: 'https://b.example/' }] },
    sources: [{ snapshot: shortcuts[1], index: 1 }, { snapshot: shortcuts[0], index: 0 }],
    folderShortcut: { id: 'folder', index: 0, groupId: 'work' }
  });
  assert.strictEqual(stackRecord.folderShortcut.groupId, 'work');

  const groupDelete = history.createShortcutGroupDeleteRecord({
    group: { id: 'work', title: '工作' }, groupIndex: 1, targetGroupId: '', movedIds: [],
    removed: [{ snapshot: shortcuts[1], index: 1, iconDataUrl: 'data:image/png;base64,AA==' }]
  });
  assert.strictEqual(groupDelete.kind, 'shortcut-group-delete');
  assert.deepStrictEqual(groupDelete.removed[0].snapshot, shortcuts[1]);
  assert.strictEqual(history.createShortcutGroupDeleteRecord({ group: { title: 'No id' } }), null);
  assert.strictEqual(history.createShortcutGroupDeleteRecord({ group: { id: 'x' }, removed: [{}] }), null,
    'a removed site without a snapshot cannot be restored');
}

// An empty group's slot is an insertion point like a tile: the index counts
// only tiles, and the group comes from whatever the pointer is beside.
{
  const element = (attributes) => ({
    getAttribute: (name) => (Object.hasOwn(attributes, name) ? attributes[name] : null),
    hasAttribute: (name) => Object.hasOwn(attributes, name)
  });
  const a = element({ 'data-shortcut-id': 'a', 'data-shortcut-group-id': 'g0' });
  const b = element({ 'data-shortcut-id': 'b', 'data-shortcut-group-id': 'g0' });
  const empty = element({ 'data-shortcut-group-id': 'later' });
  const c = element({ 'data-shortcut-id': 'c', 'data-shortcut-group-id': 'last' });
  const box = (left, top) => ({ left, top, right: left + 64, bottom: top + 64, width: 64, height: 64,
    centerX: left + 32, centerY: top + 32 });
  const rects = new Map([[a, box(0, 0)], [b, box(70, 0)], [empty, box(0, 100)], [c, box(0, 200)]]);
  const grid = { querySelectorAll: () => [a, b, empty, c] };
  const slotAt = new Function('NEWTAB_CROSS_SURFACE_DRAG', 'shortcutGrid', 'rects', `
    const SHORTCUT_SLOT_SELECTOR = '';
    const getShortcutReorderTiles = () => [];
    const getShortcutTileLayoutRect = (tile) => rects.get(tile);
    ${getFunctionSource(newtabJs, 'getShortcutTileGroupId')}
    ${getFunctionSource(newtabJs, 'getShortcutInsertionSlotAt')}
    return getShortcutInsertionSlotAt;
  `)(require('../src/newtab/cross-surface-drag.js'), grid, rects);
  const afterB = slotAt(150, 30, null);
  assert.deepStrictEqual([afterB.index, afterB.markerPosition, afterB.groupId], [2, 'after', 'g0']);
  const intoEmpty = slotAt(10, 130, null);
  assert.deepStrictEqual([intoEmpty.index, intoEmpty.anchorTile === empty, intoEmpty.groupId], [2, true, 'later'],
    'the empty group takes the drop before the next group\'s first tile');
  const beforeC = slotAt(10, 230, a);
  assert.deepStrictEqual([beforeC.index, beforeC.groupId], [1, 'last'], 'the dragged tile is left out of the count');
}

console.log('New tab cross-surface drag tests passed.');
