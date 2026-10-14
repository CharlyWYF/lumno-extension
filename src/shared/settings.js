(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.LumnoSettings = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const THEME_STORAGE_KEY = '_x_extension_theme_mode_2024_unique_';
  // Retained for safely migrating older WebDAV installations. New connections
  // keep Chrome Sync as the preferences source and add WebDAV alongside it.
  const LOCAL_PRIMARY_STORAGE_KEY = '_x_extension_local_primary_2026_unique_';
  const WEBDAV_STATUS_STORAGE_KEY = '_x_extension_webdav_status_2026_unique_';
  // Server address, directory and username of each WebDAV connection, in
  // chrome.storage.sync so another device can offer to fill them in. The app
  // password never goes here. Kept out of CHROME_SYNC_STORAGE_KEYS: it is not
  // a preference and never travels through WebDAV or settings export.
  const WEBDAV_CONNECTIONS_SYNC_STORAGE_KEY = '_x_extension_webdav_connections_2026_unique_';
  // Synced connections this device chose not to add, kept on this device only.
  const WEBDAV_DISMISSED_CONNECTIONS_STORAGE_KEY = '_x_extension_webdav_dismissed_connections_2026_unique_';
  const ASSET_REVISION_STORAGE_KEY = '_x_extension_asset_revision_2026_unique_';
  const NEWTAB_THEME_MODE_STORAGE_KEY = '_x_extension_newtab_theme_mode_2026_unique_';
  const NEWTAB_THEME_SCOPE_STORAGE_KEY = '_x_extension_newtab_theme_scope_2026_unique_';
  const NEWTAB_SHORTCUTS_VISIBLE_STORAGE_KEY = '_x_extension_newtab_shortcuts_visible_2026_unique_';
  const NEWTAB_SHORTCUTS_CHUNK_2_STORAGE_KEY = '_x_extension_newtab_shortcuts_chunk_2_2026_unique_';
  const NEWTAB_SHORTCUTS_CHUNK_3_STORAGE_KEY = '_x_extension_newtab_shortcuts_chunk_3_2026_unique_';
  // Grouped shortcut state; the three keys above hold the older flat list.
  const NEWTAB_SHORTCUTS_V2_STORAGE_KEYS = Object.freeze([
    '_x_extension_newtab_shortcuts_v2_2026_unique_',
    '_x_extension_newtab_shortcuts_v2_chunk_2_2026_unique_',
    '_x_extension_newtab_shortcuts_v2_chunk_3_2026_unique_'
  ]);
  const NEWTAB_SHORTCUT_ADD_VISIBLE_STORAGE_KEY = '_x_extension_newtab_shortcut_add_visible_2026_unique_';
  const NEWTAB_SHORTCUT_DOCK_MAGNIFICATION_ENABLED_STORAGE_KEY = '_x_extension_newtab_shortcut_dock_magnification_enabled_2026_unique_';
  const NEWTAB_FEEDBACK_BUTTON_VISIBLE_STORAGE_KEY = '_x_extension_newtab_feedback_button_visible_2026_unique_';
  const NEWTAB_APPEARANCE_BUTTON_VISIBLE_STORAGE_KEY = '_x_extension_newtab_appearance_button_visible_2026_unique_';
  const NEWTAB_SHORTCUT_WIDTH_STORAGE_KEY = '_x_extension_newtab_shortcut_width_2026_unique_';
  const NEWTAB_SHORTCUT_WIDTH_MIN = 360;
  const NEWTAB_SHORTCUT_WIDTH_MAX = 1440;
  const NEWTAB_SHORTCUT_WIDTH_DEFAULT = 920;
  const NEWTAB_SHORTCUT_COLUMNS_STORAGE_KEY =
    '_x_extension_newtab_shortcut_columns_2026_unique_';
  const NEWTAB_SHORTCUT_COLUMNS_MIN = 4;
  const NEWTAB_SHORTCUT_COLUMNS_MAX = 16;
  const NEWTAB_SHORTCUT_COLUMNS_DEFAULT = 10;
  const NEWTAB_SHORTCUT_SIZE_STORAGE_KEY =
    '_x_extension_newtab_shortcut_size_2026_unique_';
  const NEWTAB_SHORTCUT_SIZE_MIN = 48;
  const NEWTAB_SHORTCUT_SIZE_MAX = 80;
  const NEWTAB_SHORTCUT_SIZE_DEFAULT = 64;
  const NEWTAB_SHORTCUT_GAP_STORAGE_KEY =
    '_x_extension_newtab_shortcut_gap_2026_unique_';
  const NEWTAB_SHORTCUT_GAP_MIN = 0;
  const NEWTAB_SHORTCUT_GAP_MAX = 24;
  const NEWTAB_SHORTCUT_GAP_DEFAULT = 4;
  const NEWTAB_INPUT_AUTO_FOCUS_ENABLED_STORAGE_KEY = '_x_extension_newtab_input_auto_focus_enabled_2026_unique_';
  // localStorage keys: the New Tab's startup read, auto-focus choice and locale from its last load,
  // so the next load can act on them before its scripts finish loading.
  const NEWTAB_STARTUP_STORAGE_KEYS_CACHE_KEY = '_x_extension_newtab_startup_storage_keys_2026_unique_';
  const NEWTAB_INPUT_AUTO_FOCUS_CACHE_KEY = '_x_extension_newtab_input_auto_focus_cache_2026_unique_';
  const NEWTAB_LOCALE_CACHE_KEY = '_x_extension_newtab_locale_cache_2026_unique_';
  const NEWTAB_QUOTE_PREFS_STORAGE_KEY = '_x_extension_newtab_quote_prefs_2026_unique_';
  // Online wallpaper picks live apart from the shared wallpaper key, which older versions sanitize.
  const NEWTAB_ONLINE_WALLPAPER_STORAGE_KEY = '_x_extension_newtab_online_wallpaper_2026_unique_';
  // Wallpapers added from a link sync as their URLs; each device caches the image itself.
  const NEWTAB_LINK_WALLPAPERS_STORAGE_KEY = '_x_extension_newtab_link_wallpapers_2026_unique_';
  // A photo picked while a daily wallpaper is on replaces it until the local date changes.
  const NEWTAB_DAILY_WALLPAPER_PICKS_STORAGE_KEY = '_x_extension_newtab_daily_wallpaper_picks_2026_unique_';
  const NEWTAB_QUOTE_FONT_SIZE_MIN = 12;
  const NEWTAB_QUOTE_FONT_SIZE_MAX = 24;
  const NEWTAB_QUOTE_FONT_SIZE_DEFAULT = 15;
  const BOOKMARK_FOLDER_ICONS_VISIBLE_STORAGE_KEY = '_x_extension_bookmark_folder_icons_visible_2026_unique_';
  // Folder colors are keyed by bookmark path, not the device-only bookmark id.
  const BOOKMARK_FOLDER_COLOR_REFS_STORAGE_KEY = '_x_extension_bookmark_folder_color_refs_2026_unique_';
  const BOOKMARK_FOLDER_COLOR_PRESETS_STORAGE_KEY = '_x_extension_bookmark_folder_color_presets_2026_unique_';
  const UPDATE_NOTICE_ENABLED_STORAGE_KEY = '_x_extension_update_notice_enabled_2026_unique_';
  const MOTION_EFFECTS_ENABLED_STORAGE_KEY = '_x_extension_motion_effects_enabled_2026_unique_';
  const SIMPLE_MODE_ENABLED_STORAGE_KEY = '_x_extension_simple_mode_enabled_2026_unique_';
  const NUMBER_SHORTCUT_INSTANT_ENABLED_STORAGE_KEY = '_x_extension_number_shortcut_instant_enabled_2026_unique_';
  const MACOS_CTRL_SUGGESTION_NAVIGATION_ENABLED_STORAGE_KEY =
    '_x_extension_macos_ctrl_suggestion_navigation_enabled_2026_unique_';
  const FAVICON_ENHANCED_FETCH_ENABLED_STORAGE_KEY = '_x_extension_favicon_enhanced_fetch_enabled_2026_unique_';
  const SEARCH_RESULT_DISPLAY_LIMIT_STORAGE_KEY = '_x_extension_search_result_display_limit_2026_unique_';
  const SEARCH_RESULT_TAB_POSITION_STORAGE_KEY = '_x_extension_search_result_tab_position_2026_unique_';
  const OVERLAY_OPEN_TABS_DEFAULT_VISIBLE_STORAGE_KEY = '_x_extension_overlay_open_tabs_default_visible_2026_unique_';
  const OVERLAY_ENTER_ANIMATION_STORAGE_KEY = '_x_extension_overlay_enter_animation_2026_unique_';
  const OVERLAY_PAGE_THEME_ADAPTATION_ENABLED_STORAGE_KEY = '_x_extension_overlay_page_theme_adaptation_enabled_2026_unique_';
  const SELECTION_QUICK_ACTIONS_ENABLED_STORAGE_KEY = '_x_extension_selection_quick_actions_enabled_2026_unique_';
  const SELECTION_QUICK_ACTIONS_PROVIDER_STORAGE_KEY = '_x_extension_selection_quick_actions_provider_2026_unique_';
  const SELECTION_QUICK_ACTIONS_GROUP_ENABLED_STORAGE_KEY = '_x_extension_selection_quick_actions_group_enabled_2026_unique_';
  const AGGREGATE_SEARCH_STORAGE_KEY = '_x_extension_aggregate_searches_2026_unique_';
  const AGGREGATE_SEARCH_AUTO_GROUP_ENABLED_STORAGE_KEY =
    '_x_extension_aggregate_search_auto_group_enabled_2026_unique_';
  // One flat record holds the reader's custom order for every Search sources
  // list plus the search scope group order. Only short keys are stored, so the
  // record stays well inside the 8 KB Chrome Sync item budget.
  const SEARCH_SOURCE_ORDER_STORAGE_KEY = '_x_extension_search_source_order_2026_unique_';
  const PROGRESS_TRACKING_ENABLED_STORAGE_KEY = '_x_extension_progress_tracking_enabled_2026_unique_';
  // Which New Tab surfaces open a plain click in a new foreground tab instead of the New Tab itself.
  const NEWTAB_OPEN_IN_NEW_TAB_STORAGE_KEY = '_x_extension_newtab_open_in_new_tab_2026_unique_';
  const NEWTAB_OPEN_IN_NEW_TAB_SURFACES = Object.freeze(['search', 'shortcuts', 'bookmarks', 'recentSites']);
  // Bookmark bar material is chosen against the wallpaper. Browser sync
  // carries no custom wallpapers, so these values never enter Chrome Sync.
  const BOOKMARK_TOPBAR_LOCAL_STORAGE_KEYS = Object.freeze([
    '_x_extension_bookmark_topbar_surface_mode_2026_unique_',
    '_x_extension_bookmark_topbar_surface_color_light_2026_unique_',
    '_x_extension_bookmark_topbar_surface_color_dark_2026_unique_',
    '_x_extension_bookmark_topbar_surface_color_2026_unique_'
  ]);
  // WebDAV carries them together with the wallpapers. The legacy single color
  // is migrated into the light and dark colors on each device.
  const BOOKMARK_TOPBAR_WEBDAV_STORAGE_KEYS = Object.freeze(BOOKMARK_TOPBAR_LOCAL_STORAGE_KEYS.slice(0, 3));
  const LANGUAGE_STORAGE_KEY = '_x_extension_language_2024_unique_';
  const RECENT_MODE_STORAGE_KEY = '_x_extension_recent_mode_2024_unique_';
  const RECENT_COUNT_STORAGE_KEY = '_x_extension_recent_count_2024_unique_';
  const NEWTAB_WIDTH_MODE_STORAGE_KEY = '_x_extension_newtab_width_mode_2026_unique_';
  const NEWTAB_SEARCH_WIDTH_STORAGE_KEY = '_x_extension_newtab_search_width_2026_unique_';
  const NEWTAB_ZEN_MODE_STORAGE_KEY = '_x_extension_newtab_zen_mode_2026_unique_';
  const NEWTAB_WALLPAPER_STORAGE_KEY = '_x_extension_newtab_wallpaper_2026_unique_';
  const NEWTAB_WALLPAPER_OVERLAY_STORAGE_KEY = '_x_extension_newtab_wallpaper_overlay_2026_unique_';
  const NEWTAB_WALLPAPER_EFFECT_STORAGE_KEY = '_x_extension_newtab_wallpaper_effect_2026_unique_';
  const NEWTAB_FAVICON_STORAGE_KEY = '_x_extension_newtab_favicon_2026_unique_';
  const OVERLAY_SIZE_MODE_STORAGE_KEY = '_x_extension_overlay_size_mode_2026_unique_';
  const BOOKMARK_COUNT_STORAGE_KEY = '_x_extension_bookmark_count_2024_unique_';
  const BOOKMARK_COLUMNS_STORAGE_KEY = '_x_extension_bookmark_columns_2024_unique_';
  const BOOKMARK_VIEW_MODE_STORAGE_KEY = '_x_extension_bookmark_view_mode_2026_unique_';
  const PINNED_RECENT_SITES_STORAGE_KEY = '_x_extension_newtab_pinned_recent_sites_2026_unique_';
  const HIDDEN_RECENT_SITES_STORAGE_KEY = '_x_extension_newtab_hidden_recent_sites_2026_unique_';
  const NEWTAB_SHORTCUTS_STORAGE_KEY = '_x_extension_newtab_shortcuts_2026_unique_';
  const AUTO_PIP_ENABLED_STORAGE_KEY = '_x_extension_auto_pip_enabled_2026_unique_';
  const TAB_SWITCHER_ENABLED_STORAGE_KEY = '_x_extension_tab_switcher_enabled_2026_unique_';
  const DOCUMENT_PIP_ENABLED_STORAGE_KEY = '_x_extension_document_pip_enabled_2026_unique_';
  const PINNED_TAB_RECOVERY_ENABLED_STORAGE_KEY = '_x_extension_pinned_tab_recovery_enabled_2026_unique_';
  const OVERLAY_TAB_PRIORITY_STORAGE_KEY = '_x_extension_overlay_tab_priority_2024_unique_';
  const RESTRICTED_ACTION_STORAGE_KEY = '_x_extension_restricted_action_2024_unique_';
  const SEARCH_RESULT_PRIORITY_STORAGE_KEY = '_x_extension_search_result_priority_2026_unique_';
  const SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY = '_x_extension_search_result_source_types_2026_unique_';
  const FALLBACK_SHORTCUT_STORAGE_KEY = '_x_extension_fallback_hotkey_2024_unique_';
  const SITE_SEARCH_STORAGE_KEY = '_x_extension_site_search_custom_2024_unique_';
  const SITE_SEARCH_DISABLED_STORAGE_KEY = '_x_extension_site_search_disabled_2024_unique_';
  const SEARCH_BLACKLIST_STORAGE_KEY = '_x_extension_search_blacklist_2026_unique_';
  const FAVICON_REQUEST_BLACKLIST_STORAGE_KEY = '_x_extension_favicon_request_blacklist_2026_unique_';
  const DEFAULT_SEARCH_ENGINE_STORAGE_KEY = '_x_extension_default_search_engine_2024_unique_';
  // When and how settings last synced (manual sync or an import); written to the primary area.
  const SYNC_META_STORAGE_KEY = '_x_extension_sync_meta_2024_unique_';
  const RESTRICTED_ACTION_AUTO_BROWSER_SETTING_DONE_STORAGE_KEY = '_x_extension_restricted_action_auto_browser_setting_done_2026_unique_';
  // localStorage: the Options page theme from its last load, applied before its scripts load.
  const OPTIONS_THEME_PRELOAD_STORAGE_KEY = '_x_extension_options_theme_preload_2026_unique_';
  const SELECTION_QUICK_ACTIONS_PROVIDER_KEYS = Object.freeze([
    'gpt',
    'gm',
    'dbai',
    'qw',
    'yb',
    'mx',
    'ds',
    'kimi'
  ]);
  // Keep the original key value so existing installations migrate from boolean to mode in place.
  const NEWTAB_TOP_CONTENT_MODE_STORAGE_KEY = '_x_extension_newtab_wordmark_visible_2026_unique_';
  const NEWTAB_TOP_CONTENT_BRAND = 'brand';
  const NEWTAB_TOP_CONTENT_TIME = 'time';
  const NEWTAB_TOP_CONTENT_OFF = 'off';
  const NEWTAB_TIME_FONT_WEIGHT_STORAGE_KEY =
    '_x_extension_newtab_time_font_weight_2026_unique_';
  const NEWTAB_TIME_FONT_WEIGHT_MIN = 300;
  const NEWTAB_TIME_FONT_WEIGHT_MAX = 800;
  const NEWTAB_TIME_FONT_WEIGHT_DEFAULT = 320;
  const NEWTAB_TIME_SECONDS_VISIBLE_STORAGE_KEY =
    '_x_extension_newtab_time_seconds_visible_2026_unique_';
  // User-controlled preferences that are safe to store in chrome.storage.sync.
  // Keep generated caches, device state, and custom wallpaper media out of this list.
  const CHROME_SYNC_STORAGE_KEYS = Object.freeze([
    THEME_STORAGE_KEY,
    LANGUAGE_STORAGE_KEY,
    RECENT_MODE_STORAGE_KEY,
    RECENT_COUNT_STORAGE_KEY,
    NEWTAB_WIDTH_MODE_STORAGE_KEY,
    NEWTAB_SEARCH_WIDTH_STORAGE_KEY,
    NEWTAB_INPUT_AUTO_FOCUS_ENABLED_STORAGE_KEY,
    NEWTAB_QUOTE_PREFS_STORAGE_KEY,
    NEWTAB_THEME_MODE_STORAGE_KEY,
    NEWTAB_THEME_SCOPE_STORAGE_KEY,
    NEWTAB_ZEN_MODE_STORAGE_KEY,
    NEWTAB_WALLPAPER_STORAGE_KEY,
    NEWTAB_ONLINE_WALLPAPER_STORAGE_KEY,
    NEWTAB_LINK_WALLPAPERS_STORAGE_KEY,
    NEWTAB_DAILY_WALLPAPER_PICKS_STORAGE_KEY,
    NEWTAB_WALLPAPER_OVERLAY_STORAGE_KEY,
    NEWTAB_WALLPAPER_EFFECT_STORAGE_KEY,
    NEWTAB_FAVICON_STORAGE_KEY,
    OVERLAY_SIZE_MODE_STORAGE_KEY,
    OVERLAY_ENTER_ANIMATION_STORAGE_KEY,
    OVERLAY_PAGE_THEME_ADAPTATION_ENABLED_STORAGE_KEY,
    BOOKMARK_COUNT_STORAGE_KEY,
    BOOKMARK_COLUMNS_STORAGE_KEY,
    BOOKMARK_VIEW_MODE_STORAGE_KEY,
    BOOKMARK_FOLDER_ICONS_VISIBLE_STORAGE_KEY,
    BOOKMARK_FOLDER_COLOR_REFS_STORAGE_KEY,
    BOOKMARK_FOLDER_COLOR_PRESETS_STORAGE_KEY,
    PINNED_RECENT_SITES_STORAGE_KEY,
    HIDDEN_RECENT_SITES_STORAGE_KEY,
    NEWTAB_SHORTCUTS_STORAGE_KEY,
    NEWTAB_SHORTCUTS_CHUNK_2_STORAGE_KEY,
    NEWTAB_SHORTCUTS_CHUNK_3_STORAGE_KEY,
    ...NEWTAB_SHORTCUTS_V2_STORAGE_KEYS,
    NEWTAB_SHORTCUTS_VISIBLE_STORAGE_KEY,
    NEWTAB_SHORTCUT_ADD_VISIBLE_STORAGE_KEY,
    NEWTAB_SHORTCUT_DOCK_MAGNIFICATION_ENABLED_STORAGE_KEY,
    NEWTAB_FEEDBACK_BUTTON_VISIBLE_STORAGE_KEY,
    NEWTAB_APPEARANCE_BUTTON_VISIBLE_STORAGE_KEY,
    NEWTAB_SHORTCUT_WIDTH_STORAGE_KEY,
    NEWTAB_SHORTCUT_COLUMNS_STORAGE_KEY,
    NEWTAB_SHORTCUT_SIZE_STORAGE_KEY,
    NEWTAB_SHORTCUT_GAP_STORAGE_KEY,
    UPDATE_NOTICE_ENABLED_STORAGE_KEY,
    MOTION_EFFECTS_ENABLED_STORAGE_KEY,
    SIMPLE_MODE_ENABLED_STORAGE_KEY,
    NUMBER_SHORTCUT_INSTANT_ENABLED_STORAGE_KEY,
    MACOS_CTRL_SUGGESTION_NAVIGATION_ENABLED_STORAGE_KEY,
    AUTO_PIP_ENABLED_STORAGE_KEY,
    TAB_SWITCHER_ENABLED_STORAGE_KEY,
    DOCUMENT_PIP_ENABLED_STORAGE_KEY,
    PINNED_TAB_RECOVERY_ENABLED_STORAGE_KEY,
    SELECTION_QUICK_ACTIONS_ENABLED_STORAGE_KEY,
    SELECTION_QUICK_ACTIONS_PROVIDER_STORAGE_KEY,
    SELECTION_QUICK_ACTIONS_GROUP_ENABLED_STORAGE_KEY,
    OVERLAY_TAB_PRIORITY_STORAGE_KEY,
    NEWTAB_TOP_CONTENT_MODE_STORAGE_KEY,
    NEWTAB_TIME_FONT_WEIGHT_STORAGE_KEY,
    NEWTAB_TIME_SECONDS_VISIBLE_STORAGE_KEY,
    RESTRICTED_ACTION_STORAGE_KEY,
    SEARCH_RESULT_PRIORITY_STORAGE_KEY,
    SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY,
    SEARCH_RESULT_DISPLAY_LIMIT_STORAGE_KEY,
    SEARCH_RESULT_TAB_POSITION_STORAGE_KEY,
    OVERLAY_OPEN_TABS_DEFAULT_VISIBLE_STORAGE_KEY,
    FALLBACK_SHORTCUT_STORAGE_KEY,
    SITE_SEARCH_STORAGE_KEY,
    SITE_SEARCH_DISABLED_STORAGE_KEY,
    AGGREGATE_SEARCH_STORAGE_KEY,
    AGGREGATE_SEARCH_AUTO_GROUP_ENABLED_STORAGE_KEY,
    SEARCH_SOURCE_ORDER_STORAGE_KEY,
    PROGRESS_TRACKING_ENABLED_STORAGE_KEY,
    NEWTAB_OPEN_IN_NEW_TAB_STORAGE_KEY,
    SEARCH_BLACKLIST_STORAGE_KEY,
    FAVICON_REQUEST_BLACKLIST_STORAGE_KEY,
    FAVICON_ENHANCED_FETCH_ENABLED_STORAGE_KEY,
    DEFAULT_SEARCH_ENGINE_STORAGE_KEY
  ]);

  // Copies settings this device saved locally into sync where sync has none.
  // Sync is read again just before writing so a value another device synced
  // meanwhile is never overwritten. The grouped shortcut keys move as one
  // save keyed off their head: all of them while sync lacks a head (replacing
  // any stray chunk there), none once it has one. Nothing is ever removed.
  function migrateLocalSettingsToSync(localArea, syncArea, keys) {
    const [groupHeadKey] = NEWTAB_SHORTCUTS_V2_STORAGE_KEYS;
    const isGroupKey = (key) => NEWTAB_SHORTCUTS_V2_STORAGE_KEYS.includes(key);
    localArea.get(keys, (localResult) => {
      const hasLocal = keys.some((key) => typeof localResult[key] !== 'undefined');
      if (!hasLocal) {
        return;
      }
      syncArea.get(keys, (syncResult) => {
        const groupMissing = typeof localResult[groupHeadKey] !== 'undefined'
          && typeof syncResult[groupHeadKey] === 'undefined';
        const missingSyncValues = {};
        keys.forEach((key) => {
          if (typeof localResult[key] === 'undefined') {
            return;
          }
          const missing = isGroupKey(key) ? groupMissing : typeof syncResult[key] === 'undefined';
          if (missing) {
            missingSyncValues[key] = localResult[key];
          }
        });
        const missingKeys = Object.keys(missingSyncValues);
        if (missingKeys.length === 0) {
          return;
        }
        syncArea.get(missingKeys, (latestSyncResult) => {
          const groupStillMissing = typeof latestSyncResult[groupHeadKey] === 'undefined';
          const stillMissingSyncValues = {};
          missingKeys.forEach((key) => {
            const missing = isGroupKey(key)
              ? groupStillMissing
              : typeof latestSyncResult[key] === 'undefined';
            if (missing) {
              stillMissingSyncValues[key] = missingSyncValues[key];
            }
          });
          if (Object.keys(stillMissingSyncValues).length > 0) {
            syncArea.set(stillMissingSyncValues);
          }
        });
      });
    });
  }

  function normalizeLocale(locale) {
    const raw = String(locale || '').trim();
    if (!raw) {
      return 'en';
    }
    const lower = raw.toLowerCase();
    if (lower.startsWith('zh')) {
      if (lower.includes('tw') || lower.includes('hk') || lower.includes('mo') || lower.includes('hant')) {
        return 'zh_TW';
      }
      return 'zh_CN';
    }
    if (lower === 'ja' || lower.startsWith('ja-') || lower.startsWith('ja_')) {
      return 'ja';
    }
    return 'en';
  }

  function localeToHtmlLang(locale) {
    const normalized = normalizeLocale(locale);
    if (normalized === 'zh_CN') {
      return 'zh-CN';
    }
    if (normalized === 'zh_TW') {
      return 'zh-TW';
    }
    if (normalized === 'ja') {
      return 'ja';
    }
    return 'en';
  }

  function normalizeNewtabWidthMode(value) {
    return value === 'standard' ? 'standard' : 'wide';
  }

  function normalizeNewtabSearchWidth(value, options) {
    const config = options || {};
    const allowNull = Boolean(config.allowNull);
    const min = Number.isFinite(Number(config.min)) ? Number(config.min) : 640;
    const max = Number.isFinite(Number(config.max)) ? Number(config.max) : 1040;
    const fallback = Number.isFinite(Number(config.fallback)) ? Number(config.fallback) : 920;
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return allowNull ? null : fallback;
    }
    return Math.min(max, Math.max(min, Math.round(number)));
  }

  function normalizeNewtabTopContentMode(value) {
    if (value === NEWTAB_TOP_CONTENT_TIME) {
      return NEWTAB_TOP_CONTENT_TIME;
    }
    if (value === NEWTAB_TOP_CONTENT_OFF || value === false) {
      return NEWTAB_TOP_CONTENT_OFF;
    }
    return NEWTAB_TOP_CONTENT_BRAND;
  }

  function normalizeNewtabQuotePrefs(value) {
    const source = value && typeof value === 'object' ? value : {};
    const size = typeof source.fontSize === 'number' ||
      (typeof source.fontSize === 'string' && source.fontSize.trim())
      ? Number(source.fontSize) : NaN;
    return {
      // Off until the user turns it on; a saved position alone never enables it.
      enabled: source.enabled === true,
      // 'search' predates the input-box placement and still means "below shortcuts".
      position: ['top', 'input', 'bottom'].includes(source.position) ? source.position : 'search',
      category: source.category === 'poetry' ? 'poetry' : 'literature',
      fontSize: Number.isFinite(size)
        ? Math.min(NEWTAB_QUOTE_FONT_SIZE_MAX, Math.max(NEWTAB_QUOTE_FONT_SIZE_MIN, Math.round(size)))
        : NEWTAB_QUOTE_FONT_SIZE_DEFAULT
    };
  }

  function normalizeNewtabWordmarkVisible(value) {
    return normalizeNewtabTopContentMode(value) !== NEWTAB_TOP_CONTENT_OFF;
  }

  function normalizeNewtabTimeSecondsVisible(value) {
    return value === true;
  }

  function normalizeNewtabTimeFontWeight(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return NEWTAB_TIME_FONT_WEIGHT_DEFAULT;
    }
    return Math.min(
      NEWTAB_TIME_FONT_WEIGHT_MAX,
      Math.max(NEWTAB_TIME_FONT_WEIGHT_MIN, Math.round(number))
    );
  }

  function normalizeNewtabShortcutsVisible(value) {
    return value !== false;
  }

  function normalizeNewtabShortcutAddVisible(value) {
    return value !== false;
  }

  function normalizeNewtabShortcutDockMagnificationEnabled(value) {
    return value !== false;
  }

  function normalizeNewtabFeedbackButtonVisible(value) {
    return value !== false;
  }

  function normalizeNewtabAppearanceButtonVisible(value) {
    return value !== false;
  }

  function normalizeNewtabShortcutWidth(value, options) {
    const config = options || {};
    const min = Number.isFinite(Number(config.min)) ? Number(config.min) : NEWTAB_SHORTCUT_WIDTH_MIN;
    const max = Number.isFinite(Number(config.max)) ? Number(config.max) : NEWTAB_SHORTCUT_WIDTH_MAX;
    const fallback = Number.isFinite(Number(config.fallback))
      ? Number(config.fallback)
      : NEWTAB_SHORTCUT_WIDTH_DEFAULT;
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return Math.min(max, Math.max(min, Math.round(fallback)));
    }
    return Math.min(max, Math.max(min, Math.round(number)));
  }

  function normalizeNewtabShortcutColumns(value, options) {
    const config = options || {};
    const min = Number.isFinite(Number(config.min))
      ? Number(config.min)
      : NEWTAB_SHORTCUT_COLUMNS_MIN;
    const max = Number.isFinite(Number(config.max))
      ? Number(config.max)
      : NEWTAB_SHORTCUT_COLUMNS_MAX;
    const fallback = Number.isFinite(Number(config.fallback))
      ? Number(config.fallback)
      : NEWTAB_SHORTCUT_COLUMNS_DEFAULT;
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return Math.min(max, Math.max(min, Math.round(fallback)));
    }
    return Math.min(max, Math.max(min, Math.round(number)));
  }

  function normalizeNewtabShortcutSize(value, options) {
    const config = options || {};
    const min = Number.isFinite(Number(config.min))
      ? Number(config.min)
      : NEWTAB_SHORTCUT_SIZE_MIN;
    const max = Number.isFinite(Number(config.max))
      ? Number(config.max)
      : NEWTAB_SHORTCUT_SIZE_MAX;
    const fallback = Number.isFinite(Number(config.fallback))
      ? Number(config.fallback)
      : NEWTAB_SHORTCUT_SIZE_DEFAULT;
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return Math.min(max, Math.max(min, Math.round(fallback)));
    }
    return Math.min(max, Math.max(min, Math.round(number)));
  }

  function normalizeNewtabShortcutGap(value, options) {
    const config = options || {};
    const min = Number.isFinite(Number(config.min))
      ? Number(config.min)
      : NEWTAB_SHORTCUT_GAP_MIN;
    const max = Number.isFinite(Number(config.max))
      ? Number(config.max)
      : NEWTAB_SHORTCUT_GAP_MAX;
    const fallback = Number.isFinite(Number(config.fallback))
      ? Number(config.fallback)
      : NEWTAB_SHORTCUT_GAP_DEFAULT;
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return Math.min(max, Math.max(min, Math.round(fallback)));
    }
    return Math.min(max, Math.max(min, Math.round(number)));
  }

  function inferNewtabShortcutColumnsFromWidth(value, options) {
    const config = options || {};
    const widthMin = Number.isFinite(Number(config.widthMin))
      ? Number(config.widthMin)
      : NEWTAB_SHORTCUT_WIDTH_MIN;
    const widthMax = Number.isFinite(Number(config.widthMax))
      ? Number(config.widthMax)
      : NEWTAB_SHORTCUT_WIDTH_MAX;
    const columnsMin = Number.isFinite(Number(config.columnsMin))
      ? Number(config.columnsMin)
      : NEWTAB_SHORTCUT_COLUMNS_MIN;
    const columnsMax = Number.isFinite(Number(config.columnsMax))
      ? Number(config.columnsMax)
      : NEWTAB_SHORTCUT_COLUMNS_MAX;
    const width = normalizeNewtabShortcutWidth(value, {
      min: widthMin,
      max: widthMax,
      fallback: NEWTAB_SHORTCUT_WIDTH_DEFAULT
    });
    const range = Math.max(1, widthMax - widthMin);
    const ratio = (width - widthMin) / range;
    return normalizeNewtabShortcutColumns(
      columnsMin + ratio * (columnsMax - columnsMin),
      {
        min: columnsMin,
        max: columnsMax,
        fallback: NEWTAB_SHORTCUT_COLUMNS_DEFAULT
      }
    );
  }

  function normalizeNewtabInputAutoFocusEnabled(value) {
    return value === true;
  }

  // newtab-focus-entry.js reads this copy to route a new tab before storage answers.
  function cacheNewtabInputAutoFocusEnabled(value) {
    try {
      const localStorageObj = globalThis.localStorage;
      const next = normalizeNewtabInputAutoFocusEnabled(value) ? 'true' : 'false';
      if (localStorageObj && localStorageObj.getItem(NEWTAB_INPUT_AUTO_FOCUS_CACHE_KEY) !== next) {
        localStorageObj.setItem(NEWTAB_INPUT_AUTO_FOCUS_CACHE_KEY, next);
      }
    } catch (_error) {
      // The copy is only a fast path; the focus entry falls back to reading storage.
    }
  }

  // newtab-storage-prefetch.js fetches this locale's messages before newtab.js asks for them.
  function cacheNewtabLocale(locale) {
    try {
      const localStorageObj = globalThis.localStorage;
      const next = normalizeLocale(locale);
      if (localStorageObj && localStorageObj.getItem(NEWTAB_LOCALE_CACHE_KEY) !== next) {
        localStorageObj.setItem(NEWTAB_LOCALE_CACHE_KEY, next);
      }
    } catch (_error) {
      // The copy is only a fast path; newtab.js fetches the messages itself without it.
    }
  }

  function normalizeNewtabOpenInNewTab(value) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const normalized = {};
    NEWTAB_OPEN_IN_NEW_TAB_SURFACES.forEach((surface) => {
      normalized[surface] = source[surface] === true;
    });
    return normalized;
  }

  function normalizeBookmarkFolderIconsVisible(value) {
    return value !== false;
  }

  function normalizeBookmarkCount(value) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 32 && parsed % 4 === 0) {
      return parsed;
    }
    return 8;
  }

  function normalizeBookmarkColumns(value) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed >= 4 && parsed <= 8) {
      return parsed;
    }
    return 6;
  }

  function normalizeUpdateNoticeEnabled(value) {
    return value !== false;
  }

  function normalizeMotionEffectsEnabled(value) {
    return value !== false;
  }

  function normalizeSimpleModeEnabled(value) {
    return value === true;
  }

  function normalizeNumberShortcutInstantEnabled(value) {
    return value === true;
  }

  function normalizeMacosCtrlSuggestionNavigationEnabled(value) {
    return value === true;
  }

  function shouldSkipEntryMotion(windowRef, motionEffectsEnabled) {
    if (!normalizeMotionEffectsEnabled(motionEffectsEnabled)) {
      return true;
    }
    return Boolean(
      windowRef &&
      typeof windowRef.matchMedia === 'function' &&
      windowRef.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  function normalizeFaviconEnhancedFetchEnabled(value) {
    return value !== false;
  }

  function normalizeOverlayOpenTabsDefaultVisible(value) {
    return value !== false;
  }

  function normalizeOverlayPageThemeAdaptationEnabled(value) {
    return value !== false;
  }

  function normalizeOverlaySizeMode(value) {
    if (value === 'compact' || value === 'large') {
      return value;
    }
    return 'standard';
  }

  function normalizeOverlayEnterAnimation(value) {
    return value === 'fade' ? 'fade' : 'elastic';
  }

  function normalizeOverlayTabPriorityMode(value) {
    if (value === 'switchTabFirst') {
      return true;
    }
    if (value === 'newtabFirst') {
      return false;
    }
    if (value === false) {
      return false;
    }
    return true;
  }

  function normalizeSearchResultPriority(value) {
    return value === 'search' ? 'search' : 'autocomplete';
  }

  function normalizeSearchResultTabPosition(value) {
    return value === 'afterCurrent' || value === 'beforeCurrent' ? value : 'end';
  }

  function normalizeSearchResultDisplayLimit(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 5 && parsed <= 10 ? parsed : 10;
  }

  const SEARCH_RESULT_SOURCE_TYPES = Object.freeze(['topSite', 'bookmark', 'history']);

  function normalizeSearchResultSourceType(value) {
    const raw = String(value || '').trim();
    if (raw === 'topSite' || raw === 'topSites' || raw === 'frequent' || raw === 'common') {
      return 'topSite';
    }
    if (raw === 'bookmark' || raw === 'bookmarks') {
      return 'bookmark';
    }
    if (raw === 'history') {
      return 'history';
    }
    return '';
  }

  function normalizeSearchResultSourceTypes(value) {
    const rawItems = Array.isArray(value)
      ? value
      : (typeof value === 'string' ? value.split(/[\s,]+/) : []);
    const selected = [];
    rawItems.forEach((item) => {
      const type = normalizeSearchResultSourceType(item);
      if (!type || selected.includes(type)) {
        return;
      }
      selected.push(type);
    });
    return selected.length > 0 ? selected : SEARCH_RESULT_SOURCE_TYPES.slice();
  }

  function normalizeTabRankScoreDebugMode(value) {
    return value === true;
  }

  function normalizeTabSwitcherEnabled(value) {
    return value !== false;
  }

  function normalizeSelectionQuickActionsEnabled(value) {
    return value === true;
  }

  function normalizeSelectionQuickActionsProvider(value) {
    const key = String(value || '').trim().toLowerCase();
    return SELECTION_QUICK_ACTIONS_PROVIDER_KEYS.includes(key) ? key : 'gpt';
  }

  function normalizeSelectionQuickActionsGroupEnabled(value) {
    return value === true;
  }

  function normalizeAggregateSearchAutoGroupEnabled(value) {
    return value !== false;
  }

  // Pinning an episode or chapter tracks it unless the person turns this off.
  function normalizeProgressTrackingEnabled(value) {
    return value !== false;
  }

  function normalizeThemePreference(value) {
    if (value === 'dark') {
      return 'dark';
    }
    if (value === 'light') {
      return 'light';
    }
    return '';
  }

  function normalizeThemeMode(value) {
    if (value === 'dark' || value === 'light') {
      return value;
    }
    return 'system';
  }

  function createGlobalThemeModeStorageUpdate(mode) {
    return {
      [THEME_STORAGE_KEY]: normalizeThemeMode(mode)
    };
  }

  function readStorageValue(storageArea, chromeApi, key) {
    return new Promise((resolve, reject) => {
      if (!storageArea || typeof storageArea.get !== 'function') {
        resolve(undefined);
        return;
      }
      let settled = false;
      const finish = (error, result) => {
        if (settled) {
          return;
        }
        settled = true;
        if (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
          return;
        }
        if (!result || typeof result !== 'object') {
          reject(new Error('storage-read-failed'));
          return;
        }
        resolve(result[key]);
      };
      const callback = (result) => {
        const runtimeError = chromeApi && chromeApi.runtime
          ? chromeApi.runtime.lastError
          : null;
        finish(
          runtimeError
            ? new Error(String(runtimeError.message || 'storage-read-failed'))
            : null,
          result
        );
      };
      try {
        const maybePromise = storageArea.get([key], callback);
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.then((result) => finish(null, result)).catch((error) => finish(error));
        }
      } catch (error) {
        finish(error);
      }
    });
  }

  // chrome.storage.sync refuses a burst of writes (dragging a slider, several
  // pages saving at once) with an error naming the exhausted quota. Its
  // buckets refill about one write every two seconds, so a single later
  // attempt goes through unless the burst keeps going.
  const STORAGE_RATE_LIMIT_RETRY_MS = 2500;
  const STORAGE_RATE_LIMIT_PATTERN = /MAX_(?:SUSTAINED_)?WRITE_OPERATIONS_PER_(?:MINUTE|HOUR)/;
  function isStorageRateLimitError(error) {
    return STORAGE_RATE_LIMIT_PATTERN.test(String(error && error.message || error || ''));
  }
  function getStorageRetryDelay(options) {
    const delay = options && Number(options.retryDelayMs);
    return Number.isFinite(delay) && delay >= 0 ? delay : STORAGE_RATE_LIMIT_RETRY_MS;
  }
  // Provider areas retry refused bursts themselves; wrapping one must not
  // retry the same write twice.
  const rateLimitRetryingAreas = new WeakSet();

  function writeStorageValues(storageArea, chromeApi, values, options) {
    const payload = values && typeof values === 'object' && !Array.isArray(values)
      ? { ...values }
      : {};
    const retryDelayMs = getStorageRetryDelay(options);
    return new Promise((resolve, reject) => {
      if (!storageArea || typeof storageArea.set !== 'function') {
        resolve(payload);
        return;
      }
      let retries = rateLimitRetryingAreas.has(storageArea) ? 0 : 1;
      const attempt = () => {
        let settled = false;
        const finish = (error) => {
          if (settled) {
            return;
          }
          settled = true;
          if (error && retries > 0 && isStorageRateLimitError(error)) {
            retries -= 1;
            setTimeout(attempt, retryDelayMs);
            return;
          }
          if (error) {
            reject(error instanceof Error ? error : new Error(String(error)));
            return;
          }
          resolve(payload);
        };
        const callback = () => {
          const runtimeError = chromeApi && chromeApi.runtime
            ? chromeApi.runtime.lastError
            : null;
          finish(runtimeError
            ? new Error(String(runtimeError.message || 'storage-write-failed'))
            : null);
        };
        try {
          const maybePromise = storageArea.set(payload, callback);
          if (maybePromise && typeof maybePromise.then === 'function') {
            maybePromise.then(() => {
              Promise.resolve().then(() => finish(null));
            }).catch(finish);
          }
        } catch (error) {
          finish(error);
        }
      };
      attempt();
    });
  }

  function writeStorageValue(storageArea, chromeApi, key, value) {
    return writeStorageValues(storageArea, chromeApi, { [key]: value })
      .then(() => value);
  }

  const storageReadPrefetches = new WeakMap();

  // Starts a read before the page's scripts have loaded. The batch created later for the same area
  // takes the result when it covers every requested key and none of them changed in the meantime.
  function prefetchStorageRead(area, keys, chromeApi) {
    const onChanged = chromeApi && chromeApi.storage && chromeApi.storage.onChanged;
    if (!area || typeof area.get !== 'function' || !Array.isArray(keys) || !keys.length ||
        !onChanged || typeof onChanged.addListener !== 'function') {
      return false;
    }
    const keySet = new Set(keys.map(String));
    const prefetch = { keys: keySet, stale: false, result: null, release: null };
    const markStale = (changes) => {
      if (Object.keys(changes || {}).some((key) => keySet.has(key))) prefetch.stale = true;
    };
    onChanged.addListener(markStale);
    prefetch.release = () => {
      if (typeof onChanged.removeListener === 'function') onChanged.removeListener(markStale);
    };
    prefetch.result = new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value && typeof value === 'object' ? value : null);
      };
      try {
        const maybePromise = area.get(Array.from(keySet), finish);
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.then(finish, () => finish(null));
        }
      } catch (_error) {
        finish(null);
      }
    });
    storageReadPrefetches.set(area, prefetch);
    return true;
  }

  function createStorageReadBatch(area) {
    if (!area || typeof area.get !== 'function') {
      return null;
    }
    let acceptingReads = true;
    let flushScheduled = false;
    let includesAllKeys = false;
    let requests = [];
    const requestedKeys = new Set();
    let resolveReady = null;
    const ready = new Promise((resolve) => {
      resolveReady = resolve;
    });

    function collectRequestKeys(keys) {
      if (keys === null || typeof keys === 'undefined') {
        includesAllKeys = true;
        return;
      }
      if (typeof keys === 'string') {
        requestedKeys.add(keys);
        return;
      }
      if (Array.isArray(keys)) {
        keys.forEach((key) => requestedKeys.add(String(key)));
        return;
      }
      if (typeof keys === 'object') {
        Object.keys(keys).forEach((key) => requestedKeys.add(key));
      }
    }

    function selectRequestResult(source, keys) {
      const values = source && typeof source === 'object' ? source : {};
      if (keys === null || typeof keys === 'undefined') {
        return values;
      }
      if (typeof keys === 'object' && !Array.isArray(keys)) {
        const result = { ...keys };
        Object.keys(keys).forEach((key) => {
          if (Object.prototype.hasOwnProperty.call(values, key)) {
            result[key] = values[key];
          }
        });
        return result;
      }
      const list = Array.isArray(keys) ? keys : [keys];
      const result = {};
      list.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(values, key)) {
          result[key] = values[key];
        }
      });
      return result;
    }

    function flush() {
      if (!acceptingReads) {
        return;
      }
      acceptingReads = false;
      flushScheduled = false;
      const pending = requests;
      requests = [];
      const keys = includesAllKeys ? null : Array.from(requestedKeys);
      let settled = false;
      const finish = (rawResult) => {
        if (settled) {
          return;
        }
        settled = true;
        const result = rawResult && typeof rawResult === 'object' ? rawResult : {};
        const callbackErrors = [];
        pending.forEach((request) => {
          const selected = selectRequestResult(result, request.keys);
          try {
            if (request.callback) {
              request.callback(selected);
            } else if (request.resolve) {
              request.resolve(selected);
            }
          } catch (error) {
            callbackErrors.push(error);
          }
        });
        resolveReady(Object.freeze({
          keys: keys === null ? null : Object.freeze(keys.slice()),
          keyCount: keys === null ? null : keys.length,
          requestCount: pending.length,
          underlyingReadCount: 1
        }));
        callbackErrors.forEach((error) => {
          Promise.resolve().then(() => {
            throw error;
          });
        });
      };
      const readArea = () => {
        try {
          const maybePromise = area.get(keys, finish);
          if (maybePromise && typeof maybePromise.then === 'function') {
            maybePromise.then(finish).catch(() => finish({}));
          }
        } catch (error) {
          finish({});
        }
      };
      const prefetch = storageReadPrefetches.get(area);
      storageReadPrefetches.delete(area);
      if (!prefetch) {
        readArea();
        return;
      }
      if (keys === null || !keys.every((key) => prefetch.keys.has(key))) {
        prefetch.release();
        readArea();
        return;
      }
      prefetch.result.then((value) => {
        prefetch.release();
        if (value && !prefetch.stale) finish(value);
        else readArea();
      });
    }

    function get(keys, callback) {
      if (typeof keys === 'function' && typeof callback === 'undefined') {
        callback = keys;
        keys = null;
      }
      if (!acceptingReads) {
        return area.get(keys, callback);
      }
      let resolveRequest = null;
      const promise = typeof callback === 'function'
        ? undefined
        : new Promise((resolve) => {
            resolveRequest = resolve;
          });
      requests.push({
        callback: typeof callback === 'function' ? callback : null,
        keys,
        resolve: resolveRequest
      });
      collectRequestKeys(keys);
      if (!flushScheduled) {
        flushScheduled = true;
        Promise.resolve().then(flush);
      }
      return promise;
    }

    function invoke(method, args) {
      if (typeof area[method] !== 'function') {
        return undefined;
      }
      return area[method](...args);
    }

    return Object.freeze({
      area: Object.freeze({
        clear(...args) { return invoke('clear', args); },
        get,
        remove(...args) { return invoke('remove', args); },
        set(...args) { return invoke('set', args); }
      }),
      flush,
      ready
    });
  }

  const providerStorageRuntimes = new WeakMap();

  // Reading the local-primary flag picks the area every setting comes from,
  // so a failed read is retried instead of silently choosing browser sync.
  const MODE_READ_RETRY_DELAYS_MS = [100, 400, 1600];

  function createProviderStorageRuntime(chromeApi, options) {
    if (chromeApi && providerStorageRuntimes.has(chromeApi)) {
      return providerStorageRuntimes.get(chromeApi);
    }
    const storage = chromeApi && chromeApi.storage ? chromeApi.storage : null;
    const syncArea = storage && storage.sync ? storage.sync : null;
    const localArea = storage && storage.local ? storage.local : syncArea;
    const retryDelayMs = getStorageRetryDelay(options);
    const modeRetryDelays = options && Array.isArray(options.modeRetryDelaysMs)
      ? options.modeRetryDelaysMs : MODE_READ_RETRY_DELAYS_MS;
    let activeAreaName = syncArea ? 'sync' : (localArea ? 'local' : '');
    let observedModeChange = false;
    let modeKnown = true;
    const modeReady = new Promise((resolve) => {
      if (!localArea || typeof localArea.get !== 'function') {
        resolve(activeAreaName);
        return;
      }
      const readMode = (attempt) => {
        let settled = false;
        const finish = (result, error) => {
          if (settled) return;
          settled = true;
          const lastError = error || (chromeApi && chromeApi.runtime && chromeApi.runtime.lastError);
          if (lastError && !observedModeChange) {
            if (attempt < modeRetryDelays.length) {
              setTimeout(() => readMode(attempt + 1), modeRetryDelays[attempt]);
              return;
            }
            // Still unreadable: keep the default, but say so, so callers that
            // would copy settings elsewhere can refuse instead of guessing.
            modeKnown = false;
            try { console.warn('[Lumno] Could not read the settings storage mode.', lastError); } catch (_error) { /* ignore */ }
          }
          if (!lastError && !observedModeChange && result && result[LOCAL_PRIMARY_STORAGE_KEY] === true) activeAreaName = 'local';
          resolve(activeAreaName);
        };
        try {
          const pending = localArea.get([LOCAL_PRIMARY_STORAGE_KEY], (result) => finish(result));
          if (pending && typeof pending.then === 'function') {
            pending.then((result) => finish(result)).catch((error) => finish(null, error || new Error('storage-read-failed')));
          }
        } catch (error) { finish(null, error); }
      };
      readMode(0);
    });
    const onChanged = storage && storage.onChanged;
    if (onChanged && typeof onChanged.addListener === 'function') {
      onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes[LOCAL_PRIMARY_STORAGE_KEY]) {
          observedModeChange = true;
          modeKnown = true;
          activeAreaName = changes[LOCAL_PRIMARY_STORAGE_KEY].newValue === true
            ? 'local' : (syncArea ? 'sync' : 'local');
        }
      });
    }

    function getActiveArea() {
      return activeAreaName === 'local' ? localArea : (syncArea || localArea);
    }

    // The latest write of each key, so a refused write that a newer one has
    // replaced is not retried over it.
    let writeSequence = 0;
    const latestWrites = new Map();
    function writtenKeys(method, values) {
      if (method === 'set') return Object.keys(values[0] && typeof values[0] === 'object' ? values[0] : {});
      if (method === 'remove') return (Array.isArray(values[0]) ? values[0] : [values[0]]).map(String);
      return [];
    }

    // A callback receives the storage error as its second argument (Chrome
    // also leaves it in runtime.lastError while the callback runs); without a
    // callback the returned promise rejects. A write refused for exceeding
    // the sync write quota is retried once after the quota refills.
    function invoke(method, args) {
      const values = Array.from(args || []);
      const callback = typeof values[values.length - 1] === 'function' ? values.pop() : null;
      const isWrite = method === 'set' || method === 'remove';
      const keys = isWrite ? writtenKeys(method, values) : [];
      const sequence = ++writeSequence;
      keys.forEach((key) => latestWrites.set(key, sequence));
      return modeReady.then(() => new Promise((resolve, reject) => {
        const area = getActiveArea();
        if (!area || typeof area[method] !== 'function') {
          if (callback) callback(method === 'get' ? {} : undefined);
          resolve(method === 'get' ? {} : undefined);
          return;
        }
        let retried = false;
        const complete = (result, error) => {
          if (callback) callback(result, error || undefined);
          if (error && callback && isWrite) {
            try { console.warn('[Lumno] Could not save settings.', error); } catch (_error) { /* ignore */ }
          }
          if (error && !callback) reject(error);
          else resolve(result);
        };
        const attempt = () => {
          let settled = false;
          const finish = (result, failure) => {
            if (settled) return;
            settled = true;
            const lastError = failure || (chromeApi && chromeApi.runtime && chromeApi.runtime.lastError);
            if (lastError && isWrite && !retried && isStorageRateLimitError(lastError)) {
              retried = true;
              if (keys.length && keys.every((key) => latestWrites.get(key) > sequence)) {
                // A newer write carries every value; report this one once the
                // refusal has left runtime.lastError.
                Promise.resolve().then(() => complete(undefined, null));
                return;
              }
              setTimeout(attempt, retryDelayMs);
              return;
            }
            complete(result, lastError
              ? (lastError instanceof Error ? lastError : new Error(lastError.message || 'Storage operation failed'))
              : null);
          };
          try {
            const maybePromise = area[method](...values, (result) => finish(result));
            if (maybePromise && typeof maybePromise.then === 'function') {
              maybePromise.then((result) => finish(result))
                .catch((error) => finish(undefined, error || new Error('Storage operation failed')));
            }
          } catch (error) {
            if (!settled) {
              settled = true;
              reject(error);
            }
          }
        };
        attempt();
      }));
    }

    const area = Object.freeze({
      get(...args) { return invoke('get', args); },
      set(...args) { return invoke('set', args); },
      remove(...args) { return invoke('remove', args); },
      clear(...args) { return invoke('clear', args); }
    });
    rateLimitRetryingAreas.add(area);

    const runtime = Object.freeze({
      area,
      get name() { return activeAreaName; },
      ready: modeReady,
      getActiveAreaName() { return activeAreaName; },
      isActiveAreaName(areaName) { return String(areaName || '') === activeAreaName; },
      // False only when the mode could not be read at all; the active area is
      // then the default, not a choice the user made.
      isModeKnown() { return modeKnown; }
    });
    if (chromeApi) providerStorageRuntimes.set(chromeApi, runtime);
    return runtime;
  }

  // The area provider-scoped settings live in, plus the runtime that tracks
  // it. The runtime always exists (it falls back to local storage when sync
  // is missing), so callers need no sync/local fallback chain of their own.
  // areaName is the name at the time of the call; ask the runtime for the
  // current one once local-primary mode may have been read.
  function getProviderStorage(chromeApi) {
    const runtime = createProviderStorageRuntime(chromeApi);
    return Object.freeze({
      runtime,
      area: runtime.area,
      areaName: runtime.name
    });
  }

  function addStorageChangeListener(chromeApi, listener) {
    const onChanged = chromeApi && chromeApi.storage && chromeApi.storage.onChanged;
    if (!onChanged || typeof onChanged.addListener !== 'function' ||
        typeof listener !== 'function') {
      return false;
    }
    onChanged.addListener(listener);
    return true;
  }

  return Object.freeze({
    LOCAL_PRIMARY_STORAGE_KEY,
    WEBDAV_STATUS_STORAGE_KEY,
    WEBDAV_CONNECTIONS_SYNC_STORAGE_KEY,
    WEBDAV_DISMISSED_CONNECTIONS_STORAGE_KEY,
    ASSET_REVISION_STORAGE_KEY,
    THEME_STORAGE_KEY,
    LANGUAGE_STORAGE_KEY,
    RECENT_MODE_STORAGE_KEY,
    RECENT_COUNT_STORAGE_KEY,
    NEWTAB_WIDTH_MODE_STORAGE_KEY,
    NEWTAB_SEARCH_WIDTH_STORAGE_KEY,
    NEWTAB_ZEN_MODE_STORAGE_KEY,
    NEWTAB_WALLPAPER_STORAGE_KEY,
    NEWTAB_WALLPAPER_OVERLAY_STORAGE_KEY,
    NEWTAB_WALLPAPER_EFFECT_STORAGE_KEY,
    NEWTAB_FAVICON_STORAGE_KEY,
    OVERLAY_SIZE_MODE_STORAGE_KEY,
    BOOKMARK_COUNT_STORAGE_KEY,
    BOOKMARK_COLUMNS_STORAGE_KEY,
    BOOKMARK_VIEW_MODE_STORAGE_KEY,
    PINNED_RECENT_SITES_STORAGE_KEY,
    HIDDEN_RECENT_SITES_STORAGE_KEY,
    NEWTAB_SHORTCUTS_STORAGE_KEY,
    AUTO_PIP_ENABLED_STORAGE_KEY,
    TAB_SWITCHER_ENABLED_STORAGE_KEY,
    DOCUMENT_PIP_ENABLED_STORAGE_KEY,
    PINNED_TAB_RECOVERY_ENABLED_STORAGE_KEY,
    OVERLAY_TAB_PRIORITY_STORAGE_KEY,
    RESTRICTED_ACTION_STORAGE_KEY,
    SEARCH_RESULT_PRIORITY_STORAGE_KEY,
    SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY,
    FALLBACK_SHORTCUT_STORAGE_KEY,
    SITE_SEARCH_STORAGE_KEY,
    SITE_SEARCH_DISABLED_STORAGE_KEY,
    SEARCH_BLACKLIST_STORAGE_KEY,
    FAVICON_REQUEST_BLACKLIST_STORAGE_KEY,
    DEFAULT_SEARCH_ENGINE_STORAGE_KEY,
    SYNC_META_STORAGE_KEY,
    RESTRICTED_ACTION_AUTO_BROWSER_SETTING_DONE_STORAGE_KEY,
    OPTIONS_THEME_PRELOAD_STORAGE_KEY,
    NEWTAB_THEME_MODE_STORAGE_KEY,
    NEWTAB_THEME_SCOPE_STORAGE_KEY,
    NEWTAB_SHORTCUTS_VISIBLE_STORAGE_KEY,
    NEWTAB_SHORTCUTS_CHUNK_2_STORAGE_KEY,
    NEWTAB_SHORTCUTS_CHUNK_3_STORAGE_KEY,
    NEWTAB_SHORTCUTS_V2_STORAGE_KEYS,
    migrateLocalSettingsToSync,
    NEWTAB_SHORTCUT_ADD_VISIBLE_STORAGE_KEY,
    NEWTAB_SHORTCUT_DOCK_MAGNIFICATION_ENABLED_STORAGE_KEY,
    NEWTAB_FEEDBACK_BUTTON_VISIBLE_STORAGE_KEY,
    NEWTAB_APPEARANCE_BUTTON_VISIBLE_STORAGE_KEY,
    NEWTAB_SHORTCUT_WIDTH_STORAGE_KEY,
    NEWTAB_SHORTCUT_WIDTH_MIN,
    NEWTAB_SHORTCUT_WIDTH_MAX,
    NEWTAB_SHORTCUT_WIDTH_DEFAULT,
    NEWTAB_SHORTCUT_COLUMNS_STORAGE_KEY,
    NEWTAB_SHORTCUT_COLUMNS_MIN,
    NEWTAB_SHORTCUT_COLUMNS_MAX,
    NEWTAB_SHORTCUT_COLUMNS_DEFAULT,
    NEWTAB_SHORTCUT_SIZE_STORAGE_KEY,
    NEWTAB_SHORTCUT_SIZE_MIN,
    NEWTAB_SHORTCUT_SIZE_MAX,
    NEWTAB_SHORTCUT_SIZE_DEFAULT,
    NEWTAB_SHORTCUT_GAP_STORAGE_KEY,
    NEWTAB_SHORTCUT_GAP_MIN,
    NEWTAB_SHORTCUT_GAP_MAX,
    NEWTAB_SHORTCUT_GAP_DEFAULT,
    NEWTAB_INPUT_AUTO_FOCUS_ENABLED_STORAGE_KEY,
    NEWTAB_OPEN_IN_NEW_TAB_STORAGE_KEY,
    NEWTAB_OPEN_IN_NEW_TAB_SURFACES,
    NEWTAB_STARTUP_STORAGE_KEYS_CACHE_KEY,
    NEWTAB_INPUT_AUTO_FOCUS_CACHE_KEY,
    NEWTAB_LOCALE_CACHE_KEY,
    NEWTAB_QUOTE_PREFS_STORAGE_KEY,
    NEWTAB_ONLINE_WALLPAPER_STORAGE_KEY,
    NEWTAB_LINK_WALLPAPERS_STORAGE_KEY,
    NEWTAB_DAILY_WALLPAPER_PICKS_STORAGE_KEY,
    NEWTAB_QUOTE_FONT_SIZE_MIN,
    NEWTAB_QUOTE_FONT_SIZE_MAX,
    NEWTAB_QUOTE_FONT_SIZE_DEFAULT,
    BOOKMARK_FOLDER_ICONS_VISIBLE_STORAGE_KEY,
    BOOKMARK_FOLDER_COLOR_REFS_STORAGE_KEY,
    BOOKMARK_FOLDER_COLOR_PRESETS_STORAGE_KEY,
    UPDATE_NOTICE_ENABLED_STORAGE_KEY,
    MOTION_EFFECTS_ENABLED_STORAGE_KEY,
    SIMPLE_MODE_ENABLED_STORAGE_KEY,
    NUMBER_SHORTCUT_INSTANT_ENABLED_STORAGE_KEY,
    MACOS_CTRL_SUGGESTION_NAVIGATION_ENABLED_STORAGE_KEY,
    FAVICON_ENHANCED_FETCH_ENABLED_STORAGE_KEY,
    SEARCH_RESULT_DISPLAY_LIMIT_STORAGE_KEY,
    SEARCH_RESULT_TAB_POSITION_STORAGE_KEY,
    OVERLAY_OPEN_TABS_DEFAULT_VISIBLE_STORAGE_KEY,
    OVERLAY_ENTER_ANIMATION_STORAGE_KEY,
    OVERLAY_PAGE_THEME_ADAPTATION_ENABLED_STORAGE_KEY,
    SELECTION_QUICK_ACTIONS_ENABLED_STORAGE_KEY,
    SELECTION_QUICK_ACTIONS_PROVIDER_STORAGE_KEY,
    SELECTION_QUICK_ACTIONS_GROUP_ENABLED_STORAGE_KEY,
    AGGREGATE_SEARCH_STORAGE_KEY,
    AGGREGATE_SEARCH_AUTO_GROUP_ENABLED_STORAGE_KEY,
    SEARCH_SOURCE_ORDER_STORAGE_KEY,
    PROGRESS_TRACKING_ENABLED_STORAGE_KEY,
    BOOKMARK_TOPBAR_LOCAL_STORAGE_KEYS,
    BOOKMARK_TOPBAR_WEBDAV_STORAGE_KEYS,
    CHROME_SYNC_STORAGE_KEYS,
    SELECTION_QUICK_ACTIONS_PROVIDER_KEYS,
    NEWTAB_TOP_CONTENT_MODE_STORAGE_KEY,
    NEWTAB_TOP_CONTENT_BRAND,
    NEWTAB_TOP_CONTENT_TIME,
    NEWTAB_TOP_CONTENT_OFF,
    NEWTAB_TIME_FONT_WEIGHT_STORAGE_KEY,
    NEWTAB_TIME_FONT_WEIGHT_MIN,
    NEWTAB_TIME_FONT_WEIGHT_MAX,
    NEWTAB_TIME_FONT_WEIGHT_DEFAULT,
    NEWTAB_TIME_SECONDS_VISIBLE_STORAGE_KEY,
    normalizeLocale,
    localeToHtmlLang,
    normalizeNewtabWidthMode,
    normalizeNewtabSearchWidth,
    normalizeNewtabTopContentMode,
    normalizeNewtabQuotePrefs,
    normalizeNewtabWordmarkVisible,
    normalizeNewtabTimeFontWeight,
    normalizeNewtabTimeSecondsVisible,
    normalizeNewtabShortcutsVisible,
    normalizeNewtabShortcutAddVisible,
    normalizeNewtabShortcutDockMagnificationEnabled,
    normalizeNewtabFeedbackButtonVisible,
    normalizeNewtabAppearanceButtonVisible,
    normalizeNewtabShortcutWidth,
    normalizeNewtabShortcutColumns,
    normalizeNewtabShortcutSize,
    normalizeNewtabShortcutGap,
    inferNewtabShortcutColumnsFromWidth,
    normalizeNewtabInputAutoFocusEnabled,
    cacheNewtabInputAutoFocusEnabled,
    cacheNewtabLocale,
    normalizeNewtabOpenInNewTab,
    normalizeBookmarkCount,
    normalizeBookmarkColumns,
    normalizeBookmarkFolderIconsVisible,
    normalizeUpdateNoticeEnabled,
    normalizeMotionEffectsEnabled,
    normalizeSimpleModeEnabled,
    normalizeNumberShortcutInstantEnabled,
    normalizeMacosCtrlSuggestionNavigationEnabled,
    shouldSkipEntryMotion,
    normalizeFaviconEnhancedFetchEnabled,
    normalizeOverlayOpenTabsDefaultVisible,
    normalizeOverlayPageThemeAdaptationEnabled,
    normalizeOverlaySizeMode,
    normalizeOverlayEnterAnimation,
    normalizeOverlayTabPriorityMode,
    normalizeSearchResultPriority,
    normalizeSearchResultTabPosition,
    normalizeSearchResultDisplayLimit,
    normalizeSearchResultSourceTypes,
    normalizeTabRankScoreDebugMode,
    normalizeTabSwitcherEnabled,
    normalizeSelectionQuickActionsEnabled,
    normalizeSelectionQuickActionsProvider,
    normalizeSelectionQuickActionsGroupEnabled,
    normalizeAggregateSearchAutoGroupEnabled,
    normalizeProgressTrackingEnabled,
    normalizeThemePreference,
    normalizeThemeMode,
    createGlobalThemeModeStorageUpdate,
    readStorageValue,
    writeStorageValue,
    writeStorageValues,
    isStorageRateLimitError,
    createStorageReadBatch,
    prefetchStorageRead,
    createProviderStorageRuntime,
    getProviderStorage,
    addStorageChangeListener
  });
});

