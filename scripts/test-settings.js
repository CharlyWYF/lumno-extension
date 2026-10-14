const assert = require('assert');
const settings = require('../src/shared/settings.js');

let registeredStorageListener = null;
const storageListener = () => {};
assert.strictEqual(settings.addStorageChangeListener({
  storage: {
    onChanged: {
      addListener(listener) {
        registeredStorageListener = listener;
      }
    }
  }
}, storageListener), true);
assert.strictEqual(registeredStorageListener, storageListener);
assert.strictEqual(settings.addStorageChangeListener(null, storageListener), false);
assert.strictEqual(settings.addStorageChangeListener({ storage: {} }, storageListener), false);
assert.strictEqual(settings.addStorageChangeListener({
  storage: { onChanged: { addListener() {} } }
}, null), false);

assert.strictEqual(settings.CHROME_SYNC_STORAGE_KEYS.length, 78);
assert(settings.CHROME_SYNC_STORAGE_KEYS.includes(settings.NEWTAB_SURFACE_TRANSPARENCY_STORAGE_KEY));
assert.strictEqual(
  new Set(settings.CHROME_SYNC_STORAGE_KEYS).size,
  settings.CHROME_SYNC_STORAGE_KEYS.length
);
assert(settings.CHROME_SYNC_STORAGE_KEYS.includes('_x_extension_language_2024_unique_'));
assert(settings.CHROME_SYNC_STORAGE_KEYS.includes('_x_extension_motion_effects_enabled_2026_unique_'));
assert(settings.CHROME_SYNC_STORAGE_KEYS.includes('_x_extension_simple_mode_enabled_2026_unique_'));
assert(settings.CHROME_SYNC_STORAGE_KEYS.includes('_x_extension_number_shortcut_instant_enabled_2026_unique_'));
assert(settings.CHROME_SYNC_STORAGE_KEYS.includes('_x_extension_macos_ctrl_suggestion_navigation_enabled_2026_unique_'));
assert(settings.CHROME_SYNC_STORAGE_KEYS.includes('_x_extension_overlay_page_theme_adaptation_enabled_2026_unique_'));
assert(settings.CHROME_SYNC_STORAGE_KEYS.includes('_x_extension_newtab_input_auto_focus_enabled_2026_unique_'));
assert(settings.CHROME_SYNC_STORAGE_KEYS.includes(settings.NEWTAB_FEEDBACK_BUTTON_VISIBLE_STORAGE_KEY));
assert(settings.CHROME_SYNC_STORAGE_KEYS.includes(settings.NEWTAB_APPEARANCE_BUTTON_VISIBLE_STORAGE_KEY));
assert(settings.CHROME_SYNC_STORAGE_KEYS.includes('_x_extension_newtab_time_font_weight_2026_unique_'));
assert(settings.CHROME_SYNC_STORAGE_KEYS.includes('_x_extension_newtab_time_seconds_visible_2026_unique_'));
assert(settings.CHROME_SYNC_STORAGE_KEYS.includes('_x_extension_search_result_display_limit_2026_unique_'));
assert(settings.CHROME_SYNC_STORAGE_KEYS.includes(settings.AGGREGATE_SEARCH_STORAGE_KEY));
// Folder colors sync by bookmark path; the legacy id-keyed map stays device-only.
assert(settings.CHROME_SYNC_STORAGE_KEYS.includes(settings.BOOKMARK_FOLDER_COLOR_REFS_STORAGE_KEY));
assert(settings.CHROME_SYNC_STORAGE_KEYS.includes(settings.BOOKMARK_FOLDER_COLOR_PRESETS_STORAGE_KEY));
assert(!settings.CHROME_SYNC_STORAGE_KEYS.includes('_x_extension_bookmark_folder_colors_2026_unique_'));
assert(settings.CHROME_SYNC_STORAGE_KEYS.includes(
  settings.AGGREGATE_SEARCH_AUTO_GROUP_ENABLED_STORAGE_KEY
));
assert.strictEqual(settings.normalizeAggregateSearchAutoGroupEnabled(undefined), true);
assert.strictEqual(settings.normalizeAggregateSearchAutoGroupEnabled(false), false);
assert.strictEqual(settings.normalizeAggregateSearchAutoGroupEnabled(true), true);
assert(settings.CHROME_SYNC_STORAGE_KEYS.includes('_x_extension_bookmark_view_mode_2026_unique_'));
assert(settings.CHROME_SYNC_STORAGE_KEYS.includes(settings.NEWTAB_SHORTCUTS_CHUNK_2_STORAGE_KEY));
assert(settings.CHROME_SYNC_STORAGE_KEYS.includes(settings.NEWTAB_SHORTCUTS_CHUNK_3_STORAGE_KEY));
// The bookmark bar material syncs through WebDAV only, without the migrated legacy color.
assert.deepStrictEqual(settings.BOOKMARK_TOPBAR_WEBDAV_STORAGE_KEYS, settings.BOOKMARK_TOPBAR_LOCAL_STORAGE_KEYS.slice(0, 3));
assert(!settings.CHROME_SYNC_STORAGE_KEYS.includes('_x_extension_bookmark_topbar_surface_mode_2026_unique_'));
assert(!settings.CHROME_SYNC_STORAGE_KEYS.includes('_x_extension_bookmark_topbar_surface_color_light_2026_unique_'));
assert(!settings.CHROME_SYNC_STORAGE_KEYS.includes('_x_extension_bookmark_topbar_surface_color_dark_2026_unique_'));
assert.deepStrictEqual(settings.BOOKMARK_TOPBAR_LOCAL_STORAGE_KEYS, [
  '_x_extension_bookmark_topbar_surface_mode_2026_unique_',
  '_x_extension_bookmark_topbar_surface_color_light_2026_unique_',
  '_x_extension_bookmark_topbar_surface_color_dark_2026_unique_',
  '_x_extension_bookmark_topbar_surface_color_2026_unique_'
]);
assert(settings.CHROME_SYNC_STORAGE_KEYS.includes('_x_extension_selection_quick_actions_group_enabled_2026_unique_'));
assert(!settings.CHROME_SYNC_STORAGE_KEYS.includes('_x_extension_selection_quick_actions_trigger_style_2026_unique_'));
assert(!settings.CHROME_SYNC_STORAGE_KEYS.includes('_x_extension_selection_quick_actions_icon_set_2026_unique_'));
assert(!settings.CHROME_SYNC_STORAGE_KEYS.includes('_x_extension_language_messages_2024_unique_'));
assert(!settings.CHROME_SYNC_STORAGE_KEYS.includes('_x_extension_newtab_local_wallpaper_2026_unique_'));
assert.strictEqual(settings.normalizeNewtabInputAutoFocusEnabled(undefined), false);
assert.strictEqual(settings.normalizeNewtabInputAutoFocusEnabled(true), true);
assert.strictEqual(settings.normalizeNewtabInputAutoFocusEnabled(false), false);
assert(settings.CHROME_SYNC_STORAGE_KEYS.includes(settings.NEWTAB_OPEN_IN_NEW_TAB_STORAGE_KEY));
assert.deepStrictEqual(settings.normalizeNewtabOpenInNewTab(undefined), {
  search: false,
  shortcuts: false,
  bookmarks: false,
  recentSites: false
});
assert.deepStrictEqual(settings.normalizeNewtabOpenInNewTab({ search: true, bookmarks: 'true', extra: true }), {
  search: true,
  shortcuts: false,
  bookmarks: false,
  recentSites: false
});
assert.deepStrictEqual(settings.normalizeNewtabOpenInNewTab(['search']), {
  search: false,
  shortcuts: false,
  bookmarks: false,
  recentSites: false
});
assert.strictEqual(settings.normalizeSimpleModeEnabled(undefined), false);
assert.strictEqual(settings.normalizeSimpleModeEnabled(false), false);
assert.strictEqual(settings.normalizeSimpleModeEnabled(true), true);
assert.strictEqual(settings.normalizeSimpleModeEnabled('true'), false);

