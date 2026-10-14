const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = path.resolve(__dirname, '..');
const optionsSource = fs.readFileSync(path.join(repoRoot, 'src/options/options.js'), 'utf8');
const orderApi = require('../src/shared/search-source-order.js');
const searchUtils = require('../src/shared/search-utils.js');

const STORAGE_KEY = '_x_extension_search_source_order_2026_unique_';

// Extracts one top-level function body from options.js so the ordering logic
// can run against the real implementation instead of a copy.
function extractFunction(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `${name} should exist in options.js`);
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
  throw new Error(`${name} should have a complete body`);
}

const EXTRACTED_FUNCTIONS = [
  'getSearchSourceOrderApi',
  'getSearchSourceGroupKey',
  'getSiteSearchReorderCopy',
  'getDefaultSiteSearchProviderList',
  'getActiveSiteSearchOrder',
  'getSiteSearchProviderDisplayLists',
  'getSortedSiteSearchDisplayLists',
  'reorderSearchSourceList',
  'handleSiteSearchReorder',
  'handleAggregateSearchReorder',
  'getSearchSourceGroupOrder',
  'handleSearchSourceGroupReorder',
  'getSearchSourceLocalOrder',
  'handleSearchSourceLocalReorder',
  'persistSearchSourceOrder',
  'loadSearchSourceOrderValue',
  'applyLoadedSearchSourceOrder',
  'sortSearchSourceList'
];

function createHarness(state, options) {
  const config = options && typeof options === 'object' ? options : {};
  const writes = [];
  const rendered = { site: 0, aggregate: 0 };
  const sandbox = {
    console,
    SEARCH_SOURCE_ORDER: orderApi,
    SEARCH_UTILS: searchUtils,
    SETTINGS: {
      readStorageValue: () => (config.failOrderRead
        ? Promise.reject(new Error('storage-read-failed'))
        : Promise.resolve(undefined)),
      writeStorageValue: (area, chromeApi, key, value) => {
        writes.push({ key, value: JSON.parse(JSON.stringify(value)) });
        return Promise.resolve();
      }
    },
    rawStorageArea: {},
    chrome: {},
    storageArea: {},
    SEARCH_SOURCE_ORDER_STORAGE_KEY: STORAGE_KEY,
    SEARCH_SOURCE_GROUP_LABEL_KEYS: Object.freeze({
      aggregate: 'search_scope_group_aggregates',
      ai: 'search_scope_group_ai',
      engine: 'search_scope_group_engines',
      local: 'search_scope_group_local',
      site: 'search_scope_group_sites'
    }),
    getMessage: (key, fallback) => fallback || key,
    renderSiteSearchList: () => {
      rendered.site += 1;
    },
    renderAggregateSearchList: () => {
      rendered.aggregate += 1;
    },
    renderSearchSourceGroupOrderControl: () => {},
    renderSearchSourceLocalOrderControl: () => {},
    saveAggregateSearches: (items) => Promise.resolve(items),
    defaultSiteSearchProviders: state.defaultSiteSearchProviders,
    aggregateSearches: state.aggregateSearches,
    customSiteSearchProvidersSeed: state.customSiteSearchProviders,
    disabledSiteSearchKeysSeed: state.disabledSiteSearchKeys
  };
  const context = vm.createContext(sandbox);
  const declarations = EXTRACTED_FUNCTIONS
    .map((name) => extractFunction(optionsSource, name))
    .join('\n');
  vm.runInContext(`let customSiteSearchProviders =
    globalThis.customSiteSearchProvidersSeed || [];
  let customSiteSearchProviderIdsReady = true;
  let disabledSiteSearchKeys = globalThis.disabledSiteSearchKeysSeed || new Set();
  let searchSourceOrderState = null;
  ${declarations}
  globalThis.api = {
    ${EXTRACTED_FUNCTIONS.join(',\n    ')}
  };
  globalThis.state = {
    get searchSourceOrderState() { return searchSourceOrderState; },
    set searchSourceOrderState(value) { searchSourceOrderState = value; },
    get customSiteSearchProviders() { return customSiteSearchProviders; },
    set customSiteSearchProviders(value) { customSiteSearchProviders = value; },
    get disabledSiteSearchKeys() { return disabledSiteSearchKeys; },
    set disabledSiteSearchKeys(value) { disabledSiteSearchKeys = value; },
    get aggregateSearches() { return aggregateSearches; },
    set aggregateSearches(value) { aggregateSearches = value; },
    get defaultSiteSearchProviders() { return defaultSiteSearchProviders; }
  };`, context, { filename: 'options-ordering-extract.js' });
  return { api: context.api, state: context.state, writes, rendered };
}

