const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { readPageSource } = require('./helpers/page-source');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');

const repoRoot = path.resolve(__dirname, '..');
const newtabJs = readNewtabRuntimeSource();
const newtabHtml = readPageSource('newtab.html');
const bookmarksRuntimeJs = fs.readFileSync(
  path.join(repoRoot, 'src', 'newtab', 'bookmarks-runtime.js'),
  'utf8'
);
const bookmarkDragJs = fs.readFileSync(
  path.join(repoRoot, 'src', 'newtab', 'bookmark-drag.js'),
  'utf8'
);
const bookmarkFolderIconJs = fs.readFileSync(
  path.join(repoRoot, 'src', 'newtab', 'bookmark-folder-icon.js'),
  'utf8'
);
const cascadeJs = fs.readFileSync(path.join(repoRoot, 'src', 'newtab', 'bookmark-cascade-menu.js'), 'utf8');
const bookmarksViewJs = fs.readFileSync(path.join(repoRoot, 'react-src', 'newtab', 'bookmarks.tsx'), 'utf8');
const cascadeViewReact = fs.readFileSync(
  path.join(repoRoot, 'react-src', 'newtab', 'bookmark-cascade-view.tsx'),
  'utf8'
);
const {
  canMoveBookmarkToLocation,
  canMoveBookmarkToFolder,
  createBookmarkMoveHistory,
  createMoveRecord,
  getMoveApiDestinationIndex,
  isFolderInsideBookmark,
  normalizeMoveDestinationIndex
} = require(path.join(repoRoot, 'src', 'newtab', 'bookmark-move-history.js'));

const nodeMap = new Map([
  ['1', { id: '1', parentId: '0' }],
  ['design', { id: 'design', parentId: '1' }],
  ['research', { id: 'research', parentId: 'design' }],
  ['archive', { id: 'archive', parentId: '1' }],
  ['link', { id: 'link', parentId: 'design' }]
]);