assert.strictEqual(settings.normalizeLocale(''), 'en');
assert.strictEqual(settings.normalizeLocale('en-US'), 'en');
assert.strictEqual(settings.normalizeLocale('ja-JP'), 'ja');
assert.strictEqual(settings.normalizeLocale('zh-CN'), 'zh_CN');
assert.strictEqual(settings.normalizeLocale('zh-HK'), 'zh_TW');
assert.strictEqual(settings.normalizeLocale('zh-Hant-TW'), 'zh_TW');
assert.strictEqual(settings.localeToHtmlLang('en-US'), 'en');
assert.strictEqual(settings.localeToHtmlLang('ja-JP'), 'ja');
assert.strictEqual(settings.localeToHtmlLang('zh-CN'), 'zh-CN');
assert.strictEqual(settings.localeToHtmlLang('zh-HK'), 'zh-TW');

assert.strictEqual(settings.normalizeNewtabWidthMode('standard'), 'standard');
assert.strictEqual(settings.normalizeNewtabWidthMode('wide'), 'wide');
assert.strictEqual(settings.normalizeNewtabWidthMode('other'), 'wide');

assert.strictEqual(settings.normalizeNewtabSearchWidth(719), 720);
assert.strictEqual(settings.normalizeNewtabSearchWidth(920), 920);
assert.strictEqual(settings.normalizeNewtabSearchWidth(1200), 1040);
assert.strictEqual(settings.normalizeNewtabSearchWidth(undefined), 920);
assert.strictEqual(settings.normalizeNewtabSearchWidth(undefined, { allowNull: true }), null);
assert.strictEqual(settings.normalizeNewtabSearchWidth(639, { min: 640, max: 1040, fallback: 920 }), 640);
assert.strictEqual(settings.normalizeNewtabSearchWidth(680, { min: 640, max: 1040, fallback: 920 }), 680);

