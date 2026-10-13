const assert = require('assert');

const shortcutsStore = require('../src/newtab/shortcuts-store.js');

const SYNC_KEYS = shortcutsStore.SHORTCUTS_SYNC_KEYS;
const LEGACY_KEYS = shortcutsStore.LEGACY_SHORTCUTS_CHUNK_KEYS;
const OVERFLOW_KEY = shortcutsStore.SHORTCUTS_LOCAL_OVERFLOW_KEY;
const DAY_MS = 24 * 60 * 60 * 1000;

function createMemoryStorage(initialData) {
  const data = JSON.parse(JSON.stringify(initialData || {}));
  const writes = [];
  return {
    get(keys, callback) {
      const result = {};
      (Array.isArray(keys) ? keys : [keys]).forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(data, key)) result[key] = JSON.parse(JSON.stringify(data[key]));
      });
      callback(result);
    },
    set(value, callback) {
      writes.push({ set: Object.keys(value || {}) });
      Object.assign(data, JSON.parse(JSON.stringify(value || {})));
      if (callback) {
        callback();
      }
    },
    remove(keys, callback) {
      writes.push({ remove: keys });
      (Array.isArray(keys) ? keys : [keys]).forEach((key) => { delete data[key]; });
      if (callback) callback();
    },
    data,
    writes
  };
}

function createShortcutInputs(count, options) {
  const opts = options || {};
  return Array.from({ length: count }, (_, index) => ({
    id: `shortcut-${index + 1}`,
    title: `${opts.titlePrefix || 'Shortcut'} ${index + 1}`,
    url: `https://shortcut-${index + 1}.example/${opts.path || ''}`,
    ...(opts.groupId ? { groupId: typeof opts.groupId === 'function' ? opts.groupId(index) : opts.groupId } : {})
  }));
}

const FOLDER_REF = Object.freeze({
  version: 1,
  root: 'bookmarks-bar',
  scope: 'account',
  path: ['设计', '灵感'],
  fingerprint: '0123456789abcdef'
});

function testCreatesShortcutFromLooseUrl() {
  const shortcut = shortcutsStore.createShortcutRecord({
    title: ' Lumno ',
    url: 'lumno.kubai.design'
  }, {
    now: 42,
    sanitizeDisplayText: (value) => String(value || '').trim()
  });

  assert.deepStrictEqual(shortcut, {
    id: 's163q8b',
    title: 'Lumno',
    url: 'https://lumno.kubai.design/',
    host: 'lumno.kubai.design'
  }, 'new shortcuts get a short id and no timestamps, which sync would only spend bytes on');
}

function testFallsBackToHostForEmptyTitle() {
  const shortcut = shortcutsStore.createShortcutRecord({
    title: '',
    url: 'https://www.example.com/tools?q=1'
  }, {
    now: 7,
    normalizeHost: (host) => String(host || '').replace(/^www\./, '')
  });

  assert.strictEqual(shortcut.title, 'example.com');
  assert.strictEqual(shortcut.host, 'example.com');
}

function testCreatesBrowserInternalShortcuts() {
  const shortcut = shortcutsStore.createShortcutRecord({
    title: 'Inspect devices',
    url: ' chrome://inspect/#devices '
  }, { now: 42 });

  assert.strictEqual(shortcut.title, 'Inspect devices');
  assert.strictEqual(shortcut.url, 'chrome://inspect/#devices');
  assert.strictEqual(shortcut.host, 'inspect');

  ['chrome', 'edge', 'brave', 'vivaldi', 'opera'].forEach((scheme) => {
    assert.strictEqual(
      shortcutsStore.normalizeShortcutUrl(`${scheme.toUpperCase()}://SETTINGS`),
      `${scheme}://settings/`
    );
    assert.strictEqual(
      shortcutsStore.normalizeShortcutUrl(`${scheme}://settings/content?search=camera#permissions`),
      `${scheme}://settings/content?search=camera#permissions`
    );
  });
  assert.strictEqual(
    shortcutsStore.createShortcutRecord({ url: 'chrome://extensions/' }).title,
    'extensions'
  );
}

