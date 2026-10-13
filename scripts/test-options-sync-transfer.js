const assert = require('assert');
const settings = require('../src/shared/settings');
const aggregateSearchStore = require('../src/shared/aggregate-search-store');
const { createAggregateSearchModel } = require('../src/options/options-aggregate-search');
const { createSyncTransfer } = require('../src/options/options-sync-transfer');

const transfer = createSyncTransfer({
  deriveLegacyAutoGroupEnabled: createAggregateSearchModel({ aggregateSearchStore }).deriveLegacyAutoGroupEnabled,
  settings
});
const META = settings.SYNC_META_STORAGE_KEY;
const [V2_HEAD, V2_CHUNK_2, V2_CHUNK_3] = settings.NEWTAB_SHORTCUTS_V2_STORAGE_KEYS;

// Export and "sync now" carry only the Chrome Sync contract.
{
  const stored = {
    [settings.THEME_STORAGE_KEY]: 'dark',
    [settings.LANGUAGE_STORAGE_KEY]: undefined,
    [settings.WEBDAV_STATUS_STORAGE_KEY]: { enabled: true },
    unrelated: 1
  };
  assert.deepStrictEqual(transfer.buildExportFile(stored, '2026-01-01T00:00:00.000Z'), {
    version: 1,
    exportedAt: '2026-01-01T00:00:00.000Z',
    data: { [settings.THEME_STORAGE_KEY]: 'dark' }
  });
  assert.deepStrictEqual(transfer.buildManualSyncPayload(stored, 42), {
    [settings.THEME_STORAGE_KEY]: 'dark',
    [META]: { lastSyncAt: 42, source: 'manual' }
  });
}

// Reading a file: the wrapped export format and older bare objects.
assert.deepStrictEqual(transfer.parseImportFile('{"data":{"a":1}}'), { a: 1 });
assert.deepStrictEqual(transfer.parseImportFile('{"a":1}'), { a: 1 });
assert.strictEqual(transfer.parseImportFile('not json'), null);
assert.strictEqual(transfer.parseImportFile('"text"'), null);
assert.strictEqual(transfer.parseImportFile(''), null);

// Importing.
{
  assert.strictEqual(transfer.buildImportPlan({ unrelated: 1 }, 1), null, 'a file without known settings is invalid');

  const plan = transfer.buildImportPlan({
    [settings.THEME_STORAGE_KEY]: 'light',
    [settings.SITE_SEARCH_STORAGE_KEY]: [],
    unrelated: 1
  }, 7);
  assert.deepStrictEqual(plan, {
    keysToClear: [],
    payload: {
      [settings.THEME_STORAGE_KEY]: 'light',
      [settings.SITE_SEARCH_STORAGE_KEY]: [],
      [META]: { lastSyncAt: 7, source: 'import' }
    }
  });

  // A file from before shortcut chunks and groups.
  const legacy = transfer.buildImportPlan({ [settings.NEWTAB_SHORTCUTS_STORAGE_KEY]: [{ url: 'https://a' }] }, 1);
  assert.deepStrictEqual(legacy.payload[settings.NEWTAB_SHORTCUTS_CHUNK_2_STORAGE_KEY], [],
    'stale shortcut chunks are cleared with a single-key list');
  assert.deepStrictEqual(legacy.payload[settings.NEWTAB_SHORTCUTS_CHUNK_3_STORAGE_KEY], []);
  assert.deepStrictEqual(legacy.keysToClear, [V2_HEAD, V2_CHUNK_2, V2_CHUNK_3],
    'grouped shortcuts are cleared so New Tab migrates the imported flat list');

  // Grouped shortcuts move only as a whole save.
  const partialGroups = transfer.buildImportPlan({
    [settings.THEME_STORAGE_KEY]: 'dark',
    [V2_CHUNK_2]: ['orphan']
  }, 1);
  assert(!Object.prototype.hasOwnProperty.call(partialGroups.payload, V2_CHUNK_2),
    'a grouped chunk without its head is not imported');
  assert.deepStrictEqual(partialGroups.keysToClear, []);
  const groups = transfer.buildImportPlan({ [V2_HEAD]: { v: 2 }, [V2_CHUNK_2]: ['b'] }, 1);
  assert.deepStrictEqual(groups.payload[V2_HEAD], { v: 2 });
  assert.deepStrictEqual(groups.payload[V2_CHUNK_2], ['b']);
  assert.deepStrictEqual(groups.keysToClear, []);

  // Old exports derive the global aggregate tab-group switch.
  const refs = ['builtin:a', 'builtin:b'];
  const aggregates = transfer.buildImportPlan({
    [settings.AGGREGATE_SEARCH_STORAGE_KEY]: {
      version: 1,
      items: [{ id: 'x', key: 'x', name: 'X', sourceRefs: refs, autoCreateTabGroup: false }]
    }
  }, 1);
  assert.strictEqual(aggregates.payload[settings.AGGREGATE_SEARCH_AUTO_GROUP_ENABLED_STORAGE_KEY], false);
  const explicit = transfer.buildImportPlan({
    [settings.AGGREGATE_SEARCH_STORAGE_KEY]: [],
    [settings.AGGREGATE_SEARCH_AUTO_GROUP_ENABLED_STORAGE_KEY]: true
  }, 1);
  assert.strictEqual(explicit.payload[settings.AGGREGATE_SEARCH_AUTO_GROUP_ENABLED_STORAGE_KEY], true,
    'an exported switch value wins');
}

console.log('Options sync transfer tests passed.');