assert.strictEqual(settings.normalizeNewtabWordmarkVisible(false), false);
assert.strictEqual(settings.normalizeNewtabWordmarkVisible(true), true);
assert.strictEqual(settings.normalizeNewtabWordmarkVisible(undefined), true);
assert.strictEqual(settings.normalizeNewtabWordmarkVisible('time'), true);
assert.strictEqual(settings.normalizeNewtabWordmarkVisible('off'), false);
assert.strictEqual(settings.normalizeNewtabTopContentMode(false), 'off');
assert.strictEqual(settings.normalizeNewtabTopContentMode(true), 'brand');
assert.strictEqual(settings.normalizeNewtabTopContentMode('brand'), 'brand');
assert.strictEqual(settings.normalizeNewtabTopContentMode('time'), 'time');
assert.strictEqual(settings.normalizeNewtabTopContentMode('off'), 'off');
assert.strictEqual(settings.normalizeNewtabTopContentMode(undefined), 'brand');
assert.strictEqual(
  settings.NEWTAB_TOP_CONTENT_MODE_STORAGE_KEY,
  '_x_extension_newtab_wordmark_visible_2026_unique_'
);
assert.strictEqual(settings.NEWTAB_TIME_FONT_WEIGHT_MIN, 300);
assert.strictEqual(settings.NEWTAB_TIME_FONT_WEIGHT_MAX, 800);
assert.strictEqual(settings.NEWTAB_TIME_FONT_WEIGHT_DEFAULT, 320);
assert.strictEqual(settings.normalizeNewtabTimeFontWeight(undefined), 320);
assert.strictEqual(settings.normalizeNewtabTimeFontWeight(299), 300);
assert.strictEqual(settings.normalizeNewtabTimeFontWeight(320), 320);
assert.strictEqual(settings.normalizeNewtabTimeFontWeight('537'), 537);
assert.strictEqual(settings.normalizeNewtabTimeFontWeight(801), 800);
assert.strictEqual(
  settings.NEWTAB_TIME_FONT_WEIGHT_STORAGE_KEY,
  '_x_extension_newtab_time_font_weight_2026_unique_'
);
assert.strictEqual(settings.normalizeNewtabTimeSecondsVisible(undefined), false);
assert.strictEqual(settings.normalizeNewtabTimeSecondsVisible(false), false);
assert.strictEqual(settings.normalizeNewtabTimeSecondsVisible(true), true);
assert.strictEqual(settings.normalizeNewtabTimeSecondsVisible('true'), false);
assert.strictEqual(
  settings.NEWTAB_TIME_SECONDS_VISIBLE_STORAGE_KEY,
  '_x_extension_newtab_time_seconds_visible_2026_unique_'
);