function testRejectsUnsafeOrMissingUrls() {
  [
    '',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///tmp/example.html',
    'chrome-extension://example/options.html',
    'custom://settings/',
    'chrome://',
    'chrome:settings',
    'chrome:///settings',
    'chrome://user@settings/',
    'chrome://user:password@settings/',
    'chrome://settings:80/'
  ].forEach((url) => {
    assert.strictEqual(
      shortcutsStore.createShortcutRecord({ title: 'Bad', url }),
      null,
      `${url} should not be accepted as a shortcut URL`
    );
  });
}

async function testBrowserInternalShortcutsSurviveStorageAndEditing() {
  const storage = createMemoryStorage();
  const saved = await shortcutsStore.saveShortcuts(storage, [
    { id: 'inspect', title: 'Inspect', url: 'chrome://inspect/#devices' },
    { id: 'settings', title: 'Settings', url: 'chrome://settings' },
    { id: 'duplicate', title: 'Duplicate', url: 'CHROME://SETTINGS/' },
    { id: 'example', title: 'Example', url: 'https://example.com/' },
    { id: 'plain', title: 'Plain', url: 'http://plain.example/' },
    { id: 'local', title: 'Local', url: 'https://localhost:3000/app' }
  ]);
  const loaded = await shortcutsStore.loadShortcuts(storage);

  assert.deepStrictEqual(loaded, saved);
  assert.deepStrictEqual(loaded.map((item) => item.id), ['inspect', 'settings', 'example', 'plain', 'local']);
  assert.deepStrictEqual(loaded.map((item) => item.url), [
    'chrome://inspect/#devices',
    'chrome://settings/',
    'https://example.com/',
    'http://plain.example/',
    'https://localhost:3000/app'
  ], 'the compact form keeps every scheme, including a host that looks like one');

  const edited = loaded.map((item) => item.id === 'inspect'
    ? { ...item, title: 'Network', url: 'chrome://net-export/' }
    : item);
  await shortcutsStore.saveShortcuts(storage, edited);
  const reloaded = await shortcutsStore.loadShortcuts(storage);
  assert.strictEqual(reloaded[0].id, 'inspect');
  assert.strictEqual(reloaded[0].title, 'Network');
  assert.strictEqual(reloaded[0].url, 'chrome://net-export/');
}

function testNormalizesAndDeduplicatesShortcuts() {
  const shortcuts = shortcutsStore.normalizeShortcuts([
    { id: 'one', title: 'One', url: 'https://one.example/' },
    { id: 'dupe', title: 'Duplicate', url: 'one.example' },
    { id: 'bad', title: 'Bad', url: 'javascript:alert(1)' },
    { id: 'two', title: 'Two', url: 'https://two.example/' },
    { id: 'two', title: 'Same id', url: 'https://three.example/' }
  ], {
    maxShortcuts: 8
  });

  assert.deepStrictEqual(
    shortcuts.map((shortcut) => shortcut.title),
    ['One', 'Two'],
    'a url or id seen before is dropped, so icons and folders keyed by id stay unambiguous'
  );
}

function testDefaultCapacityAllowsTwoHundredShortcuts() {
  const shortcuts = shortcutsStore.normalizeShortcuts(createShortcutInputs(201));

  assert.strictEqual(shortcutsStore.DEFAULT_MAX_SHORTCUTS, 200);
  assert.strictEqual(shortcuts.length, 200, 'the default capacity keeps two hundred shortcuts');
  assert.strictEqual(shortcuts[0].id, 'shortcut-1');
  assert.strictEqual(shortcuts[199].id, 'shortcut-200');
}

function testDefaultShortcutsContainLumno() {
  const state = shortcutsStore.getDefaultShortcutState();

  assert.deepStrictEqual(state.groups, [{ id: 'g0', title: '' }]);
  assert.deepStrictEqual(state.items, [{
    id: 'shortcut-lumno-default',
    groupId: 'g0',
    title: 'Lumno',
    url: 'https://lumno.kubai.design/',
    host: 'lumno.kubai.design'
  }], 'missing shortcut storage should default to the Lumno shortcut in one untitled group');
  assert(shortcutsStore.isDefaultShortcutGroupLayout(state.groups));
}

