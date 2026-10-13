(function(root) {
  // Right-click menu for shortcut tiles and the add-shortcut tile.
  function createShortcutContextMenu(deps) {
    const {
      getShortcutDockIcon,
      setShortcutDockHover,
      resetShortcutDockHover,
      getShortcutTileFromNode,
      getShortcutById,
      SHORTCUT_CONTEXT_MENU_HIDE_ADD_VALUE,
      hideShortcutAddFromContextMenu,
      FOLDER_COLOR_CONTEXT_MENU_VALUE,
      openFolderColorPicker,
      getShortcutFolderId,
      SHORTCUT_CONTEXT_MENU_EDIT_VALUE,
      openShortcutEditor,
      NEWTAB_CONTEXT_MENU_OPEN_VALUE,
      openShortcutUrl,
      openExternalNewTabUrl,
      SHORTCUT_CONTEXT_MENU_REMOVE_VALUE,
      removeShortcutById,
      BOOKMARK_CONTEXT_MENU_OPEN_GROUP_VALUE,
      openBookmarkFolderTabGroupConfirmation,
      t,
      getShortcutContextMenuOptions,
      closeRecentContextMenu,
      hideShortcutTooltip,
      getShortcutTileId,
      SHORTCUT_GROUP_MENU_VALUES,
      openShortcutGroupDialog,
      openShortcutAddDialog,
      moveShortcutGroup,
      deleteShortcutGroup,
      confirmDeleteShortcutGroupWithSites
    } = deps;

    // Page state still owned by newtab.js; read and written through accessors.
    const pageState = deps.pageState;

    const SHORTCUT_CONTEXT_MENU_MIN_WIDTH_PX = 124;
    const SHORTCUT_CONTEXT_MENU_MAX_WIDTH_PX = 180;
    const SHORTCUT_CONTEXT_MENU_PORTAL_Z_INDEX = 10040;
    const SHORTCUT_CONTEXT_MENU_PORTAL_OFFSET_PX = -6;

    function isShortcutContextMenuOpen() {
      return Boolean(
        pageState.shortcutContextMenu &&
        pageState.shortcutContextMenuSelectController &&
        pageState.shortcutContextMenuSelectController.isOpen(pageState.shortcutContextMenu.control)
      );
    }

    function isShortcutContextMenuNode(node) {
      if (!node || !pageState.shortcutContextMenu) {
        return false;
      }
      const { control, menu } = pageState.shortcutContextMenu;
      return Boolean(
        (control && (node === control || (typeof control.contains === 'function' && control.contains(node)))) ||
        (menu && (node === menu || (typeof menu.contains === 'function' && menu.contains(node))))
      );
    }

    // A group's menu button is marked as well as tiles, so clear by the mark.
    function clearShortcutContextMenuTileActive() {
      const tiles = pageState.shortcutGrid
        ? Array.from(pageState.shortcutGrid.querySelectorAll('[data-shortcut-context-menu-open]'))
        : [];
      tiles.forEach((tile) => {
        if (!tile.hasAttribute('data-shortcut-context-menu-open')) {
          return;
        }
        tile.removeAttribute('data-shortcut-context-menu-open');
        if (typeof tile._xSetBookmarkMenuVisualActive === 'function') {
          tile._xSetBookmarkMenuVisualActive(false);
        }
      });
    }

    function setShortcutContextMenuTileActive(target) {
      clearShortcutContextMenuTileActive();
      const tile = target && target.tile;
      if (tile) {
        tile.setAttribute('data-shortcut-context-menu-open', 'true');
        if (typeof tile._xSetBookmarkMenuVisualActive === 'function') {
          tile._xSetBookmarkMenuVisualActive(true);
        }
      }
    }

    function getShortcutContextMenuAnchorElement(tile) {
      return getShortcutDockIcon(tile) || tile;
    }

    function getShortcutContextMenuAnchorX(tile) {
      const anchor = getShortcutContextMenuAnchorElement(tile);
      if (!anchor || typeof anchor.getBoundingClientRect !== 'function') {
        return null;
      }
      const rect = anchor.getBoundingClientRect();
      const centerX = rect.left + (rect.width / 2);
      return Number.isFinite(centerX) ? centerX : null;
    }

    // Only a shortcut tile magnifies; a group title's menu button does not.
    function applyShortcutContextMenuDockHover(tile) {
      if (!tile || !tile.classList || !tile.classList.contains('x-nt-shortcut-tile')) {
        return;
      }
      setShortcutDockHover(tile, getShortcutContextMenuAnchorX(tile));
      tile.setAttribute('data-shortcut-context-menu-open', 'true');
    }

    function syncShortcutDockHoverFromPoint(clientX, clientY) {
      const pointerX = Number(clientX);
      const pointerY = Number(clientY);
      if (!Number.isFinite(pointerX) || !Number.isFinite(pointerY) ||
          typeof document.elementFromPoint !== 'function') {
        resetShortcutDockHover();
        return;
      }
      const tile = getShortcutTileFromNode(document.elementFromPoint(pointerX, pointerY));
      if (tile) {
        setShortcutDockHover(tile, pointerX);
        return;
      }
      resetShortcutDockHover();
    }

    function closeShortcutContextMenu(options) {
      const closeOptions = options && typeof options === 'object' ? options : {};
      if (!pageState.shortcutContextMenu || !pageState.shortcutContextMenuSelectController) {
        pageState.shortcutContextMenuTarget = null;
        clearShortcutContextMenuTileActive();
        return;
      }
      const wasOpen = isShortcutContextMenuOpen() || Boolean(pageState.shortcutContextMenuTarget);
      pageState.shortcutContextMenuSelectController.setOpen(pageState.shortcutContextMenu.control, false);
      pageState.shortcutContextMenuTarget = null;
      clearShortcutContextMenuTileActive();
      if (!wasOpen) {
        return;
      }
      if (closeOptions.syncHoverFromPointer) {
        syncShortcutDockHoverFromPoint(closeOptions.clientX, closeOptions.clientY);
        return;
      }
      resetShortcutDockHover();
    }

    function getShortcutContextMenuPoint(tile) {
      const anchor = getShortcutContextMenuAnchorElement(tile);
      if (anchor && typeof anchor.getBoundingClientRect === 'function') {
        const rect = anchor.getBoundingClientRect();
        return {
          x: Math.round(rect.left + rect.width / 2),
          y: Math.round(rect.bottom)
        };
      }
      return { x: 0, y: 0 };
    }

    function setShortcutContextMenuPosition(tile) {
      if (!pageState.shortcutContextMenu || !pageState.shortcutContextMenu.control) {
        return;
      }
      const point = getShortcutContextMenuPoint(tile);
      pageState.shortcutContextMenu.control.style.left = `${Math.round(point.x)}px`;
      pageState.shortcutContextMenu.control.style.top = `${Math.round(point.y)}px`;
    }

    function handleShortcutContextMenuAction(actionValue) {
      const action = String(actionValue || '');
      const target = pageState.shortcutContextMenuTarget;
      const targetId = target && target.kind === 'shortcut'
        ? String(target.shortcutId || '')
        : '';
      const shortcut = getShortcutById(targetId);
      const sourceElement = target && target.tile;
      closeShortcutContextMenu();
      if (!target || !action) {
        return;
      }
      if (target.kind === 'add' && action === SHORTCUT_CONTEXT_MENU_HIDE_ADD_VALUE) {
        hideShortcutAddFromContextMenu(sourceElement);
        return;
      }
      if (action === SHORTCUT_GROUP_MENU_VALUES.create) {
        openShortcutGroupDialog('', sourceElement);
        return;
      }
      if (target.kind === 'add' && action === SHORTCUT_GROUP_MENU_VALUES.addShortcut) {
        openShortcutAddDialog(sourceElement);
        return;
      }
      if (target.kind === 'group') {
        handleShortcutGroupMenuAction(action, String(target.groupId || ''), sourceElement);
        return;
      }
      if (!shortcut) {
        return;
      }
      if (action === FOLDER_COLOR_CONTEXT_MENU_VALUE && shortcut.type === 'folder') {
        openFolderColorPicker(getShortcutFolderId(shortcut), shortcut.title, sourceElement);
        return;
      }
      if (action === BOOKMARK_CONTEXT_MENU_OPEN_GROUP_VALUE && shortcut.type === 'folder') {
        openBookmarkFolderTabGroupConfirmation({
          isFolder: true,
          bookmarkId: getShortcutFolderId(shortcut),
          title: shortcut.title,
          element: sourceElement
        });
        return;
      }
      if (action === SHORTCUT_CONTEXT_MENU_EDIT_VALUE) {
        openShortcutEditor(shortcut, sourceElement);
        return;
      }
      if (action === NEWTAB_CONTEXT_MENU_OPEN_VALUE) {
        if (shortcut.type === 'folder') {
          openShortcutUrl(shortcut);
          return;
        }
        openExternalNewTabUrl(shortcut.url, 'newTab');
        return;
      }
      if (action === SHORTCUT_CONTEXT_MENU_REMOVE_VALUE) {
        removeShortcutById(targetId);
      }
    }

    function handleShortcutGroupMenuAction(action, groupId, sourceElement) {
      if (!groupId) {
        return;
      }
      if (action === SHORTCUT_GROUP_MENU_VALUES.rename) {
        openShortcutGroupDialog(groupId, sourceElement);
      } else if (action === SHORTCUT_GROUP_MENU_VALUES.addSite) {
        openShortcutAddDialog(sourceElement, groupId);
      } else if (action === SHORTCUT_GROUP_MENU_VALUES.moveUp) {
        moveShortcutGroup(groupId, -1);
      } else if (action === SHORTCUT_GROUP_MENU_VALUES.moveDown) {
        moveShortcutGroup(groupId, 1);
      } else if (action === SHORTCUT_GROUP_MENU_VALUES.delete) {
        deleteShortcutGroup(groupId, true);
      } else if (action === SHORTCUT_GROUP_MENU_VALUES.deleteWithSites) {
        confirmDeleteShortcutGroupWithSites(groupId, sourceElement);
      }
    }

    function handleShortcutContextMenuActionClick(event) {
      const target = event && event.target;
      const option = target && typeof target.closest === 'function'
        ? target.closest('._x_extension_select_option_2024_unique_')
        : null;
      if (!option || !pageState.shortcutContextMenu || !pageState.shortcutContextMenu.menu ||
          !pageState.shortcutContextMenu.menu.contains(option)) {
        return;
      }
      event.stopPropagation();
      handleShortcutContextMenuAction(option.getAttribute('data-value'));
    }

    // A button that opened the menu closes it when pressed again, instead
    // of the press closing it and the click opening it once more.
    let reopenBlockedAnchor = null;

    // The menu's own outside-press handling may already have closed it, so
    // the menu's target, not its open state, says which button opened it.
    function handleShortcutContextMenuDocumentPointerDown(event) {
      const target = pageState.shortcutContextMenuTarget;
      if ((!target && !isShortcutContextMenuOpen()) || isShortcutContextMenuNode(event.target)) {
        return;
      }
      const anchor = target && target.kind !== 'shortcut' ? target.tile : null;
      reopenBlockedAnchor = anchor && typeof anchor.contains === 'function' && anchor.contains(event.target)
        ? anchor
        : null;
      closeShortcutContextMenu({
        syncHoverFromPointer: true,
        clientX: event.clientX,
        clientY: event.clientY
      });
    }

    function handleShortcutContextMenuDocumentKeyDown(event) {
      if (event && event.key === 'Escape' &&
          (pageState.shortcutContextMenuTarget || isShortcutContextMenuOpen())) {
        closeShortcutContextMenu();
      }
    }

    function handleShortcutContextMenuDocumentFocusIn(event) {
      if (pageState.shortcutContextMenuTarget && !isShortcutContextMenuNode(event.target)) {
        closeShortcutContextMenu();
      }
    }

    function createShortcutContextMenu() {
      if (!pageState.shortcutContextMenuSelectController ||
          typeof pageState.shortcutContextMenuSelectController.createSelect !== 'function') {
        return null;
      }
      const created = pageState.shortcutContextMenuSelectController.createSelect({
        id: '_x_extension_newtab_shortcut_context_menu_2026_unique_',
        selectId: '_x_extension_newtab_shortcut_context_menu_select_2026_unique_',
        className: 'x-nt-shortcut-context-menu',
        iconOnly: true,
        triggerIconClass: 'ri-more-line',
        menuClassName: 'x-nt-shortcut-context-menu-portal',
        menuAlign: 'middle',
        menuWidth: 'content',
        menuMinWidth: SHORTCUT_CONTEXT_MENU_MIN_WIDTH_PX,
        menuMaxWidth: SHORTCUT_CONTEXT_MENU_MAX_WIDTH_PX,
        menuPortal: true,
        menuPortalZIndex: SHORTCUT_CONTEXT_MENU_PORTAL_Z_INDEX,
        menuPortalOffset: SHORTCUT_CONTEXT_MENU_PORTAL_OFFSET_PX,
        value: NEWTAB_CONTEXT_MENU_OPEN_VALUE,
        ariaLabel: t('newtab_shortcuts_context_menu_label', 'Shortcut actions'),
        options: getShortcutContextMenuOptions(),
        onAction(payload) {
          handleShortcutContextMenuAction(payload && payload.action);
        }
      });
      const control = created.wrapper;
      const select = created.select;
      const trigger = created.trigger;
      const menu = created.menu;
      if (!control || !select || !trigger || !menu) {
        return null;
      }
      trigger.tabIndex = -1;
      const stopContextMenuEvent = (event) => {
        event.stopPropagation();
      };
      [control, trigger, menu].forEach((element) => {
        element.addEventListener('pointerdown', stopContextMenuEvent);
        element.addEventListener('click', stopContextMenuEvent);
        element.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          event.stopPropagation();
        });
      });
      menu.addEventListener('click', handleShortcutContextMenuActionClick);
      document.addEventListener('pointerdown', handleShortcutContextMenuDocumentPointerDown, true);
      document.addEventListener('keydown', handleShortcutContextMenuDocumentKeyDown, true);
      document.addEventListener('focusin', handleShortcutContextMenuDocumentFocusIn, true);
      (document.body || pageState.shortcutSection || document.documentElement).appendChild(control);
      return {
        control,
        select,
        trigger,
        menu
      };
    }

    function openShortcutContextMenu(target) {
      const tile = target && target.tile;
      const shortcutId = target && target.kind === 'shortcut'
        ? String(target.shortcutId || '')
        : '';
      if (!tile || (target.kind === 'shortcut' && !shortcutId) || (target.kind === 'group' && !target.groupId)) {
        return;
      }
      if (reopenBlockedAnchor === tile) {
        reopenBlockedAnchor = null;
        return;
      }
      reopenBlockedAnchor = null;
      if (!pageState.shortcutContextMenu) {
        pageState.shortcutContextMenu = createShortcutContextMenu();
      }
      if (!pageState.shortcutContextMenu || !pageState.shortcutContextMenuSelectController) {
        return;
      }
      closeRecentContextMenu();
      hideShortcutTooltip();
      resetShortcutDockHover();
      pageState.shortcutContextMenuTarget = target;
      setShortcutContextMenuTileActive(target);
      applyShortcutContextMenuDockHover(tile);
      setShortcutContextMenuPosition(tile);
      const defaultValue = target.kind === 'add'
        ? SHORTCUT_GROUP_MENU_VALUES.addShortcut
        : target.kind === 'group'
          ? SHORTCUT_GROUP_MENU_VALUES.rename
          : NEWTAB_CONTEXT_MENU_OPEN_VALUE;
      if (typeof pageState.shortcutContextMenuSelectController.setOptions === 'function') {
        pageState.shortcutContextMenuSelectController.setOptions(
          pageState.shortcutContextMenu.control,
          getShortcutContextMenuOptions(target),
          defaultValue
        );
      }
      pageState.shortcutContextMenu.select.value = defaultValue;
      pageState.shortcutContextMenuSelectController.sync(pageState.shortcutContextMenu.control);
      pageState.shortcutContextMenuSelectController.setOpen(pageState.shortcutContextMenu.control, true);
    }

    function handleShortcutContextMenu(event) {
      const tile = getShortcutTileFromNode(event.currentTarget || event.target);
      if (!tile || !getShortcutTileId(tile)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      openShortcutContextMenu({
        kind: 'shortcut',
        shortcutId: getShortcutTileId(tile),
        tile
      });
    }

    function openShortcutGroupMenu(groupId, anchor) {
      if (!groupId || !anchor) {
        return;
      }
      openShortcutContextMenu({
        kind: 'group',
        groupId: String(groupId),
        tile: anchor
      });
    }

    function openShortcutAddContextMenu(sourceElement) {
      const tile = sourceElement || pageState.addShortcutButton;
      if (!tile || tile.hidden) {
        return;
      }
      openShortcutContextMenu({
        kind: 'add',
        tile
      });
    }

    return {
      isShortcutContextMenuOpen,
      isShortcutContextMenuNode,
      clearShortcutContextMenuTileActive,
      applyShortcutContextMenuDockHover,
      closeShortcutContextMenu,
      handleShortcutContextMenu,
      openShortcutAddContextMenu,
      openShortcutGroupMenu
    };
  }

  root.LumnoNewtabShortcutContextMenu = { createShortcutContextMenu };
})(globalThis);