assert.strictEqual(settings.normalizeNewtabShortcutsVisible(false), false);
assert.strictEqual(settings.normalizeNewtabShortcutsVisible(true), true);
assert.strictEqual(settings.normalizeNewtabShortcutsVisible(undefined), true);
assert.strictEqual(settings.normalizeNewtabShortcutsVisible('false'), true);

assert.strictEqual(settings.normalizeNewtabShortcutAddVisible(false), false);
assert.strictEqual(settings.normalizeNewtabShortcutAddVisible(true), true);
assert.strictEqual(settings.normalizeNewtabShortcutAddVisible(undefined), true);
assert.strictEqual(settings.normalizeNewtabShortcutAddVisible('false'), true);
assert.strictEqual(
  settings.NEWTAB_SHORTCUT_ADD_VISIBLE_STORAGE_KEY,
  '_x_extension_newtab_shortcut_add_visible_2026_unique_'
);

assert.strictEqual(settings.normalizeNewtabShortcutDockMagnificationEnabled(false), false);
assert.strictEqual(settings.normalizeNewtabShortcutDockMagnificationEnabled(true), true);
assert.strictEqual(settings.normalizeNewtabShortcutDockMagnificationEnabled(undefined), true);
assert.strictEqual(settings.normalizeNewtabShortcutDockMagnificationEnabled('false'), true);
assert.strictEqual(
  settings.NEWTAB_SHORTCUT_DOCK_MAGNIFICATION_ENABLED_STORAGE_KEY,
  '_x_extension_newtab_shortcut_dock_magnification_enabled_2026_unique_'
);
[
  [
    settings.NEWTAB_FEEDBACK_BUTTON_VISIBLE_STORAGE_KEY,
    '_x_extension_newtab_feedback_button_visible_2026_unique_',
    settings.normalizeNewtabFeedbackButtonVisible
  ],
  [
    settings.NEWTAB_APPEARANCE_BUTTON_VISIBLE_STORAGE_KEY,
    '_x_extension_newtab_appearance_button_visible_2026_unique_',
    settings.normalizeNewtabAppearanceButtonVisible
  ]
].forEach(([storageKey, expectedStorageKey, normalize]) => {
  assert.strictEqual(storageKey, expectedStorageKey);
  assert.strictEqual(normalize(false), false);
  assert.strictEqual(normalize(true), true);
  assert.strictEqual(normalize(undefined), true);
  assert.strictEqual(normalize('false'), true);
});
assert.strictEqual(
  settings.NEWTAB_SHORTCUT_WIDTH_STORAGE_KEY,
  '_x_extension_newtab_shortcut_width_2026_unique_'
);
assert.strictEqual(settings.NEWTAB_SHORTCUT_WIDTH_MIN, 360);
assert.strictEqual(settings.NEWTAB_SHORTCUT_WIDTH_MAX, 1440);
assert.strictEqual(settings.NEWTAB_SHORTCUT_WIDTH_DEFAULT, 920);
assert.strictEqual(settings.normalizeNewtabShortcutWidth(undefined), 920);
assert.strictEqual(settings.normalizeNewtabShortcutWidth(359), 360);
assert.strictEqual(settings.normalizeNewtabShortcutWidth(920), 920);
assert.strictEqual(settings.normalizeNewtabShortcutWidth(1441), 1440);
assert.strictEqual(settings.normalizeNewtabShortcutWidth(720.5), 721);
assert.strictEqual(
  settings.NEWTAB_SHORTCUT_COLUMNS_STORAGE_KEY,
  '_x_extension_newtab_shortcut_columns_2026_unique_'
);
assert.strictEqual(settings.NEWTAB_SHORTCUT_COLUMNS_MIN, 4);
assert.strictEqual(settings.NEWTAB_SHORTCUT_COLUMNS_MAX, 16);
assert.strictEqual(settings.NEWTAB_SHORTCUT_COLUMNS_DEFAULT, 10);
assert.strictEqual(settings.normalizeNewtabShortcutColumns(undefined), 10);
assert.strictEqual(settings.normalizeNewtabShortcutColumns(3), 4);
assert.strictEqual(settings.normalizeNewtabShortcutColumns(10.5), 11);
assert.strictEqual(settings.normalizeNewtabShortcutColumns(17), 16);
assert.strictEqual(settings.inferNewtabShortcutColumnsFromWidth(360), 4);
assert.strictEqual(settings.inferNewtabShortcutColumnsFromWidth(920), 10);
assert.strictEqual(settings.inferNewtabShortcutColumnsFromWidth(1440), 16);
assert.strictEqual(settings.NEWTAB_SHORTCUT_SIZE_MIN, 48);
assert.strictEqual(settings.NEWTAB_SHORTCUT_SIZE_MAX, 80);
assert.strictEqual(settings.NEWTAB_SHORTCUT_SIZE_DEFAULT, 64);
assert.strictEqual(settings.normalizeNewtabShortcutSize(undefined), 64);
assert.strictEqual(settings.normalizeNewtabShortcutSize(47), 48);
assert.strictEqual(settings.normalizeNewtabShortcutSize(81), 80);
assert.strictEqual(settings.NEWTAB_SHORTCUT_GAP_MIN, 0);
assert.strictEqual(settings.NEWTAB_SHORTCUT_GAP_MAX, 24);
assert.strictEqual(settings.NEWTAB_SHORTCUT_GAP_DEFAULT, 4);
assert.strictEqual(settings.normalizeNewtabShortcutGap(undefined), 4);
assert.strictEqual(settings.normalizeNewtabShortcutGap(-1), 0);
assert.strictEqual(settings.normalizeNewtabShortcutGap(25), 24);

