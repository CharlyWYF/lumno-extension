(function(root) {
  'use strict';

  // Settings export, import and "sync now" payloads. Only keys in the shared
  // Chrome Sync contract (LumnoSettings.CHROME_SYNC_STORAGE_KEYS) ever leave
  // or enter through these paths.
  function createSyncTransfer(deps) {
    const settings = deps.settings;
    const deriveLegacyAutoGroupEnabled = deps.deriveLegacyAutoGroupEnabled;
    const syncKeys = settings.CHROME_SYNC_STORAGE_KEYS;
    const groupedShortcutKeys = settings.NEWTAB_SHORTCUTS_V2_STORAGE_KEYS;
    const legacyShortcutKeys = [
      settings.NEWTAB_SHORTCUTS_STORAGE_KEY,
      settings.NEWTAB_SHORTCUTS_CHUNK_2_STORAGE_KEY,
      settings.NEWTAB_SHORTCUTS_CHUNK_3_STORAGE_KEY
    ];
    const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

    function pickSyncValues(values, isPresent) {
      const picked = {};
      syncKeys.forEach((key) => {
        if (isPresent(values, key)) {
          picked[key] = values[key];
        }
      });
      return picked;
    }

    function createSyncMeta(source, now) {
      return { lastSyncAt: now, source };
    }

    // The file written by "Export".
    function buildExportFile(storedValues, exportedAt) {
      return {
        version: 1,
        exportedAt,
        data: pickSyncValues(storedValues || {}, (values, key) => typeof values[key] !== 'undefined')
      };
    }

    // What "Sync now" writes back to browser sync to push the values again.
    function buildManualSyncPayload(storedValues, now) {
      const payload = pickSyncValues(storedValues || {}, (values, key) => typeof values[key] !== 'undefined');
      payload[settings.SYNC_META_STORAGE_KEY] = createSyncMeta('manual', now);
      return payload;
    }

    // The settings object inside an exported file (older files are the bare
    // object), or null when the text is not one.
    function parseImportFile(text) {
      let parsed = null;
      try {
        parsed = JSON.parse(String(text || ''));
      } catch (error) {
        return null;
      }
      const data = parsed && parsed.data ? parsed.data : parsed;
      return data && typeof data === 'object' ? data : null;
    }

    // What an import writes, and which keys it clears afterwards; null when
    // the file holds no known setting.
    function buildImportPlan(data, now) {
      const payload = pickSyncValues(data, has);
      // A single-key shortcut list from an old file must not be joined with
      // chunks of a newer list already in storage.
      if (has(data, settings.NEWTAB_SHORTCUTS_STORAGE_KEY)) {
        [settings.NEWTAB_SHORTCUTS_CHUNK_2_STORAGE_KEY, settings.NEWTAB_SHORTCUTS_CHUNK_3_STORAGE_KEY]
          .forEach((key) => {
            if (!has(data, key)) {
              payload[key] = [];
            }
          });
      }
      // A file from before shortcut groups holds only the flat list. Clearing
      // the grouped copy makes New Tab read and migrate the imported list.
      const importsGroupedShortcuts = has(data, groupedShortcutKeys[0]);
      const keysToClear = !importsGroupedShortcuts &&
        legacyShortcutKeys.some((key) => has(payload, key))
        ? groupedShortcutKeys.slice()
        : [];
      if (!importsGroupedShortcuts) {
        groupedShortcutKeys.forEach((key) => { delete payload[key]; });
      }
      const autoGroupKey = settings.AGGREGATE_SEARCH_AUTO_GROUP_ENABLED_STORAGE_KEY;
      if (!has(data, autoGroupKey) && has(data, settings.AGGREGATE_SEARCH_STORAGE_KEY)) {
        payload[autoGroupKey] = deriveLegacyAutoGroupEnabled(data[settings.AGGREGATE_SEARCH_STORAGE_KEY]);
      }
      if (Object.keys(payload).length === 0) {
        return null;
      }
      payload[settings.SYNC_META_STORAGE_KEY] = createSyncMeta('import', now);
      return { keysToClear, payload };
    }

    return Object.freeze({
      buildExportFile,
      buildImportPlan,
      buildManualSyncPayload,
      parseImportFile
    });
  }

  const api = Object.freeze({ createSyncTransfer });
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.LumnoOptionsSyncTransfer = api;
})(globalThis);
