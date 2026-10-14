const assert = require('assert');
const fs = require('fs');
const { JSDOM } = require('jsdom');
const bookmarkDrag = require('../src/newtab/bookmark-drag.js');
const crossSurfaceDrag = require('../src/newtab/cross-surface-drag.js');
const bookmarkMoveHistory = require('../src/newtab/bookmark-move-history.js');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');
const { extractFunction: extractFunctionFrom } = require('./helpers/extract-function');

const source = readNewtabRuntimeSource();
function extractFunction(name, text = source) {
  return extractFunctionFrom(text, name);
}

function rect(left, top, width, height) {
  return { left, top, width, height, right: left + width, bottom: top + height };
}
function setRect(element, bounds) {
  element.getBoundingClientRect = () => bounds;
}

function createScenario(mode, sourceType, options = {}) {
  const dom = new JSDOM('<body><section><div id="grid"></div></section></body>');
  const document = dom.window.document;
  const grid = document.querySelector('#grid');
  const surface = grid.parentElement;
  const isTop = mode === 'top';
  const gap = isTop ? 2 : 12;
  const top = isTop ? 4 : 100;
  const height = isTop ? 28 : 51;
  const width = isTop ? 100 : 188;
  const left = options.scrolled ? -52 : 100;
  const pageStart = options.pageStart || 0;
  const currentFolderId = options.nested ? 'nested' : '1';
  const shortcut = sourceType === 'folder'
    ? { id: 'shortcut', type: 'folder', folderId: 'source-folder', title: 'Source folder' }
    : { id: 'shortcut', title: 'Source website', url: 'https://source.example/' };
  const nodeMap = new Map([
    ['0', { id: '0' }],
    ['1', { id: '1', parentId: '0' }],
    ['nested', { id: 'nested', parentId: '1' }],
    ['source-folder', { id: 'source-folder', parentId: '1', index: 3 }],
    ['descendant', { id: 'descendant', parentId: 'source-folder' }]
  ]);
  const cards = (options.empty ? [] : ['first', 'second', 'third']).map((id, index) => {
    const folder = options.websites !== true;
    const node = { id, parentId: currentFolderId, index: pageStart + index, title: id,
      ...(folder ? {} : { url: `https://${id}.example/` }) };
    nodeMap.set(id, node);
    const card = document.createElement('button');
    card.className = `x-nt-bookmark-card${folder ? ' x-nt-bookmark-card--folder' : ''}`;
    card.setAttribute('data-bookmark-id', id);
    card.setAttribute('data-bookmark-draggable', 'true');
    card.setAttribute('data-bookmark-index', String(node.index));
    card._xBookmarkItem = node;
    setRect(card, rect(left + index * (width + gap), top, width, height));
    grid.appendChild(card);
    return card;
  });
  const gridBounds = rect(left, top, (width * 3) + (gap * 2), height);
  setRect(grid, gridBounds);
  setRect(surface, isTop ? rect(0, 0, 900, 36) : rect(80, 80, 700, 100));
  const viewport = document.createElement('div');
  setRect(viewport, rect(options.scrolled ? 4 : 100, 4, 700, 28));
  document.elementFromPoint = (x, y) => cards.find((card) => {
    const bounds = card.getBoundingClientRect();
    return x >= bounds.left && x < bounds.right && y >= bounds.top && y <= bounds.bottom;
  }) || grid;
  const mutations = [];
  let savedShortcuts = null;
  const factory = new Function('deps', `
    const { document, grid: bookmarkGrid, surface, viewport, mode, pageStart,
      currentFolderId: bookmarkCurrentFolderId, shortcut, nodeMap,
      bookmarkDrag: NEWTAB_BOOKMARK_DRAG, crossSurfaceDrag: NEWTAB_CROSS_SURFACE_DRAG,
      bookmarkMoveHistory: NEWTAB_BOOKMARK_MOVE_HISTORY } = deps;
    const window = { getComputedStyle: () => ({ columnGap: mode === 'top' ? '2px' : '12px' }) };
    const bookmarkTopbarRuntime = { viewport };
    let bookmarkCascadeRuntime = null;
    const isBookmarkTopbarMode = () => mode === 'top';
    const getBookmarkDropSurfaceElement = () => surface;
    const getBookmarkPageStartIndex = () => pageStart;
    const getShortcutById = () => shortcut;
    const getShortcutFolderId = (item) => item && item.type === 'folder' ? item.folderId : '';
    const newtabShortcuts = [shortcut];
    const newtabShortcutIcons = {};
    const bookmarkMoveHistory = NEWTAB_BOOKMARK_MOVE_HISTORY.createBookmarkMoveHistory();
    let bookmarkMoveHistoryBusy = false;
    let bookmarkPendingLayoutAnimation;
    const MAX_NEWTAB_SHORTCUTS = 60;
    const shortcutFolderRuntime = { bind() {}, flush: () => Promise.resolve() };
    const bookmarksRuntime = {
      getNodeMap: () => nodeMap,
      getNode: (id) => nodeMap.get(id),
      ensureReady: () => Promise.resolve(true),
      getFolderItems: (id) => [...nodeMap.values()].filter((node) => node.parentId === id),
      runControlledMutation: (run) => Promise.resolve().then(run),
      create: (details) => { deps.mutations.push({ kind: 'create', ...details }); return Promise.resolve({ id: 'created', ...details }); },
      move: (id, details) => { deps.mutations.push({ kind: 'move', id, ...details }); return Promise.resolve({ id, ...details }); }
    };
    const persistShortcuts = (items) => { deps.onSave(items); return Promise.resolve(true); };
    const queueBookmarkLayoutAnimation = () => {};
    const markBookmarkTreeDirty = () => {};
    const loadBookmarks = () => {};
    const refreshOpenBookmarkCascadeMenu = () => Promise.resolve();
    const refreshShortcutFolderReferences = () => Promise.resolve();
    const settleShortcutDragTile = () => {};
    const t = (_, fallback) => fallback;
    const showToast = () => {};
    ${['getBookmarkCardId', 'getBookmarkCardLayoutRect', 'getBookmarkReorderCards',
      'getExternalBookmarkSurfacePoint', 'getBookmarkElementDropTarget',
      'isBookmarkCascadeSurfaceAtPoint', 'isValidExternalBookmarkDropTarget',
      'resolveExternalBookmarkDropTarget', 'getExternalBookmarkDropTarget',
      'applyBookmarkShortcutTransfer', 'moveShortcutToBookmarks'].map((name) => extractFunction(name)).join('\n')}
    return { getExternalBookmarkDropTarget, moveShortcutToBookmarks,
      setCascadeRuntime(value) { bookmarkCascadeRuntime = value; } };
  `);
  const api = factory({ document, grid, surface, viewport, mode, pageStart, currentFolderId,
    shortcut, nodeMap, bookmarkDrag, crossSurfaceDrag, bookmarkMoveHistory, mutations,
    onSave(items) { savedShortcuts = items; } });
  const state = { shortcutId: shortcut.id, bookmarkId: shortcut.folderId || '', tile: {}, hasReordered: false };
  return { ...api, document, grid, cards, state, mutations, pageStart, currentFolderId, nodeMap,
    getSavedShortcuts: () => savedShortcuts };
}