assert.strictEqual(settings.normalizeBookmarkFolderIconsVisible(false), false);
assert.strictEqual(settings.normalizeBookmarkFolderIconsVisible(true), true);
assert.strictEqual(settings.normalizeBookmarkFolderIconsVisible(undefined), true);
assert.strictEqual(settings.normalizeBookmarkFolderIconsVisible('false'), true);
assert.strictEqual(settings.normalizeBookmarkCount(0), 0);
assert.strictEqual(settings.normalizeBookmarkCount(4), 4);
assert.strictEqual(settings.normalizeBookmarkCount(8), 8);
assert.strictEqual(settings.normalizeBookmarkCount(12), 12);
assert.strictEqual(settings.normalizeBookmarkCount(20), 20);
assert.strictEqual(settings.normalizeBookmarkCount(28), 28);
assert.strictEqual(settings.normalizeBookmarkCount(32), 32);
assert.strictEqual(settings.normalizeBookmarkCount(2), 8);
assert.strictEqual(settings.normalizeBookmarkCount(36), 8);
assert.strictEqual(settings.normalizeBookmarkCount(12.5), 8);
assert.strictEqual(settings.normalizeBookmarkColumns(4), 4);
assert.strictEqual(settings.normalizeBookmarkColumns('5'), 5);
assert.strictEqual(settings.normalizeBookmarkColumns(6), 6);
assert.strictEqual(settings.normalizeBookmarkColumns(7), 7);
assert.strictEqual(settings.normalizeBookmarkColumns(8), 8);
assert.strictEqual(settings.normalizeBookmarkColumns(3), 6);
assert.strictEqual(settings.normalizeBookmarkColumns(9), 6);
assert.strictEqual(settings.normalizeBookmarkColumns(5.5), 6);
assert.strictEqual(
  settings.BOOKMARK_FOLDER_ICONS_VISIBLE_STORAGE_KEY,
  '_x_extension_bookmark_folder_icons_visible_2026_unique_'
);

assert.strictEqual(settings.normalizeUpdateNoticeEnabled(false), false);
assert.strictEqual(settings.normalizeUpdateNoticeEnabled(true), true);
assert.strictEqual(settings.normalizeUpdateNoticeEnabled(undefined), true);
assert.strictEqual(settings.normalizeUpdateNoticeEnabled('false'), true);

