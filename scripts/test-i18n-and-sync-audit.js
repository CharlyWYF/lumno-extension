const assert = require('assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const settings = require('../src/shared/settings.js');
const { readPageSource } = require('./helpers/page-source');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');
const { readBackgroundSource } = require('./helpers/background-source');

const auditOutput = execFileSync(process.execPath, ['scripts/audit-i18n.js'], {
  encoding: 'utf8'
});
const candidateMatch = auditOutput.match(/i18n audit candidate count=(\d+)/);
assert(candidateMatch, 'i18n audit should print a candidate count');
assert.strictEqual(
  Number(candidateMatch[1]),
  0,
  `i18n audit should have no unreviewed candidates:\n${auditOutput}`
);

const optionsSource = fs.readFileSync('src/options/options.js', 'utf8');
const optionsHtml = readPageSource('src/options/options.html');
const backgroundSource = readBackgroundSource();
const newtabSource = readNewtabRuntimeSource();
const wallpaperSource = fs.readFileSync('src/newtab/wallpaper.js', 'utf8');
const overlaySource = fs.readFileSync('src/overlay/search-panel.js', 'utf8');
const sharedSettingsSource = fs.readFileSync('src/shared/settings.js', 'utf8');
const shortcutFaviconSource = fs.readFileSync('src/shared/shortcut-favicon.js', 'utf8');
const localeNames = ['en', 'ja', 'zh_CN', 'zh_TW'];
const localeMessages = Object.fromEntries(localeNames.map((locale) => [
  locale,
  JSON.parse(fs.readFileSync(`_locales/${locale}/messages.json`, 'utf8'))
]));
const expectedBrowserSyncHints = {
  en: 'Lumno settings sync automatically through your current browser\'s built-in sync service. Sync works across devices signed in to the same browser account, but not across different browsers.',
  ja: 'Lumno の設定は、現在のブラウザの標準同期サービスで自動的に同期されます。同じブラウザアカウントでログインしている端末間のみ同期でき、異なるブラウザ間では同期できません。',
  zh_CN: 'Lumno 配置通过当前浏览器的内置同步服务自动同步，仅支持同一浏览器账号下的设备，不支持跨浏览器同步。',
  zh_TW: 'Lumno 設定會透過目前瀏覽器的內建同步服務自動同步；僅支援同一瀏覽器帳號下的裝置，不支援跨瀏覽器同步。'
};
const expectedBrowserSyncDescriptions = {
  en: 'Settings sync automatically through your current browser\'s built-in sync service',
  ja: '現在のブラウザの標準同期サービスで設定を自動的に同期します',
  zh_CN: '配置通过当前浏览器的内置同步服务自动同步',
  zh_TW: '設定會透過目前瀏覽器的內建同步服務自動同步'
};
const expectedBrowserSyncUnavailableHints = {
  en: 'Sync unavailable: check whether your current browser supports built-in sync and has it turned on.',
  ja: '同期できません。現在のブラウザが標準同期に対応し、同期が有効になっているか確認してください。',
  zh_CN: '同步不可用：请检查当前浏览器是否支持并已开启内置同步。',
  zh_TW: '同步無法使用：請檢查目前瀏覽器是否支援並已開啟內建同步。'
};
localeNames.forEach((locale) => {
  assert.strictEqual(
    String(localeMessages[locale].settings_sync_desc?.message || ''),
    expectedBrowserSyncDescriptions[locale],
    `${locale} browser sync description should refer to the current browser instead of Chrome`
  );
  assert.strictEqual(
    String(localeMessages[locale].sync_status_hint?.message || ''),
    expectedBrowserSyncHints[locale],
    `${locale} browser sync tooltip should explain same-browser support and the cross-browser boundary`
  );
  assert.strictEqual(
    String(localeMessages[locale].sync_status_unavailable_hint?.message || ''),
    expectedBrowserSyncUnavailableHints[locale],
    `${locale} unavailable sync tooltip should refer to the current browser instead of Chrome`
  );
});
const optionsMigratesSyncKeys = /migrateStorageIfNeeded\(SYNC_KEYS\);/.test(optionsSource);
const chromeSyncKeys = settings.CHROME_SYNC_STORAGE_KEYS;
const backgroundMigratesChromeSyncContract = /migrateStorageIfNeeded\(CHROME_SYNC_STORAGE_KEYS\);/.test(
  backgroundSource
);

function getFunctionSource(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert(start >= 0, `${name} should exist`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') {
      depth += 1;
    } else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }
  assert.fail(`${name} should have a complete body`);
}

