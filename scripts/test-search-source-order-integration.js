const assert = require('assert');
const fs = require('fs');
const path = require('path');
const order = require('../src/shared/search-source-order.js');
const siteSearchStore = require('../src/shared/site-search-store.js');
const searchUtils = require('../src/shared/search-utils.js');

const repoRoot = path.resolve(__dirname, '..');
const registry = JSON.parse(fs.readFileSync(
  path.join(repoRoot, 'assets/data/site-search.json'),
  'utf8'
));

// Mirrors the classification the background and both search surfaces use, so a
// provider always lands in the group its own capability implies.
function getGroupKey(provider) {
  if (searchUtils.isSearchEngineSiteSearchProvider(provider)) {
    return 'engine';
  }
  if (searchUtils.isAiSiteSearchProvider(provider)) {
    return 'ai';
  }
  return 'site';
}

function getName(provider) {
  return String((provider && provider.name) || (provider && provider.key) || '');
}

function classifyOptions(extra) {
  return Object.assign({ getGroupKey, getName, aggregates: [] }, extra || {});
}

// The overlay injects the registry items as the default providers and merges
// the stored custom array on top, exactly like loadSiteSearchProviders does.
function buildProviders(customItems, disabledKeys) {
  return siteSearchStore.mergeStoredProviders(
    registry.items,
    customItems || [],
    disabledKeys || [],
    searchUtils.mergeCustomProviders
  );
}

function providerKeys(items) {
  return items.map((item) => item.key);
}

function testRegistryShape() {
  assert.ok(registry.items.length > 0, 'the built-in site-search registry should not be empty');
  const engines = registry.items.filter((item) => item.category === 'searchEngine');
  assert.ok(engines.length >= 10, 'the registry should ship the full search engine set');
  const enginesWithoutKey = engines.filter((item) => !item.key);
  assert.deepStrictEqual(enginesWithoutKey, [], 'every search engine entry should expose a key');
}

function testFirstRunOrderIsAlphabetical() {
  const providers = buildProviders([], []);
  const initial = order.resolveInitialOrder(providers, classifyOptions());
  assert.deepStrictEqual(
    initial.groups,
    ['aggregate', 'ai', 'engine', 'local', 'site'],
    'the first run should order the group blocks alphabetically'
  );

  const byGroup = {};
  initial.providers.forEach((entry) => {
    byGroup[entry.group] = byGroup[entry.group] || [];
    byGroup[entry.group].push(entry.key);
  });

  const nameByKey = new Map(providers.map((provider) => [provider.key, getName(provider)]));
  const sortByName = (keys) => keys.slice().sort((left, right) => (
    nameByKey.get(left).localeCompare(nameByKey.get(right), undefined, {
      numeric: true,
      sensitivity: 'base'
    })
  ));

  assert.deepStrictEqual(
    byGroup.engine,
    sortByName(byGroup.engine),
    'search engines should be alphabetical by display name on first run'
  );
  assert.deepStrictEqual(
    byGroup.site,
    sortByName(byGroup.site),
    'site searches should be alphabetical by display name on first run'
  );
  assert.deepStrictEqual(
    byGroup.ai,
    sortByName(byGroup.ai),
    'AI search entries should be alphabetical by display name on first run'
  );
}

function testEveryProviderKeepsExactlyOneSlot() {
  const providers = buildProviders([
    { key: 'mine', name: 'My Search', template: 'https://example.com/?q={query}' },
    { key: 'yt', name: 'YouTube Mine', builtinKey: 'yt', template: 'https://www.youtube.com/results?search_query={query}' }
  ], []);
  const resolved = order.normalizeOrder(null, providers, classifyOptions());
  const keys = resolved.providers.map((entry) => entry.key);
  assert.strictEqual(
    keys.length,
    providers.length,
    'the reconciled order should cover every provider including custom ones'
  );
  assert.strictEqual(new Set(keys).size, keys.length, 'no provider may appear twice');
  assert.ok(keys.includes('mine'), 'a custom provider should get a slot');
  assert.ok(keys.includes('yt'), 'a customised built-in should get a slot');
  const ytEntries = resolved.providers.filter((entry) => entry.key === 'yt');
  assert.strictEqual(ytEntries.length, 1, 'a customised built-in must not duplicate its base entry');
  assert.strictEqual(ytEntries[0].group, 'site', 'a customised built-in keeps its original group');
}