async function testLoadsDefaultShortcutsOnlyWhenStorageKeyIsMissing() {
  const storage = createMemoryStorage();
  assert.deepStrictEqual(
    (await shortcutsStore.loadShortcuts(storage)).map((shortcut) => shortcut.title),
    ['Lumno'],
    'first run should seed the visible shortcuts with Lumno'
  );

  storage.data[LEGACY_KEYS[0]] = [];
  assert.deepStrictEqual(await shortcutsStore.loadShortcuts(storage), [],
    'an explicitly saved empty legacy list should stay empty');

  await shortcutsStore.saveShortcuts(storage, []);
  delete storage.data[LEGACY_KEYS[0]];
  assert.deepStrictEqual(await shortcutsStore.loadShortcuts(storage), [],
    'an explicitly saved empty grouped state should stay empty');
}

async function testSaveShortcutsPreservesExplicitOrder() {
  const storage = createMemoryStorage();
  const saved = await shortcutsStore.saveShortcuts(storage, [
    { id: 'three', title: 'Three', url: 'https://three.example/' },
    { id: 'one', title: 'One', url: 'https://one.example/' },
    { id: 'two', title: 'Two', url: 'https://two.example/' }
  ], { maxShortcuts: 8 });

  assert.deepStrictEqual(saved.map((shortcut) => shortcut.id), ['three', 'one', 'two'],
    'bulk saving shortcuts should preserve the caller-provided order');
  assert.deepStrictEqual((await shortcutsStore.loadShortcuts(storage)).map((shortcut) => shortcut.id),
    ['three', 'one', 'two']);
}

function testNormalizesGroupsAndMembership() {
  const longTitle = '一二三四五六七八九十一二三四五六七八九十一二三四五六七八';
  const state = shortcutsStore.normalizeShortcutState({
    groups: [
      { id: 'work', title: ` ${longTitle} ` },
      { id: 'work', title: 'Duplicate' },
      { id: 'bad id!', title: 'Invalid' },
      { id: 'play', title: 'Play' }
    ],
    items: [
      { id: 'a', title: 'A', url: 'https://a.example/', groupId: 'play' },
      { id: 'b', title: 'B', url: 'https://b.example/' },
      { id: 'c', title: 'C', url: 'https://c.example/', groupId: 'work' },
      { id: 'd', title: 'D', url: 'https://d.example/', groupId: 'missing' }
    ]
  });

  assert.deepStrictEqual(state.groups.map((group) => group.id), ['work', 'play'],
    'duplicate and malformed group ids are dropped');
  assert.strictEqual(Array.from(state.groups[0].title).length, shortcutsStore.SHORTCUT_GROUP_TITLE_MAX_LENGTH);
  assert.deepStrictEqual(state.items.map((item) => [item.id, item.groupId]),
    [['c', 'work'], ['d', 'work'], ['a', 'play'], ['b', 'play']],
    'items follow group order, keep their order inside a group, and an item without a known group joins the one before it');

  const capped = shortcutsStore.normalizeShortcutState({
    groups: Array.from({ length: 25 }, (_, index) => ({ id: `g${index + 1}`, title: `${index + 1}` }))
  });
  assert.strictEqual(capped.groups.length, shortcutsStore.DEFAULT_MAX_SHORTCUT_GROUPS);
  assert.deepStrictEqual(shortcutsStore.normalizeShortcutState({ groups: [] }).groups, [{ id: 'g0', title: '' }],
    'a state always has a group to put shortcuts in');
}

function testCompactPlanKeepsTwoHundredShortcutsInSync() {
  const groups = [{ id: 'g0', title: '' }, { id: 'work', title: '工作' }, { id: 'read', title: '阅读' }];
  const items = Array.from({ length: 200 }, (_, index) => ({
    id: `s${index.toString(36)}`,
    title: index % 4 === 0 ? '' : `网站 ${index}`,
    url: `https://site-${index}.example.com/${'p'.repeat(index % 30)}`,
    groupId: groups[index % 3].id
  }));
  const plan = shortcutsStore.createShortcutStoragePlan({ groups, items }, { rev: 'r1', now: 1000 });

  assert.strictEqual(plan.overflowItems.length, 0, 'two hundred ordinary shortcuts fit browser sync');
  assert(plan.totalBytes <= shortcutsStore.DEFAULT_SHORTCUTS_SYNC_TOTAL_BUDGET_BYTES);
  SYNC_KEYS.forEach((key) => {
    assert(shortcutsStore.getShortcutStorageItemByteSize(key, plan.payload[key]) <=
      shortcutsStore.DEFAULT_SHORTCUTS_SYNC_ITEM_BUDGET_BYTES, `${key} stays inside the per-item budget`);
    assert.strictEqual(plan.payload[key].r, 'r1', 'every key of one save carries its revision');
  });
  const head = plan.payload[SYNC_KEYS[0]];
  assert.deepStrictEqual(head.g, [['g0', ''], ['work', '工作'], ['read', '阅读']]);
  assert.strictEqual(head.m, 1000, 'the first save in the grouped format records when the device migrated');
  assert.deepStrictEqual(head.s[0], ['s0', 0, '', 'site-0.example.com/'],
    'a link entry drops the https scheme and a title that only repeats the host');

  const restored = shortcutsStore.readShortcutState(plan.payload, plan.overflowRecord);
  assert.deepStrictEqual(restored.groups, plan.state.groups);
  assert.deepStrictEqual(restored.items, plan.state.items);
  assert.strictEqual(restored.torn, false);
  assert.strictEqual(restored.rev, 'r1');
}