function getStorageConstantValue(source, name) {
  const start = source.indexOf(`const ${name}`);
  assert(start >= 0, `${name} should exist`);
  const end = source.indexOf(';', start);
  const declaration = source.slice(start, end + 1);
  const values = [...declaration.matchAll(/['"](_x_extension_[a-z0-9_]+_unique_)['"]/g)];
  assert(values.length > 0, `${name} should include a storage key fallback`);
  return values[values.length - 1][1];
}

{
  const syncKeysBlock = optionsSource.match(/const SYNC_KEYS = \[([\s\S]*?)\n  \];/);
  assert(syncKeysBlock, 'options should define its Chrome Sync export/import contract');
  const optionSyncKeys = [...syncKeysBlock[1].matchAll(/\b([A-Z][A-Z0-9_]+_STORAGE_KEY)\b/g)]
    .map((match) => getStorageConstantValue(optionsSource, match[1]));
  assert.deepStrictEqual(
    optionSyncKeys,
    chromeSyncKeys,
    'options export/import keys must exactly match the shared Chrome Sync contract'
  );
  assert(backgroundMigratesChromeSyncContract, 'background startup should migrate the full Chrome Sync contract');
  assert(
    /chrome\.storage\.sync\.remove\(LANGUAGE_MESSAGES_STORAGE_KEY/.test(backgroundSource),
    'background startup should remove the obsolete oversized language cache from Chrome Sync'
  );
  [optionsSource, newtabSource, overlaySource].forEach((source) => {
    assert(
      !source.includes('_x_extension_language_messages_2024_unique_'),
      'runtime surfaces must load packaged locale messages instead of syncing the language cache'
    );
  });
}

{
  const animationKey = '_x_extension_overlay_enter_animation_2026_unique_';
  assert(
    /OVERLAY_ENTER_ANIMATION_STORAGE_KEY\s*=\s*['"]_x_extension_overlay_enter_animation_2026_unique_['"]/.test(sharedSettingsSource) &&
      /OVERLAY_ENTER_ANIMATION_STORAGE_KEY,/.test(sharedSettingsSource),
    'shared settings should define and export the overlay opening-animation key'
  );
  assert(
    /const SYNC_KEYS = \[[\s\S]*OVERLAY_ENTER_ANIMATION_STORAGE_KEY[\s\S]*\];/.test(optionsSource),
    'overlay opening animation should be included in options sync/export/import keys'
  );
  assert(
    optionsMigratesSyncKeys,
    'options should migrate overlay opening animation from local to sync storage'
  );
  assert(
    backgroundMigratesChromeSyncContract &&
      chromeSyncKeys.includes('_x_extension_overlay_enter_animation_2026_unique_'),
    'background should migrate overlay opening animation from local to sync storage'
  );
  assert(
    overlaySource.includes(animationKey) &&
      /const initialOverlaySettingsReady = overlayRuntime\.getStorageValues\([\s\S]*?OVERLAY_ENTER_ANIMATION_STORAGE_KEY[\s\S]*?\)\.catch/.test(overlaySource),
    'overlay runtime should read the synchronized opening-animation preference in its batched startup settings'
  );
  localeNames.forEach((locale) => {
    ['settings_overlay_enter_animation_title', 'overlay_enter_animation_elastic', 'overlay_enter_animation_fade']
      .forEach((key) => {
        assert(
          localeMessages[locale][key] &&
            String(localeMessages[locale][key].message || '').trim(),
          `${locale} should localize ${key}`
        );
      });
  });
}
{
  const iconCacheKey = '_x_extension_site_search_icon_cache_canonical_2026_unique_';
  assert(
    shortcutFaviconSource.includes(iconCacheKey),
    'shared favicon runtime should define the canonical provider-icon cache key'
  );
  assert(
    !optionsSource.includes(iconCacheKey) && !sharedSettingsSource.includes(iconCacheKey),
    'regenerable provider-icon cache data must stay out of sync/export/import settings'
  );
  const iconStoreSource = getFunctionSource(backgroundSource, 'getSiteSearchIconStore');
  assert(
    /storageArea:\s*\(chrome && chrome\.storage && chrome\.storage\.local\)/.test(iconStoreSource),
    'background should persist provider-icon cache data only in local storage'
  );
}
assert(
  /const SYNC_KEYS = \[[\s\S]*SITE_SEARCH_STORAGE_KEY[\s\S]*\];/.test(optionsSource),
  'custom search providers, including their selected category, should remain in sync/export/import'
);

assert(
  /data-i18n="settings_overlay_open_tabs_default_visible_title"/.test(optionsHtml),
  'overlay open-tabs setting label should be wired through data-i18n'
);
assert(
  !/settings_overlay_open_tabs_default_visible_desc/.test(optionsHtml),
  'overlay open-tabs setting should not keep a secondary description in options HTML'
);
localeNames.forEach((locale) => {
  assert(
    localeMessages[locale].settings_overlay_open_tabs_default_visible_title &&
      String(localeMessages[locale].settings_overlay_open_tabs_default_visible_title.message || '').trim(),
    `${locale} should localize the overlay open-tabs setting label`
  );
  assert.strictEqual(
    Object.prototype.hasOwnProperty.call(localeMessages[locale], 'settings_overlay_open_tabs_default_visible_desc'),
    false,
    `${locale} should not keep unused overlay open-tabs setting description copy`
  );
});
assert(
  /BOOKMARK_FOLDER_ICONS_VISIBLE_STORAGE_KEY\s*=\s*['_"]_x_extension_bookmark_folder_icons_visible_2026_unique_['_"]/.test(newtabSource),
  'new tab should define the bookmark folder icons storage key'
);
assert(
  /changes\[BOOKMARK_FOLDER_ICONS_VISIBLE_STORAGE_KEY\][\s\S]*setFolderIconsVisible/.test(newtabSource),
  'new tab should apply bookmark folder icon setting changes live'
);
assert(
  /migrateStorageIfNeeded\(\[[\s\S]*BOOKMARK_FOLDER_ICONS_VISIBLE_STORAGE_KEY[\s\S]*\]\);/.test(newtabSource),
  'new tab should migrate the bookmark folder icon setting to sync storage'
);
assert(
  /BOOKMARK_FOLDER_ICONS_VISIBLE_STORAGE_KEY\s*=\s*['_"]_x_extension_bookmark_folder_icons_visible_2026_unique_['_"]/.test(backgroundSource),
  'background should define the bookmark folder icons storage key'
);
assert(
  backgroundMigratesChromeSyncContract &&
    chromeSyncKeys.includes('_x_extension_bookmark_folder_icons_visible_2026_unique_'),
  'background should migrate the bookmark folder icon setting to sync storage'
);

assert(
  /BOOKMARK_VIEW_MODE_STORAGE_KEY\s*=\s*['_"]_x_extension_bookmark_view_mode_2026_unique_['_"]/.test(optionsSource),
  'options sync should define the bookmark view mode storage key'
);
assert(
  /const SYNC_KEYS = \[[\s\S]*BOOKMARK_VIEW_MODE_STORAGE_KEY[\s\S]*\];/.test(optionsSource),
  'bookmark view mode should be included in options sync/export/import keys'
);
assert(
  optionsMigratesSyncKeys,
  'bookmark view mode should be included in local-to-sync migration'
);
assert(
  /BOOKMARK_VIEW_MODE_STORAGE_KEY\s*=\s*['_"]_x_extension_bookmark_view_mode_2026_unique_['_"]/.test(backgroundSource),
  'background sync migration should define the bookmark view mode storage key'
);
assert(
  backgroundMigratesChromeSyncContract &&
    chromeSyncKeys.includes('_x_extension_bookmark_view_mode_2026_unique_'),
  'background local-to-sync migration should include the bookmark view mode'
);
{
  // Folder colors are user choices, so they sync; bookmark ids are not
  // portable, so the synced map is keyed by folder path instead.
  [settings.BOOKMARK_FOLDER_COLOR_REFS_STORAGE_KEY, settings.BOOKMARK_FOLDER_COLOR_PRESETS_STORAGE_KEY].forEach((key) => {
    assert(chromeSyncKeys.includes(key), `${key} should be in the Chrome Sync and WebDAV contract`);
  });
  assert(!chromeSyncKeys.includes('_x_extension_bookmark_folder_colors_2026_unique_'),
    'the legacy folder color map is keyed by device-only bookmark ids and must not sync');
  const readRefs = getFunctionSource(newtabSource, 'readFolderColorRefs');
  const writeRefs = getFunctionSource(newtabSource, 'writeFolderColorRefs');
  assert(/folderColorStorage\(storageArea,/.test(readRefs) && /folderColorStorage\(storageArea,/.test(writeRefs),
    'new tab should read and write folder colors through the synced storage area');
  assert(/readSavedColors: \(\) => folderColorStorage\(storageArea,/.test(newtabSource) &&
    /saveSavedColors: \(colors\) => folderColorStorage\(storageArea,/.test(newtabSource),
    'saved folder colors should use the synced storage area');
  assert(/normalizeFolderColorRefs\(changes\[FOLDER_COLOR_REFS_STORAGE_KEY\]\.newValue\);\s*syncFolderColorsWithBookmarks\(false\)/.test(newtabSource),
    'a folder color map from another device is resolved without writing back, so two devices never bounce a renamed folder');
}

{
  const topbarLocalKeys = [
    '_x_extension_bookmark_topbar_surface_mode_2026_unique_',
    '_x_extension_bookmark_topbar_surface_color_light_2026_unique_',
    '_x_extension_bookmark_topbar_surface_color_dark_2026_unique_',
    '_x_extension_bookmark_topbar_surface_color_2026_unique_'
  ];
  assert.deepStrictEqual(
    settings.BOOKMARK_TOPBAR_LOCAL_STORAGE_KEYS,
    topbarLocalKeys,
    'shared settings should publish one explicit local-only bookmark topbar contract'
  );
  topbarLocalKeys.forEach((key) => {
    assert(!chromeSyncKeys.includes(key), `${key} must stay out of the Chrome Sync contract`);
    assert(!optionsSource.includes(key), `options must not export or import local-only ${key}`);
    assert(newtabSource.includes(key), `new tab should persist and apply local-only ${key}`);
  });
  assert(
    /const bookmarkTopbarSurfaceStorageArea =\s*\n\s*\(chrome && chrome\.storage && chrome\.storage\.local\)/.test(newtabSource) &&
      !/const bookmarkTopbarSurfaceStorageArea = (?:storageArea|localStorageArea);/.test(newtabSource),
    'bookmark topbar material preferences should require real local storage without a Sync fallback'
  );
  const persistModeSource = getFunctionSource(newtabSource, 'persistBookmarkTopbarSurfaceMode');
  const persistColorSource = getFunctionSource(newtabSource, 'persistBookmarkTopbarSurfaceColor');
  const loadModeSource = getFunctionSource(newtabSource, 'loadInitialBookmarkTopbarSurfaceMode');
  const loadColorSource = getFunctionSource(newtabSource, 'loadInitialBookmarkTopbarSurfaceColors');
  const changeSource = getFunctionSource(
    newtabSource,
    'handleBookmarkTopbarSurfaceColorStorageChanges'
  );
  assert(
    /bookmarkTopbarSurfaceStorageArea\.set/.test(persistModeSource) &&
      /bookmarkTopbarSurfaceStorageArea\.set/.test(persistColorSource),
    'bookmark topbar material preferences should write through the local-only adapter'
  );
  assert(
    /bookmarkTopbarSurfaceStorageArea\.get/.test(loadModeSource) &&
      !/syncArea|storage\.sync/.test(loadModeSource),
    'bookmark topbar material mode should load only from local storage'
  );
  assert(
    /localArea\.get\(colorKeys/.test(loadColorSource) &&
      /syncArea\.remove\(cleanupKeys/.test(loadColorSource) &&
      !/syncResult\[/.test(loadColorSource),
    'bookmark topbar colors should load locally and purge Sync copies without importing them'
  );
  assert(
    /areaName !== ['"]local['"]/.test(changeSource),
    'live bookmark topbar material updates should only accept local storage changes'
  );
  const backgroundCleanupSource = getFunctionSource(
    backgroundSource,
    'cleanupLocalOnlyBookmarkTopbarSyncStorage'
  );
  assert(
    /BOOKMARK_TOPBAR_LOCAL_STORAGE_KEYS/.test(backgroundCleanupSource) &&
      /chrome\.storage\.sync\.remove/.test(backgroundCleanupSource),
    'background startup should purge local-only bookmark topbar values from Chrome Sync'
  );

  const [modeKey, lightKey, darkKey, legacyKey] = topbarLocalKeys;
  const localData = {
    [modeKey]: 'custom',
    [lightKey]: '#112233'
  };
  const syncData = {
    [modeKey]: 'adaptive',
    [lightKey]: '#aabbcc',
    [darkKey]: '#ddeeff',
    [legacyKey]: '#445566'
  };
  const localWrites = [];
  const syncRemovals = [];
  const appliedColors = [];
  const localArea = {
    get(keys, callback) {
      callback(Object.fromEntries(keys.flatMap((key) => (
        Object.prototype.hasOwnProperty.call(localData, key) ? [[key, localData[key]]] : []
      ))));
    },
    set(payload, callback) {
      localWrites.push(payload);
      Object.assign(localData, payload);
      if (callback) callback();
    },
    remove(keys) {
      const removedKeys = Array.isArray(keys) ? keys : [keys];
      removedKeys.forEach((key) => delete localData[key]);
    }
  };
  const syncArea = {
    remove(keys, callback) {
      syncRemovals.push(...keys);
      keys.forEach((key) => delete syncData[key]);
      if (callback) callback();
    }
  };
  const createInitialColorLoader = new Function(
    'bookmarkTopbarSurfaceStorageArea',
    'chrome',
    'initialThemeReadyPromise',
    'BOOKMARK_TOPBAR_SURFACE_MODE_STORAGE_KEY',
    'BOOKMARK_TOPBAR_SURFACE_COLOR_STORAGE_KEY',
    'BOOKMARK_TOPBAR_SURFACE_COLOR_LIGHT_STORAGE_KEY',
    'BOOKMARK_TOPBAR_SURFACE_COLOR_DARK_STORAGE_KEY',
    'getCurrentBookmarkTopbarResolvedTheme',
    'getBookmarkTopbarSurfaceColorStorageKey',
    'bookmarkTopbarSurfaceColorRevisions',
    'applyInitialBookmarkTopbarSurfaceColors',
    `${getFunctionSource(newtabSource, 'getBookmarkTopbarSurfaceColorStorageKeys')}
    ${getFunctionSource(newtabSource, 'getBookmarkTopbarSurfaceCleanupKeys')}
    ${loadColorSource}
    return loadInitialBookmarkTopbarSurfaceColors;`
  );
  const loadInitialBookmarkTopbarSurfaceColors = createInitialColorLoader(
    localArea,
    { runtime: { lastError: null }, storage: { local: localArea, sync: syncArea } },
    { then(callback) { callback(); } },
    modeKey,
    legacyKey,
    lightKey,
    darkKey,
    () => 'light',
    (theme) => theme === 'dark' ? darkKey : lightKey,
    { light: 0, dark: 0 },
    (result) => appliedColors.push(result)
  );
  loadInitialBookmarkTopbarSurfaceColors();
  assert.deepStrictEqual(localWrites, [], 'Sync values must never be imported into local topbar settings');
  assert.deepStrictEqual(
    appliedColors,
    [{ [lightKey]: '#112233' }],
    'initial topbar appearance should use only current-device values'
  );
  assert.deepStrictEqual(syncRemovals, topbarLocalKeys, 'all local-only keys should be purged from Sync');
  assert.deepStrictEqual(syncData, {}, 'no local-only topbar value should survive in Sync');

  const appliedModes = [];
  const createInitialModeLoader = new Function(
    'bookmarkTopbarSurfaceStorageArea',
    'initialThemeReadyPromise',
    'BOOKMARK_TOPBAR_SURFACE_MODE_STORAGE_KEY',
    'BOOKMARK_TOPBAR_SURFACE_COLOR_STORAGE_KEY',
    'getCurrentBookmarkTopbarResolvedTheme',
    'getBookmarkTopbarSurfaceColorStorageKey',
    'normalizeBookmarkTopbarSurfaceColor',
    'bookmarkTopbarSurfaceModeRevision',
    'applyBookmarkTopbarSurfaceMode',
    `${getFunctionSource(newtabSource, 'isBookmarkTopbarSurfaceMode')}
    ${loadModeSource}
    return loadInitialBookmarkTopbarSurfaceMode;`
  );
  const loadInitialBookmarkTopbarSurfaceMode = createInitialModeLoader(
    localArea,
    { then(callback) { callback(); } },
    modeKey,
    legacyKey,
    () => 'light',
    () => lightKey,
    (value) => /^#[0-9a-f]{6}$/.test(String(value || '')) ? value : '',
    0,
    (mode, options) => appliedModes.push({ mode, options })
  );
  loadInitialBookmarkTopbarSurfaceMode();
  assert.strictEqual(appliedModes.length, 1);
  assert.strictEqual(appliedModes[0].mode, 'custom', 'material mode should load from current-device storage');
}
localeNames.forEach((locale) => {
  [
    'bookmark_topbar_surface_title',
    'bookmark_topbar_surface_adaptive',
    'bookmark_topbar_surface_clear',
    'bookmark_topbar_surface_transparent',
    'bookmark_topbar_surface_custom',
    'bookmark_topbar_color_pick',
    'bookmark_topbar_color_reset',
    'bookmark_topbar_color_picked',
    'bookmark_topbar_color_reset_done',
    'bookmark_topbar_color_unsupported',
    'bookmark_topbar_color_failed'
  ].forEach((key) => {
    assert(
      localeMessages[locale][key] &&
        String(localeMessages[locale][key].message || '').trim(),
      `${locale} should localize ${key}`
    );
  });
});
[
  ['new tab', newtabSource],
  ['options', optionsSource],
  ['background', backgroundSource]
].forEach(([surface, source]) => {
  const migrationSource = getFunctionSource(source, 'migrateStorageIfNeeded');
  assert(
    /storageArea\.get\(missingKeys,\s*\(latestSyncResult\)/.test(migrationSource),
    `${surface} migration should recheck sync storage before writing a formerly missing value`
  );
});
{
  const key = '_x_extension_bookmark_view_mode_2026_unique_';
  const writes = [];
  let syncReadCount = 0;
  const syncArea = {
    get(keys, callback) {
      syncReadCount += 1;
      callback(syncReadCount === 1 ? {} : { [key]: 'top' });
    },
    set(payload) {
      writes.push(payload);
    }
  };
  const localArea = {
    get(keys, callback) {
      callback({ [key]: 'folder' });
    }
  };
  const createMigration = new Function(
    'storageArea',
    'chrome',
    'isPrimaryStorageAreaName',
    'providerStorageRuntime',
    `${getFunctionSource(newtabSource, 'migrateStorageIfNeeded')}
    return migrateStorageIfNeeded;`
  );
  const migrateStorageIfNeeded = createMigration(syncArea, {
    storage: {
      local: localArea,
      sync: syncArea
    }
  }, (areaName) => areaName === 'sync', null);
  migrateStorageIfNeeded([key]);
  assert.deepStrictEqual(
    writes,
    [],
    'migration must not overwrite a mode that appeared in sync after its first read'
  );
  let finishModeRead;
  syncReadCount = 0;
  const waitingMigration = createMigration(syncArea, { storage: { local: localArea, sync: syncArea } },
    (areaName) => areaName === 'local', { ready: { then(callback) { finishModeRead = callback; } } });
  waitingMigration([key]);
  assert.strictEqual(syncReadCount, 0, 'migration waits for this device to choose its storage source');
  finishModeRead();
  assert.strictEqual(syncReadCount, 0, 'a WebDAV device must not migrate its complete local source into Chrome');
}
{
  const key = '_x_extension_bookmark_view_mode_2026_unique_';
  const syncWrites = [];
  const localWrites = [];
  const syncArea = {
    set(payload) {
      syncWrites.push(payload);
    }
  };
  const localArea = {
    set(payload) {
      localWrites.push(payload);
    }
  };
  const createPersistBookmarkViewMode = new Function(
    'chrome',
    'storageArea',
    'BOOKMARK_VIEW_MODE_STORAGE_KEY',
    `${getFunctionSource(newtabSource, 'normalizeBookmarkViewMode')}
    ${getFunctionSource(newtabSource, 'persistBookmarkViewMode')}
    return persistBookmarkViewMode;`
  );
  const persistBookmarkViewMode = createPersistBookmarkViewMode(
    {
      storage: {
        sync: syncArea,
        local: localArea
      }
    },
    syncArea,
    key
  );
  assert.strictEqual(persistBookmarkViewMode('top'), true);
  assert.deepStrictEqual(syncWrites, [{ [key]: 'top' }]);
  assert.deepStrictEqual(
    localWrites,
    [],
    'changing bookmark mode should not maintain a second local source of truth'
  );
}
{
  const initialModeLoaderSource = getFunctionSource(
    newtabSource,
    'loadInitialBookmarkViewMode'
  );
  const initialModeApplySource = getFunctionSource(
    newtabSource,
    'applyInitialBookmarkViewModeValue'
  );
  assert(
    /typeof stored === ['"]undefined['"][\s\S]*readLocalFallback\(\)/.test(initialModeLoaderSource) &&
      /localStorageArea\.get\(\[BOOKMARK_VIEW_MODE_STORAGE_KEY\]/.test(initialModeLoaderSource),
    'an empty sync mode should fall back to the last local mode before choosing a default'
  );
  assert(
    /source === ['"]local-fallback['"][\s\S]*persistBookmarkViewMode\(mode\)/.test(initialModeApplySource),
    'a recovered local bookmark mode should be written back to sync storage'
  );
}
assert(
  /BOOKMARK_FOLDER_ICONS_VISIBLE_STORAGE_KEY\s*=\s*['_"]_x_extension_bookmark_folder_icons_visible_2026_unique_['_"]/.test(optionsSource),
  'options sync should define the bookmark folder icons storage key'
);
assert(
  /const SYNC_KEYS = \[[\s\S]*BOOKMARK_FOLDER_ICONS_VISIBLE_STORAGE_KEY[\s\S]*\];/.test(optionsSource),
  'bookmark folder icons should be included in options sync/export/import keys'
);
assert(
  optionsMigratesSyncKeys,
  'bookmark folder icons should be included in local-to-sync migration'
);
assert(
  /data-i18n="settings_bookmark_folder_icons_visible_title"/.test(optionsHtml),
  'bookmark folder icon setting label should be wired through data-i18n'
);
assert(
  optionsHtml.indexOf('data-i18n="settings_bookmark_folder_icons_visible_title"') <
    optionsHtml.indexOf('data-i18n="settings_recent_sites_title"'),
  'bookmark folder icon setting should appear before site cards'
);
localeNames.forEach((locale) => {
  assert(
    localeMessages[locale].settings_bookmark_folder_icons_visible_title &&
      String(localeMessages[locale].settings_bookmark_folder_icons_visible_title.message || '').trim(),
    `${locale} should localize the bookmark folder icon setting label`
  );
});
assert(
  /NEWTAB_SHORTCUTS_STORAGE_KEY\s*=\s*['_"]_x_extension_newtab_shortcuts_2026_unique_['_"]/.test(optionsSource),
  'options sync should define the New Tab shortcuts storage key'
);
assert(
  /const SYNC_KEYS = \[[\s\S]*NEWTAB_SHORTCUTS_STORAGE_KEY[\s\S]*\];/.test(optionsSource),
  'New Tab shortcuts should be included in options sync/export/import keys'
);
assert(
  /const SYNC_KEYS = \[[\s\S]*NEWTAB_SHORTCUTS_CHUNK_2_STORAGE_KEY[\s\S]*NEWTAB_SHORTCUTS_CHUNK_3_STORAGE_KEY[\s\S]*\];/.test(optionsSource),
  'all New Tab shortcut chunks should be included in options sync/export/import keys'
);
assert(
  chromeSyncKeys.includes('_x_extension_newtab_shortcuts_chunk_2_2026_unique_') &&
    chromeSyncKeys.includes('_x_extension_newtab_shortcuts_chunk_3_2026_unique_'),
  'all New Tab shortcut chunks should be included in the shared Chrome Sync contract'
);
assert(
  /hasOwnProperty\.call\(data, NEWTAB_SHORTCUTS_STORAGE_KEY\)[\s\S]*NEWTAB_SHORTCUTS_CHUNK_2_STORAGE_KEY[\s\S]*NEWTAB_SHORTCUTS_CHUNK_3_STORAGE_KEY[\s\S]*payload\[key\] = \[\];/.test(optionsSource),
  'importing a legacy single-key shortcut payload should clear stale shortcut chunks'
);
assert(
  optionsMigratesSyncKeys,
  'New Tab shortcuts should be included in options local-to-sync migration'
);
assert(
  /SYNC_KEYS\.some\(\(key\) => changes\[key\]\)/.test(optionsSource),
  'all Chrome Sync preference changes should refresh options sync status'
);
assert(
  /NEWTAB_SHORTCUT_ADD_VISIBLE_STORAGE_KEY\s*=\s*['_"]_x_extension_newtab_shortcut_add_visible_2026_unique_['_"]/.test(optionsSource),
  'options sync should define the New Tab add shortcut visibility key'
);
assert(
  /const SYNC_KEYS = \[[\s\S]*NEWTAB_SHORTCUT_ADD_VISIBLE_STORAGE_KEY[\s\S]*\];/.test(optionsSource),
  'the New Tab add shortcut preference should be included in sync export and import'
);
assert(
  optionsMigratesSyncKeys,
  'the New Tab add shortcut preference should be included in local-to-sync migration'
);
assert(
  /t\(\s*['"]settings_newtab_shortcut_add_title['"]/.test(wallpaperSource),
  'the New Tab add shortcut preference label should be wired through the wallpaper runtime i18n path'
);
localeNames.forEach((locale) => {
  [
    'settings_newtab_shortcut_add_title',
    'newtab_shortcuts_hide_add',
    'newtab_shortcuts_add_hidden'
  ].forEach((key) => {
    assert(
      localeMessages[locale][key] &&
        String(localeMessages[locale][key].message || '').trim(),
      `${locale} should localize ${key}`
    );
  });
});
assert(
  /NEWTAB_SHORTCUT_DOCK_MAGNIFICATION_ENABLED_STORAGE_KEY\s*=\s*['_"]_x_extension_newtab_shortcut_dock_magnification_enabled_2026_unique_['_"]/.test(optionsSource),
  'options sync should define the New Tab shortcut Dock magnification key'
);
assert(
  /const SYNC_KEYS = \[[\s\S]*NEWTAB_SHORTCUT_DOCK_MAGNIFICATION_ENABLED_STORAGE_KEY[\s\S]*\];/.test(optionsSource),
  'the New Tab shortcut Dock magnification preference should be included in sync export and import'
);
assert(
  optionsMigratesSyncKeys,
  'the New Tab shortcut Dock magnification preference should be included in local-to-sync migration'
);
assert(
  /t\(\s*['"]settings_newtab_shortcut_dock_magnification_title['"]/.test(wallpaperSource),
  'the New Tab shortcut Dock magnification label should be wired through the wallpaper runtime i18n path'
);
localeNames.forEach((locale) => {
  const key = 'settings_newtab_shortcut_dock_magnification_title';
  assert(
    localeMessages[locale][key] &&
      String(localeMessages[locale][key].message || '').trim(),
    `${locale} should localize ${key}`
  );
});
assert(
  /NEWTAB_SHORTCUTS_STORAGE_KEY\s*=\s*['_"]_x_extension_newtab_shortcuts_2026_unique_['_"]/.test(backgroundSource),
  'background sync migration should define the New Tab shortcuts storage key'
);
assert(
  backgroundMigratesChromeSyncContract &&
    chromeSyncKeys.includes('_x_extension_newtab_shortcuts_2026_unique_'),
  'background local-to-sync migration should include New Tab shortcuts'
);