const REGISTRY = [
  { key: 'yt', name: 'YouTube', template: 'https://www.youtube.com/results?search_query={query}' },
  { key: 'bb', name: 'Bilibili', template: 'https://search.bilibili.com/all?keyword={query}' },
  { key: 'gh', name: 'GitHub', template: 'https://github.com/search?q={query}' },
  { key: 'gg', name: 'Google', template: 'https://www.google.com/search?q={query}', category: 'searchEngine' },
  { key: 'bd', name: 'Baidu', template: 'https://www.baidu.com/s?wd={query}', category: 'searchEngine' },
  { key: 'bi', name: 'Bing', template: 'https://www.bing.com/search?q={query}', category: 'searchEngine' },
  { key: 'gpt', name: 'ChatGPT', template: 'https://chatgpt.com/?q={query}', action: 'openAndSubmit' }
];

function createState(overrides) {
  return Object.assign({
    defaultSiteSearchProviders: REGISTRY.map((item) => ({ ...item })),
    customSiteSearchProviders: [],
    disabledSiteSearchKeys: new Set(),
    aggregateSearches: []
  }, overrides || {});
}

function testDisplayListsPartitionProviders() {
  const harness = createHarness(createState());
  const lists = harness.api.getSiteSearchProviderDisplayLists.call(harness.api);
  assert.deepStrictEqual(lists.engines.map((item) => item.key), ['gg', 'bd', 'bi']);
  assert.deepStrictEqual(lists.sites.map((item) => item.key), ['yt', 'bb', 'gh']);
  assert.deepStrictEqual(lists.ai.map((item) => item.key), ['gpt']);
  assert.deepStrictEqual(lists.custom, [], 'a reader with no custom providers has an empty custom list');
}

function testDisabledAndCustomisedBuiltinAreExcludedFromDefaults() {
  const harness = createHarness(createState({
    customSiteSearchProviders: [
      {
        key: 'yt',
        name: 'YouTube Custom',
        builtinKey: 'yt',
        template: 'https://www.youtube.com/results?search_query={query}'
      }
    ],
    disabledSiteSearchKeys: new Set(['gh'])
  }));
  const lists = harness.api.getSiteSearchProviderDisplayLists.call(harness.api);
  assert.deepStrictEqual(lists.sites.map((item) => item.key), ['bb'],
    'a customised or disabled built-in must not also render in the built-in list');
  assert.deepStrictEqual(lists.custom.map((item) => item.key), ['yt']);
}

async function testSiteSearchReorderRebuildsTheRecord() {
  const state = createState();
  const harness = createHarness(state);
  const context = createHarnessContext(harness);
  // The page always resolves the record before the reader can reorder.
  call(context, harness, 'applyLoadedSearchSourceOrder', undefined);
  const lists = call(context, harness, 'getSortedSiteSearchDisplayLists');
  // Move GitHub (last site search) to the front of its own list.
  call(context, harness, 'handleSiteSearchReorder', 'search', 2, 0, lists);

  const written = harness.writes.filter((entry) => entry.key === STORAGE_KEY);
  assert.strictEqual(written.length, 1, 'one reorder should write the order record once');
  const record = written[0].value;
  const siteOrder = call(context, harness, 'sortSearchSourceList',
    harness.state.defaultSiteSearchProviders
      .filter((provider) => provider.key === 'yt' || provider.key === 'bb' || provider.key === 'gh'))
    .map((provider) => provider.key);
  assert.deepStrictEqual(
    siteOrder,
    ['yt', 'bb', 'gh'],
    'the moved row should lead its own group and the rest should keep their order'
  );
  const keys = record.providers.map((entry) => entry.key);
  assert.deepStrictEqual(
    keys.slice().sort(),
    ['bb', 'bd', 'bi', 'gg', 'gh', 'gpt', 'yt'],
    'rebuilding the record after a move must keep every provider exactly once'
  );
  assert.strictEqual(new Set(keys).size, keys.length, 'the rebuilt record must not duplicate a provider');
  assert.strictEqual(keys.length, REGISTRY.length, 'the rebuilt record keeps every provider');
  assert.strictEqual(record.version, orderApi.SCHEMA_VERSION);
}