function attachCascade(scene, depth, empty = false) {
  const text = fs.readFileSync('src/newtab/bookmark-cascade-menu.js', 'utf8');
  const menu = scene.document.createElement('div');
  menu.className = 'x-nt-bookmark-cascade-menu';
  scene.document.body.appendChild(menu);
  const levels = Array.from({ length: depth }, (_, index) => {
    const folderId = `cascade-${index}`;
    scene.nodeMap.set(folderId, { id: folderId, parentId: index ? `cascade-${index - 1}` : '1' });
    const levelElement = scene.document.createElement('div');
    menu.appendChild(levelElement);
    setRect(levelElement, rect(100 + (index * 250), 200, 230, 120));
    for (let rowIndex = 0; !empty && rowIndex < 3; rowIndex += 1) {
      const id = `${folderId}-row-${rowIndex}`;
      scene.nodeMap.set(id, { id, parentId: folderId, index: rowIndex });
      const row = scene.document.createElement('div');
      row.className = 'x-nt-bookmark-cascade-row';
      const button = scene.document.createElement('button');
      button.setAttribute('data-bookmark-index', String(rowIndex));
      button.setAttribute('data-type', 'folder');
      button.setAttribute('data-bookmark-drop-folder-id', id);
      row.appendChild(button);
      levelElement.appendChild(row);
      setRect(row, rect(108 + (index * 250), 208 + (rowIndex * 36), 214, 32));
    }
    return { folderId, levelElement };
  });
  const getTarget = new Function('bookmarkCascadeMenu', 'bookmarkCascadeLevels', `
    const BOOKMARK_CASCADE_FOLDER_DROP_MIN_RATIO = 0.38;
    const BOOKMARK_CASCADE_FOLDER_DROP_MAX_RATIO = 0.62;
    const getBookmarkCascadeLevelItems = (element) => Array.from(element.querySelectorAll('button'));
    const getBookmarkCascadeElementRect = (element) => element.getBoundingClientRect();
    ${extractFunction('isPointInsideRect', text)}
    ${extractFunction('getBookmarkCascadeDragDropTargetAtPoint', text)}
    return getBookmarkCascadeDragDropTargetAtPoint;
  `)(menu, levels);
  scene.setCascadeRuntime({ isOpen: () => true, updateDragPointer(point) {
    const target = getTarget({ x: point.clientX, y: point.clientY });
    return target ? { ...target, surface: 'cascade' } : null;
  } });
  return levels[depth - 1];
}

