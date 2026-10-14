const assert = require('assert');
const { JSDOM } = require('jsdom');
const settings = require('../src/shared/settings');
const { createSyncSection } = require('../src/options/options-sync-section');

const KEY = settings.BOOKMARK_VIEW_MODE_STORAGE_KEY;
const [V2_HEAD, V2_CHUNK_2] = settings.NEWTAB_SHORTCUTS_V2_STORAGE_KEYS;

function createSection(sync, local, options) {
  const config = options || {};
  const { document } = new JSDOM(`
    <span id="status" data-i18n-tooltip="sync_status_hint"><span id="text"></span></span>
    <button id="now"></button><button id="export"></button><button id="import"></button>
    <input id="file" type="file"><p id="summary"></p>`).window;
  const writes = [];
  let syncReads = 0;
  // No remove() or clear(): migration must never delete anything.
  const storageArea = {
    get(keys, callback) {
      syncReads += 1;
      const values = typeof config.syncAfterFirstRead === 'object' && syncReads > 1
        ? Object.assign({}, sync, config.syncAfterFirstRead)
        : sync;
      callback(Object.fromEntries(keys.filter((key) => key in values).map((key) => [key, values[key]])));
    },
    set(payload) {
      writes.push(payload);
    }
  };
  const localStorageArea = {
    get(keys, callback) {
      callback(Object.fromEntries(keys.filter((key) => key in local).map((key) => [key, local[key]])));
    }
  };
  const section = createSyncSection({
    beginToast: () => ({ cancel() {}, done() {}, fail() {} }),
    chromeApi: { runtime: { lastError: null }, storage: {} },
    documentObj: document,
    elements: {
      shortcutSyncSummary: document.getElementById('summary'),
      syncExportButton: document.getElementById('export'),
      syncImportButton: document.getElementById('import'),
      syncImportInput: document.getElementById('file'),
      syncNowButton: document.getElementById('now'),
      syncStatus: document.getElementById('status'),
      syncStatusText: document.getElementById('text')
    },
    formatTemplate: (text, params) => String(text).replace(/\{(\w+)\}/g, (m, k) => (params && k in params ? params[k] : m)),
    getActivePrimaryAreaName: () => config.primary || 'sync',
    getMessage: (key, fallback) => fallback,
    localStorageArea,
    settings,
    showToast() {},
    showTooltipFor() {},
    storageArea,
    syncTransfer: null
  });
  return { document, section, writes };
}

// Settings older versions kept only in local storage move into browser sync,
// unless sync gained a value meanwhile.
{
  const moved = createSection({}, { [KEY]: 'folder' });
  moved.section.migrateStorageIfNeeded([KEY]);
  assert.deepStrictEqual(moved.writes, [{ [KEY]: 'folder' }]);

  const raced = createSection({}, { [KEY]: 'folder' }, { syncAfterFirstRead: { [KEY]: 'top' } });
  raced.section.migrateStorageIfNeeded([KEY]);
  assert.deepStrictEqual(raced.writes, [], 'a value synced in the meantime is not overwritten');

  const present = createSection({ [KEY]: 'top' }, { [KEY]: 'folder' });
  present.section.migrateStorageIfNeeded([KEY]);
  assert.deepStrictEqual(present.writes, []);

  const localPrimary = createSection({}, { [KEY]: 'folder' }, { primary: 'local' });
  localPrimary.section.migrateStorageIfNeeded([KEY]);
  assert.deepStrictEqual(localPrimary.writes, [], 'nothing moves while local storage is primary');
}

// Grouped shortcuts move only as a whole save, never chunk by chunk.
{
  const partial = createSection({}, { [V2_CHUNK_2]: ['b'] });
  partial.section.migrateStorageIfNeeded(settings.NEWTAB_SHORTCUTS_V2_STORAGE_KEYS);
  assert.deepStrictEqual(partial.writes, []);
}

// The status line and buttons follow whether settings can sync.
{
  const page = createSection({}, {});
  page.section.refreshSyncStatus();
  assert.strictEqual(page.document.getElementById('status').getAttribute('data-status'), 'success');
  assert.strictEqual(page.document.getElementById('text').textContent, '同步已开启');
  assert.strictEqual(page.document.getElementById('now').disabled, false);
  page.section.updateSyncStatusText('sync_status_failed_reason', '同步失败：{reason}', { reason: 'quota' });
  assert.strictEqual(page.document.getElementById('status').getAttribute('data-status'), 'danger');
  assert.strictEqual(page.document.getElementById('status').getAttribute('data-i18n-tooltip'), 'sync_status_unavailable_hint');
  assert.strictEqual(page.document.getElementById('text').textContent, '同步失败：quota');
}

console.log('Options sync section tests passed.');
