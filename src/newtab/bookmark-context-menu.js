(function(root) {
  // Right-click menu for bookmark cards and folders.
  function createBookmarkContextMenu(deps) {
    const {
      bookmarksRuntime,
      NEWTAB_BOOKMARKS_STORE,
      BOOKMARK_CONTEXT_MENU_OPEN_GROUP_VALUE,
      t,
      NEWTAB_CONTEXT_MENU_OPEN_VALUE,
      FOLDER_COLOR_CONTEXT_MENU_VALUE,
      BOOKMARK_CONTEXT_MENU_EDIT_VALUE,
      openFolderColorPicker,
      openExternalNewTabUrl,
      openBookmarkEditor,
      openBookmarkFolderTabGroupConfirmation,
      deleteBookmarkFromContextTarget,
      hasShortcutForSite,
      addSiteToShortcuts,
      closeShortcutContextMenu,
      closeRecentContextMenu,
      hideCursorTooltip
    } = deps;

    // The page state object shared with newtab.js and the other modules.
    const pageState = deps.pageState;

    const BOOKMARK_CONTEXT_MENU_REMOVE_VALUE = 'remove';
    const BOOKMARK_CONTEXT_MENU_ADD_SHORTCUT_VALUE = 'add-shortcut';
    const BOOKMARK_CONTEXT_MENU_MIN_WIDTH_PX = 124;
    const BOOKMARK_CONTEXT_MENU_MAX_WIDTH_PX = 240;
    const BOOKMARK_CONTEXT_MENU_PORTAL_Z_INDEX = 10060;
    const BOOKMARK_CONTEXT_MENU_PORTAL_OFFSET_PX = -6;

    function getBookmarkFolderOpenCount(target) {
      if (!target || !target.isFolder) {
        return 0;
      }
      const node = bookmarksRuntime.getNode(target.bookmarkId);
      return NEWTAB_BOOKMARKS_STORE.collectFolderBookmarkUrls(node).length;
    }

    function getBookmarkShortcutSite(target) {
      return { title: target.title, url: target.url };
    }

    function getBookmarkContextMenuOptions(target) {
      const options = [];
      if (target && target.isFolder) {
        options.push({
          action: BOOKMARK_CONTEXT_MENU_OPEN_GROUP_VALUE,
          value: BOOKMARK_CONTEXT_MENU_OPEN_GROUP_VALUE,
          label: t('bookmarks_open_in_new_tab_group', 'Open in new tab group'),
          disabled: getBookmarkFolderOpenCount(target) <= 0
        });
      } else if (target && !target.isFolder) {
        options.push({
          action: NEWTAB_CONTEXT_MENU_OPEN_VALUE,
          value: NEWTAB_CONTEXT_MENU_OPEN_VALUE,
          label: t('newtab_open_in_new_tab', 'Open in new tab')
        });
        // Copies the site into the shortcuts and leaves the bookmark where
        // it is; dragging the bookmark onto the shortcuts moves it instead.
        const isShortcut = hasShortcutForSite(getBookmarkShortcutSite(target));
        options.push({
          action: BOOKMARK_CONTEXT_MENU_ADD_SHORTCUT_VALUE,
          value: BOOKMARK_CONTEXT_MENU_ADD_SHORTCUT_VALUE,
          label: isShortcut
            ? t('newtab_shortcuts_already_added', 'Already in shortcuts')
            : t('recent_add_to_shortcuts', 'Add to shortcuts'),
          disabled: isShortcut
        });
      }
      if (target && target.isFolder) {
        options.push({
          action: FOLDER_COLOR_CONTEXT_MENU_VALUE,
          value: FOLDER_COLOR_CONTEXT_MENU_VALUE,
          label: t('folder_color_change', 'Change color'),
          dividerBefore: true
        });
      }
      options.push(
        {
          action: BOOKMARK_CONTEXT_MENU_EDIT_VALUE,
          value: BOOKMARK_CONTEXT_MENU_EDIT_VALUE,
          label: target && target.isFolder
            ? t('folder_rename', 'Rename')
            : t('bookmarks_edit', 'Edit'),
          dividerBefore: options.length > 0 && !(target && target.isFolder)
        },
        {
          action: BOOKMARK_CONTEXT_MENU_REMOVE_VALUE,
          value: BOOKMARK_CONTEXT_MENU_REMOVE_VALUE,
          label: t('bookmarks_delete', 'Delete')
        }
      );
      return options;
    }

    function isBookmarkContextMenuOpen() {
      return Boolean(
        pageState.bookmarkContextMenu &&
        pageState.bookmarkContextMenuSelectController &&
        pageState.bookmarkContextMenuSelectController.isOpen(pageState.bookmarkContextMenu.control)
      );
    }

    function isBookmarkContextMenuNode(node) {
      if (!node || !pageState.bookmarkContextMenu) {
        return false;
      }
      const { control, menu } = pageState.bookmarkContextMenu;
      return Boolean(
        (control && (node === control || (typeof control.contains === 'function' && control.contains(node)))) ||
        (menu && (node === menu || (typeof menu.contains === 'function' && menu.contains(node))))
      );
    }

    function clearBookmarkContextMenuTargetVisual() {
      const element = pageState.bookmarkContextMenuTarget && pageState.bookmarkContextMenuTarget.element;
      if (element && typeof element.removeAttribute === 'function') {
        element.removeAttribute('data-bookmark-context-menu-open');
      }
    }

    function closeBookmarkContextMenu() {
      clearBookmarkContextMenuTargetVisual();
      if (pageState.bookmarkContextMenu && pageState.bookmarkContextMenuSelectController) {
        pageState.bookmarkContextMenuSelectController.setOpen(pageState.bookmarkContextMenu.control, false);
      }
      pageState.bookmarkContextMenuTarget = null;
    }

    function getBookmarkContextMenuPoint(target, event) {
      const clientX = Number(event && event.clientX);
      const clientY = Number(event && event.clientY);
      if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
        return { x: clientX, y: clientY };
      }
      const element = target && target.element;
      if (element && typeof element.getBoundingClientRect === 'function') {
        const rect = element.getBoundingClientRect();
        return {
          x: rect.left + (rect.width / 2),
          y: rect.bottom
        };
      }
      return { x: 0, y: 0 };
    }

    function setBookmarkContextMenuPosition(target, event) {
      if (!pageState.bookmarkContextMenu || !pageState.bookmarkContextMenu.control) {
        return;
      }
      const point = getBookmarkContextMenuPoint(target, event);
      pageState.bookmarkContextMenu.control.style.left = `${Math.round(point.x)}px`;
      pageState.bookmarkContextMenu.control.style.top = `${Math.round(point.y)}px`;
    }

    function handleBookmarkContextMenuAction(actionValue) {
      const action = String(actionValue || '');
      const target = pageState.bookmarkContextMenuTarget;
      closeBookmarkContextMenu();
      if (!target || !action) {
        return;
      }
      if (action === FOLDER_COLOR_CONTEXT_MENU_VALUE && target.isFolder) {
        openFolderColorPicker(target.bookmarkId, target.title, target.element);
        return;
      }
      if (action === NEWTAB_CONTEXT_MENU_OPEN_VALUE) {
        openExternalNewTabUrl(target.url, 'newTab');
        return;
      }
      if (action === BOOKMARK_CONTEXT_MENU_ADD_SHORTCUT_VALUE && !target.isFolder) {
        addSiteToShortcuts(getBookmarkShortcutSite(target));
        return;
      }
      if (action === BOOKMARK_CONTEXT_MENU_EDIT_VALUE) {
        openBookmarkEditor(target);
        return;
      }
      if (action === BOOKMARK_CONTEXT_MENU_OPEN_GROUP_VALUE) {
        openBookmarkFolderTabGroupConfirmation(target);
        return;
      }
      if (action === BOOKMARK_CONTEXT_MENU_REMOVE_VALUE) {
        deleteBookmarkFromContextTarget(target);
      }
    }

    function handleBookmarkContextMenuActionClick(event) {
      const target = event && event.target;
      const option = target && typeof target.closest === 'function'
        ? target.closest('._x_extension_select_option_2024_unique_')
        : null;
      if (!option || option.getAttribute('aria-disabled') === 'true' ||
          !pageState.bookmarkContextMenu || !pageState.bookmarkContextMenu.menu ||
          !pageState.bookmarkContextMenu.menu.contains(option)) {
        return;
      }
      event.stopPropagation();
      handleBookmarkContextMenuAction(option.getAttribute('data-value'));
    }

    function handleBookmarkContextMenuDocumentPointerDown(event) {
      if (!isBookmarkContextMenuOpen() || isBookmarkContextMenuNode(event.target)) {
        return;
      }
      closeBookmarkContextMenu();
    }

    function createBookmarkContextMenu() {
      if (!pageState.bookmarkContextMenuSelectController ||
          typeof pageState.bookmarkContextMenuSelectController.createSelect !== 'function') {
        return null;
      }
      const created = pageState.bookmarkContextMenuSelectController.createSelect({
        id: '_x_extension_newtab_bookmark_context_menu_2026_unique_',
        selectId: '_x_extension_newtab_bookmark_context_menu_select_2026_unique_',
        className: 'x-nt-shortcut-context-menu x-nt-bookmark-context-menu',
        iconOnly: true,
        triggerIconClass: 'ri-more-line',
        menuClassName: 'x-nt-shortcut-context-menu-portal x-nt-bookmark-context-menu-portal',
        menuAlign: 'middle',
        menuWidth: 'content',
        menuMinWidth: BOOKMARK_CONTEXT_MENU_MIN_WIDTH_PX,
        menuMaxWidth: BOOKMARK_CONTEXT_MENU_MAX_WIDTH_PX,
        menuPortal: true,
        menuPortalZIndex: BOOKMARK_CONTEXT_MENU_PORTAL_Z_INDEX,
        menuPortalOffset: BOOKMARK_CONTEXT_MENU_PORTAL_OFFSET_PX,
        value: BOOKMARK_CONTEXT_MENU_EDIT_VALUE,
        ariaLabel: t('bookmarks_context_menu_label', 'Bookmark actions'),
        options: getBookmarkContextMenuOptions(),
        onAction(payload) {
          handleBookmarkContextMenuAction(payload && payload.action);
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
      menu.addEventListener('click', handleBookmarkContextMenuActionClick);
      document.addEventListener('pointerdown', handleBookmarkContextMenuDocumentPointerDown, true);
      (document.body || document.documentElement).appendChild(control);
      return { control, select, trigger, menu };
    }

    function openBookmarkContextMenu(target, event) {
      if (!target || !target.bookmarkId) {
        return;
      }
      if (!pageState.bookmarkContextMenu) {
        pageState.bookmarkContextMenu = createBookmarkContextMenu();
      }
      if (!pageState.bookmarkContextMenu || !pageState.bookmarkContextMenuSelectController) {
        return;
      }
      closeShortcutContextMenu();
      closeRecentContextMenu();
      closeBookmarkContextMenu();
      pageState.bookmarkContextMenuTarget = target;
      if (target.element && typeof target.element.setAttribute === 'function') {
        target.element.setAttribute('data-bookmark-context-menu-open', 'true');
      }
      setBookmarkContextMenuPosition(target, event);
      if (typeof pageState.bookmarkContextMenuSelectController.setOptions === 'function') {
        pageState.bookmarkContextMenuSelectController.setOptions(
          pageState.bookmarkContextMenu.control,
          getBookmarkContextMenuOptions(target),
          target.isFolder
            ? BOOKMARK_CONTEXT_MENU_OPEN_GROUP_VALUE
            : NEWTAB_CONTEXT_MENU_OPEN_VALUE
        );
      }
      pageState.bookmarkContextMenuSelectController.setOpen(pageState.bookmarkContextMenu.control, true);
    }

    // Opened over a folder menu, it is the layer Escape closes first.
    root.LumnoNewtabDismissStack.getDismissStack().register('bookmark-context-menu', {
      isOpen: isBookmarkContextMenuOpen,
      close: () => closeBookmarkContextMenu()
    });

    function handleBookmarkItemContextMenu(payload) {
      const event = payload && payload.event;
      const item = payload && payload.item;
      const element = payload && payload.element;
      if (!event || !item || !element || !item.id || pageState.bookmarkDragState) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      hideCursorTooltip();
      openBookmarkContextMenu({
        bookmarkId: String(item.id),
        title: String(item.title || ''),
        url: item.type === 'folder' ? '' : String(item.url || ''),
        parentId: String(item.parentId || payload.parentFolderId || ''),
        index: Number.isFinite(Number(item.index)) ? Number(item.index) : 0,
        isFolder: item.type === 'folder',
        sourceKind: payload.sourceKind === 'cascade' ? 'cascade' : 'card',
        element
      }, event);
    }

    return {
      getBookmarkContextMenuOptions,
      isBookmarkContextMenuNode,
      closeBookmarkContextMenu,
      handleBookmarkItemContextMenu
    };
  }

  root.LumnoNewtabBookmarkContextMenu = { createBookmarkContextMenu };
})(globalThis);