// Regression: the rebuilt record must read the reordered list back out of the
// working map instead of the pre-move snapshot, or the moved row disappears.
async function testReorderKeepsEveryProviderInTheRebuiltRecord() {
  const cases = [
    { group: 'site', kind: 'search', from: 2, to: 0 },
    { group: 'engine', kind: 'engine', from: 0, to: 2 },
    { group: 'site', kind: 'custom', from: 0, to: 1 }
  ];
  for (const scenario of cases) {
    const harness = createHarness(createState({
      customSiteSearchProviders: [
        { key: 'mine', name: 'My Search', template: 'https://example.com/?q={query}' },
        { key: 'other', name: 'Other Search', template: 'https://other.example/?q={query}' }
      ]
    }));
    const context = createHarnessContext(harness);
    call(context, harness, 'applyLoadedSearchSourceOrder', undefined);
    const lists = call(context, harness, 'getSortedSiteSearchDisplayLists');
    call(context, harness, 'handleSiteSearchReorder', scenario.kind, scenario.from, scenario.to, lists);
    const written = harness.writes.filter((entry) => entry.key === STORAGE_KEY);
    assert.strictEqual(written.length, 1, `${scenario.kind}: one reorder should write once`);
    const keys = written[0].value.providers.map((entry) => entry.key);
    assert.strictEqual(
      keys.length,
      REGISTRY.length + 2,
      `${scenario.kind}: rebuilding the record must not drop or duplicate a provider`
    );
    assert.strictEqual(new Set(keys).size, keys.length, `${scenario.kind}: no duplicates`);
    assert.ok(
      keys.includes('mine') && keys.includes('other'),
      `${scenario.kind}: custom providers must survive a reorder of another list`
    );
  }
}

async function testEngineReorderStaysInsideTheEngineList() {
  const state = createState();
  const harness = createHarness(state);
  const context = createHarnessContext(harness);
  call(context, harness, 'applyLoadedSearchSourceOrder', undefined);
  const lists = call(context, harness, 'getSortedSiteSearchDisplayLists');
  call(context, harness, 'handleSiteSearchReorder', 'engine', 0, 2, lists);

  const record = harness.writes.filter((entry) => entry.key === STORAGE_KEY)[0].value;
  const engineOrder = call(context, harness, 'sortSearchSourceList',
    harness.state.defaultSiteSearchProviders
      .filter((provider) => provider.category === 'searchEngine'))
    .map((provider) => provider.key);
  assert.deepStrictEqual(
    engineOrder,
    ['bi', 'gg', 'bd'],
    'reordering the engine list should move the row and leave the rest in order'
  );
  const siteKeys = record.providers
    .filter((entry) => entry.group === 'site')
    .map((entry) => entry.key);
  assert.deepStrictEqual(siteKeys.slice().sort(), ['bb', 'gh', 'yt'],
    'reordering one list must not disturb another group');
}

function testReorderHelperIgnoresOutOfRangeMoves() {
  const harness = createHarness(createState());
  const list = ['a', 'b', 'c'];
  assert.deepStrictEqual(harness.api.reorderSearchSourceList.call(harness.api, list, 0, 0), list);
  assert.deepStrictEqual(harness.api.reorderSearchSourceList.call(harness.api, list, -1, 1), list);
  assert.deepStrictEqual(harness.api.reorderSearchSourceList.call(harness.api, list, 0, 9), list);
  assert.deepStrictEqual(harness.api.reorderSearchSourceList.call(harness.api, list, 0, 2), ['b', 'c', 'a']);
}

