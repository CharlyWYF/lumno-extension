(function(root) {
  // Dragging a recent-site card onto the shortcuts or the bookmarks. The card
  // stays where it is: a copy of it lifts off and shrinks into a small site
  // icon that follows the pointer, and lands as a new shortcut or bookmark.
  function createRecentCardDrag(deps) {
    const {
      NEWTAB_SHORTCUTS_STORE,
      NEWTAB_CROSS_SURFACE_DRAG,
      NEWTAB_BOOKMARK_MOVE_HISTORY,
      getShortcutStoreOptions,
      getShortcutFolderId,
      MAX_NEWTAB_SHORTCUTS,
      persistShortcuts,
      bookmarkMoveHistory,
      bookmarksRuntime,
      isBookmarkTopbarMode,
      isBookmarkCascadeSurfaceAtPoint,
      getExternalBookmarkSurfacePoint,
      getExternalBookmarkDropTarget,
      getShortcutFolderDropTargetAt,
      getShortcutInsertionDropTarget,
      isPointOverShortcutDropSurface,
      isValidExternalBookmarkDropTarget,
      autoScrollShortcutArea,
      setDragDropTarget,
      clearDragDropTarget,
      getBookmarkDragPageSwitchDirection,
      scheduleBookmarkDragPageSwitch,
      clearBookmarkDragPageSwitch,
      scheduleBookmarkDragFolderSwitch,
      clearBookmarkDragFolderSwitch,
      applyBookmarkShortcutTransfer,
      queueBookmarkLayoutAnimation,
      isEmptyBookmarkRootHidden,
      renderCurrentBookmarkPage,
      closeBookmarkCascadeMenu,
      closeRecentContextMenu,
      hideCursorTooltip,
      hideTopActionTooltip,
      resetShortcutDockHover,
      scheduleWallpaperAdaptiveToneUpdate,
      showToast,
      t,
      formatMessage,
      getRiSvg
    } = deps;

    // The page state object shared with newtab.js and the other modules.
    const pageState = deps.pageState;

    const RECENT_DRAG_START_THRESHOLD_PX = 10;
    // The icon the card shrinks into, the size of a shortcut icon plus a rim.
    const GHOST_ICON_SIZE_PX = 52;
    const GHOST_ICON_RADIUS_PX = 17;
    const GHOST_LIFT_MS = 320;
    const GHOST_RETURN_MS = 260;
    const GHOST_LAND_MS = 180;
    const GHOST_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
    const GHOST_SHADOW = '0 12px 28px rgba(15, 23, 42, 0.22), 0 2px 6px rgba(15, 23, 42, 0.12)';
    const GHOST_REST_SHADOW = '0 0 0 rgba(15, 23, 42, 0), 0 0 0 rgba(15, 23, 42, 0)';

    let dragState = null;

    function isRecentCardDragActive() {
      return Boolean(dragState && dragState.isDragging);
    }

    function isRecentCardDragState(state) {
      return Boolean(state && state === dragState && state.isDragging);
    }

    function isMotionReduced() {
      const rootElement = document.documentElement;
      if (rootElement && rootElement.getAttribute('data-lumno-motion-effects') === 'off') {
        return true;
      }
      return Boolean(typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    function animate(element, keyframes, duration) {
      if (!element || typeof element.animate !== 'function' || isMotionReduced()) {
        return null;
      }
      return element.animate(keyframes, { duration, easing: GHOST_EASING, fill: 'both' });
    }

    function whenFinished(animations, callback) {
      const running = animations.filter(Boolean);
      if (!running.length) {
        callback();
        return;
      }
      let done = false;
      const finish = () => {
        if (!done) {
          done = true;
          callback();
        }
      };
      Promise.all(running.map((animation) => animation.finished)).then(finish, finish);
    }

    // The site icon shown in the card header: its favicon, or the fallback
    // icon that stands in for one that did not (or not yet) load. CSS hides
    // a favicon image that is not ready, so ask what is actually shown.
    function cloneCardFavicon(card) {
      const isShown = (node) => Boolean(node && window.getComputedStyle(node).display !== 'none');
      const image = card.querySelector('.x-nt-recent-favicon');
      const fallback = card.querySelector('.x-nt-recent-header ._x_extension_favicon_fallback_2024_unique_');
      let icon = null;
      if (isShown(image) && image.complete && image.naturalWidth > 0) {
        icon = image.cloneNode(true);
        icon.removeAttribute('loading');
      } else if (isShown(fallback)) {
        icon = fallback.cloneNode(true);
      } else {
        icon = document.createElement('span');
        icon.className = 'x-nt-favicon-fallback';
        icon.innerHTML = getRiSvg('ri-link', 'ri-size-16');
      }
      icon.removeAttribute('id');
      icon.setAttribute('data-visible', 'true');
      icon.classList.add('x-nt-recent-drag-ghost-favicon');
      return icon;
    }

    // A frozen copy of the card as it looks under the pointer. It keeps the
    // card's theme, which comes from custom properties on the card and its
    // dock, and shows the card's hover look like an open context menu does.
    function createCardSnapshot(card, rect) {
      const shell = document.createElement('div');
      shell.className = String(card.className || '').replace(/\bx-nt-recent-card--rollback\b/g, '').trim();
      shell.setAttribute('data-recent-context-menu-open', 'true');
      const computed = window.getComputedStyle(card);
      for (let index = 0; index < computed.length; index += 1) {
        const name = computed[index];
        if (name.startsWith('--')) {
          shell.style.setProperty(name, computed.getPropertyValue(name));
        }
      }
      const visual = card.querySelector('.x-nt-recent-card-visual');
      if (visual) {
        shell.appendChild(visual.cloneNode(true));
      }
      shell.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
      shell.classList.add('x-nt-recent-drag-ghost-snapshot');
      shell.style.width = `${rect.width}px`;
      shell.style.height = `${rect.height}px`;
      return shell;
    }

    function readCardColors(card) {
      const visual = card.querySelector('.x-nt-recent-card-visual');
      const inner = card.querySelector('.x-nt-recent-inner');
      const visualStyle = visual ? window.getComputedStyle(visual) : null;
      const innerStyle = inner ? window.getComputedStyle(inner) : null;
      return {
        rim: visualStyle ? visualStyle.backgroundColor : 'rgba(241, 245, 249, 0.96)',
        face: innerStyle ? innerStyle.backgroundColor : '#ffffff',
        border: visualStyle ? visualStyle.borderTopColor : 'rgba(0, 0, 0, 0.1)',
        radius: visualStyle ? Number.parseFloat(visualStyle.borderTopLeftRadius) || 28 : 28
      };
    }

    function getCardFrame(state, pointerX, pointerY) {
      const rect = state.card.getBoundingClientRect();
      return {
        left: `${rect.left - pointerX}px`,
        top: `${rect.top - pointerY}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        borderRadius: `${state.ghostColors.radius}px`,
        backgroundColor: 'rgba(0, 0, 0, 0)',
        borderColor: 'rgba(0, 0, 0, 0)',
        boxShadow: GHOST_REST_SHADOW
      };
    }

    function getIconFrame(state) {
      const half = GHOST_ICON_SIZE_PX / 2;
      return {
        left: `${-half}px`,
        top: `${-half}px`,
        width: `${GHOST_ICON_SIZE_PX}px`,
        height: `${GHOST_ICON_SIZE_PX}px`,
        borderRadius: `${GHOST_ICON_RADIUS_PX}px`,
        backgroundColor: state.ghostColors.rim,
        borderColor: state.ghostColors.border,
        boxShadow: GHOST_SHADOW
      };
    }

    function readCurrentFrame(element) {
      const style = window.getComputedStyle(element);
      return {
        left: style.left,
        top: style.top,
        width: style.width,
        height: style.height,
        borderRadius: style.borderTopLeftRadius,
        backgroundColor: style.backgroundColor,
        borderColor: style.borderTopColor,
        boxShadow: style.boxShadow
      };
    }

    function moveGhost(state, pointerX, pointerY) {
      if (state.ghost) {
        state.ghost.style.transform = `translate3d(${pointerX}px, ${pointerY}px, 0)`;
      }
    }

    // The ghost sits on the pointer. Its body starts as the card's frame,
    // measured from the pointer, and closes in on the pointer as it shrinks,
    // while the card copy fades out and the site icon fades in.
    function liftGhost(state, pointerX, pointerY) {
      const card = state.card;
      const rect = card.getBoundingClientRect();
      state.ghostColors = readCardColors(card);
      const ghost = document.createElement('div');
      ghost.className = 'x-nt-recent-drag-ghost';
      ghost.setAttribute('aria-hidden', 'true');
      const body = document.createElement('div');
      body.className = 'x-nt-recent-drag-ghost-body';
      const snapshot = createCardSnapshot(card, rect);
      const face = document.createElement('div');
      face.className = 'x-nt-recent-drag-ghost-icon';
      face.style.backgroundColor = state.ghostColors.face;
      face.appendChild(cloneCardFavicon(card));
      body.appendChild(snapshot);
      body.appendChild(face);
      ghost.appendChild(body);
      document.body.appendChild(ghost);
      state.ghost = ghost;
      state.ghostBody = body;
      state.ghostSnapshot = snapshot;
      state.ghostFace = face;
      moveGhost(state, pointerX, pointerY);
      const iconFrame = getIconFrame(state);
      Object.assign(body.style, iconFrame);
      snapshot.style.opacity = '0';
      snapshot.style.transform = `scale(${GHOST_ICON_SIZE_PX / Math.max(1, rect.width)})`;
      animate(body, [getCardFrame(state, pointerX, pointerY), iconFrame], GHOST_LIFT_MS);
      animate(snapshot, [
        { opacity: 1, transform: 'scale(1)' },
        { opacity: 0, offset: 0.55 },
        { opacity: 0, transform: snapshot.style.transform }
      ], GHOST_LIFT_MS);
      animate(face, [
        { opacity: 0, transform: 'scale(0.6)' },
        { opacity: 0, transform: 'scale(0.6)', offset: 0.25 },
        { opacity: 1, transform: 'scale(1)' }
      ], GHOST_LIFT_MS);
    }

    function removeGhost(state) {
      if (state.ghost) {
        state.ghost.remove();
      }
      state.ghost = null;
      state.ghostBody = null;
      state.ghostSnapshot = null;
      state.ghostFace = null;
    }

    function cancelGhostAnimations(state) {
      [state.ghostBody, state.ghostSnapshot, state.ghostFace].forEach((element) => {
        if (element && typeof element.getAnimations === 'function') {
          element.getAnimations().forEach((animation) => animation.cancel());
        }
      });
    }

    // Nothing took the drop: the icon grows back into the card it left.
    function returnGhost(state, pointerX, pointerY, done) {
      const { ghostBody: body, ghostSnapshot: snapshot, ghostFace: face } = state;
      if (!body || !state.card.isConnected) {
        done();
        return;
      }
      const from = readCurrentFrame(body);
      const snapshotStyle = window.getComputedStyle(snapshot);
      const faceStyle = window.getComputedStyle(face);
      const snapshotFrom = { opacity: snapshotStyle.opacity, transform: snapshotStyle.transform };
      const faceFrom = { opacity: faceStyle.opacity, transform: faceStyle.transform };
      cancelGhostAnimations(state);
      const to = getCardFrame(state, pointerX, pointerY);
      Object.assign(body.style, to);
      snapshot.style.opacity = '1';
      snapshot.style.transform = 'scale(1)';
      face.style.opacity = '0';
      whenFinished([
        animate(body, [from, to], GHOST_RETURN_MS),
        animate(snapshot, [snapshotFrom, { opacity: 1, offset: 0.6 }, { opacity: 1, transform: 'scale(1)' }], GHOST_RETURN_MS),
        animate(face, [faceFrom, { opacity: 0, transform: 'scale(0.6)', offset: 0.5 }, { opacity: 0, transform: 'scale(0.6)' }], GHOST_RETURN_MS)
      ], done);
    }

    // The drop took: the icon sinks into its new place.
    function landGhost(state, done) {
      const body = state.ghostBody;
      if (!body) {
        done();
        return;
      }
      const from = readCurrentFrame(body);
      cancelGhostAnimations(state);
      Object.assign(body.style, from);
      state.ghostSnapshot.style.opacity = '0';
      body.style.opacity = '0';
      body.style.transform = 'scale(0.5)';
      whenFinished([
        animate(body, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.5)' }], GHOST_LAND_MS)
      ], done);
    }

    function getSiteRecord(state) {
      return NEWTAB_SHORTCUTS_STORE.createShortcutRecord({
        title: state.site.title,
        url: state.site.url
      }, getShortcutStoreOptions());
    }

    function updateDropTarget(state, pointerX, pointerY) {
      if (state.folderSwitchPendingId) {
        clearDragDropTarget(state);
        return;
      }
      const direction = getBookmarkDragPageSwitchDirection(pointerX, pointerY);
      if (direction) {
        clearDragDropTarget(state);
        clearBookmarkDragFolderSwitch(state);
        scheduleBookmarkDragPageSwitch(state, direction);
        return;
      }
      clearBookmarkDragPageSwitch(state);
      const overBookmarks = Boolean(getExternalBookmarkSurfacePoint(pointerX, pointerY));
      const overCascade = isBookmarkCascadeSurfaceAtPoint(pointerX, pointerY);
      const shortcutFolder = getShortcutFolderDropTargetAt(state, pointerX, pointerY);
      let target = null;
      if (overBookmarks || overCascade || shortcutFolder) {
        target = getExternalBookmarkDropTarget(pointerX, pointerY, state) || shortcutFolder;
      } else if (isPointOverShortcutDropSurface(pointerX, pointerY)) {
        target = getShortcutInsertionDropTarget(state.record, pointerX, pointerY);
        if (!target) {
          clearDragDropTarget(state);
          clearBookmarkDragFolderSwitch(state);
          return;
        }
      }
      if (target && target.kind === 'blocked') {
        document.body.setAttribute('data-drag-blocked', 'true');
        clearDragDropTarget(state);
        clearBookmarkDragFolderSwitch(state);
        return;
      }
      if (target) {
        setDragDropTarget(state, target);
        scheduleBookmarkDragFolderSwitch(state, target);
      } else {
        clearDragDropTarget(state);
        clearBookmarkDragFolderSwitch(state);
      }
    }

    function processRecentCardDragMove(state) {
      if (!state || state !== dragState || !state.isDragging) {
        return;
      }
      state.moveFrameId = 0;
      const pointerX = Number(state.pendingPointerX);
      const pointerY = Number(state.pendingPointerY);
      if (!Number.isFinite(pointerX) || !Number.isFinite(pointerY)) {
        return;
      }
      moveGhost(state, pointerX, pointerY);
      document.body.removeAttribute('data-drag-blocked');
      const topbarPoint = isBookmarkTopbarMode() && !isBookmarkCascadeSurfaceAtPoint(pointerX, pointerY)
        ? getExternalBookmarkSurfacePoint(pointerX, pointerY) : null;
      if (topbarPoint && pageState.bookmarkTopbarRuntime.autoScroll(topbarPoint.x, topbarPoint.y)) {
        scheduleRecentCardDragMove(state, pointerX, pointerY);
      }
      if (isPointOverShortcutDropSurface(pointerX, pointerY) && autoScrollShortcutArea(pointerX, pointerY)) {
        scheduleRecentCardDragMove(state, pointerX, pointerY);
      }
      updateDropTarget(state, pointerX, pointerY);
    }

    function scheduleRecentCardDragMove(state, pointerX, pointerY) {
      if (!state || !state.isDragging) {
        return;
      }
      state.pendingPointerX = pointerX;
      state.pendingPointerY = pointerY;
      if (state.moveFrameId) {
        return;
      }
      state.moveFrameId = window.requestAnimationFrame(() => {
        processRecentCardDragMove(state);
      });
    }

    function startRecentCardDrag(state, pointerX, pointerY) {
      state.isDragging = true;
      hideCursorTooltip();
      hideTopActionTooltip();
      closeRecentContextMenu();
      closeBookmarkCascadeMenu();
      resetShortcutDockHover();
      document.body.setAttribute('data-drag-source', 'recent');
      if (isEmptyBookmarkRootHidden()) {
        renderCurrentBookmarkPage();
      }
      const selection = typeof window.getSelection === 'function' ? window.getSelection() : null;
      if (selection && typeof selection.removeAllRanges === 'function') {
        selection.removeAllRanges();
      }
      state.card.setAttribute('data-recent-dragging', 'true');
      state.card.setAttribute('aria-grabbed', 'true');
      liftGhost(state, pointerX, pointerY);
    }

    function addSiteToShortcuts(state, target) {
      const shortcuts = pageState.newtabShortcuts;
      const plan = NEWTAB_CROSS_SURFACE_DRAG.planBookmarkToShortcut({
        shortcuts,
        record: target.record,
        index: target.index,
        groupId: target.groupId,
        getFolderId: getShortcutFolderId,
        maxShortcuts: MAX_NEWTAB_SHORTCUTS
      });
      if (!plan) {
        return Promise.resolve(false);
      }
      // A site already among the shortcuts moves to the drop instead.
      const record = shortcuts.some((item) => item.id === plan.shortcutId)
        ? NEWTAB_BOOKMARK_MOVE_HISTORY.createShortcutReorderRecord({
          fromOrder: shortcuts.map((item) => item.id),
          toOrder: plan.shortcuts.map((item) => item.id),
          fromGroups: shortcuts.map((item) => item.groupId || ''),
          toGroups: plan.shortcuts.map((item) => item.groupId || '')
        })
        : NEWTAB_BOOKMARK_MOVE_HISTORY.createShortcutAddRecord({
          snapshot: plan.shortcuts.find((item) => item.id === plan.shortcutId),
          index: plan.shortcuts.findIndex((item) => item.id === plan.shortcutId)
        });
      pageState.bookmarkMoveHistoryBusy = true;
      return persistShortcuts(plan.shortcuts, '', undefined, {
        syncOverflowShortcutId: plan.shortcutId,
        animateLayout: true
      }).then((saved) => {
        if (saved && record) {
          bookmarkMoveHistory.push(record);
        }
        if (saved) {
          scheduleWallpaperAdaptiveToneUpdate();
        }
        return Boolean(saved);
      }).finally(() => {
        pageState.bookmarkMoveHistoryBusy = false;
      });
    }

    function addSiteToBookmarks(state, target) {
      if (!isValidExternalBookmarkDropTarget(state, target)) {
        return Promise.resolve(false);
      }
      const folderId = String(target.folderId);
      const record = NEWTAB_BOOKMARK_MOVE_HISTORY.createTransferRecord({
        snapshot: { title: state.site.title || state.record.title, url: state.record.url },
        from: null,
        to: {
          parentId: folderId,
          index: target.kind === 'insertion'
            ? Number(target.index) || 0
            : bookmarksRuntime.getFolderItems(folderId).length
        }
      });
      if (!record) {
        return Promise.resolve(false);
      }
      const folder = bookmarksRuntime.getNode(folderId);
      pageState.bookmarkMoveHistoryBusy = true;
      queueBookmarkLayoutAnimation('');
      return applyBookmarkShortcutTransfer(record, false).then((added) => {
        if (!added) {
          return false;
        }
        bookmarkMoveHistory.push({
          ...record,
          bookmarkId: record.runtime.currentBookmarkId,
          to: record.runtime.location || record.to
        });
        // A drop on a folder lands out of sight, so say where it went.
        if (target.kind !== 'insertion') {
          showToast(formatMessage('newtab_recent_added_to_folder', 'Added to “{folder}”', {
            folder: String(target.title || (folder && folder.title) || t('bookmarks_title', 'Bookmarks'))
          }));
        }
        return true;
      }).finally(() => {
        pageState.bookmarkMoveHistoryBusy = false;
      });
    }

    function dropSite(state, target) {
      if (pageState.bookmarkMoveHistoryBusy) {
        return Promise.resolve(false);
      }
      return target.surface === 'shortcuts'
        ? addSiteToShortcuts(state, target)
        : addSiteToBookmarks(state, target);
    }

    function attachDocumentListeners() {
      document.addEventListener('pointermove', handleRecentCardDragPointerMove, true);
      document.addEventListener('pointerup', handleRecentCardDragPointerUp, true);
      document.addEventListener('pointercancel', handleRecentCardDragPointerCancel, true);
      document.addEventListener('selectstart', handleRecentCardDragSelectStart, true);
    }

    function detachDocumentListeners() {
      document.removeEventListener('pointermove', handleRecentCardDragPointerMove, true);
      document.removeEventListener('pointerup', handleRecentCardDragPointerUp, true);
      document.removeEventListener('pointercancel', handleRecentCardDragPointerCancel, true);
      document.removeEventListener('selectstart', handleRecentCardDragSelectStart, true);
    }

    // A press that may become a drag must not start selecting the card text.
    function handleRecentCardDragSelectStart(event) {
      if (dragState) {
        event.preventDefault();
      }
    }

    function restoreCard(state) {
      state.card.removeAttribute('data-recent-dragging');
      state.card.removeAttribute('aria-grabbed');
    }

    function finishRecentCardDrag(event, options) {
      const state = dragState;
      if (!state || (event && state.pointerId !== event.pointerId)) {
        return;
      }
      detachDocumentListeners();
      if (!state.isDragging) {
        dragState = null;
        return;
      }
      if (event && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
        state.pendingPointerX = event.clientX;
        state.pendingPointerY = event.clientY;
      }
      if (state.moveFrameId) {
        // Settle the target under the release point before reading it.
        window.cancelAnimationFrame(state.moveFrameId);
        processRecentCardDragMove(state);
      }
      dragState = null;
      const canceled = Boolean(options && options.cancel);
      const dropTarget = canceled ? null : state.dropTarget;
      clearBookmarkDragPageSwitch(state);
      clearBookmarkDragFolderSwitch(state);
      clearDragDropTarget(state);
      state.isDragging = false;
      state.folderSwitchPendingId = '';
      document.body.removeAttribute('data-drag-source');
      document.body.removeAttribute('data-drag-blocked');
      closeBookmarkCascadeMenu();
      // The press ends in a click on the card; it must not open the site.
      root.LumnoNewtabDragClickGuard.getDragClickGuard().armAfterDrag(event, state.pointerId);
      if (event && typeof event.preventDefault === 'function' && dropTarget) {
        event.preventDefault();
      }
      const pointerX = Number(state.pendingPointerX);
      const pointerY = Number(state.pendingPointerY);
      const returnToCard = () => returnGhost(state, pointerX, pointerY, () => {
        removeGhost(state);
        restoreCard(state);
      });
      if (!dropTarget) {
        // The empty bookmarks bar shown for the drag hides again.
        if (pageState.bookmarkGrid &&
            pageState.bookmarkGrid.getAttribute('data-bookmark-empty-drop-surface') === 'true') {
          renderCurrentBookmarkPage();
        }
        returnToCard();
        return;
      }
      restoreCard(state);
      landGhost(state, () => removeGhost(state));
      dropSite(state, dropTarget).then((dropped) => {
        if (!dropped && dropTarget.surface === 'shortcuts' &&
            pageState.newtabShortcuts.length >= MAX_NEWTAB_SHORTCUTS) {
          showToast(formatMessage(
            'newtab_shortcuts_limit_reached',
            'You can add up to {count} shortcuts.',
            { count: MAX_NEWTAB_SHORTCUTS }
          ), true);
        }
      }).catch((error) => {
        console.warn('[Lumno] Failed to add a recent site', error);
        showToast(t('toast_error', 'Operation failed. Please try again.'), true);
      });
    }

    // Called by a recent card on a primary press. The press opens the site
    // on release unless it moves far enough to start a drag.
    function handleRecentCardPointerDown(payload) {
      const event = payload && payload.event;
      const card = payload && payload.element;
      const item = payload && payload.item;
      if (!event || !card || !item || dragState || pageState.bookmarkMoveHistoryBusy ||
          pageState.bookmarkDragState || pageState.shortcutDragState ||
          (event.pointerType === 'mouse' && event.button !== 0)) {
        return;
      }
      const site = { title: String(item.title || ''), url: String(item.url || '') };
      const state = {
        pointerId: event.pointerId,
        card,
        site,
        record: null,
        startX: Number(event.clientX),
        startY: Number(event.clientY),
        pendingPointerX: Number(event.clientX),
        pendingPointerY: Number(event.clientY),
        moveFrameId: 0,
        pageSwitchTimerId: 0,
        folderSwitchTimerId: 0,
        folderSwitchPendingId: '',
        dropTarget: null,
        isDragging: false,
        ghost: null
      };
      state.record = getSiteRecord(state);
      if (!state.record) {
        return;
      }
      dragState = state;
      attachDocumentListeners();
    }

    function handleRecentCardDragPointerMove(event) {
      const state = dragState;
      if (!state || state.pointerId !== event.pointerId) {
        return;
      }
      const pointerX = Number(event.clientX);
      const pointerY = Number(event.clientY);
      if (!Number.isFinite(pointerX) || !Number.isFinite(pointerY)) {
        return;
      }
      if (!state.isDragging) {
        if (Math.hypot(pointerX - state.startX, pointerY - state.startY) < RECENT_DRAG_START_THRESHOLD_PX) {
          return;
        }
        startRecentCardDrag(state, pointerX, pointerY);
      }
      event.preventDefault();
      scheduleRecentCardDragMove(state, pointerX, pointerY);
    }

    function handleRecentCardDragPointerUp(event) {
      finishRecentCardDrag(event);
    }

    function handleRecentCardDragPointerCancel(event) {
      finishRecentCardDrag(event, { cancel: true });
    }

    // A drag that switched the bookmark folder resumes once it shows.
    function resumeRecentCardDragAfterFolderSwitch(folderId) {
      const state = dragState;
      if (state && state.isDragging && state.folderSwitchPendingId &&
          state.folderSwitchPendingId === String(folderId || '')) {
        state.folderSwitchPendingId = '';
        scheduleRecentCardDragMove(state, state.pendingPointerX, state.pendingPointerY);
      }
    }

    return {
      handleRecentCardPointerDown,
      finishRecentCardDrag,
      isRecentCardDragActive,
      isRecentCardDragState,
      hasRecentCardDragSession: () => Boolean(dragState),
      resumeRecentCardDragAfterFolderSwitch
    };
  }

  root.LumnoNewtabRecentCardDrag = { createRecentCardDrag };
})(globalThis);