assert.strictEqual(
  isFolderInsideBookmark(nodeMap, 'design', 'research'),
  true,
  'a nested folder should be recognized as a descendant of the dragged folder'
);
assert.strictEqual(
  canMoveBookmarkToFolder({
    bookmarkId: 'design',
    sourceParentId: '1',
    targetFolderId: 'research',
    nodeMap
  }),
  false,
  'a folder must not be moved into one of its descendants'
);
assert.strictEqual(
  canMoveBookmarkToFolder({
    bookmarkId: 'link',
    sourceParentId: 'design',
    targetFolderId: 'design',
    nodeMap
  }),
  false,
  'dropping on the current parent should remain a no-op'
);
assert.strictEqual(
  canMoveBookmarkToFolder({
    bookmarkId: 'link',
    sourceParentId: 'design',
    targetFolderId: 'archive',
    nodeMap
  }),
  true,
  'a bookmark should be movable to a different folder'
);
assert.strictEqual(
  canMoveBookmarkToFolder({
    bookmarkId: 'link',
    sourceParentId: 'research',
    targetFolderId: 'design',
    nodeMap
  }),
  true,
  'a nested bookmark should be movable into an ancestor folder'
);
assert.strictEqual(
  normalizeMoveDestinationIndex({
    sourceParentId: 'design',
    sourceIndex: 1,
    targetParentId: 'design',
    targetIndex: 4
  }),
  3,
  'same-parent insertion indexes should account for removing the source item first'
);
assert.strictEqual(
  getMoveApiDestinationIndex({
    sourceParentId: 'design',
    sourceIndex: 0,
    targetParentId: 'design',
    targetIndex: 2
  }),
  3,
  'Chrome should receive the original insertion boundary when moving forward within one parent'
);
assert.strictEqual(
  getMoveApiDestinationIndex({
    sourceParentId: 'design',
    sourceIndex: 1,
    targetParentId: 'design',
    targetIndex: 8
  }),
  9,
  'moving forward to the next page start should keep the bookmark at that page start after removal'
);
assert.strictEqual(
  getMoveApiDestinationIndex({
    sourceParentId: 'design',
    sourceIndex: 1,
    targetParentId: 'design',
    targetIndex: 9
  }),
  10,
  'moving forward to the first item right edge should keep the bookmark in the second page slot'
);
assert.strictEqual(
  getMoveApiDestinationIndex({
    sourceParentId: 'design',
    sourceIndex: 1,
    targetParentId: 'design',
    targetIndex: 15
  }),
  16,
  'moving forward to the last item left edge should keep the bookmark in the last page slot'
);
function moveWithinParent(items, sourceIndex, targetIndex) {
  const nextItems = items.slice();
  const movedItem = nextItems.splice(sourceIndex, 1)[0];
  const destinationIndex = sourceIndex < targetIndex
    ? targetIndex - 1
    : targetIndex;
  nextItems.splice(destinationIndex, 0, movedItem);
  return nextItems;
}
const crossPageItems = Array.from({ length: 24 }, (_value, index) => String(index));
assert.deepStrictEqual(
  moveWithinParent(crossPageItems, 20, 8).slice(8, 12),
  ['20', '8', '9', '10'],
  'dropping at the first item left edge should occupy the first page slot and push the old last item forward'
);
assert.deepStrictEqual(
  moveWithinParent(crossPageItems, 20, 9).slice(8, 12),
  ['8', '20', '9', '10'],
  'dropping at the first item right edge should occupy the second page slot and push the old last item forward'
);
assert.deepStrictEqual(
  moveWithinParent(crossPageItems, 20, 11).slice(8, 12),
  ['8', '9', '10', '20'],
  'dropping at the last item left edge should occupy the last page slot and push the old last item forward'
);
assert.deepStrictEqual(
  (() => {
    const items = ['1', '2', '3', '4'];
    const moved = items.splice(0, 1)[0];
    items.splice(normalizeMoveDestinationIndex({
      sourceParentId: 'design',
      sourceIndex: 0,
      targetParentId: 'design',
      targetIndex: 3
    }), 0, moved);
    return items;
  })(),
  ['2', '3', '1', '4'],
  'dragging 1 to the 3-4 boundary should leave it directly between 3 and 4'
);
assert.strictEqual(
  canMoveBookmarkToLocation({
    bookmarkId: 'link',
    sourceParentId: 'design',
    sourceIndex: 1,
    targetParentId: 'design',
    targetIndex: 0,
    nodeMap
  }),
  true,
  'same-folder reordering should be valid when the final index changes'
);
assert.strictEqual(
  canMoveBookmarkToLocation({
    bookmarkId: 'link',
    sourceParentId: 'design',
    sourceIndex: 1,
    targetParentId: 'design',
    targetIndex: 2,
    nodeMap
  }),
  false,
  'an insertion boundary that resolves to the current index should remain a no-op'
);

const history = createBookmarkMoveHistory({ maxEntries: 2 });
const firstMove = createMoveRecord({
  bookmarkId: 'link',
  title: 'Lumno',
  from: { parentId: 'design', index: 1 },
  to: { parentId: 'archive', index: 0 }
});
assert.strictEqual(history.push(firstMove), true);
assert.deepStrictEqual(history.peekUndo(), firstMove);
assert.strictEqual(history.peekRedo(), null);
assert.deepStrictEqual(history.commitUndo(), firstMove);
assert.deepStrictEqual(history.peekRedo(), firstMove);
assert.deepStrictEqual(history.commitRedo(), firstMove);
assert.deepStrictEqual(history.peekUndo(), firstMove);