assert.strictEqual(settings.normalizeMotionEffectsEnabled(false), false);
assert.strictEqual(settings.normalizeMotionEffectsEnabled(true), true);
assert.strictEqual(settings.normalizeMotionEffectsEnabled(undefined), true);
assert.strictEqual(settings.normalizeMotionEffectsEnabled('false'), true);
assert.strictEqual(settings.normalizeNumberShortcutInstantEnabled(false), false);
assert.strictEqual(settings.normalizeNumberShortcutInstantEnabled(true), true);
assert.strictEqual(settings.normalizeNumberShortcutInstantEnabled(undefined), false);
assert.strictEqual(settings.normalizeNumberShortcutInstantEnabled('true'), false);
assert.strictEqual(settings.normalizeMacosCtrlSuggestionNavigationEnabled(false), false);
assert.strictEqual(settings.normalizeMacosCtrlSuggestionNavigationEnabled(true), true);
assert.strictEqual(settings.normalizeMacosCtrlSuggestionNavigationEnabled(undefined), false);
assert.strictEqual(settings.normalizeMacosCtrlSuggestionNavigationEnabled('true'), false);
assert.strictEqual(
  settings.MACOS_CTRL_SUGGESTION_NAVIGATION_ENABLED_STORAGE_KEY,
  '_x_extension_macos_ctrl_suggestion_navigation_enabled_2026_unique_'
);
assert.strictEqual(settings.shouldSkipEntryMotion({
  matchMedia: () => ({ matches: false })
}, false), true);
assert.strictEqual(settings.shouldSkipEntryMotion({
  matchMedia: () => ({ matches: true })
}, true), true);
assert.strictEqual(settings.shouldSkipEntryMotion({
  matchMedia: () => ({ matches: false })
}, true), false);

assert.strictEqual(settings.normalizeFaviconEnhancedFetchEnabled(false), false);
assert.strictEqual(settings.normalizeFaviconEnhancedFetchEnabled(true), true);
assert.strictEqual(settings.normalizeFaviconEnhancedFetchEnabled(undefined), true);
assert.strictEqual(settings.normalizeFaviconEnhancedFetchEnabled('false'), true);

assert.strictEqual(settings.normalizeOverlayOpenTabsDefaultVisible(false), false);
assert.strictEqual(settings.normalizeOverlayOpenTabsDefaultVisible(true), true);
assert.strictEqual(settings.normalizeOverlayOpenTabsDefaultVisible(undefined), true);
assert.strictEqual(settings.normalizeOverlayOpenTabsDefaultVisible('false'), true);

assert.strictEqual(settings.normalizeOverlaySizeMode('compact'), 'compact');
assert.strictEqual(settings.normalizeOverlaySizeMode('large'), 'large');
assert.strictEqual(settings.normalizeOverlaySizeMode('standard'), 'standard');
assert.strictEqual(settings.normalizeOverlaySizeMode('other'), 'standard');

assert.strictEqual(settings.normalizeOverlayEnterAnimation('elastic'), 'elastic');
assert.strictEqual(settings.normalizeOverlayEnterAnimation('fade'), 'fade');
assert.strictEqual(settings.normalizeOverlayEnterAnimation(undefined), 'elastic');
assert.strictEqual(settings.normalizeOverlayEnterAnimation('other'), 'elastic');
assert.strictEqual(
  settings.OVERLAY_ENTER_ANIMATION_STORAGE_KEY,
  '_x_extension_overlay_enter_animation_2026_unique_'
);

assert.strictEqual(settings.normalizeOverlayTabPriorityMode('switchTabFirst'), true);
assert.strictEqual(settings.normalizeOverlayTabPriorityMode('newtabFirst'), false);
assert.strictEqual(settings.normalizeOverlayTabPriorityMode(false), false);
assert.strictEqual(settings.normalizeOverlayTabPriorityMode(undefined), true);