function testOverflowRestoresTailIntoItsGroups() {
  const groups = [{ id: 'g0', title: '' }, { id: 'work', title: 'Work' }, { id: 'read', title: 'Read' }];
  const items = createShortcutInputs(90, {
    titlePrefix: `Long ${'标题'.repeat(12)}`,
    path: `?q=${'x'.repeat(200)}`,
    groupId: (index) => groups[Math.floor(index / 30)].id
  });
  const plan = shortcutsStore.createShortcutStoragePlan({ groups, items }, { rev: 'r2' });

  assert(plan.syncedItems.length > 0, 'a long shortcut set still syncs a prefix');
  assert(plan.overflowItems.length > 0, 'items past the byte budget stay in the overflow record');
  assert.strictEqual(plan.syncedItems.length + plan.overflowItems.length, 90);
  assert.deepStrictEqual(plan.payload[SYNC_KEYS[0]].g.map((group) => group[0]), ['g0', 'work', 'read'],
    'every group is synced even when its shortcuts overflow');
  assert.deepStrictEqual(plan.overflowRecord.items[0].groupId, plan.overflowItems[0].groupId,
    'overflow entries remember their group');

  const restored = shortcutsStore.readShortcutState(plan.payload, plan.overflowRecord);
  assert.deepStrictEqual(restored.items.map((item) => item.id), items.map((item) => item.id),
    'the synced prefix and the overflow tail rebuild the original order');
  assert.deepStrictEqual(restored.items.map((item) => item.groupId), items.map((item) => item.groupId));

  const elsewhere = shortcutsStore.readShortcutState(plan.payload, null);
  assert.deepStrictEqual(elsewhere.groups, restored.groups,
    'a device without the overflow record still sees every group');
  assert.strictEqual(elsewhere.items.length, plan.syncedItems.length);
}

function testOverflowFromAnotherSaveMergesWithoutDuplicates() {
  const groups = [{ id: 'g0', title: '' }, { id: 'work', title: 'Work' }];
  const syncedPlan = shortcutsStore.createShortcutStoragePlan({ groups, items: [
    { id: 'a', title: 'A', url: 'https://a.example/', groupId: 'g0' },
    { id: 'b', title: 'B renamed', url: 'https://b.example/', groupId: 'work' }
  ] }, { rev: 'new' });
  const overflow = {
    version: 2,
    rev: 'old',
    authoritative: false,
    items: [
      { id: 'b', title: 'B', url: 'https://b.example/', groupId: 'work' },
      { id: 'c', title: 'C', url: 'https://c.example/', groupId: 'g0' },
      { id: 'legacy', title: 'Legacy', url: 'https://legacy.example/' }
    ]
  };
  const state = shortcutsStore.readShortcutState(syncedPlan.payload, overflow);
  assert.deepStrictEqual(state.items.map((item) => [item.id, item.groupId]),
    [['a', 'g0'], ['c', 'g0'], ['legacy', 'g0'], ['b', 'work']],
    'another save keeps its synced entries; this device adds the rest at the end of their groups');
  assert.strictEqual(state.items.find((item) => item.id === 'b').title, 'B renamed');

  const authoritative = shortcutsStore.readShortcutState(syncedPlan.payload, {
    version: 2, authoritative: true, groups: [{ id: 'solo', title: 'Solo' }],
    items: [{ id: 'z', title: 'Z', url: 'https://z.example/' }]
  });
  assert.deepStrictEqual(authoritative.groups, [{ id: 'solo', title: 'Solo' }]);
  assert.deepStrictEqual(authoritative.items.map((item) => [item.id, item.groupId]), [['z', 'solo']],
    'after a failed sync write the local record is the whole state');
  assert.strictEqual(authoritative.source, 'local');

  const legacyArray = shortcutsStore.readShortcutState({}, [{ id: 'old', title: 'Old', url: 'https://old.example/' }]);
  assert.deepStrictEqual(legacyArray.items.map((item) => item.id), ['shortcut-lumno-default', 'old'],
    'an overflow record from before groups is still read');
}

