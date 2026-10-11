(function(root) {
  // Dock-style magnification and hover state for the shortcut row.
  function createShortcutDock(deps) {
    const {
      isShortcutDragActive,
      isBookmarkDragActive,
      isShortcutContextMenuOpen,
      applyShortcutContextMenuDockHover,
      clearShortcutContextMenuTileActive,
      getShortcutTileFromNode
    } = deps;

    // Page state still owned by newtab.js; read and written through accessors.
    const pageState = deps.pageState;

    let shortcutDockPointerFrame = 0;
    let shortcutDockPendingTile = null;
    // Folder tile whose menu is open; it keeps its hover look like a pressed dock item.
    let shortcutDockFolderMenuTile = null;

    function getShortcutDockPointerX(event) {
      const value = Number(event && event.clientX);
      return Number.isFinite(value) ? value : null;
    }

    function getShortcutDockIcon(tile) {
      return tile && typeof tile.querySelector === 'function'
        ? tile.querySelector('.x-nt-shortcut-icon')
        : null;
    }

    function resetShortcutDockTile(tile) {
      if (!tile) {
        return;
      }
      tile.removeAttribute('data-dock-distance');
      tile.removeAttribute('data-dock-side');
      const icon = getShortcutDockIcon(tile);
      if (!icon || !icon.style || typeof icon.style.removeProperty !== 'function') {
        return;
      }
      icon.style.removeProperty('--x-nt-shortcut-dock-scale');
      icon.style.removeProperty('--x-nt-shortcut-dock-shift-x');
      icon.style.removeProperty('--x-nt-shortcut-dock-rise');
    }

    function clearShortcutDockMagnificationState() {
      if (!pageState.shortcutGrid) {
        return;
      }
      pageState.shortcutGrid.removeAttribute('data-dock-active');
      Array.from(pageState.shortcutGrid.querySelectorAll('.x-nt-shortcut-tile')).forEach((tile) => {
        resetShortcutDockTile(tile);
      });
    }

    function applyNewtabShortcutDockMagnification() {
      if (!pageState.shortcutGrid) {
        return;
      }
      pageState.shortcutGrid.setAttribute(
        'data-dock-magnification',
        pageState.newtabShortcutDockMagnificationEnabled ? 'true' : 'false'
      );
      if (!pageState.newtabShortcutDockMagnificationEnabled) {
        clearShortcutDockMagnificationState();
      }
    }

    function getShortcutDockInfluence(pointerX, icon) {
      if (!icon || typeof icon.getBoundingClientRect !== 'function' || !Number.isFinite(pointerX)) {
        return null;
      }
      const rect = icon.getBoundingClientRect();
      const iconWidth = Math.max(1, rect.width || rect.height || 48);
      const centerX = rect.left + ((rect.width || iconWidth) / 2);
      const distancePx = Math.abs(pointerX - centerX);
      const influenceRadius = Math.max(144, iconWidth * 4);
      const raw = Math.max(0, 1 - (distancePx / influenceRadius));
      const eased = raw * raw * (3 - (2 * raw));
      return {
        eased,
        side: centerX < pointerX ? 'before' : centerX > pointerX ? 'after' : 'active'
      };
    }

    function applyShortcutDockPointerStyles(tile, pointerX, offset, measurement) {
      const prepared = measurement && typeof measurement === 'object' ? measurement : null;
      const icon = prepared ? prepared.icon : getShortcutDockIcon(tile);
      const influence = prepared ? prepared.influence : getShortcutDockInfluence(pointerX, icon);
      if (!icon || !influence || !icon.style || typeof icon.style.setProperty !== 'function') {
        return;
      }
      const eased = Math.max(0, Math.min(1, influence.eased));
      if (eased <= 0.015) {
        icon.style.removeProperty('--x-nt-shortcut-dock-scale');
        icon.style.removeProperty('--x-nt-shortcut-dock-shift-x');
        icon.style.removeProperty('--x-nt-shortcut-dock-rise');
        return;
      }
      const numericOffset = Number(offset);
      const sideMultiplier = numericOffset < 0 ? -1 : numericOffset > 0 ? 1 : 0;
      const distanceFalloff = sideMultiplier === 0
        ? 0
        : 1 / Math.max(1, Math.abs(numericOffset));
      const landingTaper = Math.max(0, 1 - eased);
      const shiftPx = sideMultiplier * 16 * eased * landingTaper * distanceFalloff;
      icon.style.setProperty('--x-nt-shortcut-dock-scale', (1 + (0.28 * eased)).toFixed(3));
      icon.style.setProperty('--x-nt-shortcut-dock-shift-x', `${Math.round(shiftPx)}px`);
      icon.style.setProperty('--x-nt-shortcut-dock-rise', `${Math.round(-6 * eased)}px`);
    }

    function cancelShortcutDockPointerFrame() {
      if (shortcutDockPointerFrame) {
        window.cancelAnimationFrame(shortcutDockPointerFrame);
        shortcutDockPointerFrame = 0;
      }
      shortcutDockPendingTile = null;
      pageState.shortcutDockPendingPointerX = Number.NaN;
    }

    function scheduleShortcutDockPointerStyles(tile, pointerX) {
      shortcutDockPendingTile = tile || null;
      pageState.shortcutDockPendingPointerX = Number(pointerX);
      if (shortcutDockPointerFrame) {
        return;
      }
      shortcutDockPointerFrame = window.requestAnimationFrame(() => {
        shortcutDockPointerFrame = 0;
        const pendingTile = shortcutDockPendingTile;
        const pendingPointerX = pageState.shortcutDockPendingPointerX;
        shortcutDockPendingTile = null;
        pageState.shortcutDockPendingPointerX = Number.NaN;
        if (!pendingTile || !pendingTile.isConnected ||
            isShortcutDragActive() || isBookmarkDragActive()) {
          return;
        }
        setShortcutDockHover(pendingTile, pendingPointerX);
      });
    }

    function getShortcutDockIconCenterX(tile) {
      const icon = getShortcutDockIcon(tile) || tile;
      if (!icon || typeof icon.getBoundingClientRect !== 'function') {
        return null;
      }
      const rect = icon.getBoundingClientRect();
      const centerX = rect.left + (rect.width / 2);
      return Number.isFinite(centerX) ? centerX : null;
    }

    function getOpenShortcutFolderMenuTile() {
      const tile = shortcutDockFolderMenuTile;
      if (tile && tile.isConnected && tile.getAttribute('aria-expanded') === 'true') {
        return tile;
      }
      shortcutDockFolderMenuTile = null;
      return null;
    }

    function syncShortcutDockFolderMenu(tile) {
      if (!tile) {
        return;
      }
      if (tile.getAttribute('aria-expanded') === 'true') {
        shortcutDockFolderMenuTile = tile;
        if (!tile.matches(':hover')) {
          resetShortcutDockHover();
        }
        return;
      }
      if (tile !== shortcutDockFolderMenuTile) {
        return;
      }
      shortcutDockFolderMenuTile = null;
      // A pointer still over the row keeps driving the dock on its next move.
      if (!pageState.shortcutGrid || !pageState.shortcutGrid.matches(':hover')) {
        resetShortcutDockHover();
      }
    }

    function resetShortcutDockHover() {
      cancelShortcutDockPointerFrame();
      if (!pageState.shortcutGrid) {
        return;
      }
      if (isShortcutContextMenuOpen() && pageState.shortcutContextMenuTarget) {
        const activeTile = pageState.shortcutContextMenuTarget.tile;
        if (activeTile) {
          applyShortcutContextMenuDockHover(activeTile);
          return;
        }
      }
      const folderMenuTile = getOpenShortcutFolderMenuTile();
      if (folderMenuTile) {
        setShortcutDockHover(folderMenuTile, getShortcutDockIconCenterX(folderMenuTile));
        return;
      }
      clearShortcutDockMagnificationState();
      clearShortcutContextMenuTileActive();
    }

    function setShortcutDockHover(activeTile, pointerX) {
      if (!pageState.shortcutGrid || !activeTile) {
        return;
      }
      if (!pageState.newtabShortcutDockMagnificationEnabled) {
        clearShortcutDockMagnificationState();
        return;
      }
      const tiles = Array.from(pageState.shortcutGrid.querySelectorAll('.x-nt-shortcut-tile'));
      const activeIndex = tiles.indexOf(activeTile);
      if (activeIndex < 0) {
        resetShortcutDockHover();
        return;
      }
      const pointerMeasurements = Number.isFinite(pointerX)
        ? tiles.map((tile, index) => {
          const offset = index - activeIndex;
          if (Math.abs(offset) > 2) {
            return null;
          }
          const icon = getShortcutDockIcon(tile);
          return {
            icon,
            influence: getShortcutDockInfluence(pointerX, icon)
          };
        })
        : [];
      pageState.shortcutGrid.setAttribute('data-dock-active', 'true');
      tiles.forEach((tile, index) => {
        const offset = index - activeIndex;
        const distance = Math.abs(offset);
        if (distance > 2) {
          resetShortcutDockTile(tile);
          return;
        }
        tile.setAttribute('data-dock-distance', String(distance));
        tile.setAttribute('data-dock-side', offset < 0 ? 'before' : offset > 0 ? 'after' : 'active');
        if (Number.isFinite(pointerX)) {
          applyShortcutDockPointerStyles(tile, pointerX, offset, pointerMeasurements[index]);
        }
      });
    }

    function handleShortcutDockPointerOver(event) {
      if (isShortcutDragActive() || isBookmarkDragActive()) {
        return;
      }
      const tile = getShortcutTileFromNode(event.target);
      if (tile) {
        scheduleShortcutDockPointerStyles(tile, getShortcutDockPointerX(event));
      }
    }

    function handleShortcutDockPointerMove(event) {
      if (isShortcutDragActive() || isBookmarkDragActive()) {
        return;
      }
      const tile = getShortcutTileFromNode(event.target);
      if (tile) {
        scheduleShortcutDockPointerStyles(tile, getShortcutDockPointerX(event));
      }
    }

    return {
      getShortcutDockIcon,
      applyNewtabShortcutDockMagnification,
      resetShortcutDockHover,
      setShortcutDockHover,
      handleShortcutDockPointerOver,
      handleShortcutDockPointerMove,
      syncShortcutDockFolderMenu
    };
  }

  root.LumnoNewtabShortcutDock = { createShortcutDock };
})(globalThis);