async function run() {
  let checked = 0;
  for (const mode of ['folder', 'list', 'top']) {
    for (const sourceType of ['website', 'folder']) {
      for (const options of [{}, { websites: true }, { nested: true },
        ...(mode === 'top' ? [{ scrolled: true }] : [{ pageStart: 8 }])]) {
        const scene = createScenario(mode, sourceType, options);
        const first = scene.cards[0].getBoundingClientRect();
        const second = scene.cards[1].getBoundingClientRect();
        const y = first.top + first.height / 2;
        const name = `${mode}/${sourceType}/${JSON.stringify(options)}`;
        for (const x of [first.right - 2, (first.right + second.left) / 2, second.left + 2]) {
          const target = scene.getExternalBookmarkDropTarget(x, y, scene.state);
          assert.ok(target, `${name}: the space between existing items must accept the shortcut`);
          assert.strictEqual(target.kind, 'insertion', `${name}: folder edges must not swallow the insertion position`);
          assert.strictEqual(target.folderId, scene.currentFolderId);
          assert.strictEqual(target.index, scene.pageStart + 1);
          checked += 1;
        }
        const gapTarget = scene.getExternalBookmarkDropTarget((first.right + second.left) / 2, y, scene.state);
        assert.strictEqual(await scene.moveShortcutToBookmarks(scene.state, gapTarget), true);
        assert.deepStrictEqual(scene.mutations[0], sourceType === 'folder'
          ? { kind: 'move', id: 'source-folder', parentId: scene.currentFolderId, index: scene.pageStart + 1 }
          : { kind: 'create', parentId: scene.currentFolderId, title: 'Source website',
            url: 'https://source.example/', index: scene.pageStart + 1 });
        assert.deepStrictEqual(scene.getSavedShortcuts(), []);
        checked += 1;
        if (!options.websites) {
          const center = scene.getExternalBookmarkDropTarget(first.left + first.width / 2, y, scene.state);
          assert.strictEqual(center.kind, 'card', `${name}: the center still means placing inside the folder`);
          assert.strictEqual(center.folderId, 'first');
          checked += 1;
        }
        if (mode === 'top') {
          assert.strictEqual(scene.getExternalBookmarkDropTarget(850, y, scene.state), null,
            'top-bar controls must remain outside the drop surface');
          const projected = scene.getExternalBookmarkDropTarget((first.right + second.left) / 2, 40, scene.state);
          assert.strictEqual(projected.kind, 'insertion', 'the approach area below the bar accepts the same gap');
          assert.strictEqual(projected.index, 1);
          checked += 2;
        }
        if (!options.scrolled) {
          const last = scene.cards[2].getBoundingClientRect();
          for (const [x, index] of [[first.left + 2, scene.pageStart], [last.right - 2, scene.pageStart + 3]]) {
            const target = scene.getExternalBookmarkDropTarget(x, y, scene.state);
            assert.strictEqual(target.kind, 'insertion', `${name}: first and last edges remain insertion targets`);
            assert.strictEqual(target.index, index);
            if (mode === 'top') {
              assert.ok(target.markerOffsetPx >= 1 &&
                target.markerOffsetPx <= scene.grid.getBoundingClientRect().width - 1,
              'top-bar endpoint insertion lines must stay inside the clipped scrolling grid');
            }
            checked += 1;
          }
        }
      }
      const empty = createScenario(mode, sourceType, { empty: true });
      const emptyTarget = empty.getExternalBookmarkDropTarget(150, mode === 'top' ? 18 : 125, empty.state);
      assert.strictEqual(emptyTarget.kind, 'insertion');
      assert.strictEqual(emptyTarget.index, 0);
      checked += 1;

      const alias = createScenario(mode, 'folder');
      const original = alias.cards[0];
      original.setAttribute('data-bookmark-id', 'source-folder');
      const originalBounds = original.getBoundingClientRect();
      const returnTarget = alias.getExternalBookmarkDropTarget(
        originalBounds.left + originalBounds.width / 2, originalBounds.top + originalBounds.height / 2, alias.state
      );
      assert.strictEqual(returnTarget.kind, 'return', 'dropping on the original folder only removes its shortcut');
      original.setAttribute('data-bookmark-id', 'descendant');
      const blocked = alias.getExternalBookmarkDropTarget(
        originalBounds.left + originalBounds.width / 2, originalBounds.top + originalBounds.height / 2, alias.state
      );
      assert.strictEqual(blocked.kind, 'blocked', 'a folder cannot be moved into its descendant');
      checked += 2;

      for (const depth of [1, 2]) {
        const scene = createScenario(mode, sourceType);
        const level = attachCascade(scene, depth);
        const rows = Array.from(level.levelElement.children);
        const first = rows[0].getBoundingClientRect();
        const second = rows[1].getBoundingClientRect();
        const x = first.left + first.width / 2;
        for (const y of [first.bottom - 2, (first.bottom + second.top) / 2, second.top + 2]) {
          const target = scene.getExternalBookmarkDropTarget(x, y, scene.state);
          assert.strictEqual(target.kind, 'insertion', `${mode}/${sourceType}: cascade row edges and gaps insert`);
          assert.strictEqual(target.folderId, level.folderId);
          assert.strictEqual(target.index, 1);
          checked += 1;
        }
        const center = scene.getExternalBookmarkDropTarget(x, first.top + first.height / 2, scene.state);
        assert.strictEqual(center.kind, 'cascade');
        assert.strictEqual(center.folderId, `${level.folderId}-row-0`);
        const gapTarget = scene.getExternalBookmarkDropTarget(x, (first.bottom + second.top) / 2, scene.state);
        assert.strictEqual(await scene.moveShortcutToBookmarks(scene.state, gapTarget), true);
        assert.strictEqual(scene.mutations[0].parentId, level.folderId);
        assert.strictEqual(scene.mutations[0].index, 1);
        checked += 2;
      }
      const emptyScene = createScenario(mode, sourceType);
      const emptyLevel = attachCascade(emptyScene, 2, true);
      const bounds = emptyLevel.levelElement.getBoundingClientRect();
      const emptyCascade = emptyScene.getExternalBookmarkDropTarget(bounds.left + 10, bounds.top + 10, emptyScene.state);
      assert.strictEqual(emptyCascade.kind, 'insertion');
      assert.strictEqual(emptyCascade.folderId, emptyLevel.folderId);
      assert.strictEqual(emptyCascade.index, 0);
      checked += 1;
    }
  }
  console.log(`shortcut-to-bookmark drop targets passed: ${checked} checks across folder, list, top and nested cascade views`);
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