function testTornSaveIsDetectedWithoutLosingEntries() {
  const items = createShortcutInputs(120, { path: 'x'.repeat(60) });
  const plan = shortcutsStore.createShortcutStoragePlan({ items }, { rev: 'r3' });
  assert(plan.payload[SYNC_KEYS[0]].n >= 2, 'this state spans several keys');

  const stale = JSON.parse(JSON.stringify(plan.payload));
  stale[SYNC_KEYS[1]].r = 'older';
  const mixed = shortcutsStore.readShortcutState(stale, null);
  assert.strictEqual(mixed.torn, true, 'a key from another save marks the read as torn');
  assert.strictEqual(mixed.items.length, 120, 'a torn read still keeps every entry it has');

  const missing = JSON.parse(JSON.stringify(plan.payload));
  delete missing[SYNC_KEYS[1]];
  assert.strictEqual(shortcutsStore.readShortcutState(missing, null).torn, true,
    'a key the head counts on but has not arrived marks the read as torn');

  const unused = JSON.parse(JSON.stringify(shortcutsStore.createShortcutStoragePlan({ items: items.slice(0, 2) },
    { rev: 'r4' }).payload));
  unused[SYNC_KEYS[2]] = { r: 'ancient', s: [['ghost', 0, 'Ghost', 'ghost.example/']] };
  const small = shortcutsStore.readShortcutState(unused, null);
  assert.strictEqual(small.torn, false, 'keys past the counted ones are ignored');
  assert.deepStrictEqual(small.items.map((item) => item.id), ['shortcut-1', 'shortcut-2']);
}

async function testLegacyListMigratesWithoutTouchingLegacyKeys() {
  const legacyItems = createShortcutInputs(3).map((item) => ({ ...item, createdAt: 5, updatedAt: 6 }));
  const storage = createMemoryStorage({ [LEGACY_KEYS[0]]: legacyItems, [LEGACY_KEYS[1]]: [], [LEGACY_KEYS[2]]: [] });
  const legacyCopy = JSON.parse(JSON.stringify(storage.data));

  const before = await shortcutsStore.loadShortcutState(storage);
  assert.strictEqual(before.source, 'legacy');
  assert.deepStrictEqual(before.groups, [{ id: 'g0', title: '' }]);
  assert.deepStrictEqual(before.items.map((item) => Object.keys(item)), before.items.map(() => ['id', 'groupId', 'title', 'url', 'host']),
    'timestamps from the legacy list are not carried into the grouped state');

  await shortcutsStore.saveShortcuts(storage, before.items.slice(0, 2), { now: 50 });
  LEGACY_KEYS.forEach((key) => {
    assert.deepStrictEqual(storage.data[key], legacyCopy[key],
      'older devices keep reading the legacy list, so migration leaves it as it was');
  });
  storage.data[LEGACY_KEYS[0]] = createShortcutInputs(9);
  const after = await shortcutsStore.loadShortcutState(storage);
  assert.strictEqual(after.source, 'v2');
  assert.strictEqual(after.migratedAt, 50);
  assert.deepStrictEqual(after.items.map((item) => item.id), ['shortcut-1', 'shortcut-2'],
    'once the grouped state exists, edits an older device makes to the legacy list are ignored');
}