assert.strictEqual(settings.normalizeSearchResultPriority('search'), 'search');
assert.strictEqual(settings.normalizeSearchResultPriority('autocomplete'), 'autocomplete');
assert.strictEqual(settings.normalizeSearchResultPriority('other'), 'autocomplete');
assert.strictEqual(settings.normalizeSearchResultDisplayLimit(5), 5);
assert.strictEqual(settings.normalizeSearchResultDisplayLimit('8'), 8);
assert.strictEqual(settings.normalizeSearchResultDisplayLimit(10), 10);
assert.strictEqual(settings.normalizeSearchResultDisplayLimit(4), 10);
assert.strictEqual(settings.normalizeSearchResultDisplayLimit(11), 10);
assert.strictEqual(settings.normalizeSearchResultDisplayLimit(7.5), 10);
assert.strictEqual(settings.normalizeSearchResultDisplayLimit(undefined), 10);
assert.deepStrictEqual(
  settings.normalizeSearchResultSourceTypes(['topSite', 'bookmark']),
  ['topSite', 'bookmark']
);
assert.deepStrictEqual(
  settings.normalizeSearchResultSourceTypes(['frequent', 'bookmarks', 'history', 'history']),
  ['topSite', 'bookmark', 'history']
);
assert.deepStrictEqual(
  settings.normalizeSearchResultSourceTypes([]),
  ['topSite', 'bookmark', 'history']
);

assert.strictEqual(settings.normalizeTabRankScoreDebugMode(true), true);
assert.strictEqual(settings.normalizeTabRankScoreDebugMode(false), false);
assert.strictEqual(settings.normalizeTabRankScoreDebugMode('true'), false);

assert.strictEqual(settings.normalizeTabSwitcherEnabled(false), false);
assert.strictEqual(settings.normalizeTabSwitcherEnabled(true), true);
assert.strictEqual(settings.normalizeTabSwitcherEnabled(undefined), true);
assert.strictEqual(settings.normalizeTabSwitcherEnabled('false'), true);

assert.strictEqual(settings.normalizeSelectionQuickActionsEnabled(false), false);
assert.strictEqual(settings.normalizeSelectionQuickActionsEnabled(true), true);
assert.strictEqual(settings.normalizeSelectionQuickActionsEnabled(undefined), false);
assert.strictEqual(settings.normalizeSelectionQuickActionsEnabled('false'), false);
assert.strictEqual(
  settings.SELECTION_QUICK_ACTIONS_ENABLED_STORAGE_KEY,
  '_x_extension_selection_quick_actions_enabled_2026_unique_'
);
assert.strictEqual(settings.normalizeSelectionQuickActionsProvider('gpt'), 'gpt');
assert.strictEqual(settings.normalizeSelectionQuickActionsProvider(' KIMI '), 'kimi');
assert.strictEqual(settings.normalizeSelectionQuickActionsProvider('unsupported'), 'gpt');
assert.strictEqual(settings.normalizeSelectionQuickActionsProvider(undefined), 'gpt');
assert.strictEqual(
  settings.SELECTION_QUICK_ACTIONS_PROVIDER_STORAGE_KEY,
  '_x_extension_selection_quick_actions_provider_2026_unique_'
);
assert.strictEqual(settings.normalizeSelectionQuickActionsGroupEnabled(false), false);
assert.strictEqual(settings.normalizeSelectionQuickActionsGroupEnabled(true), true);
assert.strictEqual(settings.normalizeSelectionQuickActionsGroupEnabled(undefined), false);
assert.strictEqual(settings.normalizeSelectionQuickActionsGroupEnabled('true'), false);
assert.strictEqual(
  settings.SELECTION_QUICK_ACTIONS_GROUP_ENABLED_STORAGE_KEY,
  '_x_extension_selection_quick_actions_group_enabled_2026_unique_'
);
assert.strictEqual(settings.normalizeSelectionQuickActionsIconSet, undefined);
assert.strictEqual(settings.SELECTION_QUICK_ACTIONS_ICON_SET_STORAGE_KEY, undefined);
assert.strictEqual(settings.normalizeSelectionQuickActionsTriggerStyle, undefined);
assert.strictEqual(settings.resolveSelectionQuickActionsTriggerStyle, undefined);
assert.strictEqual(settings.SELECTION_QUICK_ACTIONS_TRIGGER_STYLE_STORAGE_KEY, undefined);