// A move that changes nothing must not rewrite storage: the settings page has to
// stay quiet when a single-item list or an out-of-range drop is attempted.
async function testNoOpReorderDoesNotWrite() {
  const harness = createHarness(createState());
  const context = createHarnessContext(harness);
  call(context, harness, 'applyLoadedSearchSourceOrder', undefined);
  const lists = call(context, harness, 'getSortedSiteSearchDisplayLists');
  call(context, harness, 'handleSiteSearchReorder', 'ai', 0, 0, lists);
  call(context, harness, 'handleSiteSearchReorder', 'search', 0, 99, lists);
  assert.strictEqual(
    harness.writes.filter((entry) => entry.key === STORAGE_KEY).length,
    0,
    'a move that does not change the order must not write the record'
  );
}

function testGroupOrderReordersTheBlocks() {
  const harness = createHarness(createState());
  const context = createHarnessContext(harness);
  call(context, harness, 'applyLoadedSearchSourceOrder', undefined);
  const before = call(context, harness, 'getSearchSourceGroupOrder');
  assert.deepStrictEqual(before, ['aggregate', 'ai', 'engine', 'local', 'site']);
  call(context, harness, 'handleSearchSourceGroupReorder', 4, 0);
  const record = harness.writes.filter((entry) => entry.key === STORAGE_KEY)[0].value;
  assert.deepStrictEqual(record.groups, ['site', 'aggregate', 'ai', 'engine', 'local'],
    'moving the last group block to the front should be persisted');
  assert.deepStrictEqual(call(context, harness, 'getSearchSourceGroupOrder'),
    ['site', 'aggregate', 'ai', 'engine', 'local']);
}

function testSortSearchSourceListFollowsTheStoredOrder() {
  const harness = createHarness(createState());
  const context = createHarnessContext(harness);
  call(context, harness, 'applyLoadedSearchSourceOrder', undefined);
  const items = [
    { key: 'gh' },
    { key: 'yt' },
    { key: 'bb' }
  ];
  const sorted = call(context, harness, 'sortSearchSourceList', items);
  assert.strictEqual(sorted.length, items.length);
  assert.deepStrictEqual(
    sorted.map((item) => item.key),
    ['bb', 'gh', 'yt'],
    'the rendered page order must match the resolved record, not the registry order'
  );
}

// Regression: the background publishes providers grouped by the resolved block
// order, so the settings page must sort by the same rule. Reordering only the
// group blocks (without touching the provider positions) is what exposes a
// page that sorts by bare record position instead.
function testRenderedOrderMatchesTheResolvedRecord() {
  const harness = createHarness(createState());
  const context = createHarnessContext(harness);
  call(context, harness, 'applyLoadedSearchSourceOrder', {
    version: orderApi.SCHEMA_VERSION,
    groups: ['engine', 'site', 'ai', 'local', 'aggregate'],
    providers: [
      { key: 'gh', group: 'site' },
      { key: 'yt', group: 'site' },
      { key: 'bb', group: 'site' },
      { key: 'bi', group: 'engine' },
      { key: 'gg', group: 'engine' },
      { key: 'bd', group: 'engine' },
      { key: 'gpt', group: 'ai' }
    ],
    local: ['topSite', 'bookmark', 'history'],
    aggregates: []
  });
  const resolved = call(context, harness, 'getActiveSiteSearchOrder');
  const providers = harness.state.defaultSiteSearchProviders;
  const expected = orderApi.sortProviders(providers, resolved).map((item) => item.key);
  assert.deepStrictEqual(expected.slice(0, 3), ['bi', 'gg', 'bd'],
    'the published order should start with the first block the reader chose');
  const sorted = call(context, harness, 'sortSearchSourceList', providers);
  assert.deepStrictEqual(
    sorted.map((item) => item.key),
    expected,
    'the settings page order must equal the published order for the same record'
  );
}