function testStoredOrderSurvivesDisabledAndNewProviders() {
  const providers = buildProviders([], []);
  const initial = order.resolveInitialOrder(providers, classifyOptions());
  // Move the last site search to the front of its group while keeping every
  // other entry in place.
  const siteEntries = initial.providers.filter((entry) => entry.group === 'site');
  const moved = siteEntries[siteEntries.length - 1].key;
  const reordered = {
    ...initial,
    providers: initial.providers.map((entry) => (
      entry.key === moved ? { key: moved, group: 'site' } : entry
    )),
    groups: ['site', 'engine', 'ai', 'local', 'aggregate']
  };
  reordered.providers = [reordered.providers.find((entry) => entry.key === moved)]
    .concat(reordered.providers.filter((entry) => entry.key !== moved));
  // A provider this device disabled is simply absent, and a brand new provider
  // arrives with a later version.
  const withoutMoved = providers.filter((provider) => provider.key !== moved);
  const withNew = withoutMoved.concat([
    { key: 'zz', name: 'Zzz Search', template: 'https://zzz.example/?q={query}' }
  ]);
  const resolved = order.normalizeOrder(reordered, withNew, classifyOptions());
  const sorted = order.sortProviders(withNew, resolved);
  const keys = providerKeys(sorted);
  const groupOf = new Map(resolved.providers.map((entry) => [entry.key, entry.group]));
  const siteKeys = keys.filter((key) => groupOf.get(key) === 'site');
  // The provider disabled on this device keeps its slot in the record but must
  // not come back in the rendered list.
  assert.strictEqual(keys.includes(moved), false, 'a disabled provider must not be rendered');
  assert.strictEqual(
    siteKeys[0],
    'bb',
    'the remaining site searches keep their relative order'
  );
  assert.strictEqual(
    siteKeys[siteKeys.length - 1],
    'zz',
    'a provider added later lands at the end of its group'
  );
  assert.ok(keys.includes('zz'), 'a provider added later still appears');
  assert.strictEqual(new Set(keys).size, keys.length, 'reconciling keeps the list duplicate-free');
  assert.deepStrictEqual(
    resolved.groups,
    ['site', 'engine', 'ai', 'local', 'aggregate'],
    'a stored group order survives reconciliation'
  );
}

function testMovedProviderLeadsItsGroup() {
  const providers = buildProviders([], []);
  const initial = order.resolveInitialOrder(providers, classifyOptions());
  const siteEntries = initial.providers.filter((entry) => entry.group === 'site');
  const moved = siteEntries[siteEntries.length - 1].key;
  // Same provider set, only the stored position changes: the moved site search
  // is listed first and the group blocks put Site search first too.
  const reordered = {
    ...initial,
    groups: ['site', 'engine', 'ai', 'local', 'aggregate'],
    providers: [{ key: moved, group: 'site' }].concat(
      initial.providers.filter((entry) => entry.key !== moved)
    )
  };
  const resolved = order.normalizeOrder(reordered, providers, classifyOptions());
  const sorted = order.sortProviders(providers, resolved);
  const keys = providerKeys(sorted);
  assert.strictEqual(keys[0], moved, 'the first listed provider should lead the whole order');
  assert.deepStrictEqual(resolved.groups, ['site', 'engine', 'ai', 'local', 'aggregate']);
  assert.strictEqual(new Set(keys).size, keys.length);
  assert.strictEqual(keys.length, providers.length);
}

function testUnknownRecordFallsBack() {
  const providers = buildProviders([], []);
  const initial = order.resolveInitialOrder(providers, classifyOptions());
  const fallback = order.normalizeOrder(
    { version: 1, groups: initial.groups.slice(), providers: [{ key: 'not-real', group: 'site' }] },
    providers,
    classifyOptions()
  );
  assert.strictEqual(
    fallback.providers.length,
    providers.length,
    'an unknown key must not shrink the order record'
  );
  assert.deepStrictEqual(
    fallback.providers.map((entry) => entry.key).slice().sort(),
    initial.providers.map((entry) => entry.key).slice().sort(),
    'the same provider set should survive a record that only held stale keys'
  );
  assert.deepStrictEqual(
    fallback.providers.map((entry) => entry.key).filter((key) => key === 'not-real'),
    [],
    'unknown keys should be dropped instead of lingering'
  );
  assert.deepStrictEqual(fallback.groups, initial.groups);
}

