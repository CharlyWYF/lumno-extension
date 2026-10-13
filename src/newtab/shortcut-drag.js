(function(root) {
  // Pointer-driven shortcut reordering and dragging shortcuts onto bookmarks.
  function createShortcutDrag(deps) {
    const {
      getShortcutReorderTiles,
      NEWTAB_CROSS_SURFACE_DRAG,
      refreshShortcutTileCacheFromDom,
      getShortcutTileId,
      getShortcutTileById,
      renderShortcuts,
      resetShortcutDockHover,
      NEWTAB_BOOKMARK_MOVE_HISTORY,
      persistShortcuts,
      bookmarkMoveHistory,
      hideCursorTooltip,
      closeBookmarkCascadeMenu,
      hideShortcutTooltip,
      isEmptyBookmarkRootHidden,
      renderCurrentBookmarkPage,
      isBookmarkTopbarMode,
      isBookmarkCascadeSurfaceAtPoint,
      getExternalBookmarkSurfacePoint,
      isPointOverShortcutDropSurface,
      clearBookmarkDragPageSwitch,
      clearBookmarkDragFolderSwitch,
      clearDragDropTarget,
      scheduleWallpaperAdaptiveToneUpdate,
      getBookmarkDragPageSwitchDirection,
      scheduleBookmarkDragPageSwitch,
      getShortcutFolderDropTargetAt,
      getExternalBookmarkDropTarget,
      setDragDropTarget,
      scheduleBookmarkDragFolderSwitch,
      getShortcutById,
      isValidExternalBookmarkDropTarget,
      bookmarksRuntime,
      getShortcutFolderId,
      queueBookmarkLayoutAnimation,
      applyBookmarkShortcutTransfer,
      applyShortcutStack,
      getFolderItemIconForShortcut,
      FOLDER_REFERENCES,
      showToast,
      hideToast,
      t,
      formatMessage,
      getBookmarkUndoShortcutLabel,
      refreshShortcutFolderReferences,
      isShortcutContextMenuNode,
      getShortcutTileFromNode,
      closeShortcutContextMenu,
      moveShortcutGroupToIndex,
      fitShortcutGroupColumns
    } = deps;

    // Page state still owned by newtab.js; read and written through accessors.
    const pageState = deps.pageState;

    const SHORTCUT_DRAG_START_THRESHOLD_PX = 10;
    const SHORTCUT_REORDER_ANIMATION_MS = 180;
    const SHORTCUT_DROP_ANIMATION_MS = 210;
    const SHORTCUT_REORDER_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
    const SHORTCUT_AREA_AUTO_SCROLL_EDGE_PX = 44;
    const SHORTCUT_AREA_AUTO_SCROLL_MAX_STEP_PX = 16;
    const SHORTCUT_AREA_AUTO_SCROLL_DELAY_MS = 220;
    const SHORTCUT_SLOT_SELECTOR = '.x-nt-shortcut-tile[data-shortcut-id], .x-nt-shortcut-group-empty';

    // The shortcut section scrolls only when it is taller than the room above
    // the bottom dock.
    function getShortcutScrollArea() {
      const grid = pageState.shortcutGrid;
      const area = grid && typeof grid.closest === 'function' ? grid.closest('.x-nt-shortcuts-section') : null;
      return area && area.getAttribute('data-shortcuts-scrollable') === 'true' ? area : null;
    }

    // Scrolls a step while a drag holds the pointer near the area's top or
    // bottom edge; the caller asks for another frame while it returns true.
    // A drag coming in from the dock crosses the bottom edge, so scrolling
    // waits until the pointer has stayed by an edge for a moment.
    let shortcutAreaEdgeSince = 0;
    let shortcutAreaEdgeCheckedAt = 0;
    function autoScrollShortcutArea(pointerX, pointerY) {
      const area = getShortcutScrollArea();
      if (!area || !Number.isFinite(pointerX) || !Number.isFinite(pointerY)) {
        return false;
      }
      const rect = area.getBoundingClientRect();
      const edge = Math.min(SHORTCUT_AREA_AUTO_SCROLL_EDGE_PX, rect.height / 3);
      const inside = pointerX >= rect.left && pointerX <= rect.right && pointerY >= rect.top && pointerY <= rect.bottom;
      const depth = !inside ? 0 : pointerY < rect.top + edge
        ? -(rect.top + edge - pointerY)
        : pointerY > rect.bottom - edge ? pointerY - (rect.bottom - edge) : 0;
      const now = window.performance && typeof window.performance.now === 'function'
        ? window.performance.now() : Date.now();
      const resumed = now - shortcutAreaEdgeCheckedAt < 120;
      shortcutAreaEdgeCheckedAt = now;
      if (!depth) {
        shortcutAreaEdgeSince = 0;
        return false;
      }
      if (!shortcutAreaEdgeSince || !resumed) {
        shortcutAreaEdgeSince = now;
      }
      if (now - shortcutAreaEdgeSince < SHORTCUT_AREA_AUTO_SCROLL_DELAY_MS) {
        return true;
      }
      const step = Math.sign(depth) * Math.max(1, Math.round(SHORTCUT_AREA_AUTO_SCROLL_MAX_STEP_PX * Math.min(1, Math.abs(depth) / edge)));
      const before = area.scrollTop;
      area.scrollTop = before + step;
      return area.scrollTop !== before;
    }

    // A scrolling section would clip the dragged tile, so the tile leaves it
    // as a fixed element while a placeholder keeps its slot.
    function liftShortcutDragTile(tile) {
      if (!tile || tile._xShortcutDragLift || !tile.parentNode || !getShortcutScrollArea() ||
          typeof tile.getBoundingClientRect !== 'function') {
        return;
      }
      const rect = tile.getBoundingClientRect();
      const placeholder = document.createElement('span');
      placeholder.className = 'x-nt-shortcut-drag-placeholder';
      placeholder.setAttribute('aria-hidden', 'true');
      tile.parentNode.insertBefore(placeholder, tile);
      tile._xShortcutDragLift = { placeholder };
      tile.setAttribute('data-shortcut-lifted', 'true');
      tile.style.setProperty('left', `${rect.left}px`);
      tile.style.setProperty('top', `${rect.top}px`);
    }

    function removeShortcutDragPlaceholder(tile) {
      const lift = tile && tile._xShortcutDragLift;
      if (lift && lift.placeholder && lift.placeholder.parentNode) {
        lift.placeholder.parentNode.removeChild(lift.placeholder);
      }
      if (lift) {
        lift.placeholder = null;
      }
    }

    function unliftShortcutDragTile(tile) {
      if (!tile || !tile._xShortcutDragLift) {
        return;
      }
      removeShortcutDragPlaceholder(tile);
      delete tile._xShortcutDragLift;
      tile.removeAttribute('data-shortcut-lifted');
      tile.style.removeProperty('left');
      tile.style.removeProperty('top');
    }

    // Everything in the grid that can shift when shortcuts move: tiles, the
    // add tile, group titles and empty groups' slots.
    function getShortcutLayoutElements() {
      return pageState.shortcutGrid
        ? Array.from(pageState.shortcutGrid.querySelectorAll(
          '.x-nt-shortcut-tile, .x-nt-shortcut-group-header, .x-nt-shortcut-group-empty'
        ))
        : getShortcutReorderTiles();
    }

    function getShortcutTileRectMap() {
      const rects = new Map();
      getShortcutLayoutElements().forEach((tile) => {
        if (tile && typeof tile.getBoundingClientRect === 'function') {
          rects.set(tile, tile.getBoundingClientRect());
        }
      });
      return rects;
    }

    function getShortcutTileLayoutRect(tile) {
      if (!tile || !pageState.shortcutGrid || typeof tile.offsetLeft !== 'number' ||
          typeof tile.offsetTop !== 'number') {
        return null;
      }
      const offsetParent = tile.offsetParent && typeof tile.offsetParent.getBoundingClientRect === 'function'
        ? tile.offsetParent
        : pageState.shortcutGrid;
      const parentRect = typeof offsetParent.getBoundingClientRect === 'function'
        ? offsetParent.getBoundingClientRect()
        : { left: 0, top: 0 };
      const width = Number(tile.offsetWidth) || 0;
      const height = Number(tile.offsetHeight) || 0;
      const left = parentRect.left + tile.offsetLeft;
      const top = parentRect.top + tile.offsetTop;
      return {
        left,
        top,
        right: left + width,
        bottom: top + height,
        width,
        height,
        centerX: left + (width / 2),
        centerY: top + (height / 2)
      };
    }

    function clearShortcutTileLayoutAnimation(tile) {
      if (!tile || !tile.style) {
        return;
      }
      if (tile._xShortcutLayoutAnimationTimer) {
        window.clearTimeout(tile._xShortcutLayoutAnimationTimer);
        tile._xShortcutLayoutAnimationTimer = 0;
      }
      tile.style.removeProperty('transition');
      if (tile.getAttribute && tile.getAttribute('data-shortcut-dragging') !== 'true' &&
          tile.getAttribute('data-shortcut-dropping') !== 'true') {
        tile.style.removeProperty('transform');
      }
    }

    // Something that was hidden or not there has no place to slide from
    // (a hidden box measures at the page corner), so it fades in where it is.
    function enterShortcutLayoutElement(element) {
      if (typeof element.animate !== 'function') {
        return;
      }
      element.animate([
        { opacity: 0, scale: '0.86' },
        { opacity: 1, scale: '1' }
      ], {
        duration: SHORTCUT_REORDER_ANIMATION_MS,
        easing: SHORTCUT_REORDER_EASING
      });
    }

    function animateShortcutLayoutShift(beforeRects, draggedTile) {
      if (!beforeRects || !pageState.shortcutGrid) {
        return;
      }
      getShortcutLayoutElements().forEach((tile) => {
        if (!tile || tile === draggedTile || !tile.style || typeof tile.getBoundingClientRect !== 'function') {
          return;
        }
        const before = beforeRects.get(tile);
        if (!before || !before.width || !before.height) {
          const shown = tile.getBoundingClientRect();
          if (shown.width && shown.height) {
            enterShortcutLayoutElement(tile);
          }
          return;
        }
        clearShortcutTileLayoutAnimation(tile);
        const after = tile.getBoundingClientRect();
        if (!after.width || !after.height) {
          return;
        }
        const dx = before.left - after.left;
        const dy = before.top - after.top;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
          return;
        }
        tile.style.transition = 'none';
        tile.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
        void tile.offsetWidth;
        window.requestAnimationFrame(() => {
          if (!tile.isConnected) {
            return;
          }
          tile.style.transition = `transform ${SHORTCUT_REORDER_ANIMATION_MS}ms ${SHORTCUT_REORDER_EASING}`;
          tile.style.transform = 'translate3d(0, 0, 0)';
          tile._xShortcutLayoutAnimationTimer = window.setTimeout(() => {
            tile._xShortcutLayoutAnimationTimer = 0;
            clearShortcutTileLayoutAnimation(tile);
          }, SHORTCUT_REORDER_ANIMATION_MS + 80);
        });
      });
    }

    // Runs a change that re-renders the shortcuts and slides whatever it moved
    // from where it was, so a re-centered grid glides instead of jumping.
    function animateShortcutLayoutChange(change) {
      const beforeRects = getShortcutTileRectMap();
      const result = change();
      animateShortcutLayoutShift(beforeRects, null);
      return result;
    }

    function setShortcutDragTileTransform(state, pointerX, pointerY) {
      if (!state || !state.tile || !state.tile.style ||
          typeof state.tile.getBoundingClientRect !== 'function') {
        return;
      }
      const rect = state.tile.getBoundingClientRect();
      const currentX = Number(state.translateX) || 0;
      const currentY = Number(state.translateY) || 0;
      const baseLeft = rect.left - currentX;
      const baseTop = rect.top - currentY;
      const nextX = pointerX - state.grabOffsetX - baseLeft;
      const nextY = pointerY - state.grabOffsetY - baseTop;
      state.translateX = nextX;
      state.translateY = nextY;
      state.tile.style.transition = 'none';
      state.tile.style.transform = `translate3d(${nextX}px, ${nextY}px, 0)`;
    }

    function settleShortcutDragTile(tile) {
      if (!tile || !tile.style) {
        return;
      }
      tile.setAttribute('data-shortcut-dropping', 'true');
      tile.style.pointerEvents = '';
      tile.style.transition = `transform ${SHORTCUT_DROP_ANIMATION_MS}ms ${SHORTCUT_REORDER_EASING}`;
      // A lifted tile lands on its placeholder, wherever the area scrolled.
      const lift = tile._xShortcutDragLift;
      const slotRect = lift && lift.placeholder && lift.placeholder.isConnected
        ? lift.placeholder.getBoundingClientRect()
        : null;
      tile.style.transform = slotRect
        ? `translate3d(${slotRect.left - (Number.parseFloat(tile.style.left) || 0)}px, ${slotRect.top - (Number.parseFloat(tile.style.top) || 0)}px, 0)`
        : 'translate3d(0, 0, 0)';
      if (tile._xShortcutDropTimer) {
        window.clearTimeout(tile._xShortcutDropTimer);
      }
      tile._xShortcutDropTimer = window.setTimeout(() => {
        tile._xShortcutDropTimer = 0;
        tile.removeAttribute('data-shortcut-dragging');
        tile.removeAttribute('data-shortcut-dropping');
        unliftShortcutDragTile(tile);
        tile.style.removeProperty('transition');
        tile.style.removeProperty('transform');
        tile.style.removeProperty('will-change');
        tile.style.pointerEvents = '';
      }, SHORTCUT_DROP_ANIMATION_MS + 90);
    }

    function getShortcutTileInsertionIndex(tile) {
      if (!tile) {
        return -1;
      }
      return getShortcutReorderTiles().indexOf(tile);
    }

    // Empty groups show a slot that takes drops like a tile. `index` counts
    // only the tiles before the insertion point; `groupId` is the group of the
    // tile or slot the pointer is beside.
    function getShortcutInsertionSlotAt(pointerX, pointerY, excludedTile) {
      // The dragged tile filling an empty group hides that group's slot.
      // The slot keeps the tile's place, or the group's row would drop out
      // of reach and the next move would send the tile back, every move.
      const lift = excludedTile && excludedTile._xShortcutDragLift;
      const excludedSpot = lift && lift.placeholder && lift.placeholder.isConnected
        ? lift.placeholder
        : excludedTile;
      const getSlotRect = (tile) => (excludedTile && tile.previousElementSibling === excludedTile &&
        tile.classList.contains('x-nt-shortcut-group-empty') && !tile.hidden
        ? getShortcutTileLayoutRect(excludedSpot)
        : getShortcutTileLayoutRect(tile));
      const layoutItems = (pageState.shortcutGrid
        ? Array.from(pageState.shortcutGrid.querySelectorAll(SHORTCUT_SLOT_SELECTOR))
        : getShortcutReorderTiles())
        .filter((tile) => tile && tile !== excludedTile)
        .map((tile) => ({
          tile,
          rect: getSlotRect(tile)
        }))
        .filter((item) => item.rect && item.rect.width > 0 && item.rect.height > 0);
      const slot = NEWTAB_CROSS_SURFACE_DRAG.getRowInsertionSlot(layoutItems, pointerX, pointerY);
      const anchor = slot.anchorIndex >= 0 ? layoutItems[slot.anchorIndex] : null;
      const insertionPoint = !anchor ? 0 : slot.markerPosition === 'after' ? slot.anchorIndex + 1 : slot.anchorIndex;
      return {
        index: layoutItems.slice(0, insertionPoint)
          .filter((item) => item.tile.hasAttribute('data-shortcut-id')).length,
        markerPosition: slot.markerPosition,
        anchorRect: anchor ? anchor.rect : null,
        anchorTile: anchor ? anchor.tile : null,
        groupId: anchor ? getShortcutTileGroupId(anchor.tile) : ''
      };
    }

    function getShortcutDragInsertionSlot(pointerX, pointerY) {
      if (!pageState.shortcutGrid || !pageState.shortcutDragState || !Number.isFinite(pointerX) ||
          !Number.isFinite(pointerY)) {
        return null;
      }
      return getShortcutInsertionSlotAt(pointerX, pointerY, pageState.shortcutDragState.tile);
    }

    function getShortcutGroupHeader(groupId) {
      return pageState.shortcutGrid && groupId && typeof pageState.shortcutGrid.querySelector === 'function'
        ? pageState.shortcutGrid.querySelector(`.x-nt-shortcut-group-header[data-shortcut-group-id="${groupId}"]`)
        : null;
    }

    function getShortcutTileGroupId(tile) {
      return tile && typeof tile.getAttribute === 'function'
        ? String(tile.getAttribute('data-shortcut-group-id') || '')
        : '';
    }

    // Group titles sit between the tiles of different groups, so a tile goes
    // next to the tile the pointer is beside rather than before the next tile
    // in the list, which could already belong to the next group.
    function moveShortcutTileElement(tile, targetIndex, slot) {
      if (!pageState.shortcutGrid || !tile || tile.parentNode !== pageState.shortcutGrid ||
          !Number.isFinite(targetIndex)) {
        return false;
      }
      // A lifted tile keeps its placeholder right before it.
      const placeholder = tile._xShortcutDragLift ? tile._xShortcutDragLift.placeholder : null;
      const lead = placeholder && placeholder.parentNode === pageState.shortcutGrid ? placeholder : tile;
      const place = (reference) => {
        pageState.shortcutGrid.insertBefore(tile, reference);
        if (lead !== tile) pageState.shortcutGrid.insertBefore(lead, tile);
        refreshShortcutTileCacheFromDom();
        return true;
      };
      const anchor = slot && slot.anchorTile && slot.anchorTile !== tile && slot.anchorTile !== lead &&
        slot.anchorTile.parentNode === pageState.shortcutGrid ? slot.anchorTile : null;
      if (anchor) {
        // An empty group's slot stays after the tile that fills it.
        const after = slot.markerPosition === 'after' && !anchor.classList.contains('x-nt-shortcut-group-empty');
        const reference = after ? anchor.nextSibling : anchor;
        if (reference === tile || reference === lead || (after ? lead.previousSibling === anchor
          : tile.nextSibling === anchor)) {
          return false;
        }
        return place(reference);
      }
      const currentIndex = getShortcutTileInsertionIndex(tile);
      const remainingTiles = getShortcutReorderTiles().filter((item) => item !== tile);
      const boundedIndex = Math.max(0, Math.min(remainingTiles.length, targetIndex));
      if (currentIndex === boundedIndex) {
        return false;
      }
      return place(remainingTiles[boundedIndex] || pageState.addShortcutButton || null);
    }

    // Moves the shortcut to `targetIndex` among the other visible tiles and
    // into `targetGroupId` when given. Either change counts as a move.
    function moveShortcutItem(shortcutId, targetIndex, targetGroupId) {
      if (!shortcutId || !Number.isFinite(targetIndex)) {
        return false;
      }
      const currentIndex = pageState.newtabShortcuts.findIndex((item) => item && item.id === shortcutId);
      if (currentIndex < 0) {
        return false;
      }
      const groupId = String(targetGroupId || '');
      const regroup = Boolean(groupId) && pageState.newtabShortcuts[currentIndex].groupId !== groupId;
      const tiles = getShortcutReorderTiles();
      const visibleIds = tiles.filter((tile) => getShortcutTileId(tile) !== shortcutId).map(getShortcutTileId);
      const visibleTargetIndex = Math.max(0, Math.min(visibleIds.length, Math.floor(targetIndex)));
      if (!regroup && tiles.findIndex((tile) => getShortcutTileId(tile) === shortcutId) === visibleTargetIndex) {
        return false;
      }
      const nextShortcuts = pageState.newtabShortcuts.slice();
      const removed = nextShortcuts.splice(currentIndex, 1)[0];
      const shortcutItem = regroup ? { ...removed, groupId } : removed;
      const anchorId = visibleIds[visibleTargetIndex];
      const anchorIndex = anchorId ? nextShortcuts.findIndex((item) => item.id === anchorId) : nextShortcuts.length;
      const boundedIndex = Math.max(0, anchorIndex);
      if (!regroup && currentIndex === boundedIndex) {
        return false;
      }
      nextShortcuts.splice(boundedIndex, 0, shortcutItem);
      pageState.newtabShortcuts = nextShortcuts;
      return true;
    }

    function restoreShortcutDragOrder(state) {
      if (state.tile && state.tile._xShortcutDragLift) {
        // Back in the flow, the tile no longer aims at its fixed position.
        unliftShortcutDragTile(state.tile);
        state.tile.style.transition = 'none';
        state.tile.style.transform = '';
      }
      const originalOrder = state.originalShortcuts.map((item) => item.id);
      const restored = NEWTAB_CROSS_SURFACE_DRAG.planShortcutReorder({
        shortcuts: pageState.newtabShortcuts, order: originalOrder,
        groups: state.originalShortcuts.map((item) => item.groupId)
      });
      if (restored) pageState.newtabShortcuts = restored;
      // React has not committed the manually moved DOM order during the drag.
      // Each tile goes after the tile before it in its group, or after its
      // group's title when it is the first one.
      let visibleIndex = 0;
      let previousTile = null;
      let previousGroupId = null;
      pageState.newtabShortcuts.forEach((shortcut) => {
        const tile = getShortcutTileById(shortcut.id);
        if (!tile) return;
        const anchor = previousTile && previousGroupId === shortcut.groupId
          ? previousTile
          : getShortcutGroupHeader(shortcut.groupId);
        moveShortcutTileElement(tile, visibleIndex++, anchor ? { anchorTile: anchor, markerPosition: 'after' } : null);
        previousTile = tile;
        previousGroupId = shortcut.groupId;
      });
      renderShortcuts();
      resetShortcutDockHover();
    }

    function persistShortcutOrder(state) {
      const record = state && NEWTAB_BOOKMARK_MOVE_HISTORY.createShortcutReorderRecord({
        fromOrder: state.originalShortcuts.map((item) => item.id),
        toOrder: pageState.newtabShortcuts.map((item) => item.id),
        fromGroups: state.originalShortcuts.map((item) => item.groupId),
        toGroups: pageState.newtabShortcuts.map((item) => item.groupId)
      });
      if (state && !record) return Promise.resolve(pageState.newtabShortcuts);
      if (state) pageState.bookmarkMoveHistoryBusy = true;
      return persistShortcuts(pageState.newtabShortcuts, '', undefined, { render: false })
        .then((saved) => {
          if (saved && record) bookmarkMoveHistory.push(record);
          if (!saved && state) restoreShortcutDragOrder(state);
          return pageState.newtabShortcuts;
        }).finally(() => {
          if (state) pageState.bookmarkMoveHistoryBusy = false;
        });
    }

    function startShortcutDrag(event, tile) {
      if (!pageState.shortcutGrid || !tile || !pageState.shortcutDragState || pageState.shortcutDragState.tile !== tile) {
        return;
      }
      pageState.shortcutDragState.isDragging = true;
      hideCursorTooltip();
      closeBookmarkCascadeMenu();
      if (document.body) {
        document.body.setAttribute('data-drag-source', 'shortcut');
      }
      hideShortcutTooltip();
      resetShortcutDockHover();
      if (isEmptyBookmarkRootHidden()) {
        renderCurrentBookmarkPage();
      }
      pageState.shortcutGrid.setAttribute('data-shortcut-dragging', 'true');
      tile.setAttribute('data-shortcut-dragging', 'true');
      tile.setAttribute('aria-grabbed', 'true');
      tile.style.pointerEvents = 'none';
      tile.style.willChange = 'transform';
      liftShortcutDragTile(tile);
      setShortcutDragTileTransform(pageState.shortcutDragState, Number(event.clientX), Number(event.clientY));
      if (typeof tile.setPointerCapture === 'function') {
        try {
          tile.setPointerCapture(event.pointerId);
        } catch (error) {
          // Pointer capture can fail if the browser already canceled the pointer.
        }
      }
    }

    function cancelShortcutDragMoveFrame(state) {
      if (!state || !state.moveFrameId) {
        return;
      }
      window.cancelAnimationFrame(state.moveFrameId);
      state.moveFrameId = 0;
    }

    function applyShortcutDragMove(state, pointerX, pointerY) {
      if (!state || state !== pageState.shortcutDragState || !state.isDragging ||
          !Number.isFinite(pointerX) || !Number.isFinite(pointerY)) {
        return;
      }
      setShortcutDragTileTransform(state, pointerX, pointerY);
      document.body.removeAttribute('data-drag-blocked');
      const topbarPoint = isBookmarkTopbarMode() &&
        !isBookmarkCascadeSurfaceAtPoint(pointerX, pointerY)
        ? getExternalBookmarkSurfacePoint(pointerX, pointerY) : null;
      if (topbarPoint && pageState.bookmarkTopbarRuntime.autoScroll(topbarPoint.x, topbarPoint.y)) {
        scheduleShortcutDragMove(state, pointerX, pointerY);
      }
      // Near the shortcut area's edges the area scrolls whatever is under the
      // pointer, so a tile there does not hold the drag as a stack target.
      if (isPointOverShortcutDropSurface(pointerX, pointerY) && autoScrollShortcutArea(pointerX, pointerY)) {
        scheduleShortcutDragMove(state, pointerX, pointerY);
      }
      if (updateShortcutDragBookmarkTarget(state, pointerX, pointerY)) {
        return;
      }
      if (!isPointOverShortcutDropSurface(pointerX, pointerY)) {
        return;
      }
      const slot = getShortcutDragInsertionSlot(pointerX, pointerY);
      const targetIndex = slot ? slot.index : -1;
      const targetGroupId = slot ? slot.groupId : '';
      const source = getShortcutById(state.shortcutId);
      const regroup = Boolean(targetGroupId) && Boolean(source) && source.groupId !== targetGroupId;
      if (targetIndex < 0 || (!regroup && targetIndex === getShortcutTileInsertionIndex(state.tile))) {
        return;
      }
      const beforeRects = getShortcutTileRectMap();
      if (moveShortcutItem(state.shortcutId, targetIndex, targetGroupId)) {
        state.hasReordered = true;
        if (moveShortcutTileElement(state.tile, targetIndex, slot)) {
          // Before measuring, so a grid that hugs a longer or shorter row
          // slides to its new width with the tiles.
          if (fitShortcutGroupColumns()) {
            holdShortcutStackTargetUnderPointer(state, pointerX, pointerY);
          }
          animateShortcutLayoutShift(beforeRects, state.tile);
          setShortcutDragTileTransform(state, pointerX, pointerY);
        }
      }
    }

    function flushShortcutDragMove(state) {
      if (!state) {
        return;
      }
      cancelShortcutDragMoveFrame(state);
      applyShortcutDragMove(
        state,
        Number(state.pendingPointerX),
        Number(state.pendingPointerY)
      );
      cancelShortcutDragMoveFrame(state);
    }

    function scheduleShortcutDragMove(state, pointerX, pointerY) {
      if (!state) {
        return;
      }
      state.pendingPointerX = pointerX;
      state.pendingPointerY = pointerY;
      if (state.moveFrameId) {
        return;
      }
      state.moveFrameId = window.requestAnimationFrame(() => {
        state.moveFrameId = 0;
        applyShortcutDragMove(
          state,
          Number(state.pendingPointerX),
          Number(state.pendingPointerY)
        );
      });
    }

    function suppressCanceledDragClick(element, flagName, pointerId) {
      if (element._xDragCancelClickCleanup) {
        element._xDragCancelClickCleanup();
      }
      element[flagName] = true;
      const cleanup = () => {
        document.removeEventListener('pointerup', onRelease, true);
        document.removeEventListener('pointercancel', onRelease, true);
        document.removeEventListener('pointerdown', onNextPress, true);
        delete element._xDragCancelClickCleanup;
      };
      const onRelease = (releaseEvent) => {
        if (releaseEvent.pointerId !== pointerId) {
          return;
        }
        cleanup();
        // A canceled drag can still generate a click when the held mouse is
        // released later. Keep suppression through that click's event turn.
        window.setTimeout(() => { element[flagName] = false; }, 0);
      };
      const onNextPress = () => {
        cleanup();
        element[flagName] = false;
      };
      element._xDragCancelClickCleanup = cleanup;
      document.addEventListener('pointerup', onRelease, true);
      document.addEventListener('pointercancel', onRelease, true);
      document.addEventListener('pointerdown', onNextPress, true);
    }

    function finishShortcutDrag(event, options) {
      if (!pageState.shortcutDragState) {
        return;
      }
      if (event && pageState.shortcutDragState.pointerId !== event.pointerId) {
        return;
      }
      const state = pageState.shortcutDragState;
      detachShortcutDragDocumentListeners();
      if (event && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
        state.pendingPointerX = event.clientX;
        state.pendingPointerY = event.clientY;
      }
      if (state.isDragging) {
        flushShortcutDragMove(state);
      }
      const bookmarkDropTarget = state.isDragging && !(options && options.cancel)
        ? state.dropTarget
        : null;
      if (state.stackHintVisible && !(bookmarkDropTarget && bookmarkDropTarget.kind === 'shortcut-stack')) {
        hideToast();
      }
      clearBookmarkDragPageSwitch(state);
      clearBookmarkDragFolderSwitch(state);
      clearDragDropTarget(state);
      pageState.shortcutDragState = null;
      document.body.removeAttribute('data-drag-blocked');
      // Only a drag can leave a drag-mode folder menu open. A plain click must
      // keep an open folder menu, so the click itself can toggle it closed.
      if (state.isDragging) {
        closeBookmarkCascadeMenu();
      }
      if (document.body) {
        document.body.removeAttribute('data-drag-source');
      }
      const tile = state.tile;
      if (pageState.shortcutGrid) {
        pageState.shortcutGrid.removeAttribute('data-shortcut-dragging');
      }
      if (tile) {
        tile.removeAttribute('aria-grabbed');
        if (typeof tile.releasePointerCapture === 'function') {
          try {
            tile.releasePointerCapture(state.pointerId);
          } catch (error) {
            // Ignore stale pointer capture releases.
          }
        }
        if (state.isDragging && !bookmarkDropTarget) {
          settleShortcutDragTile(tile);
        } else if (!state.isDragging) {
          tile.removeAttribute('data-shortcut-dragging');
          tile.removeAttribute('data-shortcut-dropping');
          tile.style.pointerEvents = '';
        }
        if (state.isDragging) {
          tile._xShortcutSuppressClick = true;
          if (event) {
            window.setTimeout(() => {
              tile._xShortcutSuppressClick = false;
            }, 0);
          } else {
            suppressCanceledDragClick(tile, '_xShortcutSuppressClick', state.pointerId);
          }
        }
      }
      if (bookmarkDropTarget) {
        // React removes or re-renders the tile; only its placeholder is ours.
        removeShortcutDragPlaceholder(tile);
        if (event && typeof event.preventDefault === 'function') {
          event.preventDefault();
        }
        if (bookmarkDropTarget.kind === 'shortcut-stack') {
          stackShortcuts(state, bookmarkDropTarget);
        } else {
          moveShortcutToBookmarks(state, bookmarkDropTarget);
        }
        return;
      }
      // The empty bookmarks bar shown for the drag hides again however the
      // drag ends.
      if (state.isDragging &&
          pageState.bookmarkGrid &&
          pageState.bookmarkGrid.getAttribute('data-bookmark-empty-drop-surface') === 'true') {
        renderCurrentBookmarkPage();
      }
      if (options && options.cancel && state.hasReordered) {
        restoreShortcutDragOrder(state);
        return;
      }
      if (state.isDragging && state.hasReordered) {
        if (event && typeof event.preventDefault === 'function') {
          event.preventDefault();
        }
        persistShortcutOrder(state).then(() => {
          animateShortcutLayoutChange(renderShortcuts);
          scheduleWallpaperAdaptiveToneUpdate();
        });
        return;
      }
      if (options && options.cancel) {
        resetShortcutDockHover();
      }
    }

    // Reordering re-inserts the captured tile, which drops pointer capture, and
    // the shortcut section ignores pointer events while a drag is lifted above
    // the bookmarks, so the session listens on the document like bookmark drags.
    function attachShortcutDragDocumentListeners() {
      document.addEventListener('pointermove', handleShortcutDragPointerMove, true);
      document.addEventListener('pointerup', handleShortcutDragPointerUp, true);
      document.addEventListener('pointercancel', handleShortcutDragPointerCancel, true);
    }

    function detachShortcutDragDocumentListeners() {
      document.removeEventListener('pointermove', handleShortcutDragPointerMove, true);
      document.removeEventListener('pointerup', handleShortcutDragPointerUp, true);
      document.removeEventListener('pointercancel', handleShortcutDragPointerCancel, true);
    }

    function isShortcutDragActive() {
      return Boolean(pageState.shortcutDragState && pageState.shortcutDragState.isDragging);
    }

    function isBookmarkSurfaceDragStateActive(state) {
      return Boolean(state && state.isDragging && (state === pageState.bookmarkDragState || state === pageState.shortcutDragState));
    }

    function updateShortcutDragBookmarkTarget(state, pointerX, pointerY) {
      if (state.folderSwitchPendingId) {
        return true;
      }
      const direction = getBookmarkDragPageSwitchDirection(pointerX, pointerY);
      if (direction) {
        clearDragDropTarget(state);
        clearBookmarkDragFolderSwitch(state);
        setShortcutStackHint(state, false);
        scheduleBookmarkDragPageSwitch(state, direction);
        return true;
      }
      clearBookmarkDragPageSwitch(state);
      const overBookmarks = Boolean(getExternalBookmarkSurfacePoint(pointerX, pointerY));
      const overCascade = isBookmarkCascadeSurfaceAtPoint(pointerX, pointerY);
      const dockFolder = getShortcutFolderDropTargetAt(state, pointerX, pointerY);
      const stackTarget = overCascade || overBookmarks || dockFolder
        ? null
        : getShortcutStackTargetAt(state, pointerX, pointerY);
      const target = overCascade || overBookmarks || dockFolder
        ? getExternalBookmarkDropTarget(pointerX, pointerY, state) || dockFolder
        : stackTarget;
      setShortcutStackHint(state, Boolean(stackTarget));
      if (target && target.kind === 'blocked') {
        document.body.setAttribute('data-drag-blocked', 'true');
        clearDragDropTarget(state);
        clearBookmarkDragFolderSwitch(state);
        return true;
      }
      if (target) {
        setDragDropTarget(state, target);
        scheduleBookmarkDragFolderSwitch(state, target);
      } else {
        clearDragDropTarget(state);
        clearBookmarkDragFolderSwitch(state);
      }
      return overBookmarks || overCascade || Boolean(dockFolder) || Boolean(stackTarget);
    }

    // While the folder backdrop shows, say what releasing does.
    function setShortcutStackHint(state, visible) {
      if (!state || Boolean(state.stackHintVisible) === visible) {
        return;
      }
      state.stackHintVisible = visible;
      if (visible) {
        showToast(t('newtab_shortcuts_stack_hint', 'Release to create a folder in the bookmarks bar'), false, { duration: 0 });
      } else {
        hideToast();
      }
    }

    // The middle of another website tile stacks the dragged website onto it,
    // like folder tiles accept it; the outer quarters still reorder.
    function getShortcutStackTargetAt(state, pointerX, pointerY) {
      const source = state && getShortcutById(state.shortcutId);
      if (!source || source.type === 'folder' || !isPointOverShortcutDropSurface(pointerX, pointerY)) {
        return null;
      }
      const tile = getShortcutReorderTiles().find((candidate) => {
        if (candidate === state.tile || candidate.hasAttribute('data-bookmark-drop-folder-id')) {
          return false;
        }
        const rect = getShortcutTileLayoutRect(candidate);
        return rect && pointerX >= rect.left + rect.width * 0.25 &&
          pointerX <= rect.right - rect.width * 0.25 && pointerY >= rect.top && pointerY <= rect.bottom;
      });
      if (state.stackHeldTile) {
        if (tile === state.stackHeldTile) {
          return null;
        }
        state.stackHeldTile = null;
      }
      const target = tile ? getShortcutById(getShortcutTileId(tile)) : null;
      return target && target.type !== 'folder' && target.id !== source.id
        ? { kind: 'shortcut-stack', surface: 'shortcuts', element: tile, shortcutId: target.id }
        : null;
    }

    // A grid that re-centers slides every tile half a column under a pointer
    // that held still. A tile that lands under it is no stack target until
    // the pointer leaves it, or releasing where the drag showed a gap would
    // make a folder.
    function holdShortcutStackTargetUnderPointer(state, pointerX, pointerY) {
      state.stackHeldTile = null;
      const target = getShortcutStackTargetAt(state, pointerX, pointerY);
      state.stackHeldTile = target ? target.element : null;
    }

    function stackShortcuts(state, target) {
      const source = getShortcutById(state.shortcutId);
      const destination = getShortcutById(target.shortcutId);
      const restoreShortcut = () => {
        settleShortcutDragTile(state.tile);
        if (state.hasReordered) {
          persistShortcutOrder().then(() => {
            renderShortcuts();
            scheduleWallpaperAdaptiveToneUpdate();
          });
        }
        return false;
      };
      if (!source || !destination || source.type === 'folder' || destination.type === 'folder' ||
          pageState.bookmarkMoveHistoryBusy) {
        hideToast();
        return Promise.resolve(restoreShortcut());
      }
      // Indexes come from before the drag, so undo also reverts its reordering.
      const originalShortcuts = state.originalShortcuts || pageState.newtabShortcuts;
      const toSource = (shortcut) => ({
        snapshot: shortcut,
        index: originalShortcuts.findIndex((item) => item.id === shortcut.id),
        iconDataUrl: pageState.newtabShortcutIcons[shortcut.id]
      });
      const record = NEWTAB_BOOKMARK_MOVE_HISTORY.createShortcutStackRecord({
        snapshot: {
          title: t('newtab_shortcuts_new_folder_title', 'New folder'),
          children: [destination, source].map((shortcut) => ({ title: shortcut.title, url: shortcut.url }))
        },
        sources: [toSource(destination), toSource(source)],
        itemIcons: [destination, source].map((shortcut) => getFolderItemIconForShortcut(
          shortcut, pageState.newtabShortcutIcons[shortcut.id])),
        folderShortcut: {
          id: FOLDER_REFERENCES.createEntryId(),
          index: pageState.newtabShortcuts.filter((item) => item.id !== source.id)
            .findIndex((item) => item.id === destination.id),
          groupId: destination.groupId
        }
      });
      if (!record) {
        hideToast();
        return Promise.resolve(restoreShortcut());
      }
      pageState.bookmarkMoveHistoryBusy = true;
      queueBookmarkLayoutAnimation('');
      return applyShortcutStack(record, false).then((stacked) => {
        if (!stacked) return restoreShortcut();
        bookmarkMoveHistory.push({ ...record, bookmarkId: record.runtime.currentBookmarkId });
        showToast(formatMessage(
          'newtab_shortcuts_stacked_undo',
          'Folder created · {shortcut} to undo',
          { shortcut: getBookmarkUndoShortcutLabel() }
        ));
        return true;
      }).finally(() => {
        pageState.bookmarkMoveHistoryBusy = false;
        return refreshShortcutFolderReferences();
      });
    }

    function moveShortcutToBookmarks(state, target) {
      const shortcut = getShortcutById(state.shortcutId);
      const restoreShortcut = () => {
        settleShortcutDragTile(state.tile);
        if (state.hasReordered) {
          persistShortcutOrder().then(() => {
            renderShortcuts();
            scheduleWallpaperAdaptiveToneUpdate();
          });
        }
        return false;
      };
      if (!shortcut || pageState.bookmarkMoveHistoryBusy) {
        return Promise.resolve(restoreShortcut());
      }
      if (!isValidExternalBookmarkDropTarget(state, target)) {
        return Promise.resolve(restoreShortcut());
      }
      const isFolder = shortcut.type === 'folder';
      const node = isFolder ? bookmarksRuntime.getNode(getShortcutFolderId(shortcut)) : null;
      if (isFolder && !node) {
        return Promise.resolve(restoreShortcut());
      }
      const from = node ? { parentId: node.parentId, index: node.index } : null;
      const to = isFolder && String(node.parentId) === String(target.folderId) && target.kind !== 'insertion'
        ? from
        : {
          parentId: String(target.folderId),
          index: NEWTAB_BOOKMARK_MOVE_HISTORY.normalizeMoveDestinationIndex({
            sourceParentId: from && from.parentId,
            sourceIndex: from && from.index,
            targetParentId: target.folderId,
            targetIndex: target.kind === 'insertion'
              ? target.index : bookmarksRuntime.getFolderItems(target.folderId).length
          })
        };
      const originalShortcuts = state.originalShortcuts || pageState.newtabShortcuts;
      const record = NEWTAB_BOOKMARK_MOVE_HISTORY.createTransferRecord({
        bookmarkId: node && node.id,
        snapshot: { title: isFolder ? node.title : shortcut.title, url: isFolder ? '' : shortcut.url },
        from,
        to,
        beforeShortcut: {
          snapshot: shortcut,
          index: originalShortcuts.findIndex((item) => item.id === shortcut.id),
          iconDataUrl: pageState.newtabShortcutIcons[shortcut.id]
        }
      });
      if (!record) return Promise.resolve(restoreShortcut());
      pageState.bookmarkMoveHistoryBusy = true;
      queueBookmarkLayoutAnimation('');
      return applyBookmarkShortcutTransfer(record, false).then((moved) => {
        if (!moved) return restoreShortcut();
        bookmarkMoveHistory.push({
          ...record,
          bookmarkId: record.runtime.currentBookmarkId,
          to: record.runtime.location || record.to
        });
        if (isFolder) {
          showToast(t('newtab_shortcuts_moved_to_bookmarks', 'Moved to bookmarks'));
        }
        return true;
      }).finally(() => {
        pageState.bookmarkMoveHistoryBusy = false;
        if (pageState.newtabShortcuts.some((item) => item.type === 'folder')) return refreshShortcutFolderReferences();
      });
    }

    // Dragging a group title moves the whole group among the others. Its
    // tiles stay put while a line shows where the group will land.
    const SHORTCUT_GROUP_DRAG_START_THRESHOLD_PX = 6;
    let shortcutGroupDragState = null;

    function getShortcutGroupHeaders() {
      return pageState.shortcutGrid
        ? Array.from(pageState.shortcutGrid.querySelectorAll('.x-nt-shortcut-group-header'))
        : [];
    }

    function handleShortcutGroupDragPointerDown(event) {
      const target = event.target;
      const header = target && typeof target.closest === 'function'
        ? target.closest('.x-nt-shortcut-group-header')
        : null;
      if (!header || shortcutGroupDragState || (event.pointerType === 'mouse' && event.button !== 0) ||
          header.hasAttribute('data-shortcut-group-editing') ||
          target.closest('.x-nt-shortcut-group-more, .x-nt-shortcut-group-input') ||
          getShortcutGroupHeaders().length < 2) {
        return;
      }
      const rect = header.getBoundingClientRect();
      shortcutGroupDragState = {
        pointerId: event.pointerId,
        header,
        groupId: String(header.getAttribute('data-shortcut-group-id') || ''),
        startX: Number(event.clientX),
        startY: Number(event.clientY),
        grabOffsetX: Number(event.clientX) - rect.left,
        grabOffsetY: Number(event.clientY) - rect.top,
        isDragging: false,
        targetIndex: -1,
        ghost: null,
        line: null,
        frameId: 0
      };
      document.addEventListener('pointermove', handleShortcutGroupDragPointerMove, true);
      document.addEventListener('pointerup', handleShortcutGroupDragPointerUp, true);
      document.addEventListener('pointercancel', handleShortcutGroupDragPointerCancel, true);
      document.addEventListener('keydown', handleShortcutGroupDragKeyDown, true);
    }

    function startShortcutGroupDrag(state) {
      state.isDragging = true;
      closeShortcutContextMenu();
      hideShortcutTooltip();
      resetShortcutDockHover();
      document.body.setAttribute('data-drag-source', 'shortcut-group');
      state.header.setAttribute('data-shortcut-group-dragging', 'true');
      const rect = state.header.getBoundingClientRect();
      const ghost = state.header.cloneNode(true);
      ghost.querySelectorAll('button.x-nt-shortcut-group-more').forEach((button) => button.remove());
      ghost.classList.add('x-nt-shortcut-group-ghost');
      ghost.removeAttribute('data-shortcut-group-id');
      ghost.removeAttribute('data-shortcut-group-dragging');
      ghost.setAttribute('aria-hidden', 'true');
      ghost.style.left = `${rect.left}px`;
      ghost.style.top = `${rect.top}px`;
      const line = document.createElement('div');
      line.className = 'x-nt-shortcut-group-drop-line';
      line.setAttribute('aria-hidden', 'true');
      document.body.appendChild(ghost);
      document.body.appendChild(line);
      state.ghost = ghost;
      state.line = line;
    }

    // The group lands before the first other group whose middle is below
    // the pointer; `targetIndex` is its index among the remaining groups.
    function updateShortcutGroupDrag(state, pointerX, pointerY) {
      const left = Number.parseFloat(state.ghost.style.left) || 0;
      const top = Number.parseFloat(state.ghost.style.top) || 0;
      state.ghost.style.transform = `translate3d(${pointerX - state.grabOffsetX - left}px, ${pointerY - state.grabOffsetY - top}px, 0)`;
      if (autoScrollShortcutArea(pointerX, pointerY)) {
        scheduleShortcutGroupDragMove(state, pointerX, pointerY);
      }
      const headers = getShortcutGroupHeaders();
      const gridRect = pageState.shortcutGrid.getBoundingClientRect();
      const blocks = headers.map((header, index) => {
        const rect = header.getBoundingClientRect();
        const next = headers[index + 1];
        const bottom = next ? next.getBoundingClientRect().top : gridRect.bottom;
        return { header, top: rect.top, bottom, left: rect.left, width: rect.width };
      }).filter((block) => block.header !== state.header);
      let targetIndex = blocks.findIndex((block) => pointerY < (block.top + block.bottom) / 2);
      if (targetIndex < 0) targetIndex = blocks.length;
      state.targetIndex = targetIndex;
      const anchor = blocks[targetIndex] || blocks[blocks.length - 1];
      if (!anchor) return;
      const area = getShortcutScrollArea();
      const areaRect = area ? area.getBoundingClientRect() : null;
      let lineY = blocks[targetIndex] ? anchor.top - 4 : anchor.bottom - 4;
      if (areaRect) lineY = Math.max(areaRect.top + 2, Math.min(areaRect.bottom - 2, lineY));
      state.line.style.left = `${anchor.left}px`;
      state.line.style.width = `${Math.max(0, gridRect.right - anchor.left - 8)}px`;
      state.line.style.top = `${Math.round(lineY)}px`;
    }

    function scheduleShortcutGroupDragMove(state, pointerX, pointerY) {
      state.pendingX = pointerX;
      state.pendingY = pointerY;
      if (state.frameId) return;
      state.frameId = window.requestAnimationFrame(() => {
        state.frameId = 0;
        if (state === shortcutGroupDragState && state.isDragging) {
          updateShortcutGroupDrag(state, state.pendingX, state.pendingY);
        }
      });
    }

    function handleShortcutGroupDragPointerMove(event) {
      const state = shortcutGroupDragState;
      if (!state || event.pointerId !== state.pointerId) return;
      const pointerX = Number(event.clientX);
      const pointerY = Number(event.clientY);
      if (!state.isDragging) {
        if (Math.hypot(pointerX - state.startX, pointerY - state.startY) < SHORTCUT_GROUP_DRAG_START_THRESHOLD_PX) return;
        startShortcutGroupDrag(state);
      }
      event.preventDefault();
      scheduleShortcutGroupDragMove(state, pointerX, pointerY);
    }

    function finishShortcutGroupDrag(commit) {
      const state = shortcutGroupDragState;
      if (!state) return;
      shortcutGroupDragState = null;
      document.removeEventListener('pointermove', handleShortcutGroupDragPointerMove, true);
      document.removeEventListener('pointerup', handleShortcutGroupDragPointerUp, true);
      document.removeEventListener('pointercancel', handleShortcutGroupDragPointerCancel, true);
      document.removeEventListener('keydown', handleShortcutGroupDragKeyDown, true);
      if (state.frameId) window.cancelAnimationFrame(state.frameId);
      if (!state.isDragging) return;
      if (state.ghost) state.ghost.remove();
      if (state.line) state.line.remove();
      state.header.removeAttribute('data-shortcut-group-dragging');
      document.body.removeAttribute('data-drag-source');
      // The release would otherwise click the untitled group's title.
      const suppressClick = (clickEvent) => {
        clickEvent.preventDefault();
        clickEvent.stopPropagation();
      };
      document.addEventListener('click', suppressClick, true);
      window.setTimeout(() => document.removeEventListener('click', suppressClick, true), 0);
      if (commit && state.targetIndex >= 0) {
        moveShortcutGroupToIndex(state.groupId, state.targetIndex);
      }
    }

    function handleShortcutGroupDragPointerUp(event) {
      if (shortcutGroupDragState && event.pointerId === shortcutGroupDragState.pointerId) {
        finishShortcutGroupDrag(true);
      }
    }

    function handleShortcutGroupDragPointerCancel(event) {
      if (shortcutGroupDragState && event.pointerId === shortcutGroupDragState.pointerId) {
        finishShortcutGroupDrag(false);
      }
    }

    function handleShortcutGroupDragKeyDown(event) {
      if (event.key === 'Escape' && shortcutGroupDragState && shortcutGroupDragState.isDragging) {
        event.preventDefault();
        event.stopPropagation();
        finishShortcutGroupDrag(false);
      }
    }

    function handleShortcutDragPointerDown(event) {
      if (pageState.bookmarkMoveHistoryBusy || isShortcutContextMenuNode(event.target)) {
        return;
      }
      const tile = getShortcutTileFromNode(event.target);
      if (!tile) {
        handleShortcutGroupDragPointerDown(event);
        return;
      }
      const shortcutId = getShortcutTileId(tile);
      if (!tile || !shortcutId || (event.pointerType === 'mouse' && event.button !== 0)) {
        return;
      }
      closeShortcutContextMenu();
      pageState.shortcutDragState = {
        pointerId: event.pointerId,
        tile,
        shortcutId,
        originalShortcuts: pageState.newtabShortcuts.slice(),
        bookmarkId: getShortcutFolderId(getShortcutById(shortcutId)),
        pageSwitchTimerId: 0,
        folderSwitchTimerId: 0,
        folderSwitchPendingId: '',
        startX: Number(event.clientX),
        startY: Number(event.clientY),
        grabOffsetX: 0,
        grabOffsetY: 0,
        translateX: 0,
        translateY: 0,
        pendingPointerX: Number(event.clientX),
        pendingPointerY: Number(event.clientY),
        moveFrameId: 0,
        dropTarget: null,
        isDragging: false,
        hasReordered: false
      };
      if (typeof tile.getBoundingClientRect === 'function') {
        const rect = tile.getBoundingClientRect();
        pageState.shortcutDragState.grabOffsetX = Number(event.clientX) - rect.left;
        pageState.shortcutDragState.grabOffsetY = Number(event.clientY) - rect.top;
      }
      attachShortcutDragDocumentListeners();
      if (typeof tile.setPointerCapture === 'function') {
        try {
          tile.setPointerCapture(event.pointerId);
        } catch (error) {
          // Pointer capture can fail if the browser already canceled the pointer.
        }
      }
    }

    function handleShortcutDragPointerMove(event) {
      if (!pageState.shortcutDragState || pageState.shortcutDragState.pointerId !== event.pointerId) {
        return;
      }
      const pointerX = Number(event.clientX);
      const pointerY = Number(event.clientY);
      if (!Number.isFinite(pointerX) || !Number.isFinite(pointerY)) {
        return;
      }
      const dx = pointerX - pageState.shortcutDragState.startX;
      const dy = pointerY - pageState.shortcutDragState.startY;
      if (!pageState.shortcutDragState.isDragging &&
          Math.hypot(dx, dy) < SHORTCUT_DRAG_START_THRESHOLD_PX) {
        return;
      }
      if (!pageState.shortcutDragState.isDragging) {
        startShortcutDrag(event, pageState.shortcutDragState.tile);
      }
      if (!pageState.shortcutDragState.isDragging) {
        return;
      }
      event.preventDefault();
      scheduleShortcutDragMove(pageState.shortcutDragState, pointerX, pointerY);
    }

    function handleShortcutDragPointerUp(event) {
      finishShortcutDrag(event);
    }

    function handleShortcutDragPointerCancel(event) {
      finishShortcutDrag(event, { cancel: true });
    }

    return {
      getShortcutTileLayoutRect,
      setShortcutDragTileTransform,
      getShortcutInsertionSlotAt,
      autoScrollShortcutArea,
      animateShortcutLayoutChange,
      scheduleShortcutDragMove,
      suppressCanceledDragClick,
      finishShortcutDrag,
      isShortcutDragActive,
      isBookmarkSurfaceDragStateActive,
      handleShortcutDragPointerDown
    };
  }

  root.LumnoNewtabShortcutDrag = { createShortcutDrag };
})(globalThis);