assert.ok(
  newtabHtml.includes('<script src="bookmark-move-history.js"></script>'),
  'new tab should load bookmark move history before the main runtime'
);
assert.ok(
  newtabHtml.indexOf('<script src="bookmark-drag.js"></script>') <
    newtabHtml.indexOf('src="../shared/react-page-bootstrap.js"'),
  'new tab should load the bookmark drag runtime before the page bootstrap'
);
assert.ok(
  newtabHtml.includes('.x-nt-bookmarks-crumb[data-bookmark-drop-target="true"]'),
  'breadcrumb folders should have a restrained explicit drop-target state'
);
assert.ok(
  newtabHtml.includes('.x-nt-bookmark-card--folder[data-bookmark-drop-target="true"]'),
  'folder cards should have an explicit drop-target state'
);
assert.ok(
  newtabHtml.includes('.x-nt-bookmark-cascade-item--folder[data-bookmark-drop-target="true"]'),
  'cascade folders should have an explicit drop-target state'
);
assert.ok(
  newtabHtml.includes('.x-nt-bookmark-cascade-menu[data-drag-mode="true"] .x-nt-bookmark-cascade-level'),
  'cascade menu motion should be disabled while dragging'
);
assert.ok(
  newtabHtml.includes('[data-bookmark-insert-position="before"]') &&
    newtabHtml.includes('[data-bookmark-insert-position="after"]'),
  'bookmark cards and cascade rows should show explicit insertion lines'
);
assert.ok(
  /\n\s*\[data-insert-line-position\]::after\s*\{[^}]*width:\s*2px;[^}]*height:\s*var\(--x-nt-insert-line-height/s
    .test(newtabHtml) &&
    !/\.x-nt-bookmark-card\[data-bookmark-insert-position\]::after/s.test(newtabHtml),
  'the bookmark grid should draw one independent vertical insertion line at the measured boundary'
);
assert.ok(
  /\.x-nt-bookmark-card--folder\[data-bookmark-drop-target="true"\]\s*\{[^}]*border-color:[^}]*box-shadow:\s*none;/s
    .test(newtabHtml) &&
    newtabHtml.includes('_x_nt_insert_line_extend_a_2026_unique_') &&
    newtabHtml.includes('_x_nt_insert_line_extend_b_2026_unique_') &&
    /@keyframes _x_nt_insert_line_extend_a_2026_unique_\s*\{[^}]*transform:\s*scaleY\(0\);[\s\S]*?transform:\s*scaleY\(1\);/s
      .test(newtabHtml),
  'folder targets should keep a crisp edge while grid insertion lines extend into place'
);
assert.ok(
  /\.x-nt-bookmarks-topbar[\s\S]*?\.x-nt-bookmark-card--folder\[data-bookmark-drop-target="true"\]\s*\{[^}]*border-color:[^}]*background:\s*var\(--x-nt-bookmarks-topbar-folder-hover\);/s
    .test(newtabHtml),
  'top bookmark folders should keep a visible background while accepting a dragged bookmark'
);
const beginPointerTrackingSource = newtabJs.slice(
  newtabJs.indexOf('function beginBookmarkDragPointerTracking('),
  newtabJs.indexOf('function handleBookmarkDragPointerDown(')
);
const startBookmarkDragSource = newtabJs.slice(
  newtabJs.indexOf('function startBookmarkDrag('),
  newtabJs.indexOf('function clearBookmarkDragCardVisual(')
);
const finishBookmarkDragSource = newtabJs.slice(
  newtabJs.indexOf('function finishBookmarkDrag('),
  newtabJs.indexOf('function beginBookmarkDragPointerTracking(')
);
assert.ok(
  beginPointerTrackingSource &&
    !beginPointerTrackingSource.includes('setPointerCapture') &&
    startBookmarkDragSource &&
    startBookmarkDragSource.includes('setPointerCapture'),
  'bookmark rows should capture the pointer only after movement crosses the drag threshold so menu clicks remain intact'
);
assert.ok(
  beginPointerTrackingSource.includes("card.getAttribute('aria-expanded') === 'true'") &&
    beginPointerTrackingSource.includes('if (sourceKind !== \'cascade\' && !isOpenCascadeAnchor)') &&
    startBookmarkDragSource.includes('closeBookmarkCascadeMenu();'),
  'pressing an already-open folder should keep its cascade mounted until a real drag starts'
);
assert.ok(
  startBookmarkDragSource.includes(
    "document.body.setAttribute('data-drag-source', 'bookmark');"
  ) &&
    finishBookmarkDragSource.includes(
      "document.body.removeAttribute('data-drag-source');"
    ),
  'bookmark drag sessions should hold a page-wide grabbing cursor until pointer release'
);
assert.ok(
  /state\.keepCascadeOpenAfterDrop[\s\S]*?if \(state\.isDragging\) \{[\s\S]*?if \(shouldKeepCascadeOpen && bookmarkCascadeRuntime &&[\s\S]*?closeBookmarkCascadeMenu\(\);/.test(newtabJs),
  'releasing a cascade row before the drag threshold should keep it mounted for the following click event'
);
assert.ok(
    newtabJs.includes("previousTarget.markerPosition !== target.markerPosition") &&
    newtabJs.includes("previousTarget.markerOffsetPx) !== Number(target.markerOffsetPx") &&
    newtabJs.includes("'data-insert-line-motion'") &&
    newtabJs.includes("previousInsertMotion === 'a' ? 'b' : 'a'"),
  'each newly targeted grid boundary should restart the insertion-line extension'
);
assert.ok(
  /@media \(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\[data-insert-line-position\]::after\s*\{[^}]*animation:\s*none;/s
    .test(newtabHtml),
  'the grid insertion-line motion should respect reduced-motion preferences'
);
assert.ok(
  bookmarkDragJs.includes('DEFAULT_GRID_INSERTION_HIT_ZONE_PX = 8') &&
    bookmarkDragJs.includes('pointerY >= item.rect.top && pointerY <= item.rect.bottom') &&
    bookmarkDragJs.includes('nearestBoundaryDistance > hitZonePx'),
  'bookmark grid insertion targets should exist only near horizontal card boundaries'
);
assert.ok(
  newtabJs.includes('restoreBookmarkDragPreview(state);'),
  'leaving a valid target should restore the original preview order'
);
assert.ok(
  newtabJs.includes("document.addEventListener('pointermove', handleBookmarkDragPointerMove, true)") &&
    newtabJs.includes("document.addEventListener('pointerup', handleBookmarkDragPointerUp, true)"),
  'drag lifecycle should stay on document when live reordering releases element pointer capture'
);
assert.ok(
  !newtabJs.includes('scheduleBookmarkFolderDragOpen') &&
    !newtabJs.includes('openBookmarkCascadeMenu(item, target.element, {') &&
    !newtabJs.includes('const relativeY = (pointerY - folderRect.top)'),
  'a main-grid folder card should remain a whole-card drop target without opening its cascade'
);
assert.ok(
  newtabJs.includes("persistBookmarkCrossLevelMove(state, dropTarget)"),
  'dropping on a folder target should persist a cross-level move'
);
assert.ok(
  newtabJs.includes('const rawTargetIndex =') &&
    newtabJs.includes('target.preservePageSlot === true') &&
    newtabJs.includes('Number(state.originalIndex) < rawTargetIndex') &&
    newtabJs.includes('getMoveApiDestinationIndex({') &&
    newtabJs.includes('index: destinationIndex'),
  'every allowed forward cross-page slot should compensate for source removal exactly once'
);
assert.ok(
  newtabJs.includes('NEWTAB_BOOKMARK_DRAG.shouldKeepCascadeOpenAfterDrop(') &&
    newtabJs.includes('bookmarkCascadeRuntime.refresh') &&
    newtabJs.includes('markBookmarkTreeDirty({ preserveCascadeOpen: keepCascadeOpen })'),
  'only moves that remain inside the cascade should keep and refresh its menu'
);
assert.ok(
  cascadeJs.includes('ensureReady(false)') &&
    !cascadeJs.includes('ensureReady(true)'),
  'cascade and card refreshes should share one reload instead of invalidating each other'
);
assert.ok(
  bookmarksRuntimeJs.includes("'onMoved'") &&
    bookmarksRuntimeJs.includes("'onChildrenReordered'") &&
    bookmarksRuntimeJs.includes('controlledMutationDepth > 0') &&
    newtabJs.includes('if (change.isControlled)') &&
    newtabJs.includes('skipRuntimeInvalidate: true'),
  'controlled browser move events should mark data dirty without triggering a second render'
);
assert.ok(
  !newtabJs.includes('showBookmarkMoveToast(record);'),
  'a normal drag move should not show an undo toast before the user presses the shortcut'
);
assert.ok(
  bookmarkDragJs.includes("kind: 'insertion'") &&
    newtabJs.includes('getBookmarkGridInsertionDropTarget') &&
    newtabJs.includes('originalIndex < pageStartIndex || originalIndex >= pageEndIndex') &&
    bookmarkDragJs.includes('markerOffsetPx: Math.max(1, Math.min(gridRect.width - 1, nearestBoundary.x - gridRect.left))') &&
    bookmarkDragJs.includes('firstItem.rect.left - (columnGap / 2)') &&
    bookmarkDragJs.includes('lastItem.rect.right + (columnGap / 2)') &&
    bookmarkDragJs.includes('itemIndex === Number(config.pageStartIndex)') &&
    bookmarkDragJs.includes('isCrossPageDrag && isPageEndBoundary') &&
    bookmarkDragJs.includes('preservePageSlot: isCrossPageDrag') &&
    newtabHtml.includes('--x-nt-insert-line-left'),
  'the main bookmark grid should map cross-page gap lines to final page slots and suppress the page-end line'
);
assert.ok(
  newtabHtml.includes('--x-nt-insert-indicator: #7a8491') &&
    newtabHtml.includes('--x-nt-insert-indicator: #a8b0bc') &&
    !/data-bookmark-insert-position[^}]*background:\s*#2563eb/s.test(newtabHtml),
  'grid and cascade insertion lines should use neutral solid gray instead of blue'
);
assert.ok(
  newtabHtml.includes('.x-nt-bookmark-card[data-bookmark-draggable="true"]') &&
    newtabHtml.includes('.x-nt-bookmark-cascade-item[data-bookmark-draggable="true"]') &&
    newtabJs.includes("document.addEventListener('selectstart', handleBookmarkDragSelectStart, true)") &&
    newtabJs.includes('event.preventDefault();'),
  'bookmark drag sources should prevent native text selection before and during pointer tracking'
);
assert.ok(
  bookmarkDragJs.includes("'x-nt-bookmark-card-drag-preview'") &&
    newtabHtml.includes('.x-nt-bookmark-card-drag-preview') &&
    bookmarkDragJs.includes('DEFAULT_PREVIEW_POINTER_GAP_PX = 10') &&
    bookmarkDragJs.includes('top = pointerY - previewHeight - pointerGapPx'),
  'card drags should use a compact floating preview that stays close to the pointer'
);
assert.ok(
  bookmarkDragJs.includes("'data-bookmark-view-mode') === 'top'") &&
    bookmarkDragJs.includes("'x-nt-bookmark-card-drag-preview--topbar'") &&
    /\.x-nt-bookmark-card-drag-preview--topbar\s*\{[^}]*padding:\s*4px 8px;[^}]*gap:\s*7px;/s
      .test(newtabHtml) &&
    /\.x-nt-bookmark-card-drag-preview--topbar \.x-nt-bookmark-title\s*\{[^}]*max-width:\s*none;[^}]*font-size:\s*12px;[^}]*line-height:\s*18px;/s
      .test(newtabHtml),
  'topbar drag previews should preserve enough compact content space to show the folder title'
);
assert.ok(
  bookmarkDragJs.includes('documentObj.body.appendChild(preview);') &&
    !newtabJs.includes("state.card.closest('.x-nt-bookmark-cascade-menu')") &&
    !bookmarkDragJs.includes('previewRoot.appendChild(preview);') &&
    /\.x-nt-bookmark-cascade-drag-preview\s*\{[\s\S]*?z-index:\s*2147483645;/s.test(newtabHtml),
  'cascade drag previews should render in an independent body layer without recompositing the menu overlay'
);
assert.ok(
  /\.x-nt-bookmark-card\[data-bookmark-dragging="true"\]:not\(\.x-nt-bookmark-card-drag-preview\)\s*\{\s*opacity:\s*0\.36;/s.test(newtabHtml) &&
    /\.x-nt-bookmark-cascade-item\[data-bookmark-dragging="true"\]:not\(\.x-nt-bookmark-cascade-drag-preview\)\s*\{\s*opacity:\s*0\.38;/s.test(newtabHtml),
  'active drag sources should remain in their layout slot as a translucent placeholder'
);
assert.ok(
  /\.x-nt-bookmark-cascade-row:has\(> \.x-nt-bookmark-cascade-item\[data-bookmark-dragging="true"\]\)[\s\S]*?> \.x-nt-bookmark-cascade-copy-trigger\s*\{[\s\S]*?opacity:\s*0;[\s\S]*?pointer-events:\s*none;/s.test(newtabHtml),
  'a dragged cascade row should hide its sibling copy trigger instead of leaving the icon above the preview'
);
assert.ok(
  bookmarkDragJs.includes('function resetPreviewFolderVisual(state, preview, options)') &&
    newtabJs.includes('getFigmaFolderSvg(`${bookmarkId}-drag-preview`, bookmarkId)') &&
    newtabJs.includes('setFolderPathMorphState(folderIcon, false);') &&
    bookmarkDragJs.includes('resetPreviewFolderVisual(state, preview, config);'),
  'folder drag previews should rebuild an independent closed-folder icon'
);
assert.ok(
    bookmarkDragJs.includes(
      'const horizontalHitPadding = (columnGap / 2) + hitZonePx;'
    ) &&
    bookmarkDragJs.includes('pointerX < gridRect.left - horizontalHitPadding') &&
    newtabJs.indexOf(
      'const insertionTarget = getBookmarkGridInsertionDropTarget(state, pointerX, pointerY);'
    ) < newtabJs.indexOf('if (!isValidBookmarkFolderDropTarget(state, target))') &&
    newtabJs.includes(
      'return isValidBookmarkInsertionDropTarget(state, insertionTarget)'
    ),
  'the complete outer grid gap should accept insertion before a first item, ahead of folder-card targeting'
);
assert.ok(
  newtabJs.includes('BOOKMARK_DRAG_PAGE_SWITCH_DELAY_MS = 640') &&
    newtabJs.includes('function getBookmarkDragPageSwitchDirection(pointerX, pointerY)') &&
    newtabJs.includes('function scheduleBookmarkDragPageSwitch(state, direction)') &&
    newtabJs.includes('switchBookmarkPageDuringDrag(bookmarkCurrentPage + normalizedDirection)') &&
    newtabJs.includes('clearBookmarkDragPageSwitch(state);') &&
    newtabHtml.includes('[data-bookmark-drag-page-target="true"]'),
  'holding a dragged bookmark over an available pager button should switch pages without the normal page animation'
);
assert.ok(
  newtabHtml.includes('.x-nt-bookmark-card.x-nt-bookmark-card--hover:not([aria-expanded="true"])'),
  'drag mode should not shift the folder card anchoring an open cascade menu'
);
assert.ok(
  newtabJs.includes("performBookmarkMoveHistoryAction(direction)") &&
    newtabJs.includes("isEditableElement(activeElement)") &&
    newtabJs.includes("activeElement.blur();"),
  'bookmark moves should expose keyboard undo and redo handling immediately after a drag'
);
assert.ok(
  bookmarksRuntimeJs.includes('HISTORY_INVALIDATING_EVENT_NAMES') &&
    bookmarksRuntimeJs.includes("'onCreated'") &&
    bookmarksRuntimeJs.includes("'onRemoved'") &&
    bookmarksRuntimeJs.includes("'onMoved'") &&
    bookmarksRuntimeJs.includes("'onChildrenReordered'") &&
    bookmarksRuntimeJs.includes("'onImportEnded'") &&
    newtabJs.includes('if (change.invalidatesHistory)') &&
    newtabJs.includes('bookmarkMoveHistory.clear();'),
  'external bookmark structure changes should invalidate stale move and delete history records'
);
assert.ok(
  cascadeJs.includes('isBookmarkCascadePointInsideInteractiveArea(point)'),
  'cascade drag routing should preserve the existing safe-area behavior'
);
assert.ok(
  newtabJs.includes("target && target.kind === 'blocked'") &&
    newtabJs.includes('cascadeBlocked = true;') &&
    newtabJs.includes('isBookmarkCascadeSurfaceAtPoint(pointerX, pointerY)') &&
    newtabJs.indexOf('target = getBookmarkElementDropTarget(pointerX, pointerY);') <
      newtabJs.indexOf('if (cascadeBlocked && isBookmarkCascadeSurfaceAtPoint(pointerX, pointerY))'),
  'cascade safe-area blocking should still allow explicit parent cards and visible grid gaps'
);
assert.ok(
  cascadeJs.includes('BOOKMARK_CASCADE_DRAG_OPEN_DELAY_MS = 420'),
  'nested folders should use a deliberate hover delay during drag navigation'
);
assert.ok(
  cascadeViewReact.includes('data-bookmark-parent-id={parentId}') &&
    cascadeJs.includes("itemButton.addEventListener('pointerdown'") &&
    cascadeJs.includes('onItemPointerDown({'),
  'cascade menu items should expose bookmark metadata and initiate pointer drags'
);
assert.ok(
  cascadeJs.includes('setDragMode: setBookmarkCascadeDragMode'),
  'an already-open cascade should be able to enter drag routing mode'
);
assert.ok(
  newtabJs.includes('NEWTAB_BOOKMARK_DRAG.shouldKeepCascadeOpenAfterDrop(') &&
    cascadeJs.includes('!bookmarkCascadeMenu || bookmarkCascadeDragMode || bookmarkCascadeCloseTimer') &&
    cascadeJs.includes('cancelBookmarkCascadeDelayedClose();'),
  'a cascade drag should remain open while crossing levels and only after an internal drop'
);
assert.ok(
  newtabJs.includes('BOOKMARK_DRAG_FOLDER_SWITCH_DELAY_MS = 640') &&
    newtabJs.includes('function scheduleBookmarkDragFolderSwitch(state, dropTarget)') &&
    newtabJs.includes('NEWTAB_BOOKMARK_DRAG.getFolderSwitchTarget(') &&
    newtabJs.includes('state.folderSwitchPendingId = targetFolderId;') &&
    newtabJs.includes('navigateBookmarkFolder(targetFolderId);') &&
    newtabJs.includes("data-bookmark-empty-drop-surface"),
  'holding a drag over the Bookmarks heading should enter the root folder while keeping an empty root available as a drop surface'
);
assert.ok(
  newtabJs.includes("if (bookmarkDragState.sourceKind !== 'cascade') {") &&
    newtabJs.includes("bookmarkGrid.setAttribute('data-bookmark-dragging', 'true');"),
  'dragging from a cascade should not toggle the topbar grid into its card-drag rendering state'
);
assert.ok(
  cascadeJs.includes('rebindAnchor: rebindBookmarkCascadeAnchor') &&
    cascadeJs.includes('getRootFolderId: getBookmarkCascadeRootFolderId') &&
    newtabJs.includes('syncOpenBookmarkCascadeAnchorVisual();') &&
    newtabJs.includes('bookmarkCascadeRuntime.rebindAnchor(nextAnchor, { instant: true })'),
  'an open cascade should rebind its active folder card synchronously after bookmark rendering'
);
assert.ok(
  bookmarkFolderIconJs.includes('function setFolderPathMorphState(folderIcon, toHover)') &&
    bookmarkFolderIconJs.includes('morphOptions && morphOptions.instant === true') &&
    newtabJs.includes('NEWTAB_BOOKMARK_FOLDER_ICON.setFolderPathMorphState') &&
    bookmarksViewJs.includes('options.playFolderPathMorph('),
  'a rebound folder icon should inherit its open state without replaying the morph animation'
);
assert.ok(
  cascadeJs.includes('refresh: refreshBookmarkCascadeMenu'),
  'an open cascade should expose an in-place refresh after bookmark moves'
);
assert.ok(
  cascadeJs.includes('bookmarkCascadeRefreshInProgress') &&
    cascadeJs.includes("bookmarkCascadeMenu.setAttribute('data-refreshing', 'true')") &&
    newtabHtml.includes('.x-nt-bookmark-cascade-menu[data-refreshing="true"] .x-nt-bookmark-cascade-level'),
  'refreshing a reordered cascade should not replay the menu opening transition'
);
assert.ok(
  newtabJs.includes('draggedBookmarkId: state.bookmarkId') &&
    newtabJs.includes('draggedRect: state.draggedVisualRect') &&
    newtabJs.includes('const isDraggedCard = Boolean(') &&
    cascadeJs.includes('playBookmarkCascadeRowLayoutAnimation') &&
    cascadeJs.includes('BOOKMARK_CASCADE_REORDER_ANIMATION_MS = 180'),
  'cross-page and cross-level drops should animate the dragged preview and displaced destination items'
);
assert.ok(
  newtabJs.includes('NEWTAB_BOOKMARK_DRAG.getLayoutShiftDelta(before, after, {') &&
    newtabJs.includes('horizontalOnly: isBookmarkTopbarMode()') &&
    bookmarkDragJs.includes("dy: config.horizontalOnly === true ? 0 : beforeTop - afterTop"),
  'topbar drop animations should preserve the menu row and only settle horizontally'
);
assert.ok(
  newtabJs.includes('markerVerticalInsetPx: isBookmarkTopbarMode() ? 3 : 8') &&
    bookmarkDragJs.includes('anchorItem.rect.height - (markerVerticalInsetPx * 2)'),
  'topbar insertion markers should extend closer to the menu row edges'
);
assert.ok(
  cascadeJs.includes("kind: 'insertion'") &&
    cascadeJs.includes("data-bookmark-insert-position"),
  'cascade menu levels should expose before and after insertion targets'
);
assert.ok(
  cascadeJs.includes('BOOKMARK_CASCADE_FOLDER_DROP_MIN_RATIO = 0.38') &&
    cascadeJs.includes('BOOKMARK_CASCADE_FOLDER_DROP_MAX_RATIO = 0.62') &&
    cascadeJs.includes('(previousRect.bottom + rect.top) / 2') &&
    cascadeJs.includes('(rect.bottom + nextRect.top) / 2'),
  'cascade reorder targets should use broad edge zones and absorb the gaps between rows'
);
assert.ok(
  newtabJs.includes('onItemPointerDown: handleBookmarkCascadeItemPointerDown') &&
    newtabJs.includes("beginBookmarkDragPointerTracking(event, element, item, 'cascade')"),
  'new tab should track cascade menu rows as bookmark drag sources'
);
assert.ok(
  newtabJs.includes("bookmarkHeading.setAttribute('data-bookmark-drop-folder-id'") &&
    !newtabJs.includes("bookmarkHeading.removeAttribute('data-bookmark-drop-folder-id')"),
  'the root bookmark heading should remain a parent-folder drop target at the root view'
);

['en', 'zh_CN', 'zh_TW', 'ja'].forEach((locale) => {
  const messages = JSON.parse(fs.readFileSync(
    path.join(repoRoot, '_locales', locale, 'messages.json'),
    'utf8'
  ));
  ['bookmarks_move_success', 'bookmarks_move_undone', 'bookmarks_move_redone', 'bookmarks_move_failed']
    .forEach((key) => assert.ok(messages[key] && messages[key].message, `${locale} should include ${key}`));
});

console.log('New tab cross-level bookmark drag tests passed.');
