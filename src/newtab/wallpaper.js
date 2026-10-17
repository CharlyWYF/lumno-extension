(function() {
  const WALLPAPER_ADAPTIVE_TONE = globalThis.LumnoNewtabWallpaperAdaptiveTone;
  const WALLPAPER_EFFECTS = globalThis.LumnoNewtabWallpaperEffects;
  const WALLPAPER_LOCAL_STORE = globalThis.LumnoNewtabWallpaperLocalStore;
  const SETTINGS = globalThis.LumnoSettings;
  const REMOTE_CONTENT = globalThis.LumnoNewtabRemoteContent;
  const DEFAULT_STORAGE_KEYS = {
    wallpaper: '_x_extension_newtab_wallpaper_2026_unique_',
    localWallpaper: '_x_extension_newtab_local_wallpaper_2026_unique_',
    onlineWallpaper: SETTINGS.NEWTAB_ONLINE_WALLPAPER_STORAGE_KEY,
    linkWallpapers: SETTINGS.NEWTAB_LINK_WALLPAPERS_STORAGE_KEY,
    dailyWallpaperPicks: SETTINGS.NEWTAB_DAILY_WALLPAPER_PICKS_STORAGE_KEY,
    overlay: '_x_extension_newtab_wallpaper_overlay_2026_unique_',
    effect: '_x_extension_newtab_wallpaper_effect_2026_unique_',
    topContentMode: SETTINGS.NEWTAB_TOP_CONTENT_MODE_STORAGE_KEY ||
      '_x_extension_newtab_wordmark_visible_2026_unique_',
    timeFontWeight: SETTINGS.NEWTAB_TIME_FONT_WEIGHT_STORAGE_KEY ||
      '_x_extension_newtab_time_font_weight_2026_unique_',
    timeSecondsVisible: SETTINGS.NEWTAB_TIME_SECONDS_VISIBLE_STORAGE_KEY ||
      '_x_extension_newtab_time_seconds_visible_2026_unique_',
    favicon: '_x_extension_newtab_favicon_2026_unique_'
  };
  const PRELOAD_STORAGE_KEY = '_x_extension_newtab_wallpaper_preload_2026_unique_';
  const PRELOAD_STORAGE_VERSION = 4;
  const WALLPAPER_EFFECT_MODE_STORAGE_VERSION = 11;
  const NEWTAB_TIME_FONT_WEIGHT_MIN = Number(SETTINGS.NEWTAB_TIME_FONT_WEIGHT_MIN) || 300;
  const NEWTAB_TIME_FONT_WEIGHT_MAX = Number(SETTINGS.NEWTAB_TIME_FONT_WEIGHT_MAX) || 800;
  const NEWTAB_TIME_FONT_WEIGHT_DEFAULT = Number(SETTINGS.NEWTAB_TIME_FONT_WEIGHT_DEFAULT) || 320;
  const CRT_PARAMETER_PHYSICAL_MAX = Object.freeze({
    crtStrength: 20,
    crtBloom: 20,
    crtRgbOffset: 100,
    crtCurvature: 35
  });
  const BLOCK_PARAMETER_MAX = 5;
  function getCrtParameterPercent(key, value) {
    const physicalMax = CRT_PARAMETER_PHYSICAL_MAX[key];
    const number = Number(value);
    if (!Number.isFinite(physicalMax) || !Number.isFinite(number) || physicalMax <= 0) {
      return 0;
    }
    return Math.round(Math.max(0, Math.min(100, (number / physicalMax) * 100)));
  }

  function getCrtParameterPhysicalValue(key, percent) {
    const physicalMax = CRT_PARAMETER_PHYSICAL_MAX[key];
    const number = Number(percent);
    if (!Number.isFinite(physicalMax) || !Number.isFinite(number) || physicalMax <= 0) {
      return 0;
    }
    return Math.round((Math.max(0, Math.min(100, number)) / 100) * physicalMax * 1000) / 1000;
  }

  // For failures nothing on the page can recover from but that should not happen,
  // such as IndexedDB refusing a read; expected ones (offline photo requests) are
  // caught where they occur, with the reason.
  function warnWallpaperFailure(message) {
    return (error) => {
      console.warn(`[Lumno] ${message}`, error);
    };
  }

  // Runs once the next frame has painted: the first frame's callback still runs
  // before that frame paints, so it takes two.
  function afterNextPaint(windowObj, callback) {
    windowObj.requestAnimationFrame(() => {
      windowObj.requestAnimationFrame(callback);
    });
  }

  // One pending save per setting while a slider moves: each change restarts the
  // wait, and a final change (the end of a drag, a typed value) saves at once.
  function createDebouncedSaver(windowObj, delayMs) {
    const timers = new Map();
    return function save(key, write, options) {
      if (timers.has(key)) {
        windowObj.clearTimeout(timers.get(key));
        timers.delete(key);
      }
      if (options && options.final) {
        write();
        return;
      }
      timers.set(key, windowObj.setTimeout(() => {
        timers.delete(key);
        write();
      }, delayMs));
    };
  }

  function normalizeSingleWallpaperEffectPrefs(value, inheritedVersion) {
    return WALLPAPER_EFFECTS.normalizePrefs(value, inheritedVersion);
  }

  function normalizeWallpaperEffectStoragePrefs(value) {
    return WALLPAPER_EFFECTS.normalizeStoragePrefs(value);
  }

  function createWallpaperRuntime(options) {
    options = options || {};
    const documentObj = options.documentObj || document;
    const windowObj = options.windowObj || window;
    const document = documentObj;
    const window = windowObj;
    const chrome = options.chromeObj || globalThis.chrome || {};
    const extensionRoutes = options.extensionRoutes || globalThis.LumnoExtensionRoutes || {};
    const storageArea = options.storageArea || null;
    const localWallpaperStorageArea = options.localWallpaperStorageArea || null;
    const wallpaperView = options.view || globalThis.LumnoNewtabWallpaperView || null;
    const storageKeys = Object.assign({}, DEFAULT_STORAGE_KEYS, options.storageKeys || {});
    const NEWTAB_WALLPAPER_STORAGE_KEY = storageKeys.wallpaper;
    const NEWTAB_LOCAL_WALLPAPER_STORAGE_KEY = storageKeys.localWallpaper;
    const NEWTAB_ONLINE_WALLPAPER_STORAGE_KEY = storageKeys.onlineWallpaper;
    const NEWTAB_LINK_WALLPAPERS_STORAGE_KEY = storageKeys.linkWallpapers;
    const NEWTAB_DAILY_WALLPAPER_PICKS_STORAGE_KEY = storageKeys.dailyWallpaperPicks;
    const NEWTAB_WALLPAPER_OVERLAY_STORAGE_KEY = storageKeys.overlay;
    const NEWTAB_WALLPAPER_EFFECT_STORAGE_KEY = storageKeys.effect;
    const NEWTAB_TOP_CONTENT_MODE_STORAGE_KEY = storageKeys.topContentMode;
    const NEWTAB_TIME_FONT_WEIGHT_STORAGE_KEY = storageKeys.timeFontWeight;
    const NEWTAB_TIME_SECONDS_VISIBLE_STORAGE_KEY = storageKeys.timeSecondsVisible;
    const NEWTAB_FAVICON_STORAGE_KEY = storageKeys.favicon;
    const t = typeof options.t === 'function'
      ? options.t
      : function(_key, fallback) { return fallback || ''; };
    const formatMessage = typeof options.formatMessage === 'function'
      ? options.formatMessage
      : function(_key, fallback, params) {
        let text = fallback || '';
        Object.keys(params || {}).forEach((token) => {
          text = text.replace(new RegExp('\\{' + token + '\\}', 'g'), params[token]);
        });
        return text;
      };
    const getThemeMode = typeof options.getThemeMode === 'function'
      ? options.getThemeMode
      : function() { return 'system'; };
    const getEffectiveThemeMode = typeof options.getEffectiveThemeMode === 'function'
      ? options.getEffectiveThemeMode
      : getThemeMode;
    const getThemeScope = typeof options.getThemeScope === 'function'
      ? options.getThemeScope
      : function() { return 'global'; };
    const setThemeMode = typeof options.setThemeMode === 'function'
      ? options.setThemeMode
      : function() {};
    const setThemeScope = typeof options.setThemeScope === 'function'
      ? options.setThemeScope
      : function() {};
    const BroadcastChannelCtor = typeof options.BroadcastChannel === 'function'
      ? options.BroadcastChannel
      : (window && typeof window.BroadcastChannel === 'function'
        ? window.BroadcastChannel
        : (typeof globalThis.BroadcastChannel === 'function' ? globalThis.BroadcastChannel : null));
    // New Tab passes LumnoNewtabLayout.SEARCH_WIDTH_CONFIG; these defaults mirror it.
    const searchWidthConfig = Object.assign({
      min: 640,
      max: 1040,
      fallback: 920,
      snapPoints: [640, 720, 920, 1040],
      snapThreshold: 14
    }, options.searchWidthConfig || {});
    const getSearchWidth = typeof options.getSearchWidth === 'function'
      ? options.getSearchWidth
      : function() { return searchWidthConfig.fallback; };
    const setSearchWidth = typeof options.setSearchWidth === 'function'
      ? options.setSearchWidth
      : function() {};
    const shortcutColumnsConfig = Object.assign({
      min: 4,
      max: 16,
      fallback: 10
    }, options.shortcutColumnsConfig || {});
    const shortcutSizeConfig = Object.assign({
      min: 48,
      max: 80,
      fallback: 64
    }, options.shortcutSizeConfig || {});
    const shortcutGapConfig = Object.assign({
      min: 0,
      max: 24,
      fallback: 4
    }, options.shortcutGapConfig || {});
    const getShortcutsVisible = typeof options.getShortcutsVisible === 'function'
      ? options.getShortcutsVisible
      : function() { return true; };
    const setShortcutsVisible = typeof options.setShortcutsVisible === 'function'
      ? options.setShortcutsVisible
      : function() {};
    const getShortcutAddVisible = typeof options.getShortcutAddVisible === 'function'
      ? options.getShortcutAddVisible
      : function() { return true; };
    const setShortcutAddVisible = typeof options.setShortcutAddVisible === 'function'
      ? options.setShortcutAddVisible
      : function() {};
    const getShortcutDockMagnificationEnabled =
      typeof options.getShortcutDockMagnificationEnabled === 'function'
        ? options.getShortcutDockMagnificationEnabled
        : function() { return true; };
    const setShortcutDockMagnificationEnabled =
      typeof options.setShortcutDockMagnificationEnabled === 'function'
        ? options.setShortcutDockMagnificationEnabled
        : function() {};
    const getShortcutColumns = typeof options.getShortcutColumns === 'function'
      ? options.getShortcutColumns
      : function() { return shortcutColumnsConfig.fallback; };
    const setShortcutColumns = typeof options.setShortcutColumns === 'function'
      ? options.setShortcutColumns
      : function() {};
    const getShortcutSize = typeof options.getShortcutSize === 'function'
      ? options.getShortcutSize
      : function() { return shortcutSizeConfig.fallback; };
    const setShortcutSize = typeof options.setShortcutSize === 'function'
      ? options.setShortcutSize
      : function() {};
    const getShortcutGap = typeof options.getShortcutGap === 'function'
      ? options.getShortcutGap
      : function() { return shortcutGapConfig.fallback; };
    const setShortcutGap = typeof options.setShortcutGap === 'function'
      ? options.setShortcutGap
      : function() {};
    const featureHints = options.featureHints || globalThis.LumnoFeatureHints || {};
    const getInputAutoFocusEnabled = typeof options.getInputAutoFocusEnabled === 'function'
      ? options.getInputAutoFocusEnabled
      : function() { return false; };
    const setInputAutoFocusEnabled = typeof options.setInputAutoFocusEnabled === 'function'
      ? options.setInputAutoFocusEnabled
      : function() {};
    const inputAutoFocusReady = options.inputAutoFocusReady &&
      typeof options.inputAutoFocusReady.then === 'function'
      ? options.inputAutoFocusReady
      : Promise.resolve();
    const getGlassStyle = typeof options.getGlassStyle === 'function'
      ? options.getGlassStyle
      : function() { return 'none'; };
    const setGlassStyle = typeof options.setGlassStyle === 'function'
      ? options.setGlassStyle
      : function() {};
    const featureHintVisibilityGate = options.featureHintVisibilityGate &&
      typeof options.featureHintVisibilityGate.then === 'function'
      ? options.featureHintVisibilityGate
      : null;
    const getRiSvg = typeof options.getRiSvg === 'function'
      ? options.getRiSvg
      : function(id, sizeClass) {
        const size = sizeClass || 'ri-size-16';
        return '<i class="ri-icon ' + size + ' ' + id + '" aria-hidden="true"></i>';
      };
    const showToast = typeof options.showToast === 'function' ? options.showToast : function() {};
    const beginToast = typeof options.beginToast === 'function'
      ? options.beginToast
      : function() {
        return {
          update() {},
          done(result) { if (result) showToast(result, false); },
          fail(result) { if (result) showToast(result, true); },
          cancel() {}
        };
      };
    const showTopActionTooltip = typeof options.showTopActionTooltip === 'function'
      ? options.showTopActionTooltip
      : function() {};
    const hideTopActionTooltip = typeof options.hideTopActionTooltip === 'function'
      ? options.hideTopActionTooltip
      : function() {};
    const applyWordmarkThemeAppearance = typeof options.applyWordmarkThemeAppearance === 'function'
      ? options.applyWordmarkThemeAppearance
      : function() {};
    const hasTopContentModeGetter = typeof options.getTopContentMode === 'function';
    const getTopContentMode = hasTopContentModeGetter
      ? options.getTopContentMode
      : function() { return 'brand'; };
    const setTopContentMode = typeof options.setTopContentMode === 'function'
      ? options.setTopContentMode
      : function() {};
    const hasTimeFontWeightGetter = typeof options.getTimeFontWeight === 'function';
    const getTimeFontWeight = hasTimeFontWeightGetter
      ? options.getTimeFontWeight
      : function() { return NEWTAB_TIME_FONT_WEIGHT_DEFAULT; };
    const setTimeFontWeight = typeof options.setTimeFontWeight === 'function'
      ? options.setTimeFontWeight
      : function() {};
    const hasTimeSecondsVisibleGetter = typeof options.getTimeSecondsVisible === 'function';
    const getTimeSecondsVisible = hasTimeSecondsVisibleGetter
      ? options.getTimeSecondsVisible
      : function() { return false; };
    const setTimeSecondsVisible = typeof options.setTimeSecondsVisible === 'function'
      ? options.setTimeSecondsVisible
      : function() {};
    const getAdaptiveToneTargets = typeof options.getAdaptiveToneTargets === 'function'
      ? options.getAdaptiveToneTargets
      : function() { return []; };
    const localWallpaperStore = WALLPAPER_LOCAL_STORE.createWallpaperLocalStore({
      documentObj,
      windowObj
    });
    const wallpaperImageCache = typeof WALLPAPER_LOCAL_STORE.createWallpaperImageCache === 'function'
      ? WALLPAPER_LOCAL_STORE.createWallpaperImageCache({ windowObj })
      : null;
    // Pages without IndexedDB (some private windows) simply have no local copies;
    // any other failure of the stores is unexpected and worth a warning.
    function warnWallpaperStoreFailure(message) {
      const warn = warnWallpaperFailure(message);
      return (error) => {
        if (windowObj && windowObj.indexedDB) {
          warn(error);
        }
      };
    }
    const remoteClient = REMOTE_CONTENT.createClient({
      storageArea: localWallpaperStorageArea,
      fetch: options.fetchRemoteContent,
      getLanguage: () => document.documentElement && document.documentElement.lang ||
        (chrome.i18n && chrome.i18n.getUILanguage ? chrome.i18n.getUILanguage() : 'en')
    });

    const NEWTAB_WALLPAPER_DEFAULT_DIRECTORY = 'assets/wallpapers';
    const NEWTAB_WALLPAPER_EXTENSION_DIRECTORY = 'assets/wallpapers';
    const NEWTAB_WALLPAPER_THUMBNAIL_SUFFIX = '-thumb.webp';
    const NEWTAB_WALLPAPER_DEFAULT_ID = 'monet-coastal-white';
    const NEWTAB_CUSTOM_WALLPAPER_ID = WALLPAPER_LOCAL_STORE.CUSTOM_WALLPAPER_ID || 'custom-upload';
    const NEWTAB_LOCAL_WALLPAPER_DISABLED_VALUE = '__lumno_local_wallpaper_disabled__';
    const NEWTAB_WALLPAPER_PREFS_STORAGE_VERSION = 2;
    const NEWTAB_WALLPAPER_MODE_LIGHT = 'light';
    const NEWTAB_WALLPAPER_MODE_DARK = 'dark';
    const NEWTAB_WALLPAPER_MODES = [NEWTAB_WALLPAPER_MODE_LIGHT, NEWTAB_WALLPAPER_MODE_DARK];
    const NEWTAB_WALLPAPER_OPTIONS = [
      {
        id: 'dark-linocut-topographic',
        nameKey: 'newtab_wallpaper_name_dark_linocut_topographic',
        fallbackName: 'Night topography',
        file: 'lumno-newtab-dark-linocut-topographic.webp'
      },
      {
        id: 'dark-monet-lily-nocturne',
        nameKey: 'newtab_wallpaper_name_dark_monet_lily_nocturne',
        fallbackName: 'Lily nocturne',
        file: 'lumno-newtab-dark-monet-lily-nocturne.webp'
      },
      {
        id: 'dark-shanshui-moonlit',
        nameKey: 'newtab_wallpaper_name_dark_shanshui_moonlit',
        fallbackName: 'Moonlit shanshui',
        file: 'lumno-newtab-dark-shanshui-moonlit.webp'
      },
      {
        id: 'monet-coastal-white',
        nameKey: 'newtab_wallpaper_name_monet_coastal_white',
        fallbackName: 'Monet coast',
        file: 'lumno-newtab-monet-coastal-white.webp'
      },
      {
        id: 'monet-field-white',
        nameKey: 'newtab_wallpaper_name_monet_field_white',
        fallbackName: 'Monet field',
        file: 'lumno-newtab-monet-field-white.webp'
      },
      {
        id: 'monet-lily-pond-white',
        nameKey: 'newtab_wallpaper_name_monet_lily_pond_white',
        fallbackName: 'Lily pond',
        file: 'lumno-newtab-monet-lily-pond-white.webp'
      },
      {
        id: 'impressionist-orchard-white',
        nameKey: 'newtab_wallpaper_name_impressionist_orchard_white',
        fallbackName: 'Orchard morning',
        file: 'lumno-newtab-impressionist-orchard-white.webp'
      },
      {
        id: 'seurat-coast-white',
        nameKey: 'newtab_wallpaper_name_seurat_coast_white',
        fallbackName: 'Seurat coast',
        file: 'lumno-newtab-seurat-coast-white.webp'
      },
      {
        id: 'seurat-park-white',
        nameKey: 'newtab_wallpaper_name_seurat_park_white',
        fallbackName: 'Seurat park',
        file: 'lumno-newtab-seurat-park-white.webp'
      },
      {
        id: 'seurat-riverside-white',
        nameKey: 'newtab_wallpaper_name_seurat_riverside_white',
        fallbackName: 'Seurat riverside',
        file: 'lumno-newtab-seurat-riverside-white.webp'
      },
      {
        id: 'pointillist-lakeside-white',
        nameKey: 'newtab_wallpaper_name_pointillist_lakeside_white',
        fallbackName: 'Lakeside pointillism',
        file: 'lumno-newtab-pointillist-lakeside-white.webp'
      },
      {
        id: 'white-3d-architecture',
        nameKey: 'newtab_wallpaper_name_white_3d_architecture',
        fallbackName: 'Daylight architecture',
        file: 'lumno-newtab-white-3d-architecture.webp'
      },
      {
        id: 'white-3d-observatory',
        nameKey: 'newtab_wallpaper_name_white_3d_observatory',
        fallbackName: 'Misty observatory',
        file: 'lumno-newtab-white-3d-observatory.webp'
      },
      {
        id: 'white-linocut-topographic',
        nameKey: 'newtab_wallpaper_name_white_linocut_topographic',
        fallbackName: 'Daylight topography',
        file: 'lumno-newtab-white-linocut-topographic.webp'
      },
      {
        id: 'white-risograph-collage',
        nameKey: 'newtab_wallpaper_name_white_risograph_collage',
        fallbackName: 'Daylight collage',
        file: 'lumno-newtab-white-risograph-collage.webp'
      },
      {
        id: 'white-shanshui',
        nameKey: 'newtab_wallpaper_name_white_shanshui',
        fallbackName: 'Clear shanshui',
        file: 'lumno-newtab-white-shanshui.webp'
      },
      {
        id: 'white-shanshui-bamboo-bridge',
        nameKey: 'newtab_wallpaper_name_white_shanshui_bamboo_bridge',
        fallbackName: 'Bamboo bridge',
        file: 'lumno-newtab-white-shanshui-bamboo-bridge.webp'
      },
      {
        id: 'settings-bg-light-monet-newtab',
        nameKey: 'newtab_wallpaper_name_settings_bg_light_monet_newtab',
        fallbackName: 'Monet light',
        file: 'settings-bg-light-monet-newtab.webp'
      }
    ];
    const NEWTAB_WALLPAPER_OVERLAY_STORAGE_VERSION = 2;
    const NEWTAB_WALLPAPER_OVERLAY_DEFAULTS = { light: 50, dark: 50 };
    const NEWTAB_WALLPAPER_OVERLAY_SNAP_POINTS = [0, 50, 100];
    const NEWTAB_WALLPAPER_OVERLAY_SNAP_THRESHOLD = 4;
    const NEWTAB_WALLPAPER_OVERLAY_STOPS = {
      light: { top: 54, mid: 20, bottom: 38 },
      dark: { top: 44, mid: 20, bottom: 50 }
    };
    const NEWTAB_WALLPAPER_EFFECT_DEFAULTS = WALLPAPER_EFFECTS.DEFAULT_PREFS || {
      version: 11,
      type: 'none',
      inkTone: 'auto',
      strength: 50,
      size: 50,
      spacing: 50,
      texture: 20,
      blockSize: 1,
      crtStrength: 20,
      crtBloom: 15,
      crtRgbOffset: 35,
      crtCurvature: 18
    };
    const NEWTAB_WALLPAPER_EFFECT_TYPES = [
      { type: 'none', labelKey: 'newtab_wallpaper_effect_none', fallback: 'Off' },
      { type: 'blur', labelKey: 'newtab_wallpaper_effect_blur', fallback: 'Glass blur' },
      { type: 'grain', labelKey: 'newtab_wallpaper_effect_grain', fallback: 'Grain' },
      { type: 'blocks', labelKey: 'newtab_wallpaper_effect_blocks', fallback: 'Blocks' },
      { type: 'halftone', labelKey: 'newtab_wallpaper_effect_halftone', fallback: 'Halftone' },
      { type: 'dither', labelKey: 'newtab_wallpaper_effect_dither', fallback: 'Dither' },
      { type: 'ascii', labelKey: 'newtab_wallpaper_effect_ascii', fallback: 'ASCII' },
      { type: 'crt', labelKey: 'newtab_wallpaper_effect_crt', fallback: 'CRT' }
    ];
    const NEWTAB_WALLPAPER_EFFECT_INK_TONES = [
      { tone: 'dark', labelKey: 'newtab_wallpaper_effect_ink_dark', fallback: 'Shadows' },
      { tone: 'light', labelKey: 'newtab_wallpaper_effect_ink_light', fallback: 'Highlights' }
    ];
    const NEWTAB_FAVICON_DEFAULT_ID = 'default';
    const NEWTAB_FAVICON_OPTIONS = [
      {
        id: 'default',
        nameKey: 'newtab_favicon_name_default',
        fallbackName: 'Default',
        file: 'assets/images/lumno.png',
        type: 'image/png'
      },
      {
        id: 'alternate',
        nameKey: 'newtab_favicon_name_alternate',
        fallbackName: 'Alternate',
        file: 'assets/images/lumno-newtab-favicon.svg',
        preview: 'inlineSvg',
        themeAwareSvg: true,
        type: 'image/svg+xml',
        sizes: 'any'
      }
    ];
    const NEWTAB_FAVICON_THEME_QUERY = '(prefers-color-scheme: dark)';
    const NEWTAB_FAVICON_THEME_BROADCAST_CHANNEL = 'lumno:newtab-favicon-theme';
    const NEWTAB_FAVICON_THEME_REFRESH_ACTION = 'lumno:newtab-favicon-theme-refresh';
    const NEWTAB_FAVICON_PRELOAD_STORAGE_KEY = '_x_extension_newtab_favicon_preload_2026_unique_';
    const NEWTAB_FAVICON_SVG_SHADOW_PATH = 'M14.1832 28.5107C14.7736 26.0503 17.4872 24.8712 19.8045 25.8872L29.0688 29.9483C23.1024 42.5571 20.9583 59.1892 34.0764 74.4517C35.5367 76.1508 37.0158 77.6786 38.5039 79.0511C15.0742 61.6944 10.3754 44.3784 14.1832 28.5107ZM50.1563 62.6667C55.3534 57.1072 64.2555 57.3891 69.0898 63.2669L69.4706 63.7295C65.5069 61.937 61.0203 61.3468 56.5866 62.1747L49.3526 63.5259L50.1563 62.6667Z';
    const NEWTAB_FAVICON_SVG_MAIN_PATH = 'M34.0761 74.4516C15.8955 53.2991 27.0297 29.5157 37.0262 17.4579C38.6314 15.5217 41.5522 15.6368 43.1924 17.5435L54.2217 30.3654C58.8053 35.6938 59.7099 43.2656 56.5107 49.524L49.3531 63.5257L56.8412 62.1274C64.6007 60.6784 72.5332 63.5719 77.5374 69.6765L83.762 77.2699C85.0646 78.859 85.0813 81.1684 83.4746 82.4491C74.4334 89.6554 52.1633 95.4955 34.0761 74.4516Z';
    const NEWTAB_FAVICON_THEMES = {
      light: {
        color: '#000000',
        shadowOpacity: '0.2',
        mainOpacity: '0.5'
      },
      dark: {
        color: '#f1f3f4',
        shadowOpacity: '0.34',
        mainOpacity: '0.72'
      }
    };
    const WALLPAPER_PANEL_RESIZE_DURATION_MS = 260;
    const WALLPAPER_PANEL_RESIZE_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
    const WALLPAPER_VISUAL_TRANSITION_MS = 220;
    const WALLPAPER_FILTER_TRANSITION_MS = 180;
    const WALLPAPER_VISUAL_REFRESH_DELAY_MS = 80;
    const WALLPAPER_IMAGE_READY_CACHE_LIMIT = 8;
    const WALLPAPER_NETWORK_IMAGE_TIMEOUT_MS = 8000;

    let initialWallpaperApplied = false;
    let hasWallpaperBootstrapStarted = false;
    let hasStoredWallpaperStateLoaded = false;
    let hasNewtabFaviconBootstrapStarted = false;
    let resolveInitialWallpaperReady = null;
    const initialWallpaperReadyPromise = new Promise((resolve) => {
      resolveInitialWallpaperReady = resolve;
    });
    let initialNewtabFaviconReadyPromise = null;
    let initialWallpaperOverlayReadyPromise = null;
    let initialWallpaperEffectReadyPromise = null;
    let hasStoredWallpaperEffectLoaded = false;
    // The view owns the panel's elements; these three are the ones this runtime measures,
    // focuses and samples.
    let wallpaperControl = null;
    let wallpaperButton = null;
    let wallpaperPanel = null;
    let wallpaperViewController = null;
    let wallpaperPanelActions = null;
    let wallpaperPanelState = null;
    let wallpaperPanelLayoutKey = '';
    // A closed panel is drawn again only when it next opens; meanwhile this records that its
    // drawn state is out of date.
    let wallpaperPanelDrawPending = false;
    let wallpaperPanelOpen = false;
    let wallpaperPanelRendered = false;
    let wallpaperPanelResizing = false;
    let wallpaperSourcesHintController = null;
    let newtabFaviconThemeQueryList = null;
    let newtabFaviconThemeChangeHandler = null;
    let hasNewtabFaviconLifecycleListeners = false;
    let newtabFaviconLifecycleRefreshHandler = null;
    let newtabFaviconThemeBroadcastChannel = null;
    let hasNewtabFaviconThemeBroadcastListener = false;
    let wallpaperPanelResizeTimer = null;
    let wallpaperPanelResizeCleanup = null;
    let wallpaperAppearanceAnimationTimers = [];
    // While the theme options slide to another scope: the scope the tabs already show,
    // and the labels the options keep until they swap.
    let pendingThemeScope = null;
    let heldAppearanceModeLabels = null;
    const saveSliderSetting = createDebouncedSaver(windowObj, 140);
    const saveWallpaperStyleSetting = createDebouncedSaver(windowObj, 120);
    let customWallpapers = [];
    let customWallpaperCatalogLoaded = false;
    let customWallpaperCatalogPromise = null;
    let customWallpaperImporting = false;
    let customWallpaperUrlFormOpen = false;
    let customWallpaperUrlInvalid = false;
    // Bumped when a link is saved, so the view clears the field for the next one.
    let customWallpaperUrlClearToken = 0;
    // Link wallpapers sync as { id, url, addedAt } entries. Their images, and museum prints, are
    // downscaled once per device and cached by photo ID.
    let linkWallpapers = [];
    const cachedWallpaperImages = new Map();
    const wallpaperImageCaching = new Map();
    const LINK_WALLPAPER_ID_PATTERN = /^link-[a-z0-9]{4,32}$/;
    const LINK_WALLPAPER_URL_MAX_LENGTH = 2048;
    // chrome.storage.sync holds 8 KB per item; normalized URLs are ASCII, so length counts bytes.
    const LINK_WALLPAPERS_MAX_BYTES = 8000;
    let wallpaperStorageChangeSeq = 0;
    let wallpaperVisualSeq = 0;
    let wallpaperVisualRefreshTimer = 0;
    let appliedWallpaperVisualUrl = '';
    let appliedWallpaperVisualActive = false;
    const wallpaperImageReadyCache = new Map();
    // Whether each network image loaded on this page: 'loaded' or 'failed'. A new tab tries again.
    const wallpaperNetworkImageStates = new Map();

    function cancelWallpaperPanelActiveControls() {
      const activeElement = document.activeElement;
      if (!activeElement || !wallpaperPanel || !wallpaperPanel.contains(activeElement)) {
        return;
      }
      if (typeof activeElement.blur === 'function') {
        activeElement.blur();
      }
    }
    let currentWallpaperOverlayOpacity = {
      light: NEWTAB_WALLPAPER_OVERLAY_DEFAULTS.light,
      dark: NEWTAB_WALLPAPER_OVERLAY_DEFAULTS.dark
    };
    let currentWallpaperEffectPrefsByMode = normalizeWallpaperEffectStoragePrefs(
      NEWTAB_WALLPAPER_EFFECT_DEFAULTS
    );
    let currentAppliedWallpaperEffectPrefs = Object.assign({}, NEWTAB_WALLPAPER_EFFECT_DEFAULTS);
    let bingItems = [];
    let bingCatalogSeq = 0;
    let bingSelectionSeq = 0;
    let bingStatus = '';
    let bingLoading = false;
    let bingSelecting = false;
    const BING_RECENT_TILE_LIMIT = 6;
    // Three full rows; the refresh button pages through the category.
    const CURATED_TILE_LIMIT = 9;
    let curatedCategory = REMOTE_CONTENT.CURATED_CATEGORIES[0] || '';
    let curatedPage = 0;
    const WALLPAPER_SOURCE_TABS = ['built-in', 'local', 'bing', 'curated'];
    const WALLPAPER_APPEARANCE_MODES = ['system', 'light', 'dark'];
    const BING_DAILY_HINT = 'A new Bing photo every day. A photo you pick while this is on stays for the rest of the day.';
    const CURATED_DAILY_HINT = 'A new photo every day from the category shown when you turn this on, ' +
      'the same on every synced device. A photo you pick stays for the rest of the day.';
    let dailyWallpaperCheckedDay = '';
    // { day, picks: { [daily ID]: photo ID } }; picks from another date no longer count.
    let dailyWallpaperPicks = { day: '', picks: {} };
    let hasWallpaperPageShownListeners = false;
    let activeWallpaperTab = 'built-in';
    let lastSyncedWallpaperSourceId = null;
    let activeWallpaperMode = NEWTAB_WALLPAPER_MODE_LIGHT;
    let currentWallpaperPrefs = null;
    let currentLocalWallpaperOverrides = null;
    let currentWallpaperId = '';
    let lastActiveWallpaperId = '';
    let lastActiveWallpaperIdsByMode = {
      light: '',
      dark: ''
    };
    let currentTopContentMode = normalizeNewtabTopContentMode(getTopContentMode());
    let currentTimeFontWeight = normalizeNewtabTimeFontWeight(getTimeFontWeight());
    let currentTimeSecondsVisible = normalizeNewtabTimeSecondsVisible(getTimeSecondsVisible());
    let currentNewtabFaviconId = NEWTAB_FAVICON_DEFAULT_ID;

    function normalizeWallpaperMode(mode) {
      return mode === NEWTAB_WALLPAPER_MODE_DARK
        ? NEWTAB_WALLPAPER_MODE_DARK
        : NEWTAB_WALLPAPER_MODE_LIGHT;
    }

    function getDefaultWallpaperPrefs() {
      return {
        version: NEWTAB_WALLPAPER_PREFS_STORAGE_VERSION,
        sameForModes: true,
        light: NEWTAB_WALLPAPER_DEFAULT_ID,
        dark: NEWTAB_WALLPAPER_DEFAULT_ID
      };
    }

    function getDefaultLocalWallpaperOverrides() {
      return {
        light: null,
        dark: null
      };
    }

    currentWallpaperPrefs = getDefaultWallpaperPrefs();
    currentLocalWallpaperOverrides = getDefaultLocalWallpaperOverrides();

    function cloneWallpaperPrefs(prefs) {
      const source = prefs && typeof prefs === 'object' ? prefs : getDefaultWallpaperPrefs();
      const lightId = normalizeNewtabWallpaperId(source.light) || '';
      const darkId = normalizeNewtabWallpaperId(source.dark) || lightId;
      const sameForModes = source.sameForModes !== false;
      return {
        version: NEWTAB_WALLPAPER_PREFS_STORAGE_VERSION,
        sameForModes,
        light: lightId,
        dark: sameForModes ? lightId : darkId
      };
    }

    function cloneLocalWallpaperOverrides(overrides) {
      const source = overrides && typeof overrides === 'object' ? overrides : getDefaultLocalWallpaperOverrides();
      return {
        light: source.light || null,
        dark: source.dark || null
      };
    }

    function isCustomWallpaperId(id) {
      return localWallpaperStore.isCustomWallpaperId(id);
    }

    function getCustomWallpaperById(id) {
      const normalizedId = String(id || '').trim();
      if (!normalizedId) {
        return null;
      }
      return customWallpapers.find((item) => item && item.id === normalizedId) || null;
    }

    function getWallpaperById(id) {
      const normalizedId = String(id || '').trim();
      if (!normalizedId) {
        return null;
      }
      if (isCustomWallpaperId(normalizedId)) {
        return getCustomWallpaperById(normalizedId);
      }
      if (isLinkWallpaperId(normalizedId)) {
        return getLinkWallpaperById(normalizedId);
      }
      if (REMOTE_CONTENT.wallpaperFromId(normalizedId)) {
        const pickId = getDailyWallpaperPick(normalizedId);
        const pick = pickId && remoteClient.getWallpaper(pickId);
        return pick
          ? Object.assign({}, pick, { id: normalizedId, daily: true, dailyId: pickId, picked: true })
          : remoteClient.getWallpaper(normalizedId);
      }
      return NEWTAB_WALLPAPER_OPTIONS.find((item) => item && item.id === normalizedId) || null;
    }

    function normalizeNewtabTopContentMode(value) {
      return SETTINGS.normalizeNewtabTopContentMode(value);
    }

    function normalizeNewtabTimeSecondsVisible(value) {
      return SETTINGS.normalizeNewtabTimeSecondsVisible(value);
    }

    function normalizeNewtabTimeFontWeight(value) {
      return SETTINGS.normalizeNewtabTimeFontWeight(value);
    }

    function getNewtabFaviconById(id) {
      const normalizedId = String(id || '').trim();
      return NEWTAB_FAVICON_OPTIONS.find((item) => item && item.id === normalizedId) || null;
    }

    function normalizeNewtabFaviconId(value) {
      const raw = value && typeof value === 'object' && value.id
        ? value.id
        : value;
      const id = String(raw || '').trim();
      return getNewtabFaviconById(id) ? id : NEWTAB_FAVICON_DEFAULT_ID;
    }

    function getNewtabFaviconDisplayName(item) {
      if (!item) {
        return '';
      }
      return t(item.nameKey, item.fallbackName || item.id || '');
    }

    function getNewtabFaviconUrl(item) {
      return item && item.file ? getRuntimeAssetUrl(item.file) : '';
    }

    function getNewtabFaviconThemeQueryList() {
      if (!window || typeof window.matchMedia !== 'function') {
        return null;
      }
      try {
        return window.matchMedia(NEWTAB_FAVICON_THEME_QUERY);
      } catch (_error) {
        return null;
      }
    }

    function getNewtabFaviconBrowserTheme() {
      const queryList = getNewtabFaviconThemeQueryList();
      return queryList && queryList.matches ? 'dark' : 'light';
    }

    function buildNewtabFaviconSvgDataUrl(themeName) {
      const theme = NEWTAB_FAVICON_THEMES[themeName] || NEWTAB_FAVICON_THEMES.light;
      const svg = [
        '<svg width="104" height="104" viewBox="0 0 104 104" fill="none" xmlns="http://www.w3.org/2000/svg">',
        `<path opacity="${theme.shadowOpacity}" d="${NEWTAB_FAVICON_SVG_SHADOW_PATH}" fill="${theme.color}"/>`,
        `<path d="${NEWTAB_FAVICON_SVG_MAIN_PATH}" fill="${theme.color}" fill-opacity="${theme.mainOpacity}"/>`,
        '</svg>'
      ].join('');
      return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    }

    function getNewtabFaviconHref(item) {
      if (item && item.themeAwareSvg) {
        return buildNewtabFaviconSvgDataUrl(getNewtabFaviconBrowserTheme());
      }
      return getNewtabFaviconUrl(item);
    }

    function cacheNewtabFaviconPreloadId(id) {
      const normalizedId = normalizeNewtabFaviconId(id);
      try {
        if (window && window.localStorage) {
          window.localStorage.setItem(NEWTAB_FAVICON_PRELOAD_STORAGE_KEY, normalizedId);
        }
      } catch (_error) {
        // The main runtime still applies the favicon even when localStorage is unavailable.
      }
    }

    function clearNewtabFaviconThemeListener() {
      if (!newtabFaviconThemeQueryList || !newtabFaviconThemeChangeHandler) {
        newtabFaviconThemeQueryList = null;
        newtabFaviconThemeChangeHandler = null;
        return;
      }
      if (typeof newtabFaviconThemeQueryList.removeEventListener === 'function') {
        newtabFaviconThemeQueryList.removeEventListener('change', newtabFaviconThemeChangeHandler);
      } else if (typeof newtabFaviconThemeQueryList.removeListener === 'function') {
        newtabFaviconThemeQueryList.removeListener(newtabFaviconThemeChangeHandler);
      }
      newtabFaviconThemeQueryList = null;
      newtabFaviconThemeChangeHandler = null;
    }

    function applyNewtabFaviconLinkAttributes(link, item) {
      const themeName = item && item.themeAwareSvg ? getNewtabFaviconBrowserTheme() : '';
      link.setAttribute('rel', 'icon');
      link.setAttribute('type', item.type || 'image/png');
      link.setAttribute('href', getNewtabFaviconHref(item));
      if (item.sizes) {
        link.setAttribute('sizes', item.sizes);
      } else {
        link.removeAttribute('sizes');
      }
      link.setAttribute('data-newtab-favicon-id', item.id);
      if (themeName) {
        link.setAttribute('data-lumno-newtab-favicon-theme', themeName);
      } else {
        link.removeAttribute('data-lumno-newtab-favicon-theme');
      }
    }

    function refreshNewtabFaviconLink() {
      const item = getNewtabFaviconById(currentNewtabFaviconId) ||
        getNewtabFaviconById(NEWTAB_FAVICON_DEFAULT_ID);
      const link = getNewtabFaviconLink();
      if (link && item) {
        applyNewtabFaviconLinkAttributes(link, item);
      }
    }

    function refreshNewtabFaviconLinkIfThemeAware() {
      const item = getNewtabFaviconById(currentNewtabFaviconId);
      if (item && item.themeAwareSvg) {
        refreshNewtabFaviconLink();
      }
    }

    function getNewtabFaviconThemeBroadcastChannel() {
      if (newtabFaviconThemeBroadcastChannel) {
        return newtabFaviconThemeBroadcastChannel;
      }
      if (typeof BroadcastChannelCtor !== 'function') {
        return null;
      }
      try {
        newtabFaviconThemeBroadcastChannel = new BroadcastChannelCtor(NEWTAB_FAVICON_THEME_BROADCAST_CHANNEL);
      } catch (_error) {
        newtabFaviconThemeBroadcastChannel = null;
      }
      return newtabFaviconThemeBroadcastChannel;
    }

    function bindNewtabFaviconThemeBroadcastListener() {
      if (hasNewtabFaviconThemeBroadcastListener) {
        return;
      }
      hasNewtabFaviconThemeBroadcastListener = true;
      const channel = getNewtabFaviconThemeBroadcastChannel();
      if (!channel) {
        return;
      }
      const handleMessage = (event) => {
        const data = event && event.data ? event.data : null;
        if (!data || data.action !== NEWTAB_FAVICON_THEME_REFRESH_ACTION) {
          return;
        }
        refreshNewtabFaviconLinkIfThemeAware();
      };
      if (typeof channel.addEventListener === 'function') {
        channel.addEventListener('message', handleMessage);
      } else {
        channel.onmessage = handleMessage;
      }
    }

    function broadcastNewtabFaviconThemeRefresh() {
      const channel = getNewtabFaviconThemeBroadcastChannel();
      if (!channel || typeof channel.postMessage !== 'function') {
        return;
      }
      try {
        channel.postMessage({
          action: NEWTAB_FAVICON_THEME_REFRESH_ACTION,
          at: Date.now()
        });
      } catch (_error) {
        // BroadcastChannel can be unavailable in constrained extension contexts.
      }
    }

    function bindNewtabFaviconLifecycleRefreshListeners() {
      if (hasNewtabFaviconLifecycleListeners) {
        return;
      }
      hasNewtabFaviconLifecycleListeners = true;
      newtabFaviconLifecycleRefreshHandler = () => {
        refreshNewtabFaviconLinkIfThemeAware();
      };
      if (window && typeof window.addEventListener === 'function') {
        window.addEventListener('focus', newtabFaviconLifecycleRefreshHandler, { passive: true });
        window.addEventListener('pageshow', newtabFaviconLifecycleRefreshHandler, { passive: true });
      }
      if (document && typeof document.addEventListener === 'function') {
        document.addEventListener('visibilitychange', newtabFaviconLifecycleRefreshHandler, { passive: true });
      }
    }

    function bindNewtabFaviconThemeListener(item) {
      clearNewtabFaviconThemeListener();
      if (!item || !item.themeAwareSvg) {
        return;
      }
      bindNewtabFaviconLifecycleRefreshListeners();
      bindNewtabFaviconThemeBroadcastListener();
      const queryList = getNewtabFaviconThemeQueryList();
      if (!queryList) {
        return;
      }
      newtabFaviconThemeQueryList = queryList;
      newtabFaviconThemeChangeHandler = () => {
        refreshNewtabFaviconLinkIfThemeAware();
        broadcastNewtabFaviconThemeRefresh();
      };
      if (typeof queryList.addEventListener === 'function') {
        queryList.addEventListener('change', newtabFaviconThemeChangeHandler);
      } else if (typeof queryList.addListener === 'function') {
        queryList.addListener(newtabFaviconThemeChangeHandler);
      }
    }

    function normalizeNewtabWallpaperId(value) {
      const raw = value && typeof value === 'object' && value.id
        ? value.id
        : value;
      const id = String(raw || '').trim();
      if (id === NEWTAB_CUSTOM_WALLPAPER_ID) {
        const firstCustomWallpaper = customWallpapers[0];
        return firstCustomWallpaper ? firstCustomWallpaper.id : '';
      }
      // Move existing online selections to the daily Bing source without contacting the old provider.
      if (/^wallhaven-[a-z0-9]{6}$/.test(id) && remoteClient) return REMOTE_CONTENT.BING_DAILY_ID;
      if (getWallpaperById(id)) {
        return id;
      }
      const matchedByPath = NEWTAB_WALLPAPER_OPTIONS.find((item) => {
        const localPath = getWallpaperLocalPath(item);
        const runtimePath = getWallpaperRuntimePath(item);
        const legacyFile = getWallpaperLegacyFile(item);
        return id === localPath ||
          id === runtimePath ||
          id.endsWith(`/${item.file}`) ||
          (legacyFile && id.endsWith(`/${legacyFile}`));
      });
      return matchedByPath ? matchedByPath.id : '';
    }

    function getWallpaperLegacyFile(item) {
      const file = item && item.file ? item.file : '';
      return file.endsWith('.webp') ? file.replace(/\.webp$/, '.png') : '';
    }

    function getWallpaperThumbnailFile(item) {
      const file = item && item.file ? item.file : '';
      return file ? file.replace(/\.[^.]+$/, NEWTAB_WALLPAPER_THUMBNAIL_SUFFIX) : '';
    }

    function getWallpaperLocalPath(item) {
      if (!item || !item.file) {
        return '';
      }
      return `${NEWTAB_WALLPAPER_DEFAULT_DIRECTORY}/${item.file}`;
    }

    function getWallpaperRuntimePath(item, options) {
      if (item && isCustomWallpaperId(item.id)) {
        return '';
      }
      if (!item || !item.file) {
        return '';
      }
      const file = options && options.thumbnail ? getWallpaperThumbnailFile(item) : item.file;
      return file ? `${NEWTAB_WALLPAPER_EXTENSION_DIRECTORY}/${file}` : '';
    }

    function getCachedWallpaperImage(photoId, url) {
      const image = cachedWallpaperImages.get(photoId);
      return image && image.url === url ? image : null;
    }

    function getWallpaperImageUrl(item) {
      if (item && remoteClient && item.cacheImage) {
        const cached = getCachedWallpaperImage(item.dailyId || item.id, item.imageUrl);
        return cached ? cached.imageDataUrl : item.thumbnailUrl;
      }
      if (item && remoteClient && REMOTE_CONTENT.wallpaperFromId(item.id)) {
        return item.imageUrl || getWallpaperImageUrl(getWallpaperById(NEWTAB_WALLPAPER_DEFAULT_ID));
      }
      if (item && isCustomWallpaperId(item.id)) {
        return item.imageDataUrl || '';
      }
      if (item && isLinkWallpaperId(item.id)) {
        return item.imageDataUrl || item.url;
      }
      const runtimePath = getWallpaperRuntimePath(item);
      if (!runtimePath) {
        return '';
      }
      if (chrome && chrome.runtime && typeof chrome.runtime.getURL === 'function') {
        return chrome.runtime.getURL(runtimePath);
      }
      return `../../${runtimePath}`;
    }

    function isNetworkWallpaperImageUrl(url) {
      return /^https?:/i.test(String(url || ''));
    }

    // A network image never paints straight from CSS: it would hold the tab's loading spinner, and
    // a failed download would leave the page blank. It shows once loaded after the page; if it fails
    // or stalls, the bundled default wallpaper stands in. Copies in IndexedDB and bundled files
    // show at once, and the fallback never depends on data that sync or pruning may remove.
    function getDisplayedWallpaperImageUrl(item) {
      const url = getWallpaperImageUrl(item);
      if (!isNetworkWallpaperImageUrl(url)) {
        return url;
      }
      const state = wallpaperNetworkImageStates.get(url);
      if (state === 'loaded') {
        return url;
      }
      return state === 'failed' ? getWallpaperImageUrl(getWallpaperById(NEWTAB_WALLPAPER_DEFAULT_ID)) : '';
    }

    function getWallpaperThumbnailUrl(item) {
      if (item && remoteClient && REMOTE_CONTENT.wallpaperFromId(item.id)) {
        return item.thumbnailUrl || getWallpaperImageUrl(item);
      }
      if (item && isCustomWallpaperId(item.id)) {
        return item.thumbnailDataUrl || item.imageDataUrl || '';
      }
      if (item && isLinkWallpaperId(item.id)) {
        return item.thumbnailDataUrl || item.url;
      }
      const runtimePath = getWallpaperRuntimePath(item, { thumbnail: true });
      if (!runtimePath) {
        return getWallpaperImageUrl(item);
      }
      if (chrome && chrome.runtime && typeof chrome.runtime.getURL === 'function') {
        return chrome.runtime.getURL(runtimePath);
      }
      return `../../${runtimePath}`;
    }

    function getWallpaperDisplayName(item) {
      if (!item) {
        return '';
      }
      if (item.nameKey) {
        return t(item.nameKey, item.fallbackName || item.id || '');
      }
      const storedName = String(item.name || '').trim();
      if (!storedName) {
        return t('newtab_wallpaper_custom_name', 'Local wallpaper');
      }
      return storedName;
    }

    // Used by overlay math; adaptive image sampling lives in wallpaper-adaptive-tone.js.
    function clampNumber(value, min, max) {
      const number = Number(value);
      if (!Number.isFinite(number)) {
        return min;
      }
      return Math.min(max, Math.max(min, number));
    }

    function getViewportSize() {
      const docEl = document.documentElement;
      return {
        width: Math.max(1, window.innerWidth || (docEl ? docEl.clientWidth : 0) || 1),
        height: Math.max(1, window.innerHeight || (docEl ? docEl.clientHeight : 0) || 1)
      };
    }

    function getWallpaperOverlayAlphaAtViewportY(viewportY) {
      const mode = getResolvedWallpaperOverlayMode();
      const stops = NEWTAB_WALLPAPER_OVERLAY_STOPS[mode] || NEWTAB_WALLPAPER_OVERLAY_STOPS.light;
      const opacity = getWallpaperOverlayOpacityForCurrentMode();
      const topAlpha = getWallpaperOverlayStopPercent(stops.top, opacity) / 100;
      const midAlpha = getWallpaperOverlayStopPercent(stops.mid, opacity) / 100;
      const bottomAlpha = getWallpaperOverlayStopPercent(stops.bottom, opacity) / 100;
      const viewport = getViewportSize();
      const position = clampNumber(viewportY / viewport.height, 0, 1);
      if (position <= 0.42) {
        return topAlpha + ((midAlpha - topAlpha) * (position / 0.42));
      }
      return midAlpha + ((bottomAlpha - midAlpha) * ((position - 0.42) / 0.58));
    }

    function getWallpaperAdaptiveToneTargets() {
      const externalTargets = typeof getAdaptiveToneTargets === 'function'
        ? getAdaptiveToneTargets()
        : [];
      const targets = Array.isArray(externalTargets) ? externalTargets.slice() : [];
      targets.push({
        element: wallpaperButton,
        sampleElement: wallpaperButton,
        minWidth: 54,
        minHeight: 54,
        iconButton: true
      });
      return targets;
    }

    let wallpaperEffects = null;
    const wallpaperAdaptiveTone = WALLPAPER_ADAPTIVE_TONE.createWallpaperAdaptiveTone({
      documentObj,
      windowObj,
      getTargets: getWallpaperAdaptiveToneTargets,
      getCurrentWallpaper: () => getWallpaperById(currentWallpaperId),
      getWallpaperImageUrl: getDisplayedWallpaperImageUrl,
      getOverlayAlphaAtViewportY: getWallpaperOverlayAlphaAtViewportY,
      getOverlayLuminance: () => getResolvedWallpaperOverlayMode() === 'dark' ? 0 : 1,
      getEffectLuminanceAtViewport: (viewportX, viewportY, baseLuminance) => {
        return wallpaperEffects && typeof wallpaperEffects.getLuminanceAtViewport === 'function'
          ? wallpaperEffects.getLuminanceAtViewport(viewportX, viewportY, baseLuminance)
          : null;
      },
      applyWordmarkThemeAppearance
    });
    const wallpaperEffectPreload = globalThis.LumnoNewtabWallpaperEffectPreload || null;
    const wallpaperEffectRuntimeOptions = {
        documentObj,
        windowObj,
        getCurrentWallpaper: () => getWallpaperById(currentWallpaperId),
        getWallpaperImageUrl: getDisplayedWallpaperImageUrl,
        shouldAnimateTransition: () => Boolean(
          documentObj.body &&
          documentObj.body.getAttribute('data-nt-enter') === 'done'
        ),
        onRender: scheduleWallpaperAdaptiveToneUpdate
      };
    if (wallpaperEffectPreload && wallpaperEffectPreload.controller) {
      wallpaperEffectPreload.attach({
        onRender: scheduleWallpaperAdaptiveToneUpdate,
        shouldAnimateTransition: wallpaperEffectRuntimeOptions.shouldAnimateTransition
      });
      wallpaperEffects = wallpaperEffectPreload.controller;
    } else {
      if (wallpaperEffectPreload) {
        wallpaperEffectPreload.claimed = true;
      }
      wallpaperEffects = WALLPAPER_EFFECTS.createWallpaperEffects(wallpaperEffectRuntimeOptions);
    }

    function scheduleWallpaperAdaptiveToneUpdate() {
      wallpaperAdaptiveTone.schedule();
    }

    function refreshWallpaperAdaptiveSampler() {
      wallpaperAdaptiveTone.refresh();
    }

    function refreshWallpaperEffects() {
      if (wallpaperEffects) {
        return wallpaperEffects.refresh();
      }
      return Promise.resolve();
    }

    function getRuntimeAssetUrl(path) {
      const value = String(path || '').trim();
      if (!value) {
        return '';
      }
      if (chrome && chrome.runtime && typeof chrome.runtime.getURL === 'function') {
        return chrome.runtime.getURL(value);
      }
      return `../../${value}`;
    }

    function getCssUrlValue(url) {
      const safe = String(url || '')
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '')
        .replace(/\r/g, '');
      return safe ? `url("${safe}")` : 'none';
    }

    function cacheWallpaperImageReady(url, promise) {
      if (!url || !promise) {
        return;
      }
      if (wallpaperImageReadyCache.has(url)) {
        wallpaperImageReadyCache.delete(url);
      }
      wallpaperImageReadyCache.set(url, promise);
      while (wallpaperImageReadyCache.size > WALLPAPER_IMAGE_READY_CACHE_LIMIT) {
        const firstKey = wallpaperImageReadyCache.keys().next().value;
        wallpaperImageReadyCache.delete(firstKey);
      }
    }

    function waitForWallpaperImageReady(url) {
      const imageUrl = String(url || '').trim();
      if (!imageUrl) {
        return Promise.resolve();
      }
      const cached = wallpaperImageReadyCache.get(imageUrl);
      if (cached) {
        return cached;
      }
      const isNetwork = isNetworkWallpaperImageUrl(imageUrl);
      const load = () => new Promise((resolve) => {
        const image = new Image();
        let timer = 0;
        let settled = false;
        const finish = (loaded) => {
          if (settled) {
            return;
          }
          settled = true;
          window.clearTimeout(timer);
          if (isNetwork) {
            wallpaperNetworkImageStates.set(imageUrl, loaded ? 'loaded' : 'failed');
          }
          resolve();
        };
        if (isNetwork) {
          timer = window.setTimeout(() => {
            finish(false);
            image.src = '';
          }, WALLPAPER_NETWORK_IMAGE_TIMEOUT_MS);
        }
        image.decoding = 'async';
        image.onload = () => {
          if (typeof image.decode === 'function') {
            image.decode().then(() => finish(true)).catch(() => finish(true));
            return;
          }
          finish(true);
        };
        image.onerror = () => finish(false);
        image.src = imageUrl;
      });
      const promise = isNetwork ? waitForDocumentLoad().then(load) : load();
      cacheWallpaperImageReady(imageUrl, promise);
      return promise;
    }

    // Network images start after the page has loaded, so they never hold the tab's spinner.
    function waitForDocumentLoad() {
      if (!document || typeof document.readyState !== 'string' || document.readyState === 'complete') {
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        window.addEventListener('load', () => resolve(), { once: true });
      });
    }

    function createWallpaperTransitionLayer() {
      if (!document.body ||
          document.body.getAttribute('data-nt-enter') !== 'done' ||
          shouldReduceMotion()) {
        return null;
      }
      const computedStyle = window.getComputedStyle(document.body);
      const layer = document.createElement('div');
      layer.className = 'x-nt-wallpaper-transition-layer';
      layer.style.backgroundColor = computedStyle.backgroundColor;
      if (document.body.getAttribute('data-wallpaper-effect') === 'blur') {
        layer.setAttribute('data-wallpaper-effect', 'blur');
        layer.style.backgroundImage =
          computedStyle.getPropertyValue('--x-nt-wallpaper-image').trim() || 'none';
        layer.style.backgroundSize =
          computedStyle.getPropertyValue('--x-nt-wallpaper-size').trim() || 'cover';
        layer.style.backgroundPosition =
          computedStyle.getPropertyValue('--x-nt-wallpaper-position').trim() || 'center center';
        [
          '--x-nt-wallpaper-blur-overscan',
          '--x-nt-wallpaper-blur-radius',
          '--x-nt-wallpaper-blur-saturate',
          '--x-nt-wallpaper-blur-brightness',
          '--x-nt-wallpaper-blur-contrast'
        ].forEach((propertyName) => {
          const propertyValue = computedStyle.getPropertyValue(propertyName).trim();
          if (propertyValue) {
            layer.style.setProperty(propertyName, propertyValue);
          }
        });
      } else {
        layer.style.backgroundImage = computedStyle.backgroundImage;
        layer.style.backgroundSize = computedStyle.backgroundSize;
        layer.style.backgroundPosition = computedStyle.backgroundPosition;
      }
      layer.style.backgroundRepeat = computedStyle.backgroundRepeat;
      layer.style.backgroundAttachment = 'fixed';
      document.body.insertBefore(layer, document.body.firstChild);
      return layer;
    }

    function releaseWallpaperTransitionLayer(layer) {
      if (!layer || !layer.parentNode) {
        return;
      }
      window.requestAnimationFrame(() => {
        layer.setAttribute('data-exit', 'true');
        window.setTimeout(() => {
          if (layer.parentNode) {
            layer.parentNode.removeChild(layer);
          }
        }, (layer.getAttribute('data-wallpaper-filter-transition') === 'true'
          ? WALLPAPER_FILTER_TRANSITION_MS
          : WALLPAPER_VISUAL_TRANSITION_MS) + 80);
      });
    }

    function applyWallpaperVisualState(wallpaper) {
      const target = document.documentElement;
      const imageUrl = wallpaper ? getDisplayedWallpaperImageUrl(wallpaper) : '';
      const wallpaperPreload = globalThis.LumnoNewtabWallpaperPreload;
      if (wallpaperPreload && typeof wallpaperPreload === 'object') {
        // A copy the preload is still reading must not paint over the runtime's choice.
        wallpaperPreload.runtimeApplied = true;
      }
      appliedWallpaperVisualUrl = imageUrl;
      appliedWallpaperVisualActive = Boolean(wallpaper);
      if (target) {
        target.style.setProperty('--x-nt-wallpaper-image', imageUrl ? getCssUrlValue(imageUrl) : 'none');
        target.style.setProperty('--x-nt-wallpaper-size', 'cover');
        target.style.setProperty('--x-nt-wallpaper-position', 'center center');
        target.setAttribute('data-wallpaper-active', wallpaper ? 'true' : 'false');
      }
      if (document.body) {
        document.body.setAttribute('data-wallpaper-active', wallpaper ? 'true' : 'false');
      }
      if (wallpaperEffectPreload && typeof wallpaperEffectPreload.updateSource === 'function') {
        wallpaperEffectPreload.updateSource(wallpaper, imageUrl);
      }
      return imageUrl;
    }

    function runWallpaperVisualRefresh(seq) {
      if (seq !== wallpaperVisualSeq) {
        return;
      }
      refreshWallpaperAdaptiveSampler();
      refreshWallpaperEffects();
    }

    function scheduleWallpaperVisualRefresh(seq) {
      if (wallpaperVisualRefreshTimer) {
        window.clearTimeout(wallpaperVisualRefreshTimer);
        wallpaperVisualRefreshTimer = 0;
      }
      wallpaperVisualRefreshTimer = window.setTimeout(() => {
        wallpaperVisualRefreshTimer = 0;
        afterNextPaint(window, () => runWallpaperVisualRefresh(seq));
      }, WALLPAPER_VISUAL_REFRESH_DELAY_MS);
    }
    function getRawWallpaperId(value) {
      return value && typeof value === 'object' && value.id ? value.id : value;
    }

    function hasStorageValue(result, key) {
      return Boolean(result && Object.prototype.hasOwnProperty.call(result, key));
    }

    function readStorageValue(area, key) {
      return new Promise((resolve) => {
        if (!area || !key || typeof area.get !== 'function') {
          resolve({ hasValue: false, value: undefined });
          return;
        }
        area.get([key], (result) => {
          resolve({
            hasValue: hasStorageValue(result, key),
            value: result ? result[key] : undefined
          });
        });
      });
    }

    function writeStorageValue(area, key, value, onError) {
      if (!area || !key || typeof area.set !== 'function') {
        return;
      }
      area.set({ [key]: value }, () => {
        if (chrome.runtime && chrome.runtime.lastError && typeof onError === 'function') {
          onError();
        }
      });
    }

    function isOnlineWallpaperId(value) {
      const id = String(getRawWallpaperId(value) || '').trim();
      return Boolean(REMOTE_CONTENT.wallpaperFromId(id)) || isLinkWallpaperId(id);
    }

    // Versions without online wallpapers clear IDs they do not recognize, and that clear syncs to every device.
    // Online picks therefore live in their own key, leaving a built-in stand-in under the shared key.
    function buildSharedSyncedWallpaperValue(value) {
      if (!value || typeof value !== 'object') {
        return isOnlineWallpaperId(value) ? NEWTAB_WALLPAPER_DEFAULT_ID : value;
      }
      const shared = Object.assign({}, value);
      NEWTAB_WALLPAPER_MODES.forEach((mode) => {
        if (isOnlineWallpaperId(shared[mode])) {
          shared[mode] = NEWTAB_WALLPAPER_DEFAULT_ID;
        }
      });
      return shared;
    }

    // The online pick only counts while the shared key still holds its stand-in; any other value
    // means an older version changed the wallpaper since, and that newer choice wins.
    function mergeOnlineWallpaperValue(synced, online) {
      const entry = online && online.hasValue ? online.value : null;
      if (!entry || typeof entry !== 'object' || !synced.hasValue ||
          !getWallpaperStorageRawIds(entry.value).some(isOnlineWallpaperId) ||
          getComparableSyncedWallpaperStorageValue(entry.shared) !==
            getComparableSyncedWallpaperStorageValue(synced.value)) {
        return synced;
      }
      return { hasValue: true, value: entry.value, fromOnlineKey: true };
    }

    function writeSyncedWallpaperValue(value, options) {
      if (!storageArea || typeof storageArea.set !== 'function') {
        return;
      }
      const hasOnlineWallpaper = getWallpaperStorageRawIds(value).some(isOnlineWallpaperId);
      const shared = hasOnlineWallpaper ? buildSharedSyncedWallpaperValue(value) : value;
      storageArea.set({
        [NEWTAB_WALLPAPER_STORAGE_KEY]: shared,
        [NEWTAB_ONLINE_WALLPAPER_STORAGE_KEY]: hasOnlineWallpaper ? { value, shared } : ''
      }, () => {
        if (chrome.runtime && chrome.runtime.lastError && options && options.showError) {
          showToast(t('newtab_wallpaper_save_error', 'Failed to save wallpaper'), true);
        }
      });
    }

    function writeLocalWallpaperValue(value, options) {
      writeStorageValue(localWallpaperStorageArea, NEWTAB_LOCAL_WALLPAPER_STORAGE_KEY, value, () => {
        if (options && options.showError) {
          showToast(t('newtab_wallpaper_save_error', 'Failed to save wallpaper'), true);
        }
      });
    }

    function getWallpaperStorageModeValue(value, mode, fallback) {
      if (!value || typeof value !== 'object') {
        return fallback;
      }
      const normalizedMode = normalizeWallpaperMode(mode);
      if (Object.prototype.hasOwnProperty.call(value, normalizedMode)) {
        return value[normalizedMode];
      }
      if (normalizedMode === NEWTAB_WALLPAPER_MODE_DARK &&
          Object.prototype.hasOwnProperty.call(value, NEWTAB_WALLPAPER_MODE_LIGHT)) {
        return value[NEWTAB_WALLPAPER_MODE_LIGHT];
      }
      if (Object.prototype.hasOwnProperty.call(value, 'id')) {
        return value.id;
      }
      return fallback;
    }

    function getWallpaperStorageRawIds(value) {
      if (!value || typeof value !== 'object') {
        return [String(getRawWallpaperId(value) || '').trim()].filter(Boolean);
      }
      return NEWTAB_WALLPAPER_MODES
        .map((mode) => String(getRawWallpaperId(getWallpaperStorageModeValue(value, mode, '')) || '').trim())
        .filter(Boolean);
    }

    function shouldWaitForCustomWallpapers(value) {
      return getWallpaperStorageRawIds(value).some((id) => {
        return id === NEWTAB_CUSTOM_WALLPAPER_ID || isCustomWallpaperId(id);
      });
    }

    function getStoredCustomWallpaperIds(storedValues) {
      const ids = [];
      (Array.isArray(storedValues) ? storedValues : []).forEach((storedValue) => {
        if (!storedValue || !storedValue.hasValue) {
          return;
        }
        getWallpaperStorageRawIds(storedValue.value).forEach((id) => {
          if ((id === NEWTAB_CUSTOM_WALLPAPER_ID || isCustomWallpaperId(id)) && !ids.includes(id)) {
            ids.push(id);
          }
        });
      });
      return ids;
    }

    function hasLoadedStoredCustomWallpaper(id) {
      if (id === NEWTAB_CUSTOM_WALLPAPER_ID) {
        return customWallpapers.length > 0;
      }
      return Boolean(getCustomWallpaperById(id));
    }

    function getComparableSyncedWallpaperStorageValue(value) {
      if (!value || typeof value !== 'object') {
        return String(getRawWallpaperId(value) || '');
      }
      return JSON.stringify({
        version: Number(value.version) || 0,
        sameForModes: value.sameForModes !== false,
        light: String(getWallpaperStorageModeValue(value, NEWTAB_WALLPAPER_MODE_LIGHT, '') || ''),
        dark: String(getWallpaperStorageModeValue(value, NEWTAB_WALLPAPER_MODE_DARK, '') || '')
      });
    }

    function buildSyncedWallpaperStorageValue(prefs) {
      const normalized = cloneWallpaperPrefs(prefs);
      if (normalized.sameForModes && normalized.light === normalized.dark) {
        return normalized.light;
      }
      return {
        version: NEWTAB_WALLPAPER_PREFS_STORAGE_VERSION,
        sameForModes: normalized.sameForModes,
        light: normalized.light,
        dark: normalized.dark
      };
    }

    function getComparableLocalWallpaperStorageValue(value) {
      if (!value || typeof value !== 'object') {
        return String(getRawWallpaperId(value) || '');
      }
      return JSON.stringify({
        version: Number(value.version) || 0,
        light: String(getWallpaperStorageModeValue(value, NEWTAB_WALLPAPER_MODE_LIGHT, '') || ''),
        dark: String(getWallpaperStorageModeValue(value, NEWTAB_WALLPAPER_MODE_DARK, '') || '')
      });
    }

    function buildLocalWallpaperStorageValue(overrides, sameForModes) {
      const normalized = cloneLocalWallpaperOverrides(overrides);
      if (sameForModes && (normalized.light || null) === (normalized.dark || null)) {
        return normalized.light || '';
      }
      if (!normalized.light && !normalized.dark) {
        return '';
      }
      return {
        version: NEWTAB_WALLPAPER_PREFS_STORAGE_VERSION,
        light: normalized.light || '',
        dark: normalized.dark || ''
      };
    }

    function resolveSyncedWallpaperModeValue(raw, hasRaw) {
      const value = hasRaw ? raw : NEWTAB_WALLPAPER_DEFAULT_ID;
      if (shouldWaitForCustomWallpapers(value)) {
        const nextCustomId = normalizeNewtabWallpaperId(value);
        if (nextCustomId && isCustomWallpaperId(nextCustomId)) {
          return {
            id: NEWTAB_WALLPAPER_DEFAULT_ID,
            localMigrationId: nextCustomId,
            sanitized: true
          };
        }
        return {
          id: NEWTAB_WALLPAPER_DEFAULT_ID,
          localMigrationId: '',
          sanitized: true
        };
      }
      const nextId = normalizeNewtabWallpaperId(value);
      // An ID this version does not recognize may come from a newer install sharing sync storage.
      // Show the default here, but never write it back, or that install's wallpaper turns off.
      if (!nextId && String(getRawWallpaperId(value) || '').trim()) {
        return {
          id: NEWTAB_WALLPAPER_DEFAULT_ID,
          localMigrationId: '',
          sanitized: false,
          unrecognized: true
        };
      }
      return {
        id: nextId,
        localMigrationId: '',
        sanitized: !hasRaw || (value && value !== nextId)
      };
    }

    function resolveSyncedWallpaperValue(value, hasValue) {
      const isObjectValue = Boolean(value && typeof value === 'object');
      const sameForModes = isObjectValue ? value.sameForModes !== false : true;
      const rawLight = isObjectValue
        ? getWallpaperStorageModeValue(value, NEWTAB_WALLPAPER_MODE_LIGHT, hasValue ? value : NEWTAB_WALLPAPER_DEFAULT_ID)
        : (hasValue ? value : NEWTAB_WALLPAPER_DEFAULT_ID);
      const lightResolution = resolveSyncedWallpaperModeValue(rawLight, hasValue || isObjectValue);
      const rawDark = sameForModes
        ? rawLight
        : getWallpaperStorageModeValue(value, NEWTAB_WALLPAPER_MODE_DARK, rawLight);
      const darkResolution = sameForModes
        ? lightResolution
        : resolveSyncedWallpaperModeValue(rawDark, true);
      const prefs = {
        version: NEWTAB_WALLPAPER_PREFS_STORAGE_VERSION,
        sameForModes,
        light: lightResolution.id,
        dark: sameForModes ? lightResolution.id : darkResolution.id
      };
      const localMigrations = getDefaultLocalWallpaperOverrides();
      if (lightResolution.localMigrationId) {
        localMigrations.light = lightResolution.localMigrationId;
      }
      if (sameForModes) {
        localMigrations.dark = localMigrations.light;
      } else if (darkResolution.localMigrationId) {
        localMigrations.dark = darkResolution.localMigrationId;
      }
      const sanitizedValue = buildSyncedWallpaperStorageValue(prefs);
      const hasUnrecognizedId = lightResolution.unrecognized || (!sameForModes && darkResolution.unrecognized);
      const shouldSanitize = !hasUnrecognizedId && (!hasValue ||
        lightResolution.sanitized ||
        (!sameForModes && darkResolution.sanitized) ||
        (isObjectValue && (
          Number(value.version) !== NEWTAB_WALLPAPER_PREFS_STORAGE_VERSION ||
          getComparableSyncedWallpaperStorageValue(value) !== getComparableSyncedWallpaperStorageValue(sanitizedValue)
        )));
      return {
        prefs,
        sanitizedValue: shouldSanitize ? sanitizedValue : null,
        localMigrations
      };
    }

    function resolveLocalWallpaperModeValue(raw, hasRaw) {
      if (!hasRaw) {
        return { override: null, shouldClear: false };
      }
      const rawId = String(getRawWallpaperId(raw) || '').trim();
      if (!rawId) {
        return { override: null, shouldClear: false };
      }
      if (rawId === NEWTAB_LOCAL_WALLPAPER_DISABLED_VALUE) {
        return { override: NEWTAB_LOCAL_WALLPAPER_DISABLED_VALUE, shouldClear: false };
      }
      const nextId = normalizeNewtabWallpaperId(raw);
      if (nextId && isCustomWallpaperId(nextId)) {
        return { override: nextId, shouldClear: false };
      }
      return { override: null, shouldClear: true };
    }

    function resolveLocalWallpaperOverride(value, hasValue) {
      const overrides = getDefaultLocalWallpaperOverrides();
      if (!hasValue) {
        return { overrides, shouldClear: false };
      }
      if (!value || typeof value !== 'object') {
        const resolution = resolveLocalWallpaperModeValue(value, true);
        overrides.light = resolution.override;
        overrides.dark = resolution.override;
        return {
          overrides,
          shouldClear: resolution.shouldClear
        };
      }
      const lightResolution = resolveLocalWallpaperModeValue(
        getWallpaperStorageModeValue(value, NEWTAB_WALLPAPER_MODE_LIGHT, ''),
        true
      );
      const darkResolution = resolveLocalWallpaperModeValue(
        getWallpaperStorageModeValue(value, NEWTAB_WALLPAPER_MODE_DARK, ''),
        true
      );
      overrides.light = lightResolution.override;
      overrides.dark = darkResolution.override;
      const normalizedValue = buildLocalWallpaperStorageValue(overrides, false);
      return {
        overrides,
        shouldClear: lightResolution.shouldClear ||
        darkResolution.shouldClear ||
          getComparableLocalWallpaperStorageValue(value) !== getComparableLocalWallpaperStorageValue(normalizedValue)
      };
    }

    function getWallpaperLocalOverrideForMode(mode) {
      const normalizedMode = normalizeWallpaperMode(mode);
      const overrides = currentLocalWallpaperOverrides || getDefaultLocalWallpaperOverrides();
      return overrides[normalizedMode] || null;
    }

    function getSyncedWallpaperIdForMode(mode) {
      const normalizedMode = normalizeWallpaperMode(mode);
      const prefs = currentWallpaperPrefs || getDefaultWallpaperPrefs();
      const id = prefs.sameForModes ? prefs.light : prefs[normalizedMode];
      return normalizeNewtabWallpaperId(id) || '';
    }

    function getEffectiveWallpaperIdForMode(mode) {
      const override = getWallpaperLocalOverrideForMode(mode);
      if (override === NEWTAB_LOCAL_WALLPAPER_DISABLED_VALUE) {
        return '';
      }
      if (override && isCustomWallpaperId(override)) {
        return normalizeNewtabWallpaperId(override) || '';
      }
      return getSyncedWallpaperIdForMode(mode);
    }

    function getResolvedWallpaperMode() {
      return document.body && document.body.getAttribute('data-theme') === 'dark'
        ? NEWTAB_WALLPAPER_MODE_DARK
        : NEWTAB_WALLPAPER_MODE_LIGHT;
    }

    function getWallpaperEditMode() {
      if (currentWallpaperPrefs && currentWallpaperPrefs.sameForModes) {
        return getResolvedWallpaperMode();
      }
      return normalizeWallpaperMode(activeWallpaperMode);
    }

    // Daily mode highlights the photo it currently resolves to.
    function getWallpaperTileSelectionId(id) {
      if (!REMOTE_CONTENT.isDailyWallpaperId(id)) return id;
      const daily = getWallpaperById(id);
      return daily && daily.dailyId || id;
    }

    function getWallpaperSelectionIdForUi() {
      return getEffectiveWallpaperIdForMode(getWallpaperEditMode());
    }

    function hasAnyWallpaperEnabled() {
      return NEWTAB_WALLPAPER_MODES.some((mode) => Boolean(getEffectiveWallpaperIdForMode(mode)));
    }

    function normalizeWallpaperSourceTab(tab) {
      return WALLPAPER_SOURCE_TABS.includes(tab) ? tab : 'built-in';
    }

    function getWallpaperSourceTabForId(id) {
      const provider = REMOTE_CONTENT.getWallpaperProvider(id);
      if (provider) return normalizeWallpaperSourceTab(provider);
      return isCustomWallpaperId(id) || isLinkWallpaperId(id) ? 'local' : 'built-in';
    }

    function getWallpaperModeLabel(mode) {
      const normalizedMode = normalizeWallpaperMode(mode);
      return normalizedMode === NEWTAB_WALLPAPER_MODE_DARK
        ? t('settings_theme_dark', 'Dark')
        : t('settings_theme_light', 'Light');
    }

    function getWallpaperModePreferenceOrder() {
      const modes = [];
      const addMode = (mode) => {
        const normalizedMode = normalizeWallpaperMode(mode);
        if (!modes.includes(normalizedMode)) {
          modes.push(normalizedMode);
        }
      };
      addMode(getResolvedWallpaperMode());
      addMode(getWallpaperEditMode());
      NEWTAB_WALLPAPER_MODES.forEach(addMode);
      return modes;
    }

    function getFirstEnabledWallpaperIdForModes(modes) {
      for (let i = 0; i < modes.length; i += 1) {
        const id = getEffectiveWallpaperIdForMode(modes[i]);
        if (id) {
          return id;
        }
      }
      return '';
    }

    function getCopyableWallpaperLocalOverrideForId(modes, id) {
      const normalizedId = normalizeNewtabWallpaperId(id);
      if (!normalizedId || !isCustomWallpaperId(normalizedId)) {
        return null;
      }
      for (let i = 0; i < modes.length; i += 1) {
        const override = getWallpaperLocalOverrideForMode(modes[i]);
        if (override &&
            override !== NEWTAB_LOCAL_WALLPAPER_DISABLED_VALUE &&
            isCustomWallpaperId(override) &&
            normalizeNewtabWallpaperId(override) === normalizedId) {
          return override;
        }
      }
      return null;
    }

    function setWallpaperPrefs(nextPrefs, nextOverrides) {
      currentWallpaperPrefs = cloneWallpaperPrefs(nextPrefs);
      currentLocalWallpaperOverrides = cloneLocalWallpaperOverrides(nextOverrides);
      if (currentWallpaperPrefs.sameForModes) {
        activeWallpaperMode = getResolvedWallpaperMode();
      } else {
        activeWallpaperMode = normalizeWallpaperMode(activeWallpaperMode);
      }
    }

    function getWritableWallpaperPrefs() {
      return cloneWallpaperPrefs(currentWallpaperPrefs);
    }

    function getWritableLocalWallpaperOverrides() {
      return cloneLocalWallpaperOverrides(currentLocalWallpaperOverrides);
    }

    function applyLocalWallpaperMigrations(overrides, migrations) {
      const nextOverrides = cloneLocalWallpaperOverrides(overrides);
      let changed = false;
      NEWTAB_WALLPAPER_MODES.forEach((mode) => {
        const migrationId = migrations && migrations[mode] ? migrations[mode] : '';
        if (!migrationId) {
          return;
        }
        nextOverrides[mode] = migrationId;
        changed = true;
      });
      return { overrides: nextOverrides, changed };
    }

    function writeCurrentWallpaperPrefs(options) {
      const config = options || {};
      writeSyncedWallpaperValue(buildSyncedWallpaperStorageValue(currentWallpaperPrefs), config);
      writeLocalWallpaperValue(
        buildLocalWallpaperStorageValue(currentLocalWallpaperOverrides, currentWallpaperPrefs.sameForModes),
        config
      );
    }

    function getWallpaperPreloadEntryForMode(mode) {
      const wallpaper = getWallpaperById(getEffectiveWallpaperIdForMode(mode));
      // Online photos and links cannot paint on the first frame, but the preload reads this device's
      // IndexedDB copy while the page is still parsing.
      if (wallpaper && (REMOTE_CONTENT.wallpaperFromId(wallpaper.id) || isLinkWallpaperId(wallpaper.id))) {
        const photoId = isLinkWallpaperId(wallpaper.id) ? wallpaper.id : wallpaper.dailyId || wallpaper.id;
        const sourceUrl = isLinkWallpaperId(wallpaper.id) ? wallpaper.url : wallpaper.imageUrl;
        return (wallpaper.cacheImage || isLinkWallpaperId(wallpaper.id)) && getCachedWallpaperImage(photoId, sourceUrl)
          ? { id: wallpaper.id, cachedImage: { id: photoId, url: sourceUrl } }
          : null;
      }
      const path = wallpaper && !isCustomWallpaperId(wallpaper.id)
        ? getWallpaperRuntimePath(wallpaper)
        : '';
      return path ? { id: wallpaper.id, path } : null;
    }

    function getWallpaperPreloadOverlayStops() {
      const result = {};
      NEWTAB_WALLPAPER_MODES.forEach((mode) => {
        const stops = NEWTAB_WALLPAPER_OVERLAY_STOPS[mode];
        const opacity = currentWallpaperOverlayOpacity[mode];
        result[mode] = {
          top: Number(getWallpaperOverlayStopPercent(stops.top, opacity).toFixed(1)),
          mid: Number(getWallpaperOverlayStopPercent(stops.mid, opacity).toFixed(1)),
          bottom: Number(getWallpaperOverlayStopPercent(stops.bottom, opacity).toFixed(1))
        };
      });
      return result;
    }

    function writeWallpaperPreloadCache() {
      try {
        if (!window.localStorage) {
          return;
        }
        const wallpapers = {
          light: getWallpaperPreloadEntryForMode(NEWTAB_WALLPAPER_MODE_LIGHT),
          dark: getWallpaperPreloadEntryForMode(NEWTAB_WALLPAPER_MODE_DARK)
        };
        window.localStorage.setItem(PRELOAD_STORAGE_KEY, JSON.stringify({
          version: PRELOAD_STORAGE_VERSION,
          mode: getResolvedWallpaperMode(),
          themeMode: getEffectiveThemeMode(),
          wallpapers,
          overlayStops: getWallpaperPreloadOverlayStops(),
          wallpaperEffects: getWallpaperEffectStorageValue(),
          updatedAt: Date.now()
        }));
      } catch (e) {
        // localStorage may be unavailable in constrained contexts; storage is only a fast-path cache.
      }
    }

    function normalizeCustomWallpaperRecord(record) {
      return localWallpaperStore.normalizeRecord(record);
    }

    function readCustomWallpaperRecords() {
      return localWallpaperStore.readAll();
    }

    function readCustomWallpaperRecordsByIds(ids) {
      return localWallpaperStore.readByIds(ids);
    }

    function writeCustomWallpaperRecord(record) {
      return localWallpaperStore.write(record);
    }

    function deleteCustomWallpaperRecord(record) {
      return localWallpaperStore.remove(record);
    }

    function buildCustomWallpaperRecordFromFile(file) {
      return localWallpaperStore.buildRecordFromFile(file);
    }

    function normalizeWallpaperOverlayOpacity(value, fallback) {
      const fallbackValue = Number.isFinite(Number(fallback)) ? Number(fallback) : 50;
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed)) {
        return Math.max(0, Math.min(100, Math.round(fallbackValue)));
      }
      return Math.max(0, Math.min(100, parsed));
    }

    function snapWallpaperOverlaySliderValue(value) {
      const normalized = normalizeWallpaperOverlayOpacity(value, 50);
      const target = NEWTAB_WALLPAPER_OVERLAY_SNAP_POINTS.find((point) => {
        const threshold = point === 100 ? 0 : NEWTAB_WALLPAPER_OVERLAY_SNAP_THRESHOLD;
        return Math.abs(normalized - point) <= threshold;
      });
      return typeof target === 'number' ? target : normalized;
    }

    function legacyWallpaperOverlayOpacityToSliderValue(value, fallback) {
      return normalizeWallpaperOverlayOpacity(
        Math.round(normalizeWallpaperOverlayOpacity(value, 100) / 2),
        fallback
      );
    }

    function normalizeWallpaperOverlayPrefs(value) {
      if (value && typeof value === 'object') {
        if (value.version !== NEWTAB_WALLPAPER_OVERLAY_STORAGE_VERSION) {
          return {
            version: NEWTAB_WALLPAPER_OVERLAY_STORAGE_VERSION,
            light: legacyWallpaperOverlayOpacityToSliderValue(value.light, NEWTAB_WALLPAPER_OVERLAY_DEFAULTS.light),
            dark: legacyWallpaperOverlayOpacityToSliderValue(value.dark, NEWTAB_WALLPAPER_OVERLAY_DEFAULTS.dark)
          };
        }
        return {
          version: NEWTAB_WALLPAPER_OVERLAY_STORAGE_VERSION,
          light: normalizeWallpaperOverlayOpacity(value.light, NEWTAB_WALLPAPER_OVERLAY_DEFAULTS.light),
          dark: normalizeWallpaperOverlayOpacity(value.dark, NEWTAB_WALLPAPER_OVERLAY_DEFAULTS.dark)
        };
      }
      const shared = typeof value === 'undefined' || value === null
        ? NEWTAB_WALLPAPER_OVERLAY_DEFAULTS.light
        : legacyWallpaperOverlayOpacityToSliderValue(value, NEWTAB_WALLPAPER_OVERLAY_DEFAULTS.light);
      return {
        version: NEWTAB_WALLPAPER_OVERLAY_STORAGE_VERSION,
        light: shared,
        dark: shared
      };
    }

    function getResolvedWallpaperOverlayMode() {
      return document.body && document.body.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    }

    function getWallpaperOverlayOpacityForCurrentMode() {
      const mode = getResolvedWallpaperOverlayMode();
      return normalizeWallpaperOverlayOpacity(
        currentWallpaperOverlayOpacity[mode],
        NEWTAB_WALLPAPER_OVERLAY_DEFAULTS[mode]
      );
    }

    function getWallpaperOverlayStopPercent(base, value) {
      const basePercent = clampNumber(Number(base) || 0, 0, 100);
      const sliderValue = normalizeWallpaperOverlayOpacity(value, 50);
      if (sliderValue <= 50) {
        return basePercent * Math.pow(sliderValue / 50, 1.08);
      }
      const progress = (sliderValue - 50) / 50;
      return basePercent + ((100 - basePercent) * Math.pow(progress, 1.08));
    }

    function formatOverlayCssPercent(base, opacity) {
      const value = getWallpaperOverlayStopPercent(base, opacity);
      return `${Number(value.toFixed(1))}%`;
    }

    function applyWallpaperOverlayOpacity(value) {
      currentWallpaperOverlayOpacity = normalizeWallpaperOverlayPrefs(value);
      const target = document.documentElement;
      if (target) {
        ['light', 'dark'].forEach((mode) => {
          const stops = NEWTAB_WALLPAPER_OVERLAY_STOPS[mode];
          const opacity = currentWallpaperOverlayOpacity[mode];
          target.style.setProperty(`--x-nt-wallpaper-overlay-${mode}-top`, formatOverlayCssPercent(stops.top, opacity));
          target.style.setProperty(`--x-nt-wallpaper-overlay-${mode}-mid`, formatOverlayCssPercent(stops.mid, opacity));
          target.style.setProperty(`--x-nt-wallpaper-overlay-${mode}-bottom`, formatOverlayCssPercent(stops.bottom, opacity));
        });
      }
      renderWallpaperPanelState();
      scheduleWallpaperAdaptiveToneUpdate();
      if (hasStoredWallpaperStateLoaded) {
        writeWallpaperPreloadCache();
      }
    }

    function persistWallpaperOverlayOpacity(mode, value) {
      const nextMode = mode === 'dark' ? 'dark' : 'light';
      const nextValue = normalizeWallpaperOverlayOpacity(value, currentWallpaperOverlayOpacity[nextMode]);
      const nextPrefs = {
        version: NEWTAB_WALLPAPER_OVERLAY_STORAGE_VERSION,
        light: currentWallpaperOverlayOpacity.light,
        dark: currentWallpaperOverlayOpacity.dark,
        [nextMode]: nextValue
      };
      applyWallpaperOverlayOpacity(nextPrefs);
      if (!storageArea) {
        return;
      }
      saveWallpaperStyleSetting('overlay', () => {
        storageArea.set({ [NEWTAB_WALLPAPER_OVERLAY_STORAGE_KEY]: nextPrefs });
      });
    }
    function bootstrapInitialWallpaperOverlay() {
      if (initialWallpaperOverlayReadyPromise) {
        return initialWallpaperOverlayReadyPromise;
      }
      initialWallpaperOverlayReadyPromise = new Promise((resolve) => {
        if (!storageArea) {
          applyWallpaperOverlayOpacity({
            version: NEWTAB_WALLPAPER_OVERLAY_STORAGE_VERSION,
            light: NEWTAB_WALLPAPER_OVERLAY_DEFAULTS.light,
            dark: NEWTAB_WALLPAPER_OVERLAY_DEFAULTS.dark
          });
          resolve();
          return;
        }
        storageArea.get([NEWTAB_WALLPAPER_OVERLAY_STORAGE_KEY], (result) => {
          const raw = result ? result[NEWTAB_WALLPAPER_OVERLAY_STORAGE_KEY] : null;
          const prefs = normalizeWallpaperOverlayPrefs(raw);
          applyWallpaperOverlayOpacity(prefs);
          if (raw && JSON.stringify(raw) !== JSON.stringify(prefs)) {
            storageArea.set({ [NEWTAB_WALLPAPER_OVERLAY_STORAGE_KEY]: prefs });
          }
          resolve();
        });
      });
      return initialWallpaperOverlayReadyPromise;
    }

    function normalizeWallpaperEffectPrefs(value) {
      return normalizeSingleWallpaperEffectPrefs(value);
    }

    function getWallpaperEffectPrefsForMode(mode) {
      const normalizedMode = normalizeWallpaperMode(mode);
      return normalizeWallpaperEffectPrefs(
        currentWallpaperEffectPrefsByMode &&
          currentWallpaperEffectPrefsByMode[normalizedMode]
      );
    }

    function getWallpaperEffectEditMode() {
      return currentWallpaperPrefs && currentWallpaperPrefs.sameForModes === false
        ? getWallpaperEditMode()
        : getResolvedWallpaperMode();
    }

    function getWallpaperEffectPrefsForEditMode() {
      return getWallpaperEffectPrefsForMode(getWallpaperEffectEditMode());
    }

    function cloneWallpaperEffectStoragePrefs(value) {
      return normalizeWallpaperEffectStoragePrefs(value);
    }

    function setWallpaperEffectPrefsForModes(nextPrefsByMode) {
      currentWallpaperEffectPrefsByMode = cloneWallpaperEffectStoragePrefs(nextPrefsByMode);
    }

    function getWallpaperEffectStorageValue() {
      return cloneWallpaperEffectStoragePrefs(currentWallpaperEffectPrefsByMode);
    }

    function setSharedWallpaperEffectPrefs(value) {
      const shared = normalizeWallpaperEffectPrefs(value);
      setWallpaperEffectPrefsForModes({
        version: WALLPAPER_EFFECT_MODE_STORAGE_VERSION,
        light: shared,
        dark: shared
      });
    }

    function synchronizeWallpaperEffectPrefsWithWallpaperModes(sourceMode) {
      if (!hasStoredWallpaperEffectLoaded ||
          !hasStoredWallpaperStateLoaded ||
          !currentWallpaperPrefs ||
          currentWallpaperPrefs.sameForModes === false) {
        return false;
      }
      const mode = normalizeWallpaperMode(sourceMode || getResolvedWallpaperMode());
      const before = JSON.stringify(getWallpaperEffectStorageValue());
      setSharedWallpaperEffectPrefs(getWallpaperEffectPrefsForMode(mode));
      return before !== JSON.stringify(getWallpaperEffectStorageValue());
    }

    function doesWallpaperEffectSupportSize(type) {
      return type === 'blocks' || type === 'halftone' || type === 'dither' || type === 'ascii';
    }

    function doesWallpaperEffectSupportSpacing(type) {
      return type === 'halftone' || type === 'dither' || type === 'ascii';
    }

    function doesWallpaperEffectSupportInkTone(type) {
      return type === 'halftone' || type === 'ascii';
    }

    function getWallpaperEffectInkToneForUi(prefs) {
      return WALLPAPER_EFFECTS.resolveAutoInkTone(prefs && prefs.inkTone, getWallpaperEffectEditMode());
    }

    function getWallpaperEffectInkToneLabel(tone) {
      const item = NEWTAB_WALLPAPER_EFFECT_INK_TONES.find((option) => option.tone === tone) ||
        NEWTAB_WALLPAPER_EFFECT_INK_TONES[0];
      return t(item.labelKey, item.fallback);
    }

    function getWallpaperEffectLabel(type) {
      const item = NEWTAB_WALLPAPER_EFFECT_TYPES.find((effect) => effect.type === type) ||
        NEWTAB_WALLPAPER_EFFECT_TYPES[0];
      return t(item.labelKey, item.fallback);
    }

    function cleanupWallpaperPanelResize() {
      if (wallpaperPanelResizeTimer !== null) {
        window.clearTimeout(wallpaperPanelResizeTimer);
        wallpaperPanelResizeTimer = null;
      }
      if (typeof wallpaperPanelResizeCleanup === 'function') {
        wallpaperPanelResizeCleanup();
        wallpaperPanelResizeCleanup = null;
      }
    }

    function measureWallpaperPanelOpenHeight() {
      if (!wallpaperPanel) {
        return 0;
      }
      const previousHeight = wallpaperPanel.style.height;
      const previousTransition = wallpaperPanel.style.transition;
      wallpaperPanel.style.transition = 'none';
      wallpaperPanel.style.height = 'auto';
      const height = wallpaperPanel.getBoundingClientRect().height;
      wallpaperPanel.style.height = previousHeight;
      wallpaperPanel.style.transition = previousTransition;
      return height;
    }

    function animateWallpaperPanelResize(mutate) {
      if (typeof mutate !== 'function') {
        return;
      }
      // A resize already in progress measures its own end height after this change.
      if (wallpaperPanelResizing) {
        mutate();
        return;
      }
      const canAnimate = wallpaperPanel &&
        isWallpaperPanelOpen() &&
        !shouldReduceMotion();
      if (!canAnimate) {
        mutate();
        return;
      }

      cleanupWallpaperPanelResize();
      const startHeight = wallpaperPanel.getBoundingClientRect().height;
      const previousHeight = wallpaperPanel.style.height;
      const previousOverflow = wallpaperPanel.style.overflow;
      const previousTransition = wallpaperPanel.style.transition;
      const previousWillChange = wallpaperPanel.style.willChange;

      wallpaperPanel.style.height = `${startHeight}px`;
      wallpaperPanel.style.overflow = 'hidden';
      wallpaperPanel.style.willChange = 'height, transform, opacity, filter';
      wallpaperPanelResizing = true;
      try {
        mutate();
      } finally {
        wallpaperPanelResizing = false;
      }
      const endHeight = measureWallpaperPanelOpenHeight();

      const restorePanel = () => {
        wallpaperPanel.style.height = previousHeight;
        wallpaperPanel.style.overflow = previousOverflow;
        wallpaperPanel.style.transition = previousTransition;
        wallpaperPanel.style.willChange = previousWillChange;
        wallpaperPanel.removeEventListener('transitionend', handleTransitionEnd);
        if (wallpaperPanelResizeTimer !== null) {
          window.clearTimeout(wallpaperPanelResizeTimer);
          wallpaperPanelResizeTimer = null;
        }
        wallpaperPanelResizeCleanup = null;
      };
      function handleTransitionEnd(event) {
        if (event && event.target === wallpaperPanel && event.propertyName === 'height') {
          restorePanel();
        }
      }

      if (Math.abs(endHeight - startHeight) < 1) {
        restorePanel();
        return;
      }

      wallpaperPanelResizeCleanup = restorePanel;
      wallpaperPanel.style.height = `${startHeight}px`;
      wallpaperPanel.style.transition = `height ${WALLPAPER_PANEL_RESIZE_DURATION_MS}ms ${WALLPAPER_PANEL_RESIZE_EASING}`;
      void wallpaperPanel.offsetHeight;
      wallpaperPanel.addEventListener('transitionend', handleTransitionEnd);
      requestAnimationFrame(() => {
        if (!wallpaperPanelResizeCleanup) {
          return;
        }
        wallpaperPanel.style.height = `${endHeight}px`;
      });
      wallpaperPanelResizeTimer = window.setTimeout(restorePanel, WALLPAPER_PANEL_RESIZE_DURATION_MS + 80);
    }

    function setWallpaperActiveTab(tab) {
      const nextTab = normalizeWallpaperSourceTab(tab);
      const previousTab = activeWallpaperTab;
      if (previousTab !== nextTab) {
        activeWallpaperTab = nextTab;
        if (nextTab === 'curated') showCuratedCategoryOfSelection();
        renderWallpaperPanelState();
        playWallpaperEnterMotion(
          getWallpaperGridForTab(nextTab),
          WALLPAPER_SOURCE_TABS.indexOf(nextTab) < WALLPAPER_SOURCE_TABS.indexOf(previousTab) ? 'enter-prev' : 'enter-next'
        );
      } else {
        renderWallpaperPanelState();
      }
      if (nextTab === 'local' && isWallpaperPanelOpen()) {
        loadCustomWallpapers();
      }
      if (nextTab === 'bing' && previousTab !== nextTab && isWallpaperPanelOpen()) loadBingCatalog();
    }
    function showCuratedCategoryOfSelection() {
      const selectedId = getWallpaperSelectionIdForUi();
      const selected = getWallpaperById(selectedId);
      // A daily choice keeps its own category, which may be the random mix.
      const category = selected && selected.provider === 'curated'
        ? (REMOTE_CONTENT.isDailyWallpaperId(selectedId) ? REMOTE_CONTENT.wallpaperFromId(selectedId).category : selected.category)
        : '';
      if (!category) {
        return;
      }
      curatedCategory = category;
      showCuratedPageOfSelection();
    }
    // Follow the selection only when it moves, so storage reloads (deleting a
    // local wallpaper, syncs, theme changes) keep the tab the user is browsing.
    function syncWallpaperSourceTabToEditMode(options) {
      const selectedId = getWallpaperSelectionIdForUi();
      const force = Boolean(options && options.force);
      if (!force && selectedId === lastSyncedWallpaperSourceId) {
        return;
      }
      lastSyncedWallpaperSourceId = selectedId;
      if (selectedId) {
        setWallpaperActiveTab(getWallpaperSourceTabForId(selectedId));
      }
    }

    function setWallpaperActiveMode(mode) {
      bingSelectionSeq += 1;
      const nextMode = normalizeWallpaperMode(mode);
      if (activeWallpaperMode === nextMode) {
        renderWallpaperPanelState();
        return;
      }
      activeWallpaperMode = nextMode;
      syncWallpaperSourceTabToEditMode({ force: true });
      renderWallpaperPanelState();
      playWallpaperEnterMotion(getWallpaperGridForTab(activeWallpaperTab), 'enter');
    }
    function applyWallpaperEffectForResolvedMode() {
      const previousType = currentAppliedWallpaperEffectPrefs.type;
      const nextPrefs = getWallpaperEffectPrefsForMode(getResolvedWallpaperMode());
      const transitionLayer = previousType !== nextPrefs.type
        ? createWallpaperTransitionLayer()
        : null;
      if (transitionLayer) {
        transitionLayer.setAttribute('data-wallpaper-filter-transition', 'true');
      }
      currentAppliedWallpaperEffectPrefs = nextPrefs;
      if (document.body) {
        document.body.setAttribute('data-wallpaper-effect', currentAppliedWallpaperEffectPrefs.type);
      }
      const effectRenderReady = wallpaperEffects
        ? wallpaperEffects.apply(WALLPAPER_EFFECTS.resolvePrefsForMode(
          currentAppliedWallpaperEffectPrefs,
          getResolvedWallpaperMode()
        ))
        : null;
      if (transitionLayer && effectRenderReady && typeof effectRenderReady.then === 'function') {
        Promise.resolve(effectRenderReady).then(
          () => releaseWallpaperTransitionLayer(transitionLayer),
          () => releaseWallpaperTransitionLayer(transitionLayer)
        );
      } else {
        releaseWallpaperTransitionLayer(transitionLayer);
      }
      renderWallpaperPanelState();
    }

    function applyWallpaperEffectPrefs(value) {
      setWallpaperEffectPrefsForModes(normalizeWallpaperEffectStoragePrefs(value));
      synchronizeWallpaperEffectPrefsWithWallpaperModes();
      applyWallpaperEffectForResolvedMode();
    }

    function getWallpaperEffectControlVisibility(prefs) {
      return {
        inkTone: doesWallpaperEffectSupportInkTone(prefs.type),
        strength: prefs.type !== 'none' && prefs.type !== 'blocks',
        size: doesWallpaperEffectSupportSize(prefs.type),
        spacing: doesWallpaperEffectSupportSpacing(prefs.type),
        texture: prefs.type === 'blur',
        crtBloom: prefs.type === 'crt',
        crtRgbOffset: prefs.type === 'crt',
        crtCurvature: prefs.type === 'crt'
      };
    }

    function getWallpaperEffectStrengthLabel(prefs) {
      if (prefs.type === 'blur') {
        return { labelKey: 'newtab_wallpaper_effect_blur_strength', fallback: 'Blur strength' };
      }
      if (prefs.type === 'crt') {
        return { labelKey: 'newtab_wallpaper_effect_crt_strength', fallback: 'Display intensity' };
      }
      return { labelKey: 'newtab_wallpaper_effect_strength', fallback: 'Sampling strength' };
    }

    function getWallpaperEffectSizeLabel(prefs) {
      if (prefs.type === 'blocks') {
        return { labelKey: 'newtab_wallpaper_effect_blocks_size', fallback: 'Block size' };
      }
      return { labelKey: 'newtab_wallpaper_effect_size', fallback: 'Size' };
    }

    function getWallpaperEffectSpacingLabel(prefs) {
      return { labelKey: 'newtab_wallpaper_effect_spacing', fallback: 'Spacing' };
    }

    function getWallpaperEffectTextureLabel() {
      return { labelKey: 'newtab_wallpaper_effect_texture', fallback: 'Texture' };
    }

    function persistWallpaperEffectPrefs(partial) {
      const editMode = getWallpaperEffectEditMode();
      const nextPrefs = normalizeWallpaperEffectPrefs(Object.assign(
        {},
        getWallpaperEffectPrefsForMode(editMode),
        partial || {}
      ));
      const nextPrefsByMode = getWallpaperEffectStorageValue();
      const targetModes = currentWallpaperPrefs && currentWallpaperPrefs.sameForModes === false
        ? [editMode]
        : NEWTAB_WALLPAPER_MODES;
      targetModes.forEach((mode) => {
        nextPrefsByMode[mode] = nextPrefs;
      });
      setWallpaperEffectPrefsForModes(nextPrefsByMode);
      applyWallpaperEffectForResolvedMode();
      if (hasStoredWallpaperStateLoaded) {
        writeWallpaperPreloadCache();
      }
      if (!storageArea) {
        return;
      }
      saveWallpaperStyleSetting('effect', () => {
        storageArea.set({
          [NEWTAB_WALLPAPER_EFFECT_STORAGE_KEY]: getWallpaperEffectStorageValue()
        });
      });
    }

    function bootstrapInitialWallpaperEffect() {
      if (initialWallpaperEffectReadyPromise) {
        return initialWallpaperEffectReadyPromise;
      }
      if (!storageArea) {
        initialWallpaperEffectReadyPromise = Promise.resolve().then(() => {
          hasStoredWallpaperEffectLoaded = true;
          applyWallpaperEffectPrefs(NEWTAB_WALLPAPER_EFFECT_DEFAULTS);
          if (hasStoredWallpaperStateLoaded) {
            writeWallpaperPreloadCache();
          }
        });
        return initialWallpaperEffectReadyPromise;
      }
      initialWallpaperEffectReadyPromise = new Promise((resolve) => {
        storageArea.get([NEWTAB_WALLPAPER_EFFECT_STORAGE_KEY], (result) => {
          const raw = result ? result[NEWTAB_WALLPAPER_EFFECT_STORAGE_KEY] : null;
          const prefs = normalizeWallpaperEffectStoragePrefs(raw);
          hasStoredWallpaperEffectLoaded = true;
          applyWallpaperEffectPrefs(prefs);
          if (hasStoredWallpaperStateLoaded) {
            writeWallpaperPreloadCache();
          }
          const storedPrefs = getWallpaperEffectStorageValue();
          if (raw && JSON.stringify(raw) !== JSON.stringify(storedPrefs)) {
            storageArea.set({ [NEWTAB_WALLPAPER_EFFECT_STORAGE_KEY]: storedPrefs });
          }
          resolve();
        });
      });
      return initialWallpaperEffectReadyPromise;
    }

    function waitForInitialWallpaperEffectVisual() {
      const effectPreferencesReady = initialWallpaperEffectReadyPromise ||
        bootstrapInitialWallpaperEffect();
      return Promise.all([
        initialWallpaperReadyPromise,
        effectPreferencesReady
      ]).then(() => {
        if (!wallpaperEffects ||
            !currentWallpaperId ||
            currentAppliedWallpaperEffectPrefs.type === 'none') {
          return;
        }
        return wallpaperEffects.refresh({ immediate: true });
      });
    }

    function finalizeInitialWallpaper() {
      if (initialWallpaperApplied) {
        return;
      }
      initialWallpaperApplied = true;
      if (typeof resolveInitialWallpaperReady === 'function') {
        resolveInitialWallpaperReady();
      }
    }

    function applyTopContentMode(value) {
      currentTopContentMode = normalizeNewtabTopContentMode(value);
      setTopContentMode(currentTopContentMode);
      renderWallpaperPanelState();
    }

    function persistTopContentMode(value) {
      const nextValue = normalizeNewtabTopContentMode(value);
      applyTopContentMode(nextValue);
      if (!storageArea || !NEWTAB_TOP_CONTENT_MODE_STORAGE_KEY) {
        return;
      }
      storageArea.set({ [NEWTAB_TOP_CONTENT_MODE_STORAGE_KEY]: nextValue });
    }

    function applyTimeFontWeight(value) {
      currentTimeFontWeight = normalizeNewtabTimeFontWeight(value);
      setTimeFontWeight(currentTimeFontWeight);
      renderWallpaperPanelState();
    }

    function persistTimeFontWeight(value) {
      const nextValue = normalizeNewtabTimeFontWeight(value);
      applyTimeFontWeight(nextValue);
      if (!storageArea || !NEWTAB_TIME_FONT_WEIGHT_STORAGE_KEY) {
        return;
      }
      storageArea.set({ [NEWTAB_TIME_FONT_WEIGHT_STORAGE_KEY]: nextValue });
    }

    function applyTimeSecondsVisible(value) {
      currentTimeSecondsVisible = normalizeNewtabTimeSecondsVisible(value);
      setTimeSecondsVisible(currentTimeSecondsVisible);
      renderWallpaperPanelState();
    }

    function persistTimeSecondsVisible(value) {
      const nextValue = normalizeNewtabTimeSecondsVisible(value);
      applyTimeSecondsVisible(nextValue);
      if (!storageArea || !NEWTAB_TIME_SECONDS_VISIBLE_STORAGE_KEY) {
        return;
      }
      storageArea.set({ [NEWTAB_TIME_SECONDS_VISIBLE_STORAGE_KEY]: nextValue });
    }

    function getNewtabFaviconLink() {
      const head = document.head || document.getElementsByTagName && document.getElementsByTagName('head')[0];
      if (!head) {
        return null;
      }
      const children = Array.from(head.children || []);
      let link = children.find((child) => child &&
        String(child.tagName || '').toUpperCase() === 'LINK' &&
        child.getAttribute &&
        child.getAttribute('data-lumno-newtab-favicon') === 'true');
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('data-lumno-newtab-favicon', 'true');
        head.appendChild(link);
      }
      return link;
    }

    function applyNewtabFavicon(value) {
      const nextId = normalizeNewtabFaviconId(value);
      const item = getNewtabFaviconById(nextId) || getNewtabFaviconById(NEWTAB_FAVICON_DEFAULT_ID);
      currentNewtabFaviconId = item ? item.id : NEWTAB_FAVICON_DEFAULT_ID;
      cacheNewtabFaviconPreloadId(currentNewtabFaviconId);
      bindNewtabFaviconThemeListener(item);
      const link = getNewtabFaviconLink();
      if (link && item) {
        applyNewtabFaviconLinkAttributes(link, item);
      }
      renderWallpaperPanelState();
    }

    function persistNewtabFavicon(value) {
      const nextId = normalizeNewtabFaviconId(value);
      applyNewtabFavicon(nextId);
      writeStorageValue(storageArea, NEWTAB_FAVICON_STORAGE_KEY, nextId, () => {
        showToast(t('newtab_favicon_save_error', 'Failed to save favicon'), true);
      });
    }

    function bootstrapInitialNewtabFavicon() {
      if (hasNewtabFaviconBootstrapStarted) {
        return initialNewtabFaviconReadyPromise || Promise.resolve();
      }
      hasNewtabFaviconBootstrapStarted = true;
      initialNewtabFaviconReadyPromise = readStorageValue(storageArea, NEWTAB_FAVICON_STORAGE_KEY).then((storedValue) => {
        const nextId = normalizeNewtabFaviconId(storedValue.value);
        applyNewtabFavicon(nextId);
        if (storedValue.hasValue && storedValue.value !== nextId) {
          writeStorageValue(storageArea, NEWTAB_FAVICON_STORAGE_KEY, nextId);
        }
      });
      return initialNewtabFaviconReadyPromise;
    }

    function getWallpaperAppearanceOptionButtons() {
      const options = getWallpaperPanelRefs().appearanceOptions;
      return options ? Array.from(options.querySelectorAll('.x-nt-appearance-option')) : [];
    }
    function getWallpaperAppearanceOptionMotionElement(button) {
      if (!button || typeof button.querySelector !== 'function') {
        return button;
      }
      return button.querySelector('.x-nt-appearance-option-content') || button;
    }

    function getSearchWidthMin() {
      return Number.isFinite(Number(searchWidthConfig.min)) ? Number(searchWidthConfig.min) : 640;
    }

    function getSearchWidthMax() {
      const min = getSearchWidthMin();
      const max = Number.isFinite(Number(searchWidthConfig.max)) ? Number(searchWidthConfig.max) : 1040;
      return Math.max(min + 1, max);
    }

    function normalizeSearchWidthValue(value) {
      const min = getSearchWidthMin();
      const max = getSearchWidthMax();
      const fallback = Number.isFinite(Number(searchWidthConfig.fallback))
        ? Number(searchWidthConfig.fallback)
        : 920;
      const number = Number(value);
      if (!Number.isFinite(number)) {
        return Math.min(max, Math.max(min, Math.round(fallback)));
      }
      return Math.min(max, Math.max(min, Math.round(number)));
    }

    function getSearchWidthSnapPoints() {
      const points = Array.isArray(searchWidthConfig.snapPoints)
        ? searchWidthConfig.snapPoints
        : [640, 720, 920, 1040];
      return points.map(normalizeSearchWidthValue)
        .filter((value, index, array) => array.indexOf(value) === index)
        .sort((a, b) => a - b);
    }

    function getSearchWidthPercent(value) {
      const min = getSearchWidthMin();
      const max = getSearchWidthMax();
      return ((normalizeSearchWidthValue(value) - min) / (max - min)) * 100;
    }

    function snapSearchWidthValue(value, threshold) {
      const width = normalizeSearchWidthValue(value);
      const snapThreshold = Number.isFinite(Number(threshold))
        ? Number(threshold)
        : Number(searchWidthConfig.snapThreshold || 14);
      const matched = getSearchWidthSnapPoints().find((point) => Math.abs(point - width) <= snapThreshold);
      return Number.isFinite(matched) ? matched : width;
    }

    function formatSearchWidthValue(value) {
      return `${normalizeSearchWidthValue(value)} px`;
    }

    function persistSearchWidthFromSlider(value, options) {
      const final = Boolean(options && options.final);
      const threshold = final
        ? Number(searchWidthConfig.snapThreshold || 14) * 1.35
        : Number(searchWidthConfig.snapThreshold || 14);
      const width = snapSearchWidthValue(value, threshold);
      setSearchWidth(width, { persist: false });
      renderWallpaperPanelState();
      saveSliderSetting('searchWidth', () => setSearchWidth(width, { persist: true }), { final });
    }
    function getShortcutColumnsMin() {
      return Number.isFinite(Number(shortcutColumnsConfig.min))
        ? Number(shortcutColumnsConfig.min)
        : 4;
    }

    function getShortcutColumnsMax() {
      const min = getShortcutColumnsMin();
      const max = Number.isFinite(Number(shortcutColumnsConfig.max))
        ? Number(shortcutColumnsConfig.max)
        : 16;
      return Math.max(min, max);
    }

    function normalizeShortcutColumnsValue(value) {
      const min = getShortcutColumnsMin();
      const max = getShortcutColumnsMax();
      const fallback = Number.isFinite(Number(shortcutColumnsConfig.fallback))
        ? Number(shortcutColumnsConfig.fallback)
        : 10;
      const number = Number(value);
      if (!Number.isFinite(number)) {
        return Math.min(max, Math.max(min, Math.round(fallback)));
      }
      return Math.min(max, Math.max(min, Math.round(number)));
    }

    function getShortcutColumnsTickValues() {
      return [4, 8, 12, 16].map(normalizeShortcutColumnsValue)
        .filter((value, index, array) => array.indexOf(value) === index)
        .sort((a, b) => a - b);
    }

    function getShortcutColumnsPercent(value) {
      const min = getShortcutColumnsMin();
      const max = getShortcutColumnsMax();
      if (max <= min) {
        return 0;
      }
      return ((normalizeShortcutColumnsValue(value) - min) / (max - min)) * 100;
    }

    function persistShortcutColumnsFromSlider(value, options) {
      const columns = normalizeShortcutColumnsValue(value);
      setShortcutColumns(columns, { persist: false });
      renderWallpaperPanelState();
      saveSliderSetting('shortcutColumns', () => setShortcutColumns(columns, { persist: true }), options);
    }
    function getShortcutLayoutMin(config, fallback) {
      return Number.isFinite(Number(config && config.min))
        ? Number(config.min)
        : fallback;
    }

    function getShortcutLayoutMax(config, fallbackMin, fallbackMax) {
      const min = getShortcutLayoutMin(config, fallbackMin);
      const max = Number.isFinite(Number(config && config.max))
        ? Number(config.max)
        : fallbackMax;
      return Math.max(min, max);
    }

    function getShortcutLayoutDefault(config, fallbackMin, fallbackMax, fallbackValue) {
      const min = getShortcutLayoutMin(config, fallbackMin);
      const max = getShortcutLayoutMax(config, fallbackMin, fallbackMax);
      const value = Number.isFinite(Number(config && config.fallback))
        ? Number(config.fallback)
        : fallbackValue;
      return Math.min(max, Math.max(min, Math.round(value)));
    }

    function normalizeShortcutLayoutValue(
      value,
      config,
      fallbackMin,
      fallbackMax,
      fallbackValue
    ) {
      const min = getShortcutLayoutMin(config, fallbackMin);
      const max = getShortcutLayoutMax(config, fallbackMin, fallbackMax);
      const fallback = getShortcutLayoutDefault(
        config,
        fallbackMin,
        fallbackMax,
        fallbackValue
      );
      const number = Number(value);
      return Math.min(
        max,
        Math.max(min, Number.isFinite(number) ? Math.round(number) : fallback)
      );
    }

    function getShortcutLayoutPercent(
      value,
      config,
      fallbackMin,
      fallbackMax,
      fallbackValue
    ) {
      const min = getShortcutLayoutMin(config, fallbackMin);
      const max = getShortcutLayoutMax(config, fallbackMin, fallbackMax);
      if (max <= min) {
        return 0;
      }
      const normalized = normalizeShortcutLayoutValue(
        value,
        config,
        fallbackMin,
        fallbackMax,
        fallbackValue
      );
      return ((normalized - min) / (max - min)) * 100;
    }

    function normalizeShortcutSizeValue(value) {
      return normalizeShortcutLayoutValue(value, shortcutSizeConfig, 48, 80, 64);
    }

    function normalizeShortcutGapValue(value) {
      return normalizeShortcutLayoutValue(value, shortcutGapConfig, 0, 24, 4);
    }

    function persistShortcutSizeFromSlider(value, options) {
      const size = normalizeShortcutSizeValue(value);
      setShortcutSize(size, { persist: false });
      renderWallpaperPanelState();
      saveSliderSetting('shortcutSize', () => setShortcutSize(size, { persist: true }), options);
    }
    function persistShortcutGapFromSlider(value, options) {
      const gap = normalizeShortcutGapValue(value);
      setShortcutGap(gap, { persist: false });
      renderWallpaperPanelState();
      saveSliderSetting('shortcutGap', () => setShortcutGap(gap, { persist: true }), options);
    }
    function primeWallpaperImage(id) {
      const wallpaper = getWallpaperById(id);
      return waitForWallpaperImageReady(wallpaper ? getWallpaperImageUrl(wallpaper) : '');
    }
    function loadCustomWallpapers() {
      if (customWallpaperCatalogLoaded) {
        return Promise.resolve(customWallpapers);
      }
      if (customWallpaperCatalogPromise) {
        return customWallpaperCatalogPromise;
      }
      const linkImagesTask = readCachedWallpaperImages(linkWallpapers.map((item) => item.id));
      customWallpaperCatalogPromise = readCustomWallpaperRecords().then((records) => {
        const showRecords = () => {
          customWallpapers = records;
          customWallpaperCatalogLoaded = true;
          renderWallpaperPanelState();
          return records;
        };
        // Wait for cached link images so the tiles do not load full images from the links first.
        return linkWallpapers.length ? linkImagesTask.then(showRecords) : showRecords();
      }).catch(() => {
        renderWallpaperPanelState();
        return customWallpapers;
      }).finally(() => {
        customWallpaperCatalogPromise = null;
        cacheListedLinkWallpapers();
      });
      return customWallpaperCatalogPromise;
    }

    function refreshCustomWallpapers() {
      customWallpaperCatalogLoaded = false;
      return loadCustomWallpapers();
    }

    function mergeCustomWallpaperRecords(records) {
      const recordsById = new Map();
      customWallpapers.forEach((record) => {
        if (record && record.id) {
          recordsById.set(record.id, record);
        }
      });
      (Array.isArray(records) ? records : []).forEach((record) => {
        const normalized = normalizeCustomWallpaperRecord(record);
        if (normalized) {
          recordsById.set(normalized.id, normalized);
        }
      });
      customWallpapers = Array.from(recordsById.values()).sort((a, b) => a.updatedAt - b.updatedAt);
      return customWallpapers;
    }

    function rememberActiveWallpaperId(mode, id) {
      const nextId = normalizeNewtabWallpaperId(id);
      if (!nextId) {
        return;
      }
      const normalizedMode = normalizeWallpaperMode(mode);
      lastActiveWallpaperId = nextId;
      lastActiveWallpaperIdsByMode[normalizedMode] = nextId;
      if (currentWallpaperPrefs && currentWallpaperPrefs.sameForModes) {
        NEWTAB_WALLPAPER_MODES.forEach((item) => {
          lastActiveWallpaperIdsByMode[item] = nextId;
        });
      }
    }

    function applyNewtabWallpaper(value, options) {
      const config = options || {};
      const mode = normalizeWallpaperMode(config.mode || getResolvedWallpaperMode());
      const nextId = normalizeNewtabWallpaperId(value);
      const wallpaper = getWallpaperById(nextId);
      const imageUrl = wallpaper ? getWallpaperImageUrl(wallpaper) : '';
      const isInitialWallpaperApply = !initialWallpaperApplied;
      const visualSeq = ++wallpaperVisualSeq;
      currentWallpaperId = wallpaper ? wallpaper.id : '';
      if (currentWallpaperId) {
        rememberActiveWallpaperId(mode, currentWallpaperId);
      }
      writeWallpaperPreloadCache();
      renderWallpaperPanelState();
      if (isInitialWallpaperApply) {
        applyWallpaperVisualState(wallpaper);
        refreshWallpaperAdaptiveSampler();
        scheduleWallpaperVisualRefresh(visualSeq);
        finalizeInitialWallpaper();
        if (appliedWallpaperVisualUrl !== imageUrl) {
          showWallpaperWhenReady(wallpaper, imageUrl, visualSeq);
        }
        return;
      }
      finalizeInitialWallpaper();
      showWallpaperWhenReady(wallpaper, imageUrl, visualSeq);
    }

    // Keeps the current wallpaper until the next one has loaded, or until its fallback is ready.
    function showWallpaperWhenReady(wallpaper, imageUrl, visualSeq) {
      waitForWallpaperImageReady(imageUrl).then(() => {
        return waitForWallpaperImageReady(wallpaper ? getDisplayedWallpaperImageUrl(wallpaper) : '');
      }).then(() => {
        if (visualSeq !== wallpaperVisualSeq) {
          return;
        }
        const displayedUrl = wallpaper ? getDisplayedWallpaperImageUrl(wallpaper) : '';
        const shouldAnimateVisualChange = displayedUrl !== appliedWallpaperVisualUrl ||
          Boolean(wallpaper) !== appliedWallpaperVisualActive;
        const transitionLayer = shouldAnimateVisualChange ? createWallpaperTransitionLayer() : null;
        applyWallpaperVisualState(wallpaper);
        releaseWallpaperTransitionLayer(transitionLayer);
        scheduleWallpaperVisualRefresh(visualSeq);
      });
    }

    function applyResolvedNewtabWallpaper(options) {
      const mode = getResolvedWallpaperMode();
      applyNewtabWallpaper(getEffectiveWallpaperIdForMode(mode), Object.assign({}, options || {}, { mode }));
      if (hasStoredWallpaperStateLoaded) cacheShownWallpaperImages();
    }

    function applyStoredWallpaperState(syncedValue, localValue) {
      const syncedResolution = resolveSyncedWallpaperValue(syncedValue.value, syncedValue.hasValue);
      const localResolution = resolveLocalWallpaperOverride(localValue.value, localValue.hasValue);
      const migrated = applyLocalWallpaperMigrations(
        localResolution.overrides,
        syncedResolution.localMigrations
      );
      setWallpaperPrefs(syncedResolution.prefs, migrated.overrides);
      hasStoredWallpaperStateLoaded = true;
      bindWallpaperPageShownListeners();
      activeWallpaperMode = currentWallpaperPrefs.sameForModes
        ? getResolvedWallpaperMode()
        : normalizeWallpaperMode(activeWallpaperMode);
      const didSyncWallpaperEffects = synchronizeWallpaperEffectPrefsWithWallpaperModes();
      applyWallpaperEffectForResolvedMode();
      applyResolvedNewtabWallpaper();
      syncWallpaperSourceTabToEditMode();
      renderWallpaperPanelState();
      if (syncedResolution.sanitizedValue !== null) {
        writeSyncedWallpaperValue(syncedResolution.sanitizedValue);
      } else if (!syncedValue.fromOnlineKey && getWallpaperStorageRawIds(syncedValue.value).some(isOnlineWallpaperId)) {
        // Move online picks saved under the shared key before older versions can clear them.
        writeSyncedWallpaperValue(syncedValue.value);
      }
      if (localResolution.shouldClear || migrated.changed) {
        writeLocalWallpaperValue(buildLocalWallpaperStorageValue(
          currentLocalWallpaperOverrides,
          currentWallpaperPrefs.sameForModes
        ));
      }
      if (didSyncWallpaperEffects && storageArea) {
        storageArea.set({
          [NEWTAB_WALLPAPER_EFFECT_STORAGE_KEY]: getWallpaperEffectStorageValue()
        });
      }
    }

    function loadStoredWallpaperState(options) {
      const config = options || {};
      const changeSeq = wallpaperStorageChangeSeq;
      return Promise.all([
        readStorageValue(storageArea, NEWTAB_WALLPAPER_STORAGE_KEY),
        readStorageValue(localWallpaperStorageArea, NEWTAB_LOCAL_WALLPAPER_STORAGE_KEY),
        readStorageValue(storageArea, NEWTAB_ONLINE_WALLPAPER_STORAGE_KEY),
        readStorageValue(storageArea, NEWTAB_LINK_WALLPAPERS_STORAGE_KEY),
        readStorageValue(storageArea, NEWTAB_DAILY_WALLPAPER_PICKS_STORAGE_KEY)
      ]).then((stored) => {
        dailyWallpaperPicks = normalizeDailyWallpaperPicks(stored[4].value);
        const results = [mergeOnlineWallpaperValue(stored[0], stored[2]), stored[1]];
        const linksChanged = setLinkWallpapers(stored[3].value);
        const linkIds = getWallpaperStorageRawIds(results[0].value).filter(isLinkWallpaperId);
        const customWallpaperIds = getStoredCustomWallpaperIds(results)
          .filter((id) => !hasLoadedStoredCustomWallpaper(id));
        const customWallpaperPromise = customWallpaperIds.length > 0
          ? readCustomWallpaperRecordsByIds(customWallpaperIds).then((records) => {
            mergeCustomWallpaperRecords(records);
          }).catch(warnWallpaperStoreFailure('Could not read local wallpapers; showing the default.'))
          : Promise.resolve();
        const remoteIds = getWallpaperStorageRawIds(results[0].value)
          .map((id) => normalizeNewtabWallpaperId(id))
          .filter((id) => REMOTE_CONTENT.wallpaperFromId(id));
        // Picks are dated Bing photos or bundled ones; restore them like any chosen photo.
        const pickIds = remoteIds.map(getDailyWallpaperPick).filter(Boolean);
        // Read cached copies only once photos are restored: the daily Bing photo resolves from storage.
        const cachedImagesTask = Promise.all(remoteIds.concat(pickIds).map((id) => remoteClient.restoreWallpaper(id)))
          .then(() => readCachedWallpaperImages(linkIds.concat(remoteIds.map((id) => getWallpaperById(id))
            .filter((item) => item && item.cacheImage).map((item) => item.dailyId || item.id))));
        return Promise.all([customWallpaperPromise, cachedImagesTask]).then(() => {
          if (changeSeq !== wallpaperStorageChangeSeq ||
              typeof config.shouldApply === 'function' && !config.shouldApply()) {
            return false;
          }
          applyStoredWallpaperState(results[0], results[1]);
          cacheShownWallpaperImages();
          if (linksChanged && customWallpaperCatalogLoaded) {
            renderWallpaperPanelState();
            cacheListedLinkWallpapers();
          }
          remoteClient.setPinnedIds(remoteIds);
          if (remoteIds.includes(REMOTE_CONTENT.BING_DAILY_ID)) {
            remoteClient.ensureWallpaper(REMOTE_CONTENT.BING_DAILY_ID).then(() => {
              if (getEffectiveWallpaperIdForMode(getResolvedWallpaperMode()) === REMOTE_CONTENT.BING_DAILY_ID) {
                applyResolvedNewtabWallpaper();
              }
              renderWallpaperPanelState();
            }).catch(() => {
              // Offline or Bing is down: the built-in stand-in stays until the next visit.
            });
          }
          return true;
        });
      });
    }

    function bootstrapInitialWallpaper() {
      if (hasWallpaperBootstrapStarted) {
        return initialWallpaperReadyPromise;
      }
      hasWallpaperBootstrapStarted = true;
      loadStoredWallpaperState();
      return initialWallpaperReadyPromise;
    }

    function normalizeWallpaperRestoreId(mode) {
      const normalizedMode = normalizeWallpaperMode(mode);
      return normalizeNewtabWallpaperId(lastActiveWallpaperIdsByMode[normalizedMode]) ||
        normalizeNewtabWallpaperId(lastActiveWallpaperId) ||
        NEWTAB_WALLPAPER_DEFAULT_ID;
    }

    function persistWallpaperEnabled(enabled) {
      bingSelectionSeq += 1;
      wallpaperStorageChangeSeq += 1;
      const prefs = getWritableWallpaperPrefs();
      const overrides = getWritableLocalWallpaperOverrides();
      if (enabled) {
        NEWTAB_WALLPAPER_MODES.forEach((mode) => {
          if (getEffectiveWallpaperIdForMode(mode)) {
            return;
          }
          overrides[mode] = null;
          prefs[mode] = normalizeWallpaperRestoreId(mode);
        });
        if (prefs.sameForModes) {
          const sharedId = prefs.light || prefs.dark || normalizeWallpaperRestoreId(getResolvedWallpaperMode());
          prefs.light = sharedId;
          prefs.dark = sharedId;
          overrides.dark = overrides.light;
        }
        setWallpaperPrefs(prefs, overrides);
        applyResolvedNewtabWallpaper();
        syncWallpaperSourceTabToEditMode();
        renderWallpaperPanelState();
        writeCurrentWallpaperPrefs({ showError: true });
        return;
      }
      NEWTAB_WALLPAPER_MODES.forEach((mode) => {
        const activeId = getEffectiveWallpaperIdForMode(mode);
        if (activeId) {
          rememberActiveWallpaperId(mode, activeId);
        }
        if (activeId && isCustomWallpaperId(activeId)) {
          overrides[mode] = NEWTAB_LOCAL_WALLPAPER_DISABLED_VALUE;
          return;
        }
        overrides[mode] = null;
        prefs[mode] = '';
      });
      if (prefs.sameForModes) {
        prefs.dark = prefs.light;
        overrides.dark = overrides.light;
      }
      setWallpaperPrefs(prefs, overrides);
      applyResolvedNewtabWallpaper();
      syncWallpaperSourceTabToEditMode();
      renderWallpaperPanelState();
      writeCurrentWallpaperPrefs({ showError: true });
    }

    function persistWallpaperModeConsistency(sameForModes) {
      const nextSameForModes = sameForModes !== false;
      const prefs = getWritableWallpaperPrefs();
      const overrides = getWritableLocalWallpaperOverrides();
      if (prefs.sameForModes === nextSameForModes) {
        renderWallpaperPanelState();
        return;
      }
      if (!nextSameForModes) {
        const sharedEffectPrefs = getWallpaperEffectPrefsForEditMode();
        const modeOrder = getWallpaperModePreferenceOrder();
        const sharedId = hasAnyWallpaperEnabled()
          ? getFirstEnabledWallpaperIdForModes(modeOrder)
          : '';
        const sharedOverride = getCopyableWallpaperLocalOverrideForId(modeOrder, sharedId);
        prefs.sameForModes = false;
        prefs.light = sharedOverride
          ? (prefs.light || NEWTAB_WALLPAPER_DEFAULT_ID)
          : sharedId;
        prefs.dark = prefs.light;
        if (sharedOverride) {
          overrides.light = sharedOverride;
          overrides.dark = sharedOverride;
        } else {
          overrides.light = null;
          overrides.dark = null;
        }
        activeWallpaperMode = getResolvedWallpaperMode();
        setSharedWallpaperEffectPrefs(sharedEffectPrefs);
      } else {
        const sharedMode = getWallpaperEditMode();
        const sharedEffectPrefs = getWallpaperEffectPrefsForMode(sharedMode);
        const sharedId = getEffectiveWallpaperIdForMode(sharedMode);
        const sharedOverride = getWallpaperLocalOverrideForMode(sharedMode);
        prefs.sameForModes = true;
        prefs.light = sharedOverride && isCustomWallpaperId(sharedOverride)
          ? (prefs[sharedMode] || NEWTAB_WALLPAPER_DEFAULT_ID)
          : sharedId;
        prefs.dark = prefs.light;
        overrides.light = sharedOverride || null;
        overrides.dark = overrides.light;
        activeWallpaperMode = getResolvedWallpaperMode();
        setSharedWallpaperEffectPrefs(sharedEffectPrefs);
      }
      setWallpaperPrefs(prefs, overrides);
      applyWallpaperEffectForResolvedMode();
      applyResolvedNewtabWallpaper();
      syncWallpaperSourceTabToEditMode();
      renderWallpaperPanelState();
      writeCurrentWallpaperPrefs({ showError: true });
      if (storageArea) {
        storageArea.set({
          [NEWTAB_WALLPAPER_EFFECT_STORAGE_KEY]: getWallpaperEffectStorageValue()
        });
      }
    }

    function persistNewtabWallpaper(id) {
      bingSelectionSeq += 1;
      wallpaperStorageChangeSeq += 1;
      const nextId = normalizeNewtabWallpaperId(id);
      const prefs = getWritableWallpaperPrefs();
      const overrides = getWritableLocalWallpaperOverrides();
      const targetModes = prefs.sameForModes
        ? NEWTAB_WALLPAPER_MODES.slice()
        : [getWallpaperEditMode()];
      targetModes.forEach((mode) => {
        if (nextId && isCustomWallpaperId(nextId)) {
          overrides[mode] = nextId;
          rememberActiveWallpaperId(mode, nextId);
          return;
        }
        overrides[mode] = null;
        prefs[mode] = nextId;
        if (nextId) {
          rememberActiveWallpaperId(mode, nextId);
        }
      });
      if (prefs.sameForModes) {
        prefs.dark = prefs.light;
        overrides.dark = overrides.light;
      }
      setWallpaperPrefs(prefs, overrides);
      remoteClient.setPinnedIds([prefs.light, prefs.dark]);
      applyResolvedNewtabWallpaper();
      renderWallpaperPanelState();
      if (nextId && isCustomWallpaperId(nextId)) {
        writeLocalWallpaperValue(
          buildLocalWallpaperStorageValue(currentLocalWallpaperOverrides, currentWallpaperPrefs.sameForModes),
          { showError: true }
        );
        return;
      }
      writeCurrentWallpaperPrefs({ showError: true });
    }

    function importCustomWallpaperFile(file) {
      if (!file || customWallpaperImporting) {
        return;
      }
      customWallpaperImporting = true;
      renderWallpaperPanelState();
      const toastTask = beginToast(t('newtab_wallpaper_importing', 'Importing wallpaper…'));
      buildCustomWallpaperRecordFromFile(file).then((record) => {
        return writeCustomWallpaperRecord(record).then(() => record);
      }).then((record) => {
        const nextWallpaper = normalizeCustomWallpaperRecord(record);
        if (!nextWallpaper) {
          throw new Error('Invalid wallpaper record.');
        }
        customWallpapers = customWallpapers.concat(nextWallpaper);
        persistNewtabWallpaper(nextWallpaper.id);
        renderWallpaperPanelState();
        toastTask.done(t('newtab_wallpaper_import_done', 'Wallpaper imported'));
      }).catch(() => {
        toastTask.fail(t('newtab_wallpaper_import_error', 'Failed to import wallpaper'));
      }).finally(() => {
        customWallpaperImporting = false;
        renderWallpaperPanelState();
      });
    }

    function normalizeCustomWallpaperUrl(value) {
      try {
        const url = new URL(String(value || '').trim());
        return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
      } catch (_error) {
        return '';
      }
    }

    function getCustomWallpaperUrlName(url) {
      try {
        const parsed = new URL(url);
        const file = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || '');
        return (file.replace(/\.[^.]+$/, '') || parsed.hostname).slice(0, 80);
      } catch (_error) {
        return '';
      }
    }

    // Some hosts label images as generic binaries; the file extension then names the type.
    function getCustomWallpaperUrlMimeType(url, type) {
      const mime = String(type || '').split(';')[0].trim().toLowerCase();
      if (mime.startsWith('image/')) return mime === 'image/jpg' ? 'image/jpeg' : mime;
      const extension = (/\.([a-z0-9]{3,4})$/i.exec(new URL(url).pathname) || [])[1] || '';
      return { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[extension.toLowerCase()] || mime;
    }

    async function fetchCustomWallpaperFile(url) {
      const fetcher = typeof options.fetchRemoteContent === 'function'
        ? options.fetchRemoteContent
        : windowObj.fetch.bind(windowObj);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetcher(url, {
          signal: controller.signal,
          credentials: 'omit',
          referrerPolicy: 'no-referrer'
        });
        if (!response.ok) {
          throw new Error(`Request failed (${response.status}).`);
        }
        const blob = await response.blob();
        return new File([blob], getCustomWallpaperUrlName(response.url || url), {
          type: getCustomWallpaperUrlMimeType(response.url || url, blob.type)
        });
      } finally {
        clearTimeout(timer);
      }
    }

    function setCustomWallpaperUrlFormOpen(open) {
      const nextOpen = Boolean(open);
      if (customWallpaperUrlFormOpen !== nextOpen) {
        customWallpaperUrlFormOpen = nextOpen;
        customWallpaperUrlInvalid = false;
        renderWallpaperPanelState();
      }
      if (nextOpen && wallpaperViewController) {
        wallpaperViewController.focus('urlInput');
      }
    }
    function isLinkWallpaperId(id) {
      return LINK_WALLPAPER_ID_PATTERN.test(String(id || ''));
    }

    function normalizeLinkWallpapers(value) {
      const ids = new Set();
      return (Array.isArray(value) ? value : []).map((entry) => ({
        id: String(entry && entry.id || ''),
        url: normalizeCustomWallpaperUrl(entry && entry.url),
        addedAt: Number(entry && entry.addedAt) || 0
      })).filter((entry) => {
        if (!isLinkWallpaperId(entry.id) || !entry.url || ids.has(entry.id)) return false;
        ids.add(entry.id);
        return true;
      });
    }

    function setLinkWallpapers(value) {
      const next = normalizeLinkWallpapers(value);
      const changed = JSON.stringify(next) !== JSON.stringify(linkWallpapers);
      linkWallpapers = next;
      return changed;
    }

    function getLinkWallpaperById(id) {
      const entry = linkWallpapers.find((item) => item.id === id);
      if (!entry) return null;
      const cached = getCachedWallpaperImage(id, entry.url);
      return {
        id,
        url: entry.url,
        name: getCustomWallpaperUrlName(entry.url),
        imageDataUrl: cached ? cached.imageDataUrl : '',
        thumbnailDataUrl: cached ? cached.thumbnailDataUrl : '',
        updatedAt: entry.addedAt
      };
    }

    // The preload already reads the shown photo's copy; take it instead of opening the cache again.
    function takePreloadedWallpaperImage() {
      const wallpaperPreload = globalThis.LumnoNewtabWallpaperPreload;
      const ready = wallpaperPreload && wallpaperPreload.imageReady;
      if (!ready || typeof ready.then !== 'function') return Promise.resolve();
      wallpaperPreload.imageReady = null;
      return ready.then(() => {
        const record = wallpaperPreload.cachedImageRecord;
        if (record && record.id && record.imageDataUrl && !cachedWallpaperImages.has(record.id)) {
          cachedWallpaperImages.set(record.id, record);
        }
      }, () => {
        // The preload found no copy; the runtime reads the cache itself next.
      });
    }

    function readCachedWallpaperImages(ids) {
      return takePreloadedWallpaperImage().then(() => readStoredCachedWallpaperImages(ids));
    }

    function readStoredCachedWallpaperImages(ids) {
      const missing = ids.filter((id) => !cachedWallpaperImages.has(id));
      if (!wallpaperImageCache || !missing.length) return Promise.resolve();
      return wallpaperImageCache.readByIds(missing).then((records) => {
        records.forEach((record) => {
          if (record && record.imageDataUrl) cachedWallpaperImages.set(record.id, record);
        });
      }).catch(warnWallpaperStoreFailure('Could not read cached wallpaper images.'));
    }

    function rememberCachedWallpaperImage(id, url, record) {
      const image = { id, url, imageDataUrl: record.imageDataUrl, thumbnailDataUrl: record.thumbnailDataUrl,
        cachedAt: Date.now() };
      cachedWallpaperImages.set(id, image);
      if (wallpaperImageCache) {
        wallpaperImageCache.write(image).catch(warnWallpaperStoreFailure('Could not cache a wallpaper image.'));
      }
    }

    // A link names a single image. Each device downloads it, or a curated photo or print, once and
    // keeps a downscaled copy, so new tabs skip the network and the wallpaper keeps showing if the
    // link later breaks.
    function cacheWallpaperImage(photoId, url) {
      if (getCachedWallpaperImage(photoId, url)) return Promise.resolve(true);
      if (wallpaperImageCaching.has(photoId)) return wallpaperImageCaching.get(photoId);
      const task = readCachedWallpaperImages([photoId]).then(() => getCachedWallpaperImage(photoId, url) ||
        fetchCustomWallpaperFile(url).then(buildCustomWallpaperRecordFromFile).then((record) => {
          rememberCachedWallpaperImage(photoId, url, record);
          pruneCachedWallpaperImages();
        }))
        .then(() => {
          const showing = NEWTAB_WALLPAPER_MODES.some((mode) => getEffectiveWallpaperPhotoId(mode) === photoId);
          if (showing) applyResolvedNewtabWallpaper();
          if (customWallpaperCatalogLoaded && isLinkWallpaperId(photoId)) renderWallpaperPanelState();
          return true;
        })
        .catch(() => false)
        .finally(() => wallpaperImageCaching.delete(photoId));
      wallpaperImageCaching.set(photoId, task);
      return task;
    }

    function cacheLinkWallpaper(id) {
      const entry = linkWallpapers.find((item) => item.id === id);
      return entry ? cacheWallpaperImage(id, entry.url) : Promise.resolve(false);
    }

    // The photo a mode shows: the link itself, or the photo or print a curated or daily pick resolves to.
    function getEffectiveWallpaperPhotoId(mode) {
      const id = getEffectiveWallpaperIdForMode(mode);
      if (isLinkWallpaperId(id)) return id;
      const item = id && REMOTE_CONTENT.wallpaperFromId(id) ? getWallpaperById(id) : null;
      return item && item.cacheImage ? item.dailyId || item.id : '';
    }

    function cacheShownWallpaperImages() {
      NEWTAB_WALLPAPER_MODES.forEach((mode) => {
        const id = getEffectiveWallpaperIdForMode(mode);
        if (isLinkWallpaperId(id)) {
          cacheLinkWallpaper(id);
          return;
        }
        const item = id && REMOTE_CONTENT.wallpaperFromId(id) ? getWallpaperById(id) : null;
        if (item && item.cacheImage) cacheWallpaperImage(item.dailyId || item.id, item.imageUrl);
      });
    }

    // Saved links keep their copies; a curated photo or print stays only while a mode shows it, so
    // daily picks do not pile up one image per day.
    function pruneCachedWallpaperImages() {
      if (!wallpaperImageCache || !hasStoredWallpaperStateLoaded) return;
      const keep = new Set(linkWallpapers.map((item) => item.id)
        .concat(NEWTAB_WALLPAPER_MODES.map(getEffectiveWallpaperPhotoId)));
      wallpaperImageCache.keys().then((keys) => keys.filter((key) => !keep.has(key)).forEach((key) => {
        cachedWallpaperImages.delete(key);
        wallpaperImageCache.remove(key).catch(warnWallpaperStoreFailure('Could not prune a cached wallpaper image.'));
      })).catch(warnWallpaperStoreFailure('Could not list cached wallpaper images.'));
    }

    function cacheListedLinkWallpapers() {
      linkWallpapers.forEach((item) => cacheLinkWallpaper(item.id));
    }

    function writeLinkWallpapers(list) {
      linkWallpapers = list;
      writeStorageValue(storageArea, NEWTAB_LINK_WALLPAPERS_STORAGE_KEY, list, () => {
        showToast(t('newtab_wallpaper_save_error', 'Failed to save wallpaper'), true);
      });
    }

    // Deleting a link removes it from every synced device, like the other synced settings.
    function deleteLinkWallpaper(id) {
      hideTopActionTooltip();
      // Read the selection while the link still resolves.
      const prefs = getWritableWallpaperPrefs();
      const selected = NEWTAB_WALLPAPER_MODES.filter((mode) => prefs[mode] === id);
      selected.forEach((mode) => { prefs[mode] = NEWTAB_WALLPAPER_DEFAULT_ID; });
      writeLinkWallpapers(linkWallpapers.filter((item) => item.id !== id));
      cachedWallpaperImages.delete(id);
      if (wallpaperImageCache) {
        wallpaperImageCache.remove(id).catch(warnWallpaperStoreFailure('Could not remove a cached link wallpaper.'));
      }
      if (selected.length) {
        setWallpaperPrefs(prefs, getWritableLocalWallpaperOverrides());
        applyResolvedNewtabWallpaper();
        writeCurrentWallpaperPrefs({ showError: true });
      }
      renderWallpaperPanelState();
      showToast(t('newtab_wallpaper_delete_done', 'Deleted'), false);
    }

    function finishCustomWallpaperUrlEntry() {
      customWallpaperUrlClearToken += 1;
      setCustomWallpaperUrlFormOpen(false);
    }

    function submitCustomWallpaperUrl(value) {
      const url = normalizeCustomWallpaperUrl(value);
      if (!url) {
        customWallpaperUrlInvalid = true;
        renderWallpaperPanelState();
        showToast(t('newtab_wallpaper_url_invalid', 'Enter a link that starts with http:// or https://'), true);
        wallpaperViewController.focus('urlInput');
        return;
      }
      if (customWallpaperUrlInvalid) {
        customWallpaperUrlInvalid = false;
        renderWallpaperPanelState();
      }
      const existing = linkWallpapers.find((item) => item.url === url);
      if (existing) {
        persistNewtabWallpaper(existing.id);
        finishCustomWallpaperUrlEntry();
        return;
      }
      const entry = {
        id: `link-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
        url,
        addedAt: Date.now()
      };
      if (url.length > LINK_WALLPAPER_URL_MAX_LENGTH ||
          JSON.stringify(linkWallpapers.concat(entry)).length > LINK_WALLPAPERS_MAX_BYTES) {
        showToast(t('newtab_wallpaper_url_limit',
          'This link is too long, or too many links are saved. Remove some and try again.'), true);
        return;
      }
      customWallpaperImporting = true;
      renderWallpaperPanelState();
      const toastTask = beginToast(t('newtab_wallpaper_importing', 'Importing wallpaper…'));
      // Load the image before saving the link, so a broken link never reaches other devices.
      fetchCustomWallpaperFile(url).then(buildCustomWallpaperRecordFromFile).then((record) => {
        rememberCachedWallpaperImage(entry.id, url, record);
        writeLinkWallpapers(linkWallpapers.concat(entry));
        persistNewtabWallpaper(entry.id);
        renderWallpaperPanelState();
        finishCustomWallpaperUrlEntry();
        toastTask.done(t('newtab_wallpaper_import_done', 'Wallpaper imported'));
      }).catch(() => {
        toastTask.fail(t('newtab_wallpaper_url_import_error', 'Could not add an image from this link'));
        if (customWallpaperUrlFormOpen) wallpaperViewController.focus('urlInput');
      }).finally(() => {
        customWallpaperImporting = false;
        renderWallpaperPanelState();
      });
    }

    function closeCustomWallpaperUrlForm() {
      if (!customWallpaperUrlFormOpen || activeWallpaperTab !== 'local') {
        return false;
      }
      const urlForm = getWallpaperPanelRefs().urlForm;
      const hadFocus = Boolean(urlForm && urlForm.contains(document.activeElement));
      setCustomWallpaperUrlFormOpen(false);
      if (hadFocus) wallpaperViewController.focus('urlTile');
      return true;
    }
    function deleteCustomWallpaper(id) {
      if (isLinkWallpaperId(id)) {
        deleteLinkWallpaper(id);
        return;
      }
      const targetWallpaper = getCustomWallpaperById(id);
      if (!targetWallpaper || customWallpaperImporting) {
        return;
      }
      hideTopActionTooltip();
      deleteCustomWallpaperRecord(targetWallpaper).then(() => {
        customWallpapers = customWallpapers.filter((item) => item && item.id !== targetWallpaper.id);
        renderWallpaperPanelState();
        const overrides = getWritableLocalWallpaperOverrides();
        let changed = false;
        NEWTAB_WALLPAPER_MODES.forEach((mode) => {
          if (overrides[mode] !== targetWallpaper.id) {
            return;
          }
          overrides[mode] = NEWTAB_LOCAL_WALLPAPER_DISABLED_VALUE;
          changed = true;
        });
        if (changed) {
          setWallpaperPrefs(currentWallpaperPrefs, overrides);
          applyResolvedNewtabWallpaper();
          renderWallpaperPanelState();
          writeLocalWallpaperValue(buildLocalWallpaperStorageValue(
            currentLocalWallpaperOverrides,
            currentWallpaperPrefs.sameForModes
          ), { showError: true });
        } else {
          renderWallpaperPanelState();
        }
        showToast(t('newtab_wallpaper_delete_done', 'Deleted'), false);
      }).catch(() => {
        showToast(t('newtab_wallpaper_delete_error', 'Failed to delete wallpaper'), true);
      });
    }

    function isWallpaperPanelOpen() {
      return wallpaperPanelOpen;
    }
    function setWallpaperPanelOpenState(open) {
      if (!document.body) {
        return;
      }
      if (open) {
        document.body.setAttribute('data-wallpaper-panel-open', 'true');
        return;
      }
      document.body.removeAttribute('data-wallpaper-panel-open');
    }

    function getWallpaperAppearanceModeLabel(mode) {
      if (mode === 'light') {
        return t('settings_theme_light', 'Light');
      }
      if (mode === 'dark') {
        return t('settings_theme_dark', 'Dark');
      }
      if (getThemeScope() === 'home') {
        return t('newtab_theme_follow_global', 'Follow "Global"');
      }
      return t('settings_theme_system', 'Follow system');
    }

    function clearWallpaperAppearanceScopeAnimation() {
      wallpaperAppearanceAnimationTimers.forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      wallpaperAppearanceAnimationTimers = [];
      heldAppearanceModeLabels = null;
      pendingThemeScope = null;
      getWallpaperAppearanceOptionButtons().forEach((button) => {
        const motionElement = getWallpaperAppearanceOptionMotionElement(button);
        if (!motionElement) {
          return;
        }
        motionElement.style.removeProperty('transition');
        motionElement.style.removeProperty('transform');
        motionElement.style.removeProperty('opacity');
        motionElement.style.removeProperty('will-change');
      });
      const options = getWallpaperPanelRefs().appearanceOptions;
      if (options) {
        options.removeAttribute('data-scope-animating');
      }
    }
    function shouldReduceMotion() {
      return Boolean(window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    function playWallpaperEnterMotion(element, state) {
      if (!element) {
        return;
      }
      const nextState = state || 'enter';
      if (shouldReduceMotion()) {
        element.removeAttribute('data-motion');
        return;
      }
      element.setAttribute('data-motion', nextState);
      afterNextPaint(window, () => {
        if (element.getAttribute('data-motion') === nextState) {
          element.removeAttribute('data-motion');
        }
      });
    }
    function getWallpaperGridForTab(tab) {
      const refs = getWallpaperPanelRefs();
      if (tab === 'bing') return refs.bingPanel;
      if (tab === 'curated') return refs.curatedPanel;
      return tab === 'local' ? refs.localGrid : refs.builtInGrid;
    }
    function getAppearanceScopeDirection(scope) {
      return scope === 'home' ? 1 : -1;
    }

    function getAppearanceOptionDelay(index, count, direction) {
      const visualIndex = direction > 0 ? (count - 1 - index) : index;
      return Math.max(0, visualIndex * 20);
    }

    function animateWallpaperAppearanceScopeChange(previousScope, nextScope) {
      const targetScope = nextScope === 'home' ? 'home' : 'global';
      const sourceScope = previousScope === 'home' ? 'home' : 'global';
      const buttons = getWallpaperAppearanceOptionButtons();
      clearWallpaperAppearanceScopeAnimation();
      if (!buttons.length || sourceScope === targetScope || shouldReduceMotion()) {
        setThemeScope(targetScope);
        renderWallpaperPanelState();
        return;
      }
      const direction = getAppearanceScopeDirection(targetScope);
      const offsetPx = 24;
      const durationMs = 220;
      const fadeDurationMs = 140;
      const handoffOverlapMs = 70;
      const easing = 'cubic-bezier(0.22, 1, 0.36, 1)';
      const options = getWallpaperPanelRefs().appearanceOptions;
      // The tabs move to the new scope at once; the options keep their labels until they swap.
      heldAppearanceModeLabels = getWallpaperAppearanceModeLabels();
      pendingThemeScope = targetScope;
      if (options) {
        options.setAttribute('data-scope-animating', 'true');
      }
      renderWallpaperPanelState();

      let maxOutDelay = 0;
      buttons.forEach((button, index) => {
        const motionElement = getWallpaperAppearanceOptionMotionElement(button);
        if (!motionElement) {
          return;
        }
        const delay = getAppearanceOptionDelay(index, buttons.length, direction);
        maxOutDelay = Math.max(maxOutDelay, delay);
        motionElement.style.setProperty('will-change', 'transform, opacity');
        motionElement.style.setProperty(
          'transition',
          `transform ${durationMs}ms ${easing} ${delay}ms, opacity ${fadeDurationMs}ms ${easing} ${delay}ms`
        );
        motionElement.style.setProperty('opacity', '0');
        motionElement.style.setProperty('transform', `translate3d(${direction * -offsetPx}px, 0, 0)`);
      });

      const handoffDelayMs = Math.max(0, durationMs + maxOutDelay - handoffOverlapMs);
      const handoffTimer = window.setTimeout(() => {
        wallpaperAppearanceAnimationTimers = wallpaperAppearanceAnimationTimers.filter((timerId) => timerId !== handoffTimer);
        setThemeScope(targetScope);
        pendingThemeScope = null;
        heldAppearanceModeLabels = null;
        renderWallpaperPanelState();
        buttons.forEach((button) => {
          const motionElement = getWallpaperAppearanceOptionMotionElement(button);
          if (!motionElement) {
            return;
          }
          motionElement.style.setProperty('transition', 'none');
          motionElement.style.setProperty('opacity', '0');
          motionElement.style.setProperty('transform', `translate3d(${direction * offsetPx}px, 0, 0)`);
        });
        if (options) {
          void options.offsetHeight;
        }
        let maxInDelay = 0;
        buttons.forEach((button, index) => {
          const motionElement = getWallpaperAppearanceOptionMotionElement(button);
          if (!motionElement) {
            return;
          }
          const delay = getAppearanceOptionDelay(index, buttons.length, direction);
          maxInDelay = Math.max(maxInDelay, delay);
          motionElement.style.setProperty(
            'transition',
            `transform ${durationMs}ms ${easing} ${delay}ms, opacity ${fadeDurationMs}ms ${easing} ${delay}ms`
          );
          motionElement.style.setProperty('opacity', '1');
          motionElement.style.setProperty('transform', 'translate3d(0, 0, 0)');
        });
        const cleanupTimer = window.setTimeout(() => {
          wallpaperAppearanceAnimationTimers = wallpaperAppearanceAnimationTimers.filter((timerId) => timerId !== cleanupTimer);
          clearWallpaperAppearanceScopeAnimation();
          renderWallpaperPanelState();
        }, durationMs + maxInDelay + 24);
        wallpaperAppearanceAnimationTimers.push(cleanupTimer);
      }, handoffDelayMs);
      wallpaperAppearanceAnimationTimers.push(handoffTimer);
    }
    function getWallpaperButtonLabel() {
      return t('settings_tab_appearance', 'Appearance');
    }

    // ---- Appearance panel ----
    // The panel view renders from the state built here and calls back through
    // wallpaperPanelActions; this runtime owns the settings and their storage.

    function buildPanelToggle(checked, label) {
      return { checked: Boolean(checked), label };
    }

    function getSliderMarks(values, toPercent) {
      return values.map(toPercent);
    }

    // Asset URLs, icons and slider marks: fixed for the page's lifetime.
    function createWallpaperPanelModel() {
      const faviconInlineSvg = [
        '<svg viewBox="0 0 104 104" fill="none" xmlns="http://www.w3.org/2000/svg">',
        `<path opacity="var(--x-nt-favicon-shadow-opacity, 0.2)" d="${NEWTAB_FAVICON_SVG_SHADOW_PATH}" fill="currentColor"/>`,
        `<path d="${NEWTAB_FAVICON_SVG_MAIN_PATH}" fill="currentColor" fill-opacity="var(--x-nt-favicon-main-opacity, 0.5)"/>`,
        '</svg>'
      ].join('');
      const uniqueSorted = (values) => values
        .filter((value, index, array) => array.indexOf(value) === index)
        .sort((a, b) => a - b);
      return {
        appearanceOptions: WALLPAPER_APPEARANCE_MODES.map((mode) => ({
          mode,
          imageUrl: getRuntimeAssetUrl(`assets/images/${mode}.svg`)
        })),
        favicons: NEWTAB_FAVICON_OPTIONS.map((item) => ({
          id: item.id,
          inlineSvg: item.preview === 'inlineSvg' ? faviconInlineSvg : '',
          previewUrl: item.preview === 'inlineSvg' ? '' : getNewtabFaviconUrl(item)
        })),
        icons: {
          add: getRiSvg('ri-add-large-line', 'ri-size-18'),
          arrow: getRiSvg('ri-arrow-right-s-line', 'ri-size-14'),
          check: getRiSvg('ri-check-line', 'ri-size-16'),
          delete: getRiSvg('ri-close-line', 'ri-size-14'),
          refresh: getRiSvg('ri-refresh-line', 'ri-size-14'),
          info: getRiSvg('ri-information-line', 'ri-size-14'),
          restore: getRiSvg('ri-arrow-go-back-line', 'ri-size-14'),
          link: getRiSvg('ri-link', 'ri-size-18'),
          wallpaper: getRiSvg('ri-t-shirt-2-line', 'ri-size-20')
        },
        quoteFontSize: {
          min: SETTINGS.NEWTAB_QUOTE_FONT_SIZE_MIN || 12,
          max: SETTINGS.NEWTAB_QUOTE_FONT_SIZE_MAX || 24,
          defaultValue: SETTINGS.NEWTAB_QUOTE_FONT_SIZE_DEFAULT || 15
        },
        marks: {
          // One mark per snap point, so the marks show where the slider settles.
          searchWidth: getSliderMarks(getSearchWidthSnapPoints(), getSearchWidthPercent),
          shortcutColumns: getSliderMarks(getShortcutColumnsTickValues(), getShortcutColumnsPercent),
          shortcutSize: getSliderMarks(
            uniqueSorted([48, 64, 80].map(normalizeShortcutSizeValue)),
            (value) => getShortcutLayoutPercent(value, shortcutSizeConfig, 48, 80, 64)
          ),
          shortcutGap: getSliderMarks(
            uniqueSorted([0, 8, 16, 24].map(normalizeShortcutGapValue)),
            (value) => getShortcutLayoutPercent(value, shortcutGapConfig, 0, 24, 4)
          ),
          timeWeight: [50]
        }
      };
    }

    function buildWallpaperPanelHeaderState() {
      return {
        title: t('newtab_appearance_settings_title', 'Appearance settings'),
        moreSettingsLabel: t('newtab_more_settings', 'More settings'),
        moreSettingsUrl: buildAppearanceSettingsUrl(),
        helpPrompt: t('newtab_help_footer_prompt', 'Not sure what an option does?'),
        helpText: t('newtab_help_footer_action', 'Visit the Help Center'),
        helpUrl: buildHelpCenterUrl()
      };
    }

    function getWallpaperAppearanceModeLabels() {
      const labels = {};
      WALLPAPER_APPEARANCE_MODES.forEach((mode) => {
        labels[mode] = getWallpaperAppearanceModeLabel(mode);
      });
      return labels;
    }

    function buildWallpaperThemeState() {
      const scope = pendingThemeScope || (getThemeScope() === 'home' ? 'home' : 'global');
      const themeMode = getThemeMode();
      // While the options slide between scopes they keep the labels they left with.
      const modeLabels = heldAppearanceModeLabels || getWallpaperAppearanceModeLabels();
      return {
        title: t('settings_theme_title', 'Theme mode'),
        infoLabel: t('newtab_theme_scope_help_label', 'Theme scope info'),
        infoTooltip: t(
          'newtab_theme_scope_help',
          'Global: the default theme for all pages.\nNew Tab: applies only to the new tab page. Choose Follow "Global" to keep it in sync.'
        ),
        scope: {
          active: scope,
          label: t('newtab_theme_scope_label', 'Theme scope'),
          options: ['global', 'home'].map((value) => {
            const label = value === 'home'
              ? t('newtab_theme_scope_home', 'New Tab')
              : t('newtab_theme_scope_global', 'Global');
            return {
              value,
              label,
              ariaLabel: formatMessage(
                'newtab_theme_scope_select_label',
                'Apply theme changes to {scope}',
                { scope: label }
              )
            };
          })
        },
        modes: WALLPAPER_APPEARANCE_MODES.map((mode) => ({
          mode,
          selected: mode === themeMode,
          label: modeLabels[mode],
          ariaLabel: formatMessage('mode_switch_title', '{name}: switch to {mode} mode', {
            name: 'Lumno',
            mode: modeLabels[mode]
          })
        }))
      };
    }

    function buildWallpaperSearchState() {
      if (hasTopContentModeGetter) {
        currentTopContentMode = normalizeNewtabTopContentMode(getTopContentMode());
      }
      if (hasTimeFontWeightGetter) {
        currentTimeFontWeight = normalizeNewtabTimeFontWeight(getTimeFontWeight());
      }
      if (hasTimeSecondsVisibleGetter) {
        currentTimeSecondsVisible = normalizeNewtabTimeSecondsVisible(getTimeSecondsVisible());
      }
      const width = normalizeSearchWidthValue(getSearchWidth());
      const timeVisible = currentTopContentMode === 'time';
      const autoFocusTitle = t('newtab_input_auto_focus_title', 'Automatically focus input');
      const topContentTitle = t('settings_newtab_wordmark_title', 'Content above the search bar');
      const secondsTitle = t('newtab_time_show_seconds_title', 'Show seconds');
      return {
        title: t('newtab_search_section_title', 'Search box'),
        width: {
          label: t('newtab_search_width_title', 'Search box width'),
          ariaLabel: t('newtab_search_width_aria', 'Adjust New Tab search box width'),
          value: width,
          min: getSearchWidthMin(),
          max: getSearchWidthMax(),
          suffix: ' px',
          valueText: formatSearchWidthValue(width)
        },
        autoFocus: {
          title: autoFocusTitle,
          infoLabel: t('newtab_input_auto_focus_help_label', 'Input auto-focus info'),
          infoTooltip: t(
            'newtab_input_auto_focus_help',
            'If you prefer to use the browser’s native address bar, turn this option off. The extension URL will no longer appear in the address bar.'
          ),
          toggle: buildPanelToggle(getInputAutoFocusEnabled(), autoFocusTitle)
        },
        topContent: {
          title: topContentTitle,
          tabs: {
            active: currentTopContentMode,
            label: topContentTitle,
            options: [
              { value: 'brand', label: t('newtab_top_content_brand', 'Brand') },
              { value: 'time', label: t('newtab_top_content_time', 'Time') },
              { value: 'off', label: t('newtab_top_content_off', 'Hide') }
            ].map((option) => Object.assign(option, { ariaLabel: option.label }))
          }
        },
        timeWeight: {
          visible: timeVisible,
          label: t('newtab_time_font_weight_title', 'Time font weight'),
          value: currentTimeFontWeight,
          min: NEWTAB_TIME_FONT_WEIGHT_MIN,
          max: NEWTAB_TIME_FONT_WEIGHT_MAX,
          resetLabel: t('newtab_time_font_weight_reset', 'Reset time font weight'),
          resetVisible: currentTimeFontWeight !== NEWTAB_TIME_FONT_WEIGHT_DEFAULT
        },
        seconds: {
          visible: timeVisible,
          title: secondsTitle,
          toggle: buildPanelToggle(currentTimeSecondsVisible, secondsTitle)
        }
      };
    }

    function buildWallpaperShortcutsState() {
      const enabled = Boolean(getShortcutsVisible());
      const title = t('settings_newtab_shortcuts_title', 'Shortcuts');
      const addTitle = t('settings_newtab_shortcut_add_title', 'Show “+”');
      const dockTitle = t(
        'settings_newtab_shortcut_dock_magnification_title',
        'macOS Dock-style magnification'
      );
      const size = normalizeShortcutSizeValue(getShortcutSize());
      const gap = normalizeShortcutGapValue(getShortcutGap());
      return {
        enabled,
        title,
        toggle: buildPanelToggle(enabled, title),
        add: { title: addTitle, toggle: buildPanelToggle(getShortcutAddVisible(), addTitle) },
        dock: { title: dockTitle, toggle: buildPanelToggle(getShortcutDockMagnificationEnabled(), dockTitle) },
        columns: {
          label: t('settings_newtab_shortcut_columns_title', 'Shortcuts per row'),
          value: normalizeShortcutColumnsValue(getShortcutColumns()),
          min: getShortcutColumnsMin(),
          max: getShortcutColumnsMax()
        },
        size: {
          label: t('settings_newtab_shortcut_size_title', 'Shortcut size'),
          value: size,
          min: getShortcutLayoutMin(shortcutSizeConfig, 48),
          max: getShortcutLayoutMax(shortcutSizeConfig, 48, 80),
          suffix: ' px',
          valueText: `${size} px`,
          resetLabel: t('settings_newtab_shortcut_size_reset', 'Reset shortcut size'),
          resetVisible: size !== getShortcutLayoutDefault(shortcutSizeConfig, 48, 80, 64)
        },
        gap: {
          label: t('settings_newtab_shortcut_gap_title', 'Shortcut spacing'),
          value: gap,
          min: getShortcutLayoutMin(shortcutGapConfig, 0),
          max: getShortcutLayoutMax(shortcutGapConfig, 0, 24),
          suffix: ' px',
          valueText: `${gap} px`,
          resetLabel: t('settings_newtab_shortcut_gap_reset', 'Reset shortcut spacing'),
          resetVisible: gap !== getShortcutLayoutDefault(shortcutGapConfig, 0, 24, 4)
        }
      };
    }

    function getWallpaperSelectLabel(name) {
      return formatMessage('newtab_wallpaper_select_label', 'Select {name}', { name });
    }

    function buildWallpaperTileState(item, selectedTileId) {
      return {
        id: item.id,
        thumbnailUrl: getWallpaperThumbnailUrl(item),
        selected: item.id === selectedTileId,
        label: getWallpaperSelectLabel(getWallpaperDisplayName(item))
      };
    }

    const NO_SELECTED_SOURCE = Object.freeze({ visible: false, title: '', meta: '', url: '', linkLabel: '' });

    function buildSelectedSourceState(title, meta, url) {
      return {
        visible: true,
        title,
        meta,
        url,
        linkLabel: `${title} · ${t('newtab_bing_source', 'View wallpaper source')}`
      };
    }

    function buildDailyState(toggleChecked, hint, selected) {
      const label = t('newtab_bing_daily', 'Auto-update daily');
      return {
        label,
        infoTooltip: hint,
        restoreLabel: t('newtab_daily_restore', "Back to today's wallpaper"),
        restoreVisible: Boolean(selected && selected.picked),
        toggle: buildPanelToggle(toggleChecked, label)
      };
    }

    function getLocalWallpaperItems() {
      return customWallpapers.concat(linkWallpapers.map((item) => getLinkWallpaperById(item.id)))
        .filter(Boolean)
        .sort((a, b) => a.updatedAt - b.updatedAt);
    }

    function buildLocalWallpaperState(label, selectedTileId) {
      const urlLabel = t('newtab_wallpaper_add_url', 'Add image link');
      return {
        label,
        deleteLabel: t('newtab_wallpaper_delete_local', 'Delete imported wallpaper'),
        upload: {
          label: t('newtab_wallpaper_add_local', 'Add local wallpaper'),
          loading: customWallpaperImporting
        },
        url: {
          open: customWallpaperUrlFormOpen,
          invalid: customWallpaperUrlInvalid,
          clearToken: customWallpaperUrlClearToken,
          disabled: customWallpaperImporting,
          tileLabel: urlLabel,
          inputLabel: urlLabel,
          placeholder: t('newtab_wallpaper_url_placeholder', 'Paste an image link (https://…)'),
          submitLabel: t('newtab_wallpaper_url_submit', 'Add')
        },
        tiles: getLocalWallpaperItems().map((item) => buildWallpaperTileState(item, selectedTileId))
      };
    }

    function buildBingWallpaperState(selectedId, selectedTileId) {
      const selected = REMOTE_CONTENT.getWallpaperProvider(selectedId) === 'bing'
        ? getWallpaperById(selectedId)
        : null;
      const busy = bingLoading || bingSelecting;
      // Bing skips some days, so cap the list to two full rows instead of leaving a ragged last row.
      const items = (selected && selectedId !== REMOTE_CONTENT.BING_DAILY_ID &&
        !bingItems.some((item) => item.id === selectedId)
        ? [selected, ...bingItems]
        : bingItems).slice(0, BING_RECENT_TILE_LIMIT);
      const daily = buildDailyState(
        selectedId === REMOTE_CONTENT.BING_DAILY_ID,
        t('newtab_bing_daily_hint', BING_DAILY_HINT),
        selected
      );
      return {
        label: 'Bing',
        busy,
        loading: bingLoading && !bingItems.length,
        daily: Object.assign(daily, { busy: bingSelecting }),
        recentLabel: t('newtab_bing_recent', 'Recent wallpapers'),
        refresh: { label: t('newtab_bing_refresh', 'Refresh'), busy: bingLoading, disabled: busy },
        status: bingStatus === 'loading' && !bingItems.length
          ? t('newtab_bing_loading', 'Loading wallpapers…')
          : bingStatus === 'error'
            ? t('newtab_bing_error', 'Could not load wallpapers. Please try again.') : '',
        selected: selected && selected.date
          ? Object.assign(buildSelectedSourceState(selected.name, formatBingCopyright(selected.copyright),
            selected.sourceUrl), {
            linkLabel: `${getBingWallpaperLabel(selected)} · ${t('newtab_bing_source', 'View wallpaper source')}`
          })
          : NO_SELECTED_SOURCE,
        tiles: items.map((item) => {
          const wallpaper = remoteClient.getWallpaper(item.id);
          const label = getBingWallpaperLabel(wallpaper);
          return {
            id: item.id,
            thumbnailUrl: getWallpaperThumbnailUrl(wallpaper),
            selected: item.id === selectedTileId,
            disabled: bingSelecting,
            tooltip: label,
            label: getWallpaperSelectLabel(label)
          };
        })
      };
    }

    function buildCuratedWallpaperState(label, selectedId, selectedTileId) {
      const selected = REMOTE_CONTENT.getWallpaperProvider(selectedId) === 'curated'
        ? getWallpaperById(selectedId)
        : null;
      const categoryLabel = t('newtab_curated_category', 'Category');
      const photoLabel = selected && selected.imageUrl ? getCuratedPhotoLabel(selected) : '';
      return {
        label,
        daily: buildDailyState(
          isCuratedDailyWallpaperActive(),
          t('newtab_curated_daily_hint', CURATED_DAILY_HINT),
          selected
        ),
        category: {
          label: categoryLabel,
          tabs: {
            active: curatedCategory,
            label: categoryLabel,
            options: REMOTE_CONTENT.CURATED_CATEGORIES.map((value) => ({
              value,
              label: getCuratedCategoryLabel(value)
            }))
          }
        },
        listLabel: t('newtab_curated_list', 'Photos'),
        refreshLabel: t('newtab_curated_more', 'Show others'),
        selected: photoLabel
          ? buildSelectedSourceState(photoLabel, getCuratedPhotoMeta(selected), selected.sourceUrl)
          : NO_SELECTED_SOURCE,
        tiles: getCuratedTileItems().map((item) => {
          const wallpaper = remoteClient.getWallpaper(item.id);
          const tileLabel = [getCuratedPhotoLabel(wallpaper), wallpaper && wallpaper.title ? wallpaper.name : '']
            .filter(Boolean)
            .join(' · ');
          return {
            id: item.id,
            thumbnailUrl: item.thumbnailUrl,
            selected: item.id === selectedTileId,
            tooltip: tileLabel,
            label: getWallpaperSelectLabel(tileLabel)
          };
        })
      };
    }

    function buildWallpaperEffectSliderState(labelInfo, value, visible, max, percent) {
      const number = Number(value);
      const normalizedValue = Number.isFinite(number) ? number : 0;
      return {
        label: t(labelInfo.labelKey, labelInfo.fallback),
        value: normalizedValue,
        min: 0,
        max,
        visible,
        disabled: !visible,
        suffix: percent ? '%' : '',
        valueText: percent ? `${normalizedValue}%` : String(normalizedValue)
      };
    }

    function buildWallpaperEffectState() {
      const prefs = getWallpaperEffectPrefsForEditMode();
      const visibility = getWallpaperEffectControlVisibility(prefs);
      const title = t('newtab_wallpaper_effect_title', 'Wallpaper filter');
      const inkTitle = t('newtab_wallpaper_effect_ink_title', 'Sample tones');
      const blockMax = prefs.type === 'blocks' ? BLOCK_PARAMETER_MAX : 100;
      const crtSlider = (key, labelKey, fallback) => buildWallpaperEffectSliderState(
        { labelKey, fallback },
        getCrtParameterPercent(key, prefs[key]),
        visibility[key],
        100,
        true
      );
      return {
        label: title,
        select: {
          ariaLabel: title,
          value: prefs.type,
          options: NEWTAB_WALLPAPER_EFFECT_TYPES.map((item) => ({
            value: item.type,
            label: getWallpaperEffectLabel(item.type)
          }))
        },
        inkTone: {
          visible: visibility.inkTone,
          label: inkTitle,
          tabs: {
            active: getWallpaperEffectInkToneForUi(prefs),
            label: inkTitle,
            options: NEWTAB_WALLPAPER_EFFECT_INK_TONES.map((item) => {
              const label = getWallpaperEffectInkToneLabel(item.tone);
              return {
                value: item.tone,
                label,
                ariaLabel: formatMessage(
                  'newtab_wallpaper_effect_ink_select_label',
                  'Sample {tone} for dots or characters',
                  { tone: label }
                )
              };
            })
          }
        },
        sliders: {
          strength: buildWallpaperEffectSliderState(
            getWallpaperEffectStrengthLabel(prefs),
            prefs.type === 'crt' ? getCrtParameterPercent('crtStrength', prefs.crtStrength) : prefs.strength,
            visibility.strength,
            100,
            prefs.type === 'crt'
          ),
          size: buildWallpaperEffectSliderState(
            getWallpaperEffectSizeLabel(prefs),
            prefs.type === 'blocks' ? prefs.blockSize : prefs.size,
            visibility.size,
            blockMax,
            false
          ),
          spacing: buildWallpaperEffectSliderState(
            getWallpaperEffectSpacingLabel(prefs),
            Math.round(clampNumber(prefs.spacing, 0, prefs.type === 'blocks' ? 5 : 100)),
            visibility.spacing,
            blockMax,
            true
          ),
          texture: buildWallpaperEffectSliderState(
            getWallpaperEffectTextureLabel(),
            prefs.texture,
            visibility.texture,
            100,
            false
          ),
          crtBloom: crtSlider('crtBloom', 'newtab_wallpaper_effect_crt_bloom', 'Bloom'),
          crtRgbOffset: crtSlider('crtRgbOffset', 'newtab_wallpaper_effect_crt_rgb_offset', 'RGB offset'),
          crtCurvature: crtSlider('crtCurvature', 'newtab_wallpaper_effect_crt_curvature', 'Screen curvature')
        }
      };
    }

    function buildWallpaperSectionState() {
      const enabled = hasAnyWallpaperEnabled();
      const selectedId = getWallpaperSelectionIdForUi();
      const selectedTileId = getWallpaperTileSelectionId(selectedId);
      const split = Boolean(currentWallpaperPrefs && currentWallpaperPrefs.sameForModes === false);
      const builtInLabel = t('newtab_wallpaper_builtin_section', 'Built-in');
      const localLabel = t('newtab_wallpaper_local_section', 'Local');
      const curatedLabel = t('newtab_wallpaper_curated_section', 'Curated');
      const sourceLabel = t('newtab_wallpaper_source_title', 'Source');
      return {
        title: t('newtab_wallpaper_title', 'Wallpaper'),
        enabled,
        toggle: buildPanelToggle(enabled, t('newtab_wallpaper_toggle_label', 'Toggle wallpaper')),
        activeTab: activeWallpaperTab,
        modeSync: {
          title: t('newtab_wallpaper_mode_sync_title', 'Match light and dark mode'),
          toggle: buildPanelToggle(
            !split,
            t('newtab_wallpaper_mode_sync_toggle_label', 'Use the same wallpaper for light and dark mode')
          )
        },
        mode: {
          visible: split,
          label: t('newtab_wallpaper_mode_row_title', 'Mode'),
          tabs: {
            active: normalizeWallpaperMode(activeWallpaperMode),
            label: t('newtab_wallpaper_mode_tabs_label', 'Wallpaper color mode'),
            options: NEWTAB_WALLPAPER_MODES.map((mode) => ({
              value: mode,
              label: mode === NEWTAB_WALLPAPER_MODE_DARK
                ? t('newtab_wallpaper_dark_mode_tab', 'Dark')
                : t('newtab_wallpaper_light_mode_tab', 'Light'),
              ariaLabel: formatMessage(
                'newtab_wallpaper_mode_select_label',
                'Edit {mode} wallpaper',
                { mode: getWallpaperModeLabel(mode) }
              )
            }))
          }
        },
        source: {
          label: sourceLabel,
          tabs: {
            active: activeWallpaperTab,
            label: sourceLabel,
            options: [
              { value: 'built-in', label: builtInLabel },
              { value: 'local', label: localLabel },
              { value: 'bing', label: 'Bing' },
              { value: 'curated', label: curatedLabel }
            ].map((option) => Object.assign(option, { ariaLabel: option.label }))
          }
        },
        builtIn: {
          label: builtInLabel,
          tiles: NEWTAB_WALLPAPER_OPTIONS.map((item) => Object.assign(
            buildWallpaperTileState(item, selectedTileId),
            { path: getWallpaperLocalPath(item) }
          ))
        },
        local: buildLocalWallpaperState(localLabel, selectedTileId),
        bing: buildBingWallpaperState(selectedId, selectedTileId),
        curated: buildCuratedWallpaperState(curatedLabel, selectedId, selectedTileId),
        overlay: {
          label: t('newtab_wallpaper_overlay_opacity', 'Mask effect'),
          value: getWallpaperOverlayOpacityForCurrentMode(),
          min: 0,
          max: 100
        },
        effect: buildWallpaperEffectState()
      };
    }

    function buildNewtabFaviconState() {
      const currentItem = getNewtabFaviconById(currentNewtabFaviconId) ||
        getNewtabFaviconById(NEWTAB_FAVICON_DEFAULT_ID);
      return {
        title: t('newtab_favicon_title', 'New Tab favicon'),
        options: NEWTAB_FAVICON_OPTIONS.map((item) => ({
          id: item.id,
          selected: Boolean(currentItem && item.id === currentItem.id),
          label: formatMessage('newtab_favicon_select_label', 'Select {name} favicon', {
            name: getNewtabFaviconDisplayName(item)
          })
        }))
      };
    }

    function buildWallpaperPanelState() {
      return {
        actions: wallpaperPanelActions,
        open: wallpaperPanelOpen,
        panelLabel: t('settings_tab_appearance', 'Appearance'),
        button: { active: Boolean(currentWallpaperId), label: getWallpaperButtonLabel() },
        header: buildWallpaperPanelHeaderState(),
        theme: buildWallpaperThemeState(),
        glassStyle: {
          sectionTitle: t('newtab_style_section_title', 'Style'),
          title: t('settings_newtab_glass_style_title', 'Material'),
          infoTooltip: t('settings_newtab_glass_style_desc', 'Give the search bar, cards, buttons, menus, and this panel a glass finish. Works best with a wallpaper.'),
          ariaLabel: t('settings_newtab_glass_style_title', 'Material'),
          value: getGlassStyle(),
          options: [
            { value: 'none', label: t('settings_newtab_glass_style_none', 'Default') },
            { value: 'frosted', label: t('settings_newtab_glass_style_frosted', 'Frosted glass') },
            { value: 'liquid', label: t('settings_newtab_glass_style_liquid', 'Liquid glass') }
          ]
        },
        search: buildWallpaperSearchState(),
        shortcuts: buildWallpaperShortcutsState(),
        quote: {
          infoTooltip: getQuoteProviderLabel(),
          library: {
            title: t('newtab_quote_library', 'Quote collection'),
            shuffleLabel: t('newtab_quote_shuffle', 'Show another quote'),
            shuffleTooltip: t('newtab_quote_shuffle_daily', 'Show a random quote. A new one also comes every day.'),
            infoTooltip: t('newtab_quote_import_hint', 'TXT / MD: one non-empty content line per quote. Up to 1 MB, 1,000 quotes, 500 characters each; stored on this device only.')
          }
        },
        wallpaper: buildWallpaperSectionState(),
        favicon: buildNewtabFaviconState()
      };
    }

    function getQuoteProviderLabel() {
      const quoteRuntime = options.getQuoteRuntime && options.getQuoteRuntime();
      return (quoteRuntime && typeof quoteRuntime.getProviderLabel === 'function' &&
        quoteRuntime.getProviderLabel()) || t('newtab_quote_provider', 'Powered by Hitokoto');
    }

    // What changes the panel's height: a change here animates the resize.
    function getWallpaperPanelLayoutKey(state) {
      const wallpaper = state.wallpaper;
      return JSON.stringify([
        wallpaper.activeTab,
        wallpaper.mode.visible ? wallpaper.mode.tabs.active : '',
        wallpaper.local.tiles.length,
        wallpaper.curated.category.tabs.active
      ]);
    }

    // Rebuilds the panel state and renders it; while the panel is open the DOM is current when
    // this returns. A closed panel waits for its next open, and only its button, which stays on
    // the page, follows the state at once: the New Tab start-up changes the state many times,
    // and drawing the whole hidden panel for each change held the page back.
    function renderWallpaperPanelState() {
      if (!wallpaperViewController) {
        return;
      }
      if (!wallpaperPanelOpen) {
        wallpaperPanelDrawPending = true;
        syncClosedWallpaperButton();
        return;
      }
      drawWallpaperPanelState();
    }

    // The button's attributes as the view draws them; React leaves an attribute alone while its
    // value matches the last render, so the DOM set here stays right until the next draw.
    function syncClosedWallpaperButton() {
      if (!wallpaperButton) {
        return;
      }
      const label = getWallpaperButtonLabel();
      const active = currentWallpaperId ? 'true' : 'false';
      if (label) {
        wallpaperButton.setAttribute('aria-label', label);
      } else {
        wallpaperButton.removeAttribute('aria-label');
      }
      wallpaperButton.setAttribute('aria-pressed', active);
      wallpaperButton.setAttribute('data-active', active);
    }

    function drawWallpaperPanelState() {
      const previous = wallpaperPanelDrawPending ? null : wallpaperPanelState;
      wallpaperPanelDrawPending = false;
      const state = buildWallpaperPanelState();
      const layoutKey = getWallpaperPanelLayoutKey(state);
      const layoutChanged = Boolean(previous) && layoutKey !== wallpaperPanelLayoutKey;
      wallpaperPanelState = state;
      wallpaperPanelLayoutKey = layoutKey;
      // Rows that show or hide (mode, link form, effect controls) animate their own height
      // through .x-nt-panel-collapsible.
      const apply = () => wallpaperViewController.render(state);
      if (layoutChanged) {
        animateWallpaperPanelResize(apply);
        return;
      }
      apply();
    }

    function getWallpaperPanelRefs() {
      return wallpaperViewController ? wallpaperViewController.getRefs() : {};
    }

    function isWallpaperTileSelected(id) {
      return getWallpaperTileSelectionId(getWallpaperSelectionIdForUi()) === id;
    }

    // Overlay and filter sliders snap to their marks while dragged.
    function getWallpaperStyleSliderValue(value, fallbackValue, change, snap) {
      return change && change.dragging && snap
        ? snapWallpaperOverlaySliderValue(value)
        : normalizeWallpaperOverlayOpacity(value, fallbackValue);
    }

    function setWallpaperEffectParameter(sliderKey, value, change) {
      const currentPrefs = getWallpaperEffectPrefsForEditMode();
      const key = sliderKey === 'strength'
        ? (currentPrefs.type === 'crt' ? 'crtStrength' : 'strength')
        : sliderKey === 'size'
          ? (currentPrefs.type === 'blocks' ? 'blockSize' : 'size')
          : sliderKey;
      const isCrtParameter = currentPrefs.type === 'crt' && CRT_PARAMETER_PHYSICAL_MAX[key];
      const fallbackValue = isCrtParameter
        ? getCrtParameterPercent(key, currentPrefs[key])
        : currentPrefs[key];
      const sliderValue = getWallpaperStyleSliderValue(value, fallbackValue, change, sliderKey === 'strength');
      persistWallpaperEffectPrefs({
        [key]: isCrtParameter ? getCrtParameterPhysicalValue(key, sliderValue) : sliderValue
      });
    }

    function setBingDailyWallpaper(enabled) {
      const daily = getWallpaperById(REMOTE_CONTENT.BING_DAILY_ID);
      if (enabled) {
        clearDailyWallpaperPick(REMOTE_CONTENT.BING_DAILY_ID);
        selectBingWallpaper(REMOTE_CONTENT.BING_DAILY_ID);
      } else if (daily && daily.dailyId) {
        selectBingWallpaper(daily.dailyId);
      } else {
        // An unresolved daily photo shows the built-in default, so keep that one.
        persistNewtabWallpaper(NEWTAB_WALLPAPER_DEFAULT_ID);
      }
    }

    function createWallpaperPanelActions() {
      return Object.freeze({
        togglePanel: toggleWallpaperPanel,
        showTooltip: (anchor, text) => showTopActionTooltip(anchor, text),
        hideTooltip: () => hideTopActionTooltip(),
        showButtonTooltip(anchor) {
          if (isWallpaperPanelOpen()) {
            hideTopActionTooltip();
            return;
          }
          showTopActionTooltip(anchor, getWallpaperButtonLabel(), { placement: 'top' });
        },
        selectThemeScope: (scope) => animateWallpaperAppearanceScopeChange(getThemeScope(), scope),
        selectThemeMode: (mode) => setThemeMode(mode),
        setSearchWidth: (value, change) => persistSearchWidthFromSlider(value, change),
        setInputAutoFocus(enabled) {
          setInputAutoFocusEnabled(enabled);
          renderWallpaperPanelState();
        },
        setGlassStyle(value) {
          setGlassStyle(value);
          renderWallpaperPanelState();
        },
        selectTopContent: (mode) => persistTopContentMode(mode),
        setTimeFontWeight: (value) => persistTimeFontWeight(value),
        resetTimeFontWeight: () => persistTimeFontWeight(NEWTAB_TIME_FONT_WEIGHT_DEFAULT),
        setTimeSecondsVisible: (visible) => persistTimeSecondsVisible(visible),
        setShortcutsVisible(visible) {
          setShortcutsVisible(visible, { persist: true });
          renderWallpaperPanelState();
        },
        setShortcutAddVisible(visible) {
          setShortcutAddVisible(visible, { persist: true });
          renderWallpaperPanelState();
        },
        setShortcutDockMagnification(enabled) {
          setShortcutDockMagnificationEnabled(enabled, { persist: true });
          renderWallpaperPanelState();
        },
        setShortcutColumns: (value, change) => persistShortcutColumnsFromSlider(value, change),
        setShortcutSize: (value, change) => persistShortcutSizeFromSlider(value, change),
        setShortcutGap: (value, change) => persistShortcutGapFromSlider(value, change),
        resetShortcutSize: () => persistShortcutSizeFromSlider(
          getShortcutLayoutDefault(shortcutSizeConfig, 48, 80, 64),
          { final: true }
        ),
        resetShortcutGap: () => persistShortcutGapFromSlider(
          getShortcutLayoutDefault(shortcutGapConfig, 0, 24, 4),
          { final: true }
        ),
        setWallpaperEnabled: (enabled) => persistWallpaperEnabled(enabled),
        setModeSync: (enabled) => persistWallpaperModeConsistency(enabled),
        selectWallpaperMode: (mode) => setWallpaperActiveMode(mode),
        selectSourceTab: (tab) => setWallpaperActiveTab(tab),
        selectWallpaper: (id) => persistNewtabWallpaper(id),
        primeWallpaper: (id) => primeWallpaperImage(id),
        deleteWallpaper: (id) => deleteCustomWallpaper(id),
        importWallpaperFile: (file) => importCustomWallpaperFile(file),
        toggleUrlForm() {
          if (!customWallpaperImporting) {
            setCustomWallpaperUrlFormOpen(!customWallpaperUrlFormOpen);
          }
        },
        submitWallpaperUrl(url) {
          if (!customWallpaperImporting) {
            submitCustomWallpaperUrl(url);
          }
        },
        clearUrlInvalid() {
          customWallpaperUrlInvalid = false;
          renderWallpaperPanelState();
        },
        setBingDaily: setBingDailyWallpaper,
        restoreDailyWallpaper() {
          const dailyId = getWallpaperSelectionIdForUi();
          if (REMOTE_CONTENT.isDailyWallpaperId(dailyId)) {
            clearDailyWallpaperPick(dailyId);
          }
        },
        refreshBing: () => loadBingCatalog(true),
        selectBingWallpaper(id) {
          // The highlighted tile is already applied; re-clicking it should not leave daily mode.
          if (!isWallpaperTileSelected(id)) {
            selectBingWallpaper(id, { asDailyPick: true });
          }
        },
        setCuratedDaily: (enabled) => setCuratedDailyWallpaper(enabled),
        selectCuratedCategory: (category) => selectCuratedCategory(category),
        showMoreCurated: () => showMoreCuratedWallpapers(),
        selectCuratedWallpaper(id) {
          if (isWallpaperTileSelected(id)) {
            return;
          }
          const daily = getActiveDailyWallpaperId('curated');
          if (daily) setDailyWallpaperPick(daily, id);
          else persistNewtabWallpaper(id);
        },
        setOverlay(value, change) {
          const mode = getResolvedWallpaperOverlayMode();
          persistWallpaperOverlayOpacity(mode, getWallpaperStyleSliderValue(
            value,
            getWallpaperOverlayOpacityForCurrentMode(),
            change,
            true
          ));
        },
        selectEffect: (type) => persistWallpaperEffectPrefs({ type }),
        selectInkTone: (tone) => persistWallpaperEffectPrefs({ inkTone: tone }),
        setEffectParameter: setWallpaperEffectParameter,
        selectFavicon: (id) => persistNewtabFavicon(id)
      });
    }

    // The bookmark, site card and quote sections belong to their own runtimes; they
    // bind to the panel's elements the first time it opens.
    function bindWallpaperPanelSectionRuntimes() {
      if (wallpaperPanelRendered) {
        return;
      }
      wallpaperPanelRendered = true;
      const refs = getWallpaperPanelRefs();
      const quoteRuntime = options.getQuoteRuntime && options.getQuoteRuntime();
      if (quoteRuntime) quoteRuntime.bindSettings(refs, wallpaperViewController);
      const sectionSettings = options.getSectionPanelSettings && options.getSectionPanelSettings();
      if (sectionSettings) {
        sectionSettings.bindSettings(refs, wallpaperViewController, {
          bindSliderValueInput: bindPanelSliderValueInput,
          syncSliderValueInput: syncPanelSliderValueInput
        });
      }
    }

    // Number boxes beside the section runtimes' plain range inputs: typed values
    // commit on blur or Enter, clamped and stepped like the slider.
    function getPanelSliderValueInput(slider) {
      const row = slider && typeof slider.closest === 'function'
        ? slider.closest('.x-nt-range-slider-row')
        : null;
      return row ? row.querySelector('._x_extension_range_slider_value_input_2026_unique_') : null;
    }

    function syncPanelSliderValueInput(slider) {
      const valueInput = getPanelSliderValueInput(slider);
      if (!valueInput) {
        return;
      }
      valueInput.min = slider.min;
      valueInput.max = slider.max;
      valueInput.step = slider.step;
      valueInput.value = slider.value;
      valueInput.disabled = Boolean(slider.disabled);
      const label = String(slider.getAttribute('aria-label') || '').trim();
      if (label) {
        valueInput.setAttribute('aria-label', label);
      }
    }

    function commitPanelSliderValueInput(slider, valueInput) {
      const draft = String(valueInput.value || '').trim();
      const number = Number(draft);
      if (!draft || !Number.isFinite(number)) {
        syncPanelSliderValueInput(slider);
        return;
      }
      const min = Number(slider.min);
      const max = Number(slider.max);
      const step = Number(slider.step);
      const bounded = Math.min(
        Number.isFinite(max) ? max : number,
        Math.max(Number.isFinite(min) ? min : number, number)
      );
      slider.value = String(Number.isFinite(step) && step > 0 && Number.isFinite(min)
        ? min + Math.round((bounded - min) / step) * step
        : bounded);
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      slider.dispatchEvent(new Event('change', { bubbles: true }));
      syncPanelSliderValueInput(slider);
    }

    function bindPanelSliderValueInput(slider) {
      const valueInput = getPanelSliderValueInput(slider);
      if (!slider || !valueInput || valueInput.dataset.sliderValueInputBound === 'true') {
        return;
      }
      valueInput.dataset.sliderValueInputBound = 'true';
      slider.addEventListener('input', () => syncPanelSliderValueInput(slider));
      slider.addEventListener('change', () => syncPanelSliderValueInput(slider));
      valueInput.addEventListener('input', () => {
        const number = Number(valueInput.value);
        const min = Number(slider.min);
        const max = Number(slider.max);
        if (!Number.isFinite(number)) {
          return;
        }
        if (Number.isFinite(min) && number < min) {
          valueInput.value = String(min);
        } else if (Number.isFinite(max) && number > max) {
          valueInput.value = String(max);
        }
      });
      valueInput.addEventListener('blur', () => commitPanelSliderValueInput(slider, valueInput));
      valueInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          valueInput.blur();
        }
      });
      syncPanelSliderValueInput(slider);
    }

    function isFocusRoutePending() {
      return Boolean(
        document.documentElement &&
        document.documentElement.getAttribute('data-nt-focus-route-pending') === 'true'
      );
    }

    // Points at the appearance button until the panel is opened once.
    function createWallpaperSourcesFeatureHint() {
      if (wallpaperSourcesHintController ||
          isFocusRoutePending() ||
          !wallpaperControl ||
          !featureHints ||
          typeof featureHints.createFeatureHint !== 'function') {
        return wallpaperSourcesHintController;
      }
      const controller = featureHints.createFeatureHint({
        documentObj: document,
        windowObj: window,
        chromeApi: chrome,
        definition: 'newtab-wallpaper-sources',
        visibilityGate: featureHintVisibilityGate,
        t,
        getRiSvg
      });
      if (!controller || !controller.element) {
        return null;
      }
      wallpaperSourcesHintController = controller;
      wallpaperControl.appendChild(controller.element);
      return controller;
    }

    function dismissWallpaperSourcesFeatureHint() {
      if (wallpaperSourcesHintController &&
          typeof wallpaperSourcesHintController.dismiss === 'function') {
        wallpaperSourcesHintController.dismiss();
      }
    }

    function formatBingDate(date) {
      return /^\d{8}$/.test(String(date || ''))
        ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}` : '';
    }

    // Bing credits read "Place (© Photographer)"; show them as "Place · © Photographer".
    function formatBingCopyright(copyright) {
      const text = String(copyright || '').trim();
      const match = /^(.*?)\s*[(（]\s*(©[^()（）]*)[)）]\s*$/.exec(text);
      return match ? [match[1], match[2].trim()].filter(Boolean).join(' · ') : text;
    }

    function getBingWallpaperLabel(item) {
      return item ? [item.name, formatBingDate(item.date)].filter(Boolean).join(' · ') : '';
    }

    async function loadBingCatalog(refresh) {
      if (!wallpaperViewController) return;
      const seq = ++bingCatalogSeq;
      bingLoading = true;
      bingStatus = 'loading';
      renderWallpaperPanelState();
      try {
        const items = await remoteClient.getCatalog(Boolean(refresh));
        if (seq !== bingCatalogSeq) return;
        bingItems = items;
        bingStatus = '';
        if (NEWTAB_WALLPAPER_MODES.some((mode) => getEffectiveWallpaperIdForMode(mode) === REMOTE_CONTENT.BING_DAILY_ID)) {
          await remoteClient.ensureWallpaper(REMOTE_CONTENT.BING_DAILY_ID).catch(() => {
            // The list loaded; if the daily photo still fails, the current wallpaper simply stays.
          });
          if (seq !== bingCatalogSeq) return;
          if (getEffectiveWallpaperIdForMode(getResolvedWallpaperMode()) === REMOTE_CONTENT.BING_DAILY_ID) {
            applyResolvedNewtabWallpaper();
          }
        }
      } catch (_error) {
        if (seq !== bingCatalogSeq) return;
        bingStatus = 'error';
      } finally {
        if (seq === bingCatalogSeq) {
          bingLoading = false;
          renderWallpaperPanelState();
        }
      }
    }

    // A New Tab can stay open past midnight; pick up the new daily photo when it is shown again.
    function refreshDailyWallpapersIfStale() {
      if (!hasStoredWallpaperStateLoaded || document.visibilityState === 'hidden') return;
      const day = REMOTE_CONTENT.localDay(Date.now());
      if (day === dailyWallpaperCheckedDay) return;
      const dailyIds = NEWTAB_WALLPAPER_MODES.map((mode) => getEffectiveWallpaperIdForMode(mode))
        .filter((id) => REMOTE_CONTENT.isDailyWallpaperId(id));
      if (!dailyIds.length) return;
      dailyWallpaperCheckedDay = day;
      // Curated picks follow the date alone, so the new one is ready without a request.
      if (dailyIds.some((id) => id !== REMOTE_CONTENT.BING_DAILY_ID)) {
        applyResolvedNewtabWallpaper();
        renderWallpaperPanelState();
      }
      if (!dailyIds.includes(REMOTE_CONTENT.BING_DAILY_ID)) return;
      remoteClient.ensureWallpaper(REMOTE_CONTENT.BING_DAILY_ID).then(() => {
        if (getEffectiveWallpaperIdForMode(getResolvedWallpaperMode()) === REMOTE_CONTENT.BING_DAILY_ID) {
          applyResolvedNewtabWallpaper();
        }
        renderWallpaperPanelState();
      }).catch(() => {
        // Offline at midnight: yesterday's photo stays until the next check.
      });
    }

    // A background tab can miss the effect redraw for a photo that changed while it was hidden.
    function syncWallpaperEffectSource() {
      if (document.visibilityState === 'hidden' || !wallpaperEffects ||
          typeof wallpaperEffects.isSourceStale !== 'function' || !wallpaperEffects.isSourceStale()) {
        return;
      }
      wallpaperEffects.refresh({ immediate: true });
    }

    function handleWallpaperPageShown() {
      refreshDailyWallpapersIfStale();
      syncWallpaperEffectSource();
    }

    // Bound once the stored wallpaper loads, so a tab that never opens the panel still rolls over.
    function bindWallpaperPageShownListeners() {
      if (hasWallpaperPageShownListeners) return;
      hasWallpaperPageShownListeners = true;
      dailyWallpaperCheckedDay = REMOTE_CONTENT.localDay(Date.now());
      if (window && typeof window.addEventListener === 'function') {
        window.addEventListener('focus', handleWallpaperPageShown, { passive: true });
      }
      if (document && typeof document.addEventListener === 'function') {
        document.addEventListener('visibilitychange', handleWallpaperPageShown, { passive: true });
      }
    }

    function normalizeDailyWallpaperPicks(value) {
      const picks = {};
      const source = value && typeof value === 'object' && value.picks && typeof value.picks === 'object'
        ? value.picks
        : {};
      Object.keys(source).forEach((dailyId) => {
        const pickId = String(source[dailyId] || '');
        if (REMOTE_CONTENT.isDailyWallpaperId(dailyId) && !REMOTE_CONTENT.isDailyWallpaperId(pickId) &&
            REMOTE_CONTENT.getWallpaperProvider(pickId) === REMOTE_CONTENT.getWallpaperProvider(dailyId)) {
          picks[dailyId] = pickId;
        }
      });
      return { day: value && typeof value.day === 'string' ? value.day : '', picks };
    }

    function getDailyWallpaperPick(dailyId) {
      if (!REMOTE_CONTENT.isDailyWallpaperId(dailyId) ||
          dailyWallpaperPicks.day !== REMOTE_CONTENT.localDay(Date.now())) {
        return '';
      }
      return dailyWallpaperPicks.picks[dailyId] || '';
    }

    function getActiveDailyWallpaperId(provider) {
      const id = getWallpaperSelectionIdForUi();
      return REMOTE_CONTENT.isDailyWallpaperId(id) && REMOTE_CONTENT.getWallpaperProvider(id) === provider ? id : '';
    }

    // Choosing today's own photo, or restoring it, simply drops the pick.
    function setDailyWallpaperPick(dailyId, pickId) {
      const today = REMOTE_CONTENT.localDay(Date.now());
      const picks = dailyWallpaperPicks.day === today ? Object.assign({}, dailyWallpaperPicks.picks) : {};
      const scheduled = remoteClient.getWallpaper(dailyId);
      if (!pickId || scheduled && scheduled.dailyId === pickId) delete picks[dailyId];
      else picks[dailyId] = pickId;
      dailyWallpaperPicks = { day: today, picks };
      writeStorageValue(storageArea, NEWTAB_DAILY_WALLPAPER_PICKS_STORAGE_KEY,
        Object.keys(picks).length ? dailyWallpaperPicks : '', () => {
          showToast(t('newtab_wallpaper_save_error', 'Failed to save wallpaper'), true);
        });
      applyResolvedNewtabWallpaper();
      renderWallpaperPanelState();
    }

    function clearDailyWallpaperPick(dailyId) {
      if (getDailyWallpaperPick(dailyId)) setDailyWallpaperPick(dailyId, '');
    }

    function getCuratedTileItems() {
      const items = REMOTE_CONTENT.getCuratedWallpapers(curatedCategory);
      if (!items.length) return [];
      // Wrap around the end of the category so every page fills both rows.
      const start = (curatedPage * CURATED_TILE_LIMIT) % items.length;
      return Array.from({ length: Math.min(CURATED_TILE_LIMIT, items.length) },
        (_, index) => items[(start + index) % items.length]);
    }

    // Pages keep a fixed order, so choosing a photo never reshuffles the grid; instead the list
    // opens on the page that holds the chosen or daily photo.
    function showCuratedPageOfSelection() {
      const selectedId = getWallpaperTileSelectionId(getWallpaperSelectionIdForUi());
      const index = REMOTE_CONTENT.getCuratedWallpapers(curatedCategory).findIndex((item) => item.id === selectedId);
      curatedPage = index >= 0 ? Math.floor(index / CURATED_TILE_LIMIT) : 0;
    }

    // Paintings are named by title, photos by photographer.
    function getCuratedPhotoLabel(item) {
      if (item && item.title) return item.title;
      return item && item.name && item.name !== 'Picsum'
        ? formatMessage('newtab_curated_photo_by', 'Photo by {name}', { name: item.name })
        : '';
    }

    function getCuratedPhotoMeta(item) {
      if (item && item.title) {
        return [item.name, t('newtab_curated_art_meta', 'The Cleveland Museum of Art')].filter(Boolean).join(' · ');
      }
      return t('newtab_curated_source_meta', 'Unsplash · via Lorem Picsum');
    }

    function getCuratedCategoryLabel(category) {
      const fallbacks = { random: 'Mix', nature: 'Nature', water: 'Water', city: 'City', minimal: 'Minimal', art: 'Art' };
      return t(`newtab_curated_category_${category}`, fallbacks[category] || category);
    }

    function isCuratedDailyWallpaperActive() {
      const selectedId = getWallpaperSelectionIdForUi();
      return REMOTE_CONTENT.isDailyWallpaperId(selectedId) &&
        REMOTE_CONTENT.getWallpaperProvider(selectedId) === 'curated';
    }

    function selectCuratedCategory(category) {
      if (!REMOTE_CONTENT.CURATED_CATEGORIES.includes(category) || category === curatedCategory) return;
      curatedCategory = category;
      showCuratedPageOfSelection();
      renderWallpaperPanelState();
      playWallpaperEnterMotion(getWallpaperPanelRefs().curatedItemsHost, 'enter');
    }
    function showMoreCuratedWallpapers() {
      curatedPage += 1;
      renderWallpaperPanelState();
      playWallpaperEnterMotion(getWallpaperPanelRefs().curatedItemsHost, 'enter');
    }
    function setCuratedDailyWallpaper(enabled) {
      if (enabled) {
        const dailyId = REMOTE_CONTENT.curatedDailyId(curatedCategory);
        clearDailyWallpaperPick(dailyId);
        persistNewtabWallpaper(dailyId);
        showCuratedPageOfSelection();
      } else {
        // Keep the photo on screen, picked or not, as turning off the Bing daily wallpaper does.
        const daily = getWallpaperById(getWallpaperSelectionIdForUi());
        persistNewtabWallpaper(daily && daily.dailyId || NEWTAB_WALLPAPER_DEFAULT_ID);
      }
      renderWallpaperPanelState();
    }

    async function selectBingWallpaper(id, options) {
      if (bingSelecting) return;
      // A tile chosen while the daily photo is on replaces it for today only.
      const dailyId = options && options.asDailyPick ? getActiveDailyWallpaperId('bing') : '';
      const seq = ++bingSelectionSeq;
      const mode = getWallpaperEditMode();
      const sameForModes = currentWallpaperPrefs.sameForModes;
      bingSelecting = true;
      renderWallpaperPanelState();
      // The new wallpaper is its own success signal, so only a failure leaves a message.
      const toastTask = beginToast(t('newtab_bing_saving', 'Saving wallpaper…'));
      try {
        await remoteClient.ensureWallpaper(id);
        toastTask.done();
        if (seq !== bingSelectionSeq || mode !== getWallpaperEditMode() ||
            sameForModes !== currentWallpaperPrefs.sameForModes) return;
        if (dailyId) setDailyWallpaperPick(dailyId, id);
        else persistNewtabWallpaper(id);
      } catch (_error) {
        toastTask.fail(seq === bingSelectionSeq
          ? t('newtab_bing_save_error', 'Could not save wallpaper. Please try again.')
          : '');
      } finally {
        bingSelecting = false;
        renderWallpaperPanelState();
      }
    }

    function updateWallpaperLanguageStrings() {
      renderWallpaperPanelState();
      if (wallpaperSourcesHintController &&
          typeof wallpaperSourcesHintController.updateLanguage === 'function') {
        wallpaperSourcesHintController.updateLanguage();
      }
      const quoteRuntime = options.getQuoteRuntime && options.getQuoteRuntime();
      if (quoteRuntime) quoteRuntime.updateLanguage();
      const sectionSettings = options.getSectionPanelSettings && options.getSectionPanelSettings();
      if (sectionSettings) sectionSettings.updateLanguage();
    }
    // The wallpaper article opens with how this panel works, so it is the panel's help page.
    function buildHelpCenterUrl() {
      const communityLinks = globalThis.LumnoCommunityLinks;
      if (!communityLinks || typeof communityLinks.getHelpUrl !== 'function') {
        return '';
      }
      const htmlLang = document.documentElement && document.documentElement.lang;
      return communityLinks.getHelpUrl(htmlLang, 'newtab-wallpaper');
    }

    function buildAppearanceSettingsUrl() {
      if (extensionRoutes && typeof extensionRoutes.buildOptionsUrl === 'function') {
        return extensionRoutes.buildOptionsUrl(chrome, 'appearance');
      }
      if (chrome && chrome.runtime && typeof chrome.runtime.getURL === 'function') {
        return `${chrome.runtime.getURL('src/options/options.html')}#appearance`;
      }
      try {
        return new URL('../options/options.html#appearance', document.baseURI || window.location.href).toString();
      } catch (e) {
        return '../options/options.html#appearance';
      }
    }

    function openWallpaperPanel() {
      if (!wallpaperPanel || !wallpaperButton) {
        return;
      }
      if (!wallpaperPanelRendered) {
        bindWallpaperPanelSectionRuntimes();
        // The first open shows the source the current wallpaper comes from.
        syncWallpaperSourceTabToEditMode({ force: true });
      }
      dismissWallpaperSourcesFeatureHint();
      wallpaperPanelOpen = true;
      renderWallpaperPanelState();
      setWallpaperPanelOpenState(true);
      if (activeWallpaperTab === 'local') {
        loadCustomWallpapers();
      }
      if (activeWallpaperTab === 'bing') loadBingCatalog();
    }
    function closeWallpaperPanel(options) {
      if (!wallpaperPanel || !wallpaperButton) {
        return;
      }
      cancelWallpaperPanelActiveControls();
      wallpaperViewController.closeOpenSelect();
      const wasOpen = wallpaperPanelOpen;
      wallpaperPanelOpen = false;
      // The close itself is drawn, so the panel animates out.
      if (wasOpen) {
        drawWallpaperPanelState();
      } else {
        renderWallpaperPanelState();
      }
      setWallpaperPanelOpenState(false);
      if (options && options.restoreFocus) {
        try {
          wallpaperButton.focus({ preventScroll: true });
        } catch (e) {
          wallpaperButton.focus();
        }
      }
    }
    function toggleWallpaperPanel() {
      if (isWallpaperPanelOpen()) {
        closeWallpaperPanel();
        return;
      }
      openWallpaperPanel();
    }

    function createWallpaperControls() {
      wallpaperPanelActions = createWallpaperPanelActions();
      wallpaperPanelState = buildWallpaperPanelState();
      wallpaperPanelLayoutKey = getWallpaperPanelLayoutKey(wallpaperPanelState);
      wallpaperViewController = wallpaperView.createController({
        documentObj,
        model: createWallpaperPanelModel(),
        state: wallpaperPanelState
      });
      wallpaperControl = wallpaperViewController.control;
      wallpaperButton = wallpaperViewController.button;
      wallpaperPanel = wallpaperViewController.panel;
      inputAutoFocusReady.then(renderWallpaperPanelState);
      updateWallpaperLanguageStrings();
      createWallpaperSourcesFeatureHint();
    }
    function handleThemeModeChange() {
      if (!hasStoredWallpaperStateLoaded) {
        return;
      }
      if (currentWallpaperPrefs && (currentWallpaperPrefs.sameForModes || !isWallpaperPanelOpen())) {
        activeWallpaperMode = getResolvedWallpaperMode();
      }
      applyResolvedNewtabWallpaper();
      renderWallpaperPanelState();
      applyWallpaperEffectForResolvedMode();
      renderWallpaperPanelState();
      syncWallpaperSourceTabToEditMode();
      renderWallpaperPanelState();
    }

    function handleStorageChange(changes) {
      if (!changes) {
        return false;
      }
      let handled = false;
      if (changes[REMOTE_CONTENT.BING_DAILY_CACHE_KEY] && hasStoredWallpaperStateLoaded) {
        remoteClient.restoreWallpaper(REMOTE_CONTENT.BING_DAILY_ID).then(() => {
          if (getEffectiveWallpaperIdForMode(getResolvedWallpaperMode()) === REMOTE_CONTENT.BING_DAILY_ID) {
            applyResolvedNewtabWallpaper();
          }
          renderWallpaperPanelState();
        }).catch(warnWallpaperFailure('Could not restore the daily Bing wallpaper another tab saved.'));
        handled = true;
      }
      if (changes[SETTINGS.ASSET_REVISION_STORAGE_KEY]) {
        refreshCustomWallpapers().then(() => loadStoredWallpaperState());
        handled = true;
      }
      if (changes[NEWTAB_WALLPAPER_OVERLAY_STORAGE_KEY]) {
        applyWallpaperOverlayOpacity(changes[NEWTAB_WALLPAPER_OVERLAY_STORAGE_KEY].newValue);
        handled = true;
      }
      const wallpaperStorageChanged = Boolean(
        (NEWTAB_LOCAL_WALLPAPER_STORAGE_KEY && changes[NEWTAB_LOCAL_WALLPAPER_STORAGE_KEY]) ||
        changes[NEWTAB_WALLPAPER_STORAGE_KEY] ||
        (NEWTAB_ONLINE_WALLPAPER_STORAGE_KEY && changes[NEWTAB_ONLINE_WALLPAPER_STORAGE_KEY]) ||
        (NEWTAB_LINK_WALLPAPERS_STORAGE_KEY && changes[NEWTAB_LINK_WALLPAPERS_STORAGE_KEY]) ||
        (NEWTAB_DAILY_WALLPAPER_PICKS_STORAGE_KEY && changes[NEWTAB_DAILY_WALLPAPER_PICKS_STORAGE_KEY])
      );
      if (wallpaperStorageChanged) {
        bingSelectionSeq += 1;
        const changeSeq = ++wallpaperStorageChangeSeq;
        loadStoredWallpaperState({
          shouldApply: () => changeSeq === wallpaperStorageChangeSeq
        });
        handled = true;
      }
      if (changes[NEWTAB_WALLPAPER_EFFECT_STORAGE_KEY]) {
        const raw = changes[NEWTAB_WALLPAPER_EFFECT_STORAGE_KEY].newValue;
        applyWallpaperEffectPrefs(raw);
        if (hasStoredWallpaperStateLoaded) {
          writeWallpaperPreloadCache();
        }
        const storedPrefs = getWallpaperEffectStorageValue();
        if (storageArea && raw && JSON.stringify(raw) !== JSON.stringify(storedPrefs)) {
          storageArea.set({ [NEWTAB_WALLPAPER_EFFECT_STORAGE_KEY]: storedPrefs });
        }
        handled = true;
      }
      if (NEWTAB_TOP_CONTENT_MODE_STORAGE_KEY && changes[NEWTAB_TOP_CONTENT_MODE_STORAGE_KEY]) {
        const raw = changes[NEWTAB_TOP_CONTENT_MODE_STORAGE_KEY].newValue;
        const nextValue = normalizeNewtabTopContentMode(raw);
        applyTopContentMode(nextValue);
        if (storageArea && raw !== nextValue) {
          storageArea.set({ [NEWTAB_TOP_CONTENT_MODE_STORAGE_KEY]: nextValue });
        }
        handled = true;
      }
      if (NEWTAB_TIME_FONT_WEIGHT_STORAGE_KEY &&
          changes[NEWTAB_TIME_FONT_WEIGHT_STORAGE_KEY]) {
        const raw = changes[NEWTAB_TIME_FONT_WEIGHT_STORAGE_KEY].newValue;
        const nextValue = normalizeNewtabTimeFontWeight(raw);
        applyTimeFontWeight(nextValue);
        if (storageArea && raw !== nextValue) {
          storageArea.set({ [NEWTAB_TIME_FONT_WEIGHT_STORAGE_KEY]: nextValue });
        }
        handled = true;
      }
      if (NEWTAB_TIME_SECONDS_VISIBLE_STORAGE_KEY &&
          changes[NEWTAB_TIME_SECONDS_VISIBLE_STORAGE_KEY]) {
        const raw = changes[NEWTAB_TIME_SECONDS_VISIBLE_STORAGE_KEY].newValue;
        const nextValue = normalizeNewtabTimeSecondsVisible(raw);
        applyTimeSecondsVisible(nextValue);
        if (storageArea && raw !== nextValue) {
          storageArea.set({ [NEWTAB_TIME_SECONDS_VISIBLE_STORAGE_KEY]: nextValue });
        }
        handled = true;
      }
      if (NEWTAB_FAVICON_STORAGE_KEY && changes[NEWTAB_FAVICON_STORAGE_KEY]) {
        const raw = changes[NEWTAB_FAVICON_STORAGE_KEY].newValue;
        const nextId = normalizeNewtabFaviconId(raw);
        applyNewtabFavicon(nextId);
        if (storageArea && raw !== nextId) {
          writeStorageValue(storageArea, NEWTAB_FAVICON_STORAGE_KEY, nextId);
        }
        handled = true;
      }
      return handled;
    }

    function getControlElement() {
      return wallpaperControl;
    }

    function containsTarget(target) {
      if (!target) {
        return false;
      }
      if (wallpaperControl && (target === wallpaperControl || wallpaperControl.contains(target))) {
        return true;
      }
      return Boolean(wallpaperViewController && wallpaperViewController.containsSelectMenuTarget(target));
    }

    return {
      storageKeys,
      createControls: createWallpaperControls,
      getControlElement,
      containsTarget,
      closeOpenMenu: () => Boolean(wallpaperViewController &&
        wallpaperViewController.closeOpenSelect({ restoreFocus: true })) || closeCustomWallpaperUrlForm(),
      isPanelOpen: isWallpaperPanelOpen,
      closePanel: closeWallpaperPanel,
      updateLanguageStrings: updateWallpaperLanguageStrings,
      // The page calls these after changing a setting the panel shows.
      updateAppearanceSelectionUi: renderWallpaperPanelState,
      updateSearchWidthUi: renderWallpaperPanelState,
      updateShortcutsUi: renderWallpaperPanelState,
      updateInputAutoFocusUi: renderWallpaperPanelState,
      updateTopContentModeUi: renderWallpaperPanelState,
      updateTimeFontWeightUi: renderWallpaperPanelState,
      updateTimeSecondsVisibleUi: renderWallpaperPanelState,
      refreshCustomWallpapers,
      bootstrapInitialWallpaper,
      bootstrapInitialWallpaperOverlay,
      bootstrapInitialWallpaperEffect,
      waitForInitialWallpaperEffectVisual,
      bootstrapInitialNewtabFavicon,
      handleStorageChange,
      handleThemeModeChange,
      scheduleAdaptiveToneUpdate: scheduleWallpaperAdaptiveToneUpdate
    };
  }

  globalThis.LumnoNewtabWallpaper = {
    STORAGE_KEYS: DEFAULT_STORAGE_KEYS,
    WALLPAPER_EFFECT_MODE_STORAGE_VERSION,
    normalizeWallpaperEffectStoragePrefs,
    createWallpaperRuntime
  };
})();