function testSyncBudgetLeavesRoomForOtherSettings() {
  const budget = shortcutsStore.getShortcutSyncBudget;
  assert.strictEqual(budget({ totalBytes: 0 }), shortcutsStore.DEFAULT_SHORTCUTS_SYNC_TOTAL_BUDGET_BYTES);
  assert.strictEqual(budget({ totalBytes: 12000, shortcutBytes: 2000, legacyBytes: 10000 }),
    shortcutsStore.DEFAULT_SHORTCUTS_SYNC_TOTAL_BUDGET_BYTES - 10000,
    'the legacy copy counts against the shortcut ceiling, never against other settings');
  assert.strictEqual(budget({ quotaBytes: 102400, totalBytes: 30000, shortcutBytes: 5000 }), 102400 - 65536 - 25000,
    'shortcuts never take the space reserved for other settings');
  assert.strictEqual(budget({ quotaBytes: 102400, totalBytes: 60000 }), 0);

  const usage = shortcutsStore.measureShortcutSyncUsage({
    [SYNC_KEYS[0]]: { r: 'a' },
    [LEGACY_KEYS[0]]: [],
    other: 'value'
  });
  assert.strictEqual(usage.shortcutBytes, shortcutsStore.getShortcutStorageItemByteSize(SYNC_KEYS[0], { r: 'a' }));
  assert.strictEqual(usage.legacyBytes, shortcutsStore.getShortcutStorageItemByteSize(LEGACY_KEYS[0], []));
  assert.strictEqual(usage.totalBytes, usage.shortcutBytes + usage.legacyBytes +
    shortcutsStore.getShortcutStorageItemByteSize('other', 'value'));
}

async function testPersistSplitsSyncAndOverflowAndFallsBack() {
  const sync = createMemoryStorage({ [LEGACY_KEYS[0]]: [] });
  const local = createMemoryStorage();
  const items = createShortcutInputs(40, { path: `?q=${'y'.repeat(200)}` });
  const result = await shortcutsStore.persistShortcutState(sync, { items }, {
    overflowArea: local, maxTotalBytes: 4000, legacyKeysPresent: true, now: 10 * DAY_MS
  });
  assert(result.syncLimited, 'items past the budget are reported as local-only');
  assert.strictEqual(result.localOnlyIds.length + result.plan.syncedItems.length, 40);
  assert.strictEqual(local.data[OVERFLOW_KEY].rev, sync.data[SYNC_KEYS[0]].r,
    'the overflow record names the save it belongs to');
  assert.deepStrictEqual(shortcutsStore.readShortcutState(sync.data, local.data[OVERFLOW_KEY]).items.map((item) => item.id),
    items.map((item) => item.id));
  assert(Object.prototype.hasOwnProperty.call(sync.data, LEGACY_KEYS[0]), 'a fresh migration keeps the legacy list');

  const later = await shortcutsStore.persistShortcutState(sync, result.state, {
    overflowArea: local, maxTotalBytes: 4000, legacyKeysPresent: true, now: 10 * DAY_MS + 29 * DAY_MS
  });
  assert.deepStrictEqual(later.plan.removeKeys, []);
  await shortcutsStore.persistShortcutState(sync, result.state, {
    overflowArea: local, maxTotalBytes: 4000, legacyKeysPresent: true, now: 10 * DAY_MS + 30 * DAY_MS
  });
  assert(!Object.prototype.hasOwnProperty.call(sync.data, LEGACY_KEYS[0]),
    'thirty days after migration the legacy list gives its sync bytes back');

  const failing = { set() { throw new Error('QUOTA_BYTES quota exceeded'); } };
  const fallbackLocal = createMemoryStorage();
  const failed = await shortcutsStore.persistShortcutState(failing, { items: items.slice(0, 3) }, {
    overflowArea: fallbackLocal
  });
  assert(failed.syncError, 'a failed sync write is reported');
  assert.strictEqual(fallbackLocal.data[OVERFLOW_KEY].authoritative, true,
    'the local record becomes the authoritative copy after a failed sync write');
  assert.deepStrictEqual(failed.localOnlyIds, ['shortcut-1', 'shortcut-2', 'shortcut-3']);

  const unlimited = createMemoryStorage();
  const localOnly = await shortcutsStore.persistShortcutState(unlimited, { items }, {});
  assert.strictEqual(localOnly.syncLimited, false, 'without an overflow area every item goes to the given area');
  assert.strictEqual(unlimited.data[SYNC_KEYS[0]].s.length, 40);
}

