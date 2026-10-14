(function(root) {
  // Binds and hides the New Tab tooltips: top actions, search input, shortcut
  // tiles, the shortcut dialog and bookmark cursor tooltips.
  function createTooltipBindings(deps) {
    const {
      topActionTooltipController,
      searchInputCursorTooltipController,
      shortcutTooltipController,
      t,
      isShortcutDragActive,
      isBookmarkDragActive,
      isShortcutContextMenuOpen,
      shortcutDialogTooltipController,
      bookmarkCursorTooltipController,
      shouldSuppressBookmarkHover
    } = deps;

    // The page state object shared with newtab.js and the other modules.
    const pageState = deps.pageState;

    function showTopActionTooltip(button, text, options) {
      if (!button || !text) {
        return;
      }
      const tooltipOptions = options && typeof options === 'object' ? options : {};
      const placement = tooltipOptions.placement === 'left' || tooltipOptions.placement === 'left-above'
        ? tooltipOptions.placement
        : 'top';
      topActionTooltipController.show(button, text, Object.assign({}, tooltipOptions, {
        placement,
        maxWidth: 420
      }));
    }

    function hideTopActionTooltip() {
      topActionTooltipController.hide();
    }

    function bindSearchInputCursorTooltip(button, getText) {
      if (!button) {
        return null;
      }
      return searchInputCursorTooltipController.bind(button, getText, {
        maxWidth: 420,
        deferHideVisibility: true,
        preserveVisibleOnTargetSwitch: true,
        handoffRoot: pageState.inputParts && pageState.inputParts.container
          ? pageState.inputParts.container
          : null
      });
    }

    function hideSearchInputCursorTooltip() {
      searchInputCursorTooltipController.hide();
    }

    function bindShortcutTooltip(target, getText, options) {
      if (!target) {
        return null;
      }
      const tooltipOptions = options && typeof options === 'object' ? options : {};
      const resolveText = typeof getText === 'function'
        ? getText
        : () => (typeof target.getAttribute === 'function' ? target.getAttribute('data-tooltip') : '');
      return shortcutTooltipController.bind(target, (tooltipTarget) => {
        if (isShortcutTooltipSuppressed()) {
          return '';
        }
        const tooltip = shortcutTooltipController.element;
        if (tooltip && tooltipTarget.classList.contains('x-nt-shortcut-tile--folder')) {
          tooltip.setAttribute('data-shortcut-origin-label',
            t('newtab_shortcuts_from_bookmarks', '(from bookmarks bar)'));
        } else if (tooltip) {
          tooltip.removeAttribute('data-shortcut-origin-label');
        }
        return resolveText(tooltipTarget);
      }, Object.assign({
        placement: 'bottom',
        maxWidth: 360,
        spacing: () => (pageState.newtabShortcutDockMagnificationEnabled ? -6 : -2),
        showOnFocus: false
      }, tooltipOptions));
    }

    function isShortcutTooltipSuppressed() {
      return Boolean(
        isShortcutDragActive() ||
        isBookmarkDragActive() ||
        (pageState.shortcutGrid && pageState.shortcutGrid.getAttribute('data-shortcut-dragging') === 'true') ||
        isShortcutContextMenuOpen()
      );
    }

    function hideShortcutTooltip() {
      shortcutTooltipController.hide();
    }

    function bindShortcutDialogTooltip(target, getText, options) {
      if (!target) {
        return null;
      }
      return shortcutDialogTooltipController.bind(target, getText, Object.assign({
        placement: 'top',
        maxWidth: 320
      }, options || {}));
    }

    function hideShortcutDialogTooltip() {
      shortcutDialogTooltipController.hide();
    }

    function bindCursorTooltip(target, getText, options) {
      if (!target) {
        return null;
      }
      const tooltipOptions = options && typeof options === 'object' ? options : {};
      const originalShouldShow = typeof tooltipOptions.shouldShow === 'function'
        ? tooltipOptions.shouldShow
        : null;
      return bookmarkCursorTooltipController.bind(target, getText, Object.assign({
        maxWidth: 460
      }, tooltipOptions, {
        shouldShow: (tooltipTarget, inputEvent) => {
          if (isBookmarkCursorTooltipSuppressed(tooltipTarget)) {
            return false;
          }
          return originalShouldShow ? originalShouldShow(tooltipTarget, inputEvent) !== false : true;
        }
      }));
    }

    function isBookmarkCursorTooltipSuppressed(target) {
      return shouldSuppressBookmarkHover(target);
    }

    function hideCursorTooltip() {
      bookmarkCursorTooltipController.hide();
    }

    return {
      showTopActionTooltip,
      hideTopActionTooltip,
      bindSearchInputCursorTooltip,
      hideSearchInputCursorTooltip,
      bindShortcutTooltip,
      hideShortcutTooltip,
      bindShortcutDialogTooltip,
      hideShortcutDialogTooltip,
      bindCursorTooltip,
      hideCursorTooltip
    };
  }

  root.LumnoNewtabTooltipBindings = { createTooltipBindings };
})(globalThis);
