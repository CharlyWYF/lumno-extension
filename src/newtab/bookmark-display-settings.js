(function(root) {
  // Bookmark view mode and bookmark bar surface mode/color preferences:
  // loading, legacy migration, persistence and applying them to the page.
  function createBookmarkDisplaySettings(deps) {
    const {
      storageArea,
      BOOKMARK_VIEW_MODE_STORAGE_KEY,
      applyBookmarkViewMode,
      localStorageArea,
      isPrimaryStorageAreaName,
      NEWTAB_BOOKMARKS_TOPBAR,
      bookmarkTopbarSurfaceStorageArea,
      updateBookmarkModeMenu,
      setNewtabTopLayout,
      scheduleWallpaperAdaptiveToneUpdate,
      initialThemeReadyPromise,
      showToast,
      t,
      BOOKMARK_TOPBAR_PICK_COLOR_ACTION,
      BOOKMARK_TOPBAR_SURFACE_MODE_ACTION,
      BOOKMARK_TOPBAR_LAYOUT_ACTION
    } = deps;

    // Page state still owned by newtab.js; read and written through accessors.
    const pageState = deps.pageState;

    const BOOKMARK_TOPBAR_SURFACE_COLOR_STORAGE_KEY =
      '_x_extension_bookmark_topbar_surface_color_2026_unique_';

    const BOOKMARK_TOPBAR_SURFACE_COLOR_LIGHT_STORAGE_KEY =
      '_x_extension_bookmark_topbar_surface_color_light_2026_unique_';

    const BOOKMARK_TOPBAR_SURFACE_COLOR_DARK_STORAGE_KEY =
      '_x_extension_bookmark_topbar_surface_color_dark_2026_unique_';

    const BOOKMARK_TOPBAR_SURFACE_MODE_STORAGE_KEY =
      '_x_extension_bookmark_topbar_surface_mode_2026_unique_';

    // Docked or floating, kept on this device with the bar's background.
    const BOOKMARK_TOPBAR_LAYOUT_STORAGE_KEY = '_x_extension_bookmark_topbar_layout_2026_unique_';

    const BOOKMARK_TOPBAR_RESET_COLOR_ACTION = 'reset-bookmark-topbar-color';
    let bookmarkTopbarLayout = 'docked';
    let bookmarkTopbarSurfaceMode = 'adaptive';
    let bookmarkTopbarSurfaceModeRevision = 0;
    let currentBookmarkTopbarSurfaceColor = '';
    const bookmarkTopbarSurfaceColors = {
      light: '',
      dark: ''
    };

    const bookmarkTopbarSurfaceColorRevisions = {
      light: 0,
      dark: 0
    };

    function normalizeBookmarkViewMode(value) {
      return value === 'list' || value === 'top' ? value : 'folder';
    }

    function shouldRepairBookmarkViewModeStorageValue(rawValue, normalizedValue) {
      return typeof rawValue !== 'undefined' && rawValue !== normalizedValue;
    }

    function persistBookmarkViewMode(value) {
      const mode = normalizeBookmarkViewMode(value);
      if (!storageArea || typeof storageArea.set !== 'function') {
        return false;
      }
      storageArea.set({ [BOOKMARK_VIEW_MODE_STORAGE_KEY]: mode });
      return true;
    }

    // The page reveals after the view mode is ready; the bar's shape is read alongside it so the bar
    // never changes shape after it first appears.
    const initialBookmarkTopbarLayoutReady = new Promise((resolve) => {
      if (!bookmarkTopbarSurfaceStorageArea ||
          typeof bookmarkTopbarSurfaceStorageArea.get !== 'function') {
        resolve();
        return;
      }
      try {
        bookmarkTopbarSurfaceStorageArea.get([BOOKMARK_TOPBAR_LAYOUT_STORAGE_KEY], (result) => {
          applyBookmarkTopbarLayout(result ? result[BOOKMARK_TOPBAR_LAYOUT_STORAGE_KEY] : undefined, {
            updateMenu: false
          });
          resolve();
        });
      } catch (_error) {
        resolve();
      }
    });

    function settleInitialBookmarkViewModeReady() {
      if (typeof pageState.resolveInitialBookmarkViewModeReady !== 'function') {
        return;
      }
      const resolveReady = pageState.resolveInitialBookmarkViewModeReady;
      pageState.resolveInitialBookmarkViewModeReady = null;
      initialBookmarkTopbarLayoutReady.then(resolveReady);
    }

    function applyInitialBookmarkViewModeValue(rawValue, source, expectedRevision) {
      try {
        const mode = normalizeBookmarkViewMode(rawValue);
        const applyResult = applyBookmarkViewMode(mode, {
          expectedRevision,
          ensureLoaded: true
        });
        if (!applyResult.applied) {
          return;
        }
        if (shouldRepairBookmarkViewModeStorageValue(rawValue, mode) ||
            (source === 'local-fallback' && typeof rawValue !== 'undefined')) {
          persistBookmarkViewMode(mode);
        }
      } finally {
        settleInitialBookmarkViewModeReady();
      }
    }

    function loadInitialBookmarkViewMode() {
      if (!storageArea || typeof storageArea.get !== 'function') {
        settleInitialBookmarkViewModeReady();
        return;
      }
      const expectedRevision = pageState.bookmarkViewModeRevision;
      const readLocalFallback = () => {
        if (!localStorageArea || isPrimaryStorageAreaName('local') ||
            typeof localStorageArea.get !== 'function') {
          applyInitialBookmarkViewModeValue(undefined, 'primary', expectedRevision);
          return;
        }
        try {
          localStorageArea.get([BOOKMARK_VIEW_MODE_STORAGE_KEY], (localResult) => {
            const localValue = localResult
              ? localResult[BOOKMARK_VIEW_MODE_STORAGE_KEY]
              : undefined;
            applyInitialBookmarkViewModeValue(
              localValue,
              'local-fallback',
              expectedRevision
            );
          });
        } catch (_error) {
          applyInitialBookmarkViewModeValue(undefined, 'primary', expectedRevision);
        }
      };
      try {
        storageArea.get([BOOKMARK_VIEW_MODE_STORAGE_KEY], (result) => {
          const stored = result ? result[BOOKMARK_VIEW_MODE_STORAGE_KEY] : undefined;
          if (typeof stored === 'undefined' && !isPrimaryStorageAreaName('local')) {
            readLocalFallback();
            return;
          }
          applyInitialBookmarkViewModeValue(stored, 'primary', expectedRevision);
        });
      } catch (_error) {
        readLocalFallback();
      }
    }

    function getBookmarkTopbarLayout() {
      return bookmarkTopbarLayout;
    }

    function applyBookmarkTopbarLayout(value, options) {
      const config = options && typeof options === 'object' ? options : {};
      bookmarkTopbarLayout = NEWTAB_BOOKMARKS_TOPBAR.normalizeLayout(value);
      if (pageState.bookmarkTopbarRuntime &&
          typeof pageState.bookmarkTopbarRuntime.setLayout === 'function') {
        pageState.bookmarkTopbarRuntime.setLayout(bookmarkTopbarLayout);
      }
      setNewtabTopLayout(bookmarkTopbarLayout);
      if (config.persist === true && bookmarkTopbarSurfaceStorageArea &&
          typeof bookmarkTopbarSurfaceStorageArea.set === 'function') {
        bookmarkTopbarSurfaceStorageArea.set({ [BOOKMARK_TOPBAR_LAYOUT_STORAGE_KEY]: bookmarkTopbarLayout });
      }
      if (config.updateMenu !== false) {
        updateBookmarkModeMenu();
      }
      return bookmarkTopbarLayout;
    }

    function handleBookmarkTopbarLayoutStorageChanges(changes, areaName) {
      if (areaName !== 'local' || !changes[BOOKMARK_TOPBAR_LAYOUT_STORAGE_KEY]) {
        return false;
      }
      applyBookmarkTopbarLayout(changes[BOOKMARK_TOPBAR_LAYOUT_STORAGE_KEY].newValue);
      return true;
    }

    function normalizeBookmarkTopbarSurfaceColor(value) {
      return NEWTAB_BOOKMARKS_TOPBAR.normalizeSurfaceColor(value);
    }

    function isBookmarkTopbarSurfaceMode(value) {
      return value === 'adaptive' ||
        value === 'clear' ||
        value === 'transparent' ||
        value === 'custom';
    }

    function normalizeBookmarkTopbarSurfaceMode(value) {
      return NEWTAB_BOOKMARKS_TOPBAR.normalizeSurfaceMode(value, 'adaptive');
    }

    function getEffectiveBookmarkTopbarSurfaceMode() {
      return bookmarkTopbarSurfaceMode === 'custom' && !currentBookmarkTopbarSurfaceColor
        ? 'adaptive'
        : bookmarkTopbarSurfaceMode;
    }

    function persistBookmarkTopbarSurfaceMode(value) {
      if (!bookmarkTopbarSurfaceStorageArea ||
          typeof bookmarkTopbarSurfaceStorageArea.set !== 'function') {
        return false;
      }
      bookmarkTopbarSurfaceStorageArea.set({
        [BOOKMARK_TOPBAR_SURFACE_MODE_STORAGE_KEY]: normalizeBookmarkTopbarSurfaceMode(value)
      });
      return true;
    }

    function syncBookmarkTopbarSurfaceAppearance(options) {
      const config = options && typeof options === 'object' ? options : {};
      const effectiveMode = getEffectiveBookmarkTopbarSurfaceMode();
      if (pageState.bookmarkTopbarRuntime) {
        if (typeof pageState.bookmarkTopbarRuntime.setLayout === 'function') {
          pageState.bookmarkTopbarRuntime.setLayout(bookmarkTopbarLayout);
        }
        if (typeof pageState.bookmarkTopbarRuntime.setSurfaceMode === 'function') {
          pageState.bookmarkTopbarRuntime.setSurfaceMode(effectiveMode);
        }
        if (typeof pageState.bookmarkTopbarRuntime.setSurfaceColor === 'function') {
          pageState.bookmarkTopbarRuntime.setSurfaceColor(
            effectiveMode === 'custom' ? currentBookmarkTopbarSurfaceColor : ''
          );
        }
      }
      if (config.updateMenu !== false) {
        updateBookmarkModeMenu();
      }
      if (config.scheduleTone !== false) {
        scheduleWallpaperAdaptiveToneUpdate();
      }
      return effectiveMode;
    }

    function applyBookmarkTopbarSurfaceMode(value, options) {
      const config = options && typeof options === 'object' ? options : {};
      if (Object.prototype.hasOwnProperty.call(config, 'expectedRevision') &&
          config.expectedRevision !== bookmarkTopbarSurfaceModeRevision) {
        return bookmarkTopbarSurfaceMode;
      }
      const nextMode = normalizeBookmarkTopbarSurfaceMode(value);
      if (nextMode !== bookmarkTopbarSurfaceMode || config.persist === true) {
        bookmarkTopbarSurfaceModeRevision += 1;
      }
      bookmarkTopbarSurfaceMode = nextMode;
      syncBookmarkTopbarSurfaceAppearance({
        updateMenu: config.updateMenu !== false,
        scheduleTone: config.scheduleTone !== false
      });
      if (config.persist === true) {
        persistBookmarkTopbarSurfaceMode(nextMode);
      }
      return nextMode;
    }

    function loadInitialBookmarkTopbarSurfaceMode() {
      if (!bookmarkTopbarSurfaceStorageArea ||
          typeof bookmarkTopbarSurfaceStorageArea.get !== 'function') {
        return;
      }
      const expectedRevision = bookmarkTopbarSurfaceModeRevision;
      initialThemeReadyPromise.then(() => {
        const currentThemeColorKey = getBookmarkTopbarSurfaceColorStorageKey(
          getCurrentBookmarkTopbarResolvedTheme()
        );
        bookmarkTopbarSurfaceStorageArea.get([
          BOOKMARK_TOPBAR_SURFACE_MODE_STORAGE_KEY,
          currentThemeColorKey,
          BOOKMARK_TOPBAR_SURFACE_COLOR_STORAGE_KEY
        ], (result) => {
          if (bookmarkTopbarSurfaceModeRevision !== expectedRevision) {
            return;
          }
          const rawMode = result && result[BOOKMARK_TOPBAR_SURFACE_MODE_STORAGE_KEY];
          const storedColor = normalizeBookmarkTopbarSurfaceColor(
            result && (result[currentThemeColorKey] ||
              result[BOOKMARK_TOPBAR_SURFACE_COLOR_STORAGE_KEY])
          );
          applyBookmarkTopbarSurfaceMode(
            isBookmarkTopbarSurfaceMode(rawMode)
              ? rawMode
              : (storedColor ? 'custom' : 'adaptive'),
            {
              expectedRevision,
              persist: !isBookmarkTopbarSurfaceMode(rawMode),
              updateMenu: true,
              scheduleTone: true
            }
          );
        });
      });
    }

    function normalizeBookmarkTopbarResolvedTheme(value) {
      return value === 'dark' ? 'dark' : 'light';
    }

    function getCurrentBookmarkTopbarResolvedTheme() {
      return normalizeBookmarkTopbarResolvedTheme(
        document.body ? document.body.getAttribute('data-theme') : 'light'
      );
    }

    function getBookmarkTopbarSurfaceColorStorageKey(resolvedTheme) {
      return normalizeBookmarkTopbarResolvedTheme(resolvedTheme) === 'dark'
        ? BOOKMARK_TOPBAR_SURFACE_COLOR_DARK_STORAGE_KEY
        : BOOKMARK_TOPBAR_SURFACE_COLOR_LIGHT_STORAGE_KEY;
    }

    function persistBookmarkTopbarSurfaceColor(value, resolvedTheme) {
      const theme = normalizeBookmarkTopbarResolvedTheme(
        resolvedTheme || getCurrentBookmarkTopbarResolvedTheme()
      );
      const color = normalizeBookmarkTopbarSurfaceColor(value);
      if (!bookmarkTopbarSurfaceStorageArea ||
          typeof bookmarkTopbarSurfaceStorageArea.set !== 'function') {
        return false;
      }
      bookmarkTopbarSurfaceStorageArea.set({
        [getBookmarkTopbarSurfaceColorStorageKey(theme)]: color
      });
      return true;
    }

    function applyBookmarkTopbarSurfaceColor(value, options) {
      const config = options && typeof options === 'object' ? options : {};
      const theme = normalizeBookmarkTopbarResolvedTheme(
        config.resolvedTheme || getCurrentBookmarkTopbarResolvedTheme()
      );
      if (Object.prototype.hasOwnProperty.call(config, 'expectedRevision') &&
          config.expectedRevision !== bookmarkTopbarSurfaceColorRevisions[theme]) {
        return bookmarkTopbarSurfaceColors[theme];
      }
      const color = normalizeBookmarkTopbarSurfaceColor(value);
      if (color !== bookmarkTopbarSurfaceColors[theme]) {
        bookmarkTopbarSurfaceColorRevisions[theme] += 1;
      }
      bookmarkTopbarSurfaceColors[theme] = color;
      if (theme === getCurrentBookmarkTopbarResolvedTheme()) {
        currentBookmarkTopbarSurfaceColor = color;
        syncBookmarkTopbarSurfaceAppearance({
          updateMenu: config.updateMenu !== false,
          scheduleTone: false
        });
      }
      if (config.persist === true) {
        persistBookmarkTopbarSurfaceColor(color, theme);
      }
      return color;
    }

    function syncBookmarkTopbarSurfaceColorForTheme(resolvedTheme, options) {
      const theme = normalizeBookmarkTopbarResolvedTheme(resolvedTheme);
      return applyBookmarkTopbarSurfaceColor(bookmarkTopbarSurfaceColors[theme], {
        resolvedTheme: theme,
        updateMenu: !options || options.updateMenu !== false
      });
    }

    function removeLegacyBookmarkTopbarSurfaceColor() {
      if (!bookmarkTopbarSurfaceStorageArea ||
          typeof bookmarkTopbarSurfaceStorageArea.remove !== 'function') {
        return false;
      }
      bookmarkTopbarSurfaceStorageArea.remove(BOOKMARK_TOPBAR_SURFACE_COLOR_STORAGE_KEY);
      return true;
    }

    function migrateLegacyBookmarkTopbarSurfaceColor(value) {
      const color = normalizeBookmarkTopbarSurfaceColor(value);
      if (!color) {
        removeLegacyBookmarkTopbarSurfaceColor();
        return;
      }
      const theme = getCurrentBookmarkTopbarResolvedTheme();
      const storageKey = getBookmarkTopbarSurfaceColorStorageKey(theme);
      if (!bookmarkTopbarSurfaceStorageArea ||
          typeof bookmarkTopbarSurfaceStorageArea.get !== 'function') {
        applyBookmarkTopbarSurfaceColor(color, {
          resolvedTheme: theme,
          persist: true
        });
        removeLegacyBookmarkTopbarSurfaceColor();
        return;
      }
      bookmarkTopbarSurfaceStorageArea.get([storageKey], (result) => {
        if (!result || typeof result[storageKey] === 'undefined') {
          applyBookmarkTopbarSurfaceColor(color, {
            resolvedTheme: theme,
            persist: true
          });
        }
        removeLegacyBookmarkTopbarSurfaceColor();
      });
    }

    function getBookmarkTopbarSurfaceColorStorageKeys() {
      return [
        BOOKMARK_TOPBAR_SURFACE_COLOR_LIGHT_STORAGE_KEY,
        BOOKMARK_TOPBAR_SURFACE_COLOR_DARK_STORAGE_KEY,
        BOOKMARK_TOPBAR_SURFACE_COLOR_STORAGE_KEY
      ];
    }

    function getBookmarkTopbarSurfaceCleanupKeys() {
      return [
        BOOKMARK_TOPBAR_SURFACE_MODE_STORAGE_KEY,
        ...getBookmarkTopbarSurfaceColorStorageKeys()
      ];
    }

    function applyInitialBookmarkTopbarSurfaceColors(result, readRevisions) {
      [
        {
          key: BOOKMARK_TOPBAR_SURFACE_COLOR_LIGHT_STORAGE_KEY,
          resolvedTheme: 'light'
        },
        {
          key: BOOKMARK_TOPBAR_SURFACE_COLOR_DARK_STORAGE_KEY,
          resolvedTheme: 'dark'
        }
      ].forEach((entry) => {
        if (bookmarkTopbarSurfaceColorRevisions[entry.resolvedTheme] !==
            readRevisions[entry.resolvedTheme]) {
          return;
        }
        const rawColor = result ? result[entry.key] : undefined;
        const color = applyBookmarkTopbarSurfaceColor(rawColor, {
          resolvedTheme: entry.resolvedTheme,
          updateMenu: true
        });
        if (rawColor && rawColor !== color) {
          persistBookmarkTopbarSurfaceColor(color, entry.resolvedTheme);
        }
      });
    }

    function loadInitialBookmarkTopbarSurfaceColors() {
      const localArea = bookmarkTopbarSurfaceStorageArea;
      if (!localArea || typeof localArea.get !== 'function') {
        return;
      }
      const colorKeys = getBookmarkTopbarSurfaceColorStorageKeys();
      const cleanupKeys = getBookmarkTopbarSurfaceCleanupKeys();
      const syncArea = chrome && chrome.storage ? chrome.storage.sync : null;
      initialThemeReadyPromise.then(() => {
        localArea.get(colorKeys, (localResult) => {
          const resolvedLocalResult = Object.assign({}, localResult || {});
          const localUpdates = {};
          const hasLocalLegacyColor = Object.prototype.hasOwnProperty.call(
            resolvedLocalResult,
            BOOKMARK_TOPBAR_SURFACE_COLOR_STORAGE_KEY
          );
          const localLegacyColor = resolvedLocalResult[BOOKMARK_TOPBAR_SURFACE_COLOR_STORAGE_KEY];
          const currentThemeKey = getBookmarkTopbarSurfaceColorStorageKey(
            getCurrentBookmarkTopbarResolvedTheme()
          );
          if (typeof localLegacyColor !== 'undefined' &&
              typeof resolvedLocalResult[currentThemeKey] === 'undefined') {
            resolvedLocalResult[currentThemeKey] = localLegacyColor;
            localUpdates[currentThemeKey] = localLegacyColor;
          }
          delete resolvedLocalResult[BOOKMARK_TOPBAR_SURFACE_COLOR_STORAGE_KEY];
          const readRevisions = {
            light: bookmarkTopbarSurfaceColorRevisions.light,
            dark: bookmarkTopbarSurfaceColorRevisions.dark
          };
          const finishLocalMigration = () => {
            if (hasLocalLegacyColor && typeof localArea.remove === 'function') {
              localArea.remove(BOOKMARK_TOPBAR_SURFACE_COLOR_STORAGE_KEY);
            }
            applyInitialBookmarkTopbarSurfaceColors(resolvedLocalResult, readRevisions);
          };
          if (Object.keys(localUpdates).length > 0 && typeof localArea.set === 'function') {
            localArea.set(localUpdates, finishLocalMigration);
            return;
          }
          finishLocalMigration();
        });
        if (syncArea && syncArea !== localArea && typeof syncArea.remove === 'function') {
          syncArea.remove(cleanupKeys, () => {
            void (chrome.runtime && chrome.runtime.lastError);
          });
        }
      });
    }

    function handleBookmarkTopbarSurfaceColorStorageChanges(changes, areaName) {
      if (areaName !== 'local') {
        return false;
      }
      let handled = false;
      if (changes[BOOKMARK_TOPBAR_SURFACE_MODE_STORAGE_KEY]) {
        handled = true;
        applyBookmarkTopbarSurfaceMode(
          changes[BOOKMARK_TOPBAR_SURFACE_MODE_STORAGE_KEY].newValue,
          { updateMenu: true, scheduleTone: true }
        );
      }
      [
        {
          key: BOOKMARK_TOPBAR_SURFACE_COLOR_LIGHT_STORAGE_KEY,
          resolvedTheme: 'light'
        },
        {
          key: BOOKMARK_TOPBAR_SURFACE_COLOR_DARK_STORAGE_KEY,
          resolvedTheme: 'dark'
        }
      ].forEach((entry) => {
        if (!changes[entry.key]) {
          return;
        }
        handled = true;
        const rawColor = changes[entry.key].newValue;
        const color = applyBookmarkTopbarSurfaceColor(rawColor, {
          resolvedTheme: entry.resolvedTheme,
          updateMenu: true
        });
        if (rawColor && rawColor !== color) {
          persistBookmarkTopbarSurfaceColor(color, entry.resolvedTheme);
        }
      });
      if (changes[BOOKMARK_TOPBAR_SURFACE_COLOR_STORAGE_KEY] &&
          typeof changes[BOOKMARK_TOPBAR_SURFACE_COLOR_STORAGE_KEY].newValue !== 'undefined') {
        handled = true;
        initialThemeReadyPromise.then(() => {
          migrateLegacyBookmarkTopbarSurfaceColor(
            changes[BOOKMARK_TOPBAR_SURFACE_COLOR_STORAGE_KEY].newValue
          );
        });
      }
      return handled;
    }

    function pickBookmarkTopbarSurfaceColor() {
      if (!window || typeof window.EyeDropper !== 'function') {
        showToast(t(
          'bookmark_topbar_color_unsupported',
          'Screen color picking is not supported in this browser.'
        ), true);
        return Promise.resolve(false);
      }
      let request;
      try {
        request = new window.EyeDropper().open();
      } catch (error) {
        showToast(t('bookmark_topbar_color_failed', 'Could not pick a color. Try again.'), true);
        return Promise.resolve(false);
      }
      return request.then((result) => {
        const color = normalizeBookmarkTopbarSurfaceColor(result && result.sRGBHex);
        if (!color) {
          showToast(t('bookmark_topbar_color_failed', 'Could not pick a color. Try again.'), true);
          return false;
        }
        applyBookmarkTopbarSurfaceColor(color, { persist: true, updateMenu: false });
        applyBookmarkTopbarSurfaceMode('custom', { persist: true });
        showToast(t('bookmark_topbar_color_picked', 'Color picked'));
        return true;
      }).catch((error) => {
        if (error && error.name === 'AbortError') {
          return false;
        }
        showToast(t('bookmark_topbar_color_failed', 'Could not pick a color. Try again.'), true);
        return false;
      });
    }

    function resetBookmarkTopbarSurfaceColor() {
      applyBookmarkTopbarSurfaceColor('', { persist: true, updateMenu: false });
      applyBookmarkTopbarSurfaceMode('adaptive', { persist: true });
      showToast(t('bookmark_topbar_color_reset_done', 'Automatic colors restored'));
    }

    function handleBookmarkModeMenuAction(action) {
      if (action === BOOKMARK_TOPBAR_PICK_COLOR_ACTION) {
        pickBookmarkTopbarSurfaceColor();
        return;
      }
      if (action === BOOKMARK_TOPBAR_RESET_COLOR_ACTION) {
        resetBookmarkTopbarSurfaceColor();
        return;
      }
      const layoutPrefix = `${BOOKMARK_TOPBAR_LAYOUT_ACTION}:`;
      if (String(action || '').startsWith(layoutPrefix)) {
        applyBookmarkTopbarLayout(String(action).slice(layoutPrefix.length), { persist: true });
        return;
      }
      const surfaceModePrefix = `${BOOKMARK_TOPBAR_SURFACE_MODE_ACTION}:`;
      if (String(action || '').startsWith(surfaceModePrefix)) {
        const nextMode = String(action).slice(surfaceModePrefix.length);
        if (nextMode === 'adaptive' ||
            nextMode === 'clear' ||
            nextMode === 'transparent') {
          applyBookmarkTopbarSurfaceMode(nextMode, { persist: true });
        }
      }
    }

    return {
      normalizeBookmarkViewMode,
      shouldRepairBookmarkViewModeStorageValue,
      persistBookmarkViewMode,
      loadInitialBookmarkViewMode,
      getEffectiveBookmarkTopbarSurfaceMode,
      getBookmarkTopbarLayout,
      applyBookmarkTopbarLayout,
      handleBookmarkTopbarLayoutStorageChanges,
      syncBookmarkTopbarSurfaceAppearance,
      loadInitialBookmarkTopbarSurfaceMode,
      syncBookmarkTopbarSurfaceColorForTheme,
      loadInitialBookmarkTopbarSurfaceColors,
      handleBookmarkTopbarSurfaceColorStorageChanges,
      handleBookmarkModeMenuAction
    };
  }

  root.LumnoNewtabBookmarkDisplaySettings = { createBookmarkDisplaySettings };
})(globalThis);