// The first run must show the alphabetical default, and it must NOT write it:
// the resolved default is deterministic, so seeding it would only risk
// overwriting an order another device has already synced.
function testFirstRunUsesTheAlphabeticalDefaultWithoutWriting() {
  const harness = createHarness(createState());
  const context = createHarnessContext(harness);
  call(context, harness, 'applyLoadedSearchSourceOrder', undefined);
  assert.strictEqual(
    harness.writes.filter((entry) => entry.key === STORAGE_KEY).length,
    0,
    'resolving the default must not write the record'
  );
  const record = call(context, harness, 'getActiveSiteSearchOrder');
  assert.deepStrictEqual(record.groups, ['aggregate', 'ai', 'engine', 'local', 'site']);
  const engineKeys = record.providers.filter((entry) => entry.group === 'engine').map((entry) => entry.key);
  assert.deepStrictEqual(engineKeys, ['bd', 'bi', 'gg'], 'engines should be alphabetical by name');
  const siteKeys = record.providers.filter((entry) => entry.group === 'site').map((entry) => entry.key);
  assert.deepStrictEqual(siteKeys, ['bb', 'gh', 'yt'],
    'site searches should be alphabetical rather than registry order');
}

// A failed read must not be mistaken for "no record yet", or the page would
// resolve a default that hides the reader's stored order.
function testFailedOrderReadPropagates() {
  const harness = createHarness(createState(), { failOrderRead: true });
  const context = createHarnessContext(harness);
  let rejected = false;
  return call(context, harness, 'loadSearchSourceOrderValue')
    .then(() => undefined, () => {
      rejected = true;
    })
    .then(() => {
      assert.strictEqual(rejected, true, 'a failed storage read must reject instead of resolving undefined');
    });
}

function testStoredRecordIsRespectedOnLoad() {
  const state = createState();
  const harness = createHarness(state);
  const context = createHarnessContext(harness);
  call(context, harness, 'applyLoadedSearchSourceOrder', {
    version: orderApi.SCHEMA_VERSION,
    groups: ['site', 'engine', 'ai', 'local', 'aggregate'],
    providers: [
      { key: 'gh', group: 'site' },
      { key: 'yt', group: 'site' },
      { key: 'bb', group: 'site' }
    ],
    local: ['topSite', 'bookmark', 'history'],
    aggregates: []
  });
  assert.strictEqual(
    harness.writes.filter((entry) => entry.key === STORAGE_KEY).length,
    0,
    'an existing record must not be rewritten on every load'
  );
  assert.deepStrictEqual(call(context, harness, 'getSearchSourceGroupOrder'),
    ['site', 'engine', 'ai', 'local', 'aggregate']);
  const siteKeys = call(context, harness, 'getActiveSiteSearchOrder')
    .providers.filter((entry) => entry.group === 'site').map((entry) => entry.key);
  assert.deepStrictEqual(siteKeys.slice(0, 3), ['gh', 'yt', 'bb'],
    'the stored order should drive the rendered list');
}

function createHarnessContext(harness) {
  return harness;
}

function call(_context, harness, name, ...args) {
  return harness.api[name].call(harness.api, ...args);
}

async function main() {
  testDisplayListsPartitionProviders();
  testDisabledAndCustomisedBuiltinAreExcludedFromDefaults();
  testReorderHelperIgnoresOutOfRangeMoves();
  await testNoOpReorderDoesNotWrite();
  await testSiteSearchReorderRebuildsTheRecord();
  await testReorderKeepsEveryProviderInTheRebuiltRecord();
  await testEngineReorderStaysInsideTheEngineList();
  testGroupOrderReordersTheBlocks();
  testSortSearchSourceListFollowsTheStoredOrder();
  testRenderedOrderMatchesTheResolvedRecord();
  testFirstRunUsesTheAlphabeticalDefaultWithoutWriting();
  await testFailedOrderReadPropagates();
  testStoredRecordIsRespectedOnLoad();
  console.log('options search source ordering tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