async function testQuotaOverflowAndStorageFailuresAreObservable() {
  const oversized = [{
    id: 'oversized',
    title: 'Oversized',
    url: `https://oversized.example/path?query=${'x'.repeat(9000)}`
  }];
  await assert.rejects(
    shortcutsStore.saveShortcuts(createMemoryStorage(), oversized),
    (error) => error && error.code === 'SHORTCUT_SYNC_QUOTA_EXCEEDED',
    'callers without a local overflow layer should receive a quota error'
  );

  const writeError = { message: 'QUOTA_BYTES quota exceeded' };
  await assert.rejects(
    shortcutsStore.saveShortcuts({
      get(_keys, callback) {
        callback({});
      },
      set(_value, callback) {
        callback();
      }
    }, createShortcutInputs(1), {
      getLastError: () => writeError
    }),
    (error) => error &&
      error.code === 'SHORTCUT_STORAGE_WRITE_FAILED' &&
      error.message === writeError.message,
    'Chrome callback errors must reject instead of reporting a false save success'
  );
}

async function testFolderReferencesSurviveStorageAndDeduplicateIndependentlyFromUrls() {
  const folder = shortcutsStore.createShortcutRecord({ type: 'folder', folderId: '42', title: 'Design' }, { now: 9 });
  assert.strictEqual(folder.url, undefined);
  assert.strictEqual(folder.id, 'shortcut-folder-42');
  assert.strictEqual(shortcutsStore.normalizeShortcutItem({ type: 'folder', folderId: '0' }), null);
  const portable = { id: 'shortcut-folder-entry', type: 'folder', folderRef: FOLDER_REF, title: '灵感' };
  const storage = createMemoryStorage();
  await shortcutsStore.saveShortcuts(storage, [folder,
    { type: 'folder', folderId: '42', title: 'Duplicate' },
    { type: 'folder', folderId: '43', title: 'Other folder' },
    portable,
    { url: 'https://example.com/', title: 'Site' }
  ]);
  const loaded = await shortcutsStore.loadShortcuts(storage);
  assert.strictEqual(loaded.length, 4);
  assert.strictEqual(loaded[0].folderId, '42');
  assert.strictEqual(loaded[1].folderId, '43');
  assert.deepStrictEqual(loaded[2], { ...portable, groupId: 'g0' },
    'a portable folder reference survives the compact form');
  assert.strictEqual(loaded[3].url, 'https://example.com/');
}

async function run() {
  const sourceStorage = createMemoryStorage();
  await shortcutsStore.saveShortcuts(sourceStorage, [
    { url: 'https://service.example/', iconSource: 'service' },
    { url: 'https://favicon-is.example/', iconSource: 'favicon-is' },
    { url: 'https://cache.example/', iconSource: 'cache' },
    { url: 'https://custom.example/', iconSource: 'custom' },
    { url: 'https://github.com/', iconSource: 'builtin' },
    { url: 'https://legacy.example/' },
    { url: 'https://invalid.example/', iconSource: 'unapproved' }
  ]);
  const sourceRecords = await shortcutsStore.loadShortcuts(sourceStorage);
  assert.deepStrictEqual(sourceRecords.map((item) => item.iconSource),
    ['service', 'favicon-is', 'cache', 'custom', 'builtin', undefined, undefined],
    'source preferences must survive storage without rewriting legacy or invalid sources');
  await testFolderReferencesSurviveStorageAndDeduplicateIndependentlyFromUrls();
  testCreatesShortcutFromLooseUrl();
  testFallsBackToHostForEmptyTitle();
  testCreatesBrowserInternalShortcuts();
  testRejectsUnsafeOrMissingUrls();
  await testBrowserInternalShortcutsSurviveStorageAndEditing();
  testNormalizesAndDeduplicatesShortcuts();
  testDefaultCapacityAllowsTwoHundredShortcuts();
  testDefaultShortcutsContainLumno();
  await testLoadsDefaultShortcutsOnlyWhenStorageKeyIsMissing();
  await testSaveShortcutsPreservesExplicitOrder();
  testNormalizesGroupsAndMembership();
  testCompactPlanKeepsTwoHundredShortcutsInSync();
  testOverflowRestoresTailIntoItsGroups();
  testOverflowFromAnotherSaveMergesWithoutDuplicates();
  testTornSaveIsDetectedWithoutLosingEntries();
  await testLegacyListMigratesWithoutTouchingLegacyKeys();
  testSyncBudgetLeavesRoomForOtherSettings();
  await testPersistSplitsSyncAndOverflowAndFallsBack();
  await testQuotaOverflowAndStorageFailuresAreObservable();
  console.log('shortcut store tests passed: groups, compact sync, overflow, torn saves, legacy migration and budgets');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