function testRecordFitsSyncBudget() {
  const providers = buildProviders([], []);
  const resolved = order.resolveInitialOrder(providers, classifyOptions());
  const bytes = Buffer.byteLength(JSON.stringify(resolved), 'utf8') +
    Buffer.byteLength(order.STORAGE_KEY, 'utf8');
  assert.ok(
    bytes < 8192,
    `the order record must stay inside the 8 KB Chrome Sync item budget (was ${bytes} bytes)`
  );
}

function testLabelKeysExistInEveryLocale() {
  const locales = ['en', 'ja', 'zh_CN', 'zh_TW'];
  const labelKeys = Object.values(order.GROUP_LABEL_KEYS);
  locales.forEach((locale) => {
    const messages = JSON.parse(fs.readFileSync(
      path.join(repoRoot, `_locales/${locale}/messages.json`),
      'utf8'
    ));
    labelKeys.forEach((key) => {
      assert.ok(
        messages[key] && String(messages[key].message || '').trim(),
        `${locale} should localize the search scope group label ${key}`
      );
    });
  });
}

// Guards the wiring that the behaviour tests cannot reach: the search scope
// panels are built inside large closures, so their use of the shared ranker and
// its group keys is checked at the source level.
function testSurfacesUseTheSharedRanker() {
  const backgroundSource = fs.readFileSync(path.join(repoRoot, 'src/background/background.js'), 'utf8');
  const newtabSource = fs.readFileSync(path.join(repoRoot, 'src/newtab/search-modes.js'), 'utf8');
  const overlaySource = fs.readFileSync(path.join(repoRoot, 'src/overlay/search-panel.js'), 'utf8');

  assert.match(
    backgroundSource,
    /SEARCH_SOURCE_ORDER\.sortProviders\(merged, order\)/,
    'the background should apply the stored order to the provider list it publishes'
  );
  assert.match(
    backgroundSource,
    /loadSearchSourceOrder\(merged, aggregates\)/,
    'the background should resolve the order against the merged providers'
  );

  [newtabSource, overlaySource].forEach((source, index) => {
    const surface = index === 0 ? 'New Tab' : 'overlay';
    assert.match(
      source,
      /SEARCH_SOURCE_ORDER\.rankMenuItems\(items, order, \{/,
      `${surface} should rank its search scope items with the shared ranker`
    );
    ['aggregate', 'engine', 'site', 'ai', 'local'].forEach((group) => {
      assert.ok(
        source.includes(`groupKey: '${group}'`) ||
          source.includes(`'${group}' : `) ||
          source.includes(`'${group}': `) ||
          source.includes(`: '${group}'`),
        `${surface} should tag the ${group} group so the block order can apply`
      );
    });
  });
}

// The ordering record must be listed in the Chrome Sync contract and in the
// options export/import list, or the order silently stops syncing.
function testSyncContractCarriesTheOrder() {
  const settingsSource = fs.readFileSync(path.join(repoRoot, 'src/shared/settings.js'), 'utf8');
  const optionsSource = fs.readFileSync(path.join(repoRoot, 'src/options/options.js'), 'utf8');
  assert.match(
    settingsSource,
    /AGGREGATE_SEARCH_AUTO_GROUP_ENABLED_STORAGE_KEY,\n\s*SEARCH_SOURCE_ORDER_STORAGE_KEY,/,
    'the order key should sit inside CHROME_SYNC_STORAGE_KEYS'
  );
  // The Options page takes its sync contract straight from the shared list, so
  // it follows the key automatically; the assertion guards that it still does.
  assert.match(
    optionsSource,
    /const SYNC_KEYS = SETTINGS\.CHROME_SYNC_STORAGE_KEYS;/,
    'options export and import should use the shared Chrome Sync contract'
  );
  const settings = require('../src/shared/settings.js');
  assert.ok(
    settings.CHROME_SYNC_STORAGE_KEYS.includes(order.STORAGE_KEY),
    'the shared Chrome Sync contract should carry the order key'
  );
}

testRegistryShape();
testFirstRunOrderIsAlphabetical();
testEveryProviderKeepsExactlyOneSlot();
testStoredOrderSurvivesDisabledAndNewProviders();
testMovedProviderLeadsItsGroup();
testUnknownRecordFallsBack();
testRecordFitsSyncBudget();
testLabelKeysExistInEveryLocale();
testSurfacesUseTheSharedRanker();
testSyncContractCarriesTheOrder();
console.log('search source order integration tests passed');