assert.strictEqual(settings.normalizeThemePreference('dark'), 'dark');
assert.strictEqual(settings.normalizeThemePreference('light'), 'light');
assert.strictEqual(settings.normalizeThemePreference('system'), '');

assert.strictEqual(settings.normalizeThemeMode('dark'), 'dark');
assert.strictEqual(settings.normalizeThemeMode('light'), 'light');
assert.strictEqual(settings.normalizeThemeMode('system'), 'system');
assert.strictEqual(settings.normalizeThemeMode('other'), 'system');
assert.deepStrictEqual(
  settings.createGlobalThemeModeStorageUpdate('dark'),
  {
    _x_extension_theme_mode_2024_unique_: 'dark'
  },
  'global theme writes should not clear the New Tab-specific appearance override'
);
assert.deepStrictEqual(
  settings.createGlobalThemeModeStorageUpdate('weird'),
  {
    _x_extension_theme_mode_2024_unique_: 'system'
  },
  'global theme writes should normalize invalid theme modes to system'
);

async function testProviderStorageRuntime() {
  function createArea(initial) {
    const values = { ...(initial || {}) };
    return {
      values,
      get(keys, callback) {
        const result = Object.fromEntries((Array.isArray(keys) ? keys : Object.keys(values))
          .flatMap((key) => Object.prototype.hasOwnProperty.call(values, key) ? [[key, values[key]]] : []));
        callback(result);
      },
      set(payload, callback) { Object.assign(values, payload); if (callback) callback(); },
      remove(keys, callback) {
        (Array.isArray(keys) ? keys : [keys]).forEach((key) => delete values[key]);
        if (callback) callback();
      },
      clear(callback) { Object.keys(values).forEach((key) => delete values[key]); if (callback) callback(); }
    };
  }
  const languageKey = '_x_extension_language_2024_unique_';
  const sync = createArea({ [languageKey]: 'zh_CN' });
  const local = createArea({});
  const chromeApi = {
    storage: {
      sync,
      local
    }
  };
  const runtime = settings.createProviderStorageRuntime(chromeApi);
  await runtime.ready;
  assert.deepStrictEqual(
    await runtime.area.get([languageKey]),
    { [languageKey]: 'zh_CN' },
    'Chrome Sync mode should expose stored settings'
  );
  await runtime.area.set({ theme: 'chrome' });
  assert.strictEqual(sync.values.theme, 'chrome');
  local.values[languageKey] = 'en';
  await runtime.area.set({ theme: 'lumno' });
  assert.strictEqual(sync.values.theme, 'lumno', 'settings writes should stay on Chrome Sync');
  assert.strictEqual(local.values.theme, undefined, 'local storage should not receive synced settings');
  assert.strictEqual(runtime.isActiveAreaName('sync'), true);
  assert.deepStrictEqual(
    await runtime.area.get([languageKey]),
    { [languageKey]: 'zh_CN' },
    'the runtime should keep reading the Chrome Sync value'
  );

  let multiWriteCount = 0;
  let multiWritePayload = null;
  const writtenValues = await settings.writeStorageValues({
    set(payload, callback) {
      multiWriteCount += 1;
      multiWritePayload = payload;
      callback();
    }
  }, { runtime: { lastError: null } }, {
    customProviders: [{ id: 'source-1' }],
    disabledProviders: ['builtin-1']
  });
  assert.strictEqual(multiWriteCount, 1, 'related storage keys must be written in one operation');
  assert.deepStrictEqual(multiWritePayload, writtenValues);
  assert.deepStrictEqual(writtenValues, {
    customProviders: [{ id: 'source-1' }],
    disabledProviders: ['builtin-1']
  });

  const chromeWithMultiWriteError = { runtime: { lastError: null } };
  await assert.rejects(
    settings.writeStorageValues({
      set(_payload, callback) {
        chromeWithMultiWriteError.runtime.lastError = { message: 'multi write failed' };
        callback();
      }
    }, chromeWithMultiWriteError, { customProviders: [] }),
    /multi write failed/
  );
}

testProviderStorageRuntime().then(() => {
  console.log('settings tests passed');
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
