const assert = require('assert');
const order = require('../src/shared/search-source-order.js');

// Registry names mirror assets/data/site-search.json closely enough to prove
// the alphabetical default without depending on the whole file.
const PROVIDERS = [
  { key: 'yt', name: 'YouTube' },
  { key: 'bb', name: 'Bilibili' },
  { key: 'gh', name: 'GitHub' },
  { key: 'gg', name: 'Google', category: 'searchEngine' },
  { key: 'bd', name: 'Baidu', category: 'searchEngine' },
  { key: 'bi', name: 'Bing', category: 'searchEngine' },
  { key: 'kg', name: 'Kagi', category: 'searchEngine' },
  { key: 'eco', name: 'Ecosia', category: 'searchEngine' },
  { key: 'br', name: 'Brave Search', category: 'searchEngine' },
  { key: 'yh', name: 'Yahoo', category: 'searchEngine' },
  { key: 'yx', name: 'Yandex', category: 'searchEngine' },
  { key: 'sg', name: 'Sogou', category: 'searchEngine' },
  { key: 'sm', name: 'Shenma', category: 'searchEngine' },
  { key: 'gpt', name: 'ChatGPT', action: 'openAndSubmit' },
  { key: 'kimi', name: 'Kimi', action: 'openAndSubmit' },
  { key: 'ds', name: 'DeepSeek', action: 'openAndSubmit' }
];

function getGroupKey(provider) {
  if (provider && provider.category === 'searchEngine') {
    return 'engine';
  }
  if (provider && provider.action === 'openAndSubmit') {
    return 'ai';
  }
  return 'site';
}

function getName(provider) {
  return provider && (provider.name || provider.key);
}

function classifyOptions(extra) {
  return Object.assign({ getGroupKey, getName }, extra || {});
}

function providerKeys(items) {
  return items.map((item) => item.key);
}

const AGGREGATES = [
  { id: 'a2', name: 'Zeta', sourceRefs: ['builtin:gg', 'builtin:bi'] },
  { id: 'a1', name: 'Alpha', sourceRefs: ['builtin:gg', 'builtin:bb'] }
];

function testStorageContract() {
  assert.strictEqual(
    order.STORAGE_KEY,
    '_x_extension_search_source_order_2026_unique_',
    'the order record should use one stable Chrome Sync key'
  );
  assert.strictEqual(order.SCHEMA_VERSION, 1);
  assert.deepStrictEqual(
    order.DEFAULT_GROUP_ORDER,
    ['aggregate', 'ai', 'engine', 'local', 'site'],
    'group order should default to alphabetical'
  );
  assert.deepStrictEqual(
    order.LOCAL_SOURCE_TYPES,
    ['topSite', 'bookmark', 'history'],
    'browser content should keep its canonical source types'
  );
}

function testInitialOrderIsAlphabetical() {
  const initial = order.resolveInitialOrder(PROVIDERS, classifyOptions());
  assert.deepStrictEqual(
    initial.groups,
    ['aggregate', 'ai', 'engine', 'local', 'site'],
    'AI search should sort ahead of Search engines and Site search'
  );
  const enginesInOrder = initial.providers
    .filter((entry) => entry.group === 'engine')
    .map((entry) => entry.key);
  assert.deepStrictEqual(
    enginesInOrder,
    ['bd', 'bi', 'br', 'eco', 'gg', 'kg', 'sm', 'sg', 'yh', 'yx'],
    'search engines should be alphabetical by display name'
  );
  const aiInOrder = initial.providers
    .filter((entry) => entry.group === 'ai')
    .map((entry) => entry.key);
  assert.deepStrictEqual(
    aiInOrder,
    ['gpt', 'ds', 'kimi'],
    'AI search providers should be alphabetical by display name'
  );
  const sitesInOrder = initial.providers
    .filter((entry) => entry.group === 'site')
    .map((entry) => entry.key);
  assert.deepStrictEqual(sitesInOrder, ['bb', 'gh', 'yt']);
}

function testSortUsesConfiguredOrder() {
  const stored = {
    version: 1,
    groups: ['site', 'engine', 'ai', 'local', 'aggregate'],
    providers: [
      { key: 'yt', group: 'site' },
      { key: 'gh', group: 'site' },
      { key: 'bb', group: 'site' }
    ],
    local: ['history', 'bookmark', 'topSite'],
    aggregates: []
  };
  const resolved = order.normalizeOrder(stored, PROVIDERS, classifyOptions());
  assert.deepStrictEqual(
    resolved.groups,
    ['site', 'engine', 'ai', 'local', 'aggregate'],
    'a stored group order should win over the alphabetical default'
  );
  assert.deepStrictEqual(
    providerKeys(order.sortProviders(PROVIDERS, resolved)).slice(0, 3),
    ['yt', 'gh', 'bb'],
    'listed providers should lead in their configured order'
  );
  assert.deepStrictEqual(
    order.sortLocalSourceTypes(['topSite', 'bookmark', 'history'], resolved),
    ['history', 'bookmark', 'topSite'],
    'browser content order should follow the stored list'
  );
  const groups = order.getGroupRank(resolved);
  assert.strictEqual(groups.site, 0);
  assert.strictEqual(groups.aggregate, 4);
}

function testUnknownProvidersAppendWithoutDisturbingOrder() {
  const stored = {
    version: 1,
    groups: ['aggregate', 'ai', 'engine', 'local', 'site'],
    providers: [{ key: 'yt', group: 'site' }],
    local: ['topSite'],
    aggregates: []
  };
  const resolved = order.normalizeOrder(stored, PROVIDERS, classifyOptions());
  assert.strictEqual(resolved.providers[0].key, 'yt');
  const keys = resolved.providers.map((entry) => entry.key);
  assert.strictEqual(new Set(keys).size, keys.length, 'reconciled order must not duplicate keys');
  assert.strictEqual(keys.length, PROVIDERS.length, 'every provider should appear exactly once');
  assert.deepStrictEqual(resolved.local, ['topSite', 'bookmark', 'history']);
  const engineTail = resolved.providers.filter((entry) => entry.group === 'engine').map((entry) => entry.key);
  assert.deepStrictEqual(
    engineTail,
    ['bd', 'bi', 'br', 'eco', 'gg', 'kg', 'sm', 'sg', 'yh', 'yx'],
    'providers missing from the record should append alphabetically'
  );
}

function testAggregatesReconcile() {
  const resolved = order.normalizeOrder({ version: 1, providers: [], aggregates: ['a2'] },
    PROVIDERS, classifyOptions({ aggregates: AGGREGATES }));
  assert.deepStrictEqual(resolved.aggregates, ['a2', 'a1'], 'a new aggregate should append');
  assert.deepStrictEqual(
    order.sortAggregates(AGGREGATES, resolved).map((item) => item.id),
    ['a2', 'a1'],
    'aggregate sort should honour the stored order then keep the rest stable'
  );
}

function testInvalidRecordsFallBackToTheDefault() {
  const weak = [
    undefined,
    null,
    [],
    'nonsense',
    { groups: ['engine'] },
    { version: 99, providers: [{ key: 'yt', group: 'site' }] }
  ];
  weak.forEach((value) => {
    const resolved = order.normalizeOrder(value, PROVIDERS, classifyOptions());
    assert.deepStrictEqual(resolved.groups, ['aggregate', 'ai', 'engine', 'local', 'site']);
    assert.strictEqual(resolved.providers.length, PROVIDERS.length);
    assert.deepStrictEqual(resolved.local, ['topSite', 'bookmark', 'history']);
  });
}

function testOrderEntrySanitizing() {
  const resolved = order.normalizeOrder({
    version: 1,
    groups: ['site', 'site', 'unknown-group', 'engine'],
    providers: [
      { key: 'yt', group: 'site' },
      { key: 'YT', group: 'engine' },
      { key: 'gh', group: 'not-a-group' },
      { key: '', group: 'site' },
      'string-entry',
      { key: 'bb' }
    ],
    local: ['topSite', 'not-a-source', 'topSite'],
    aggregates: ['a1', 'a1', '', null]
  }, PROVIDERS, classifyOptions({ aggregates: AGGREGATES }));
  assert.strictEqual(
    resolved.providers[0].key,
    'yt',
    'the only usable entry should lead; duplicates, empty keys and unknown groups are dropped'
  );
  assert.strictEqual(
    resolved.providers.filter((entry) => entry.key === 'yt').length,
    1,
    'a key listed twice should be kept once'
  );
  assert.strictEqual(
    resolved.providers.length,
    PROVIDERS.length,
    'every provider still gets exactly one slot after sanitizing'
  );
  assert.deepStrictEqual(resolved.local, ['topSite', 'bookmark', 'history']);
  assert.deepStrictEqual(resolved.aggregates, ['a1', 'a2']);
  assert.deepStrictEqual(
    resolved.groups.slice(0, 2),
    ['site', 'engine'],
    'unknown group ids should be dropped and missing ones appended'
  );
  assert.strictEqual(resolved.groups.length, order.GROUP_IDS.length);
  assert.strictEqual(resolved.groups.filter((id) => id === 'site').length, 1);
}

function testGroupLookup() {
  const resolved = order.normalizeOrder({
    version: 1,
    providers: [{ key: 'bb', group: 'engine' }]
  }, PROVIDERS, classifyOptions());
  assert.strictEqual(order.getProviderGroup(resolved, 'bb', 'site'), 'engine');
  assert.strictEqual(order.getProviderGroup(resolved, 'BB', 'site'), 'engine');
  assert.strictEqual(order.getProviderGroup(resolved, 'yt', 'site'), 'site');
  assert.strictEqual(order.getProviderGroup(resolved, 'unknown', 'not-a-group'), 'site');
}

function testBoundedRecord() {
  const many = [];
  for (let index = 0; index < 400; index += 1) {
    many.push({ key: `k${index}`, group: 'site' });
  }
  const resolved = order.normalizeOrder({ version: 1, providers: many, local: [], aggregates: [] },
    PROVIDERS, classifyOptions());
  assert.ok(
    resolved.providers.length <= order.MAX_ORDER_ENTRIES + PROVIDERS.length,
    'an oversized record should be clamped instead of growing without bound'
  );
  const serialized = JSON.stringify(resolved);
  assert.ok(serialized.length < 8192, 'the order record must stay inside the Chrome Sync item budget');
}

function testRankMenuItems() {
  const stored = {
    version: 1,
    groups: ['engine', 'ai', 'local', 'site', 'aggregate'],
    providers: [
      { key: 'sg', group: 'engine' },
      { key: 'bd', group: 'engine' },
      { key: 'gpt', group: 'ai' },
      { key: 'yt', group: 'site' },
      { key: 'gh', group: 'site' }
    ],
    local: ['bookmark', 'history', 'topSite'],
    aggregates: ['a1']
  };
  const resolved = order.normalizeOrder(stored, PROVIDERS, classifyOptions({ aggregates: AGGREGATES }));
  const items = [
    { groupKey: 'site', id: 'gh', kind: 'provider', provider: { key: 'gh' } },
    { groupKey: 'aggregate', id: 'aggregate:a2', kind: 'aggregate', aggregate: { id: 'a2' } },
    { groupKey: 'engine', id: 'gg', kind: 'provider', provider: { key: 'gg' } },
    { groupKey: 'local', id: 'local:history', kind: 'local', sourceType: 'history' },
    { groupKey: 'ai', id: 'gpt', kind: 'provider', provider: { key: 'gpt' } },
    { groupKey: 'engine', id: 'sg', kind: 'provider', provider: { key: 'sg' } },
    { groupKey: 'site', id: 'yt', kind: 'provider', provider: { key: 'yt' } },
    { groupKey: 'engine', id: 'bd', kind: 'provider', provider: { key: 'bd' } },
    { groupKey: 'local', id: 'local:topSite', kind: 'local', sourceType: 'topSite' },
    { groupKey: 'aggregate', id: 'aggregate:a1', kind: 'aggregate', aggregate: { id: 'a1' } }
  ];
  const ranked = order.rankMenuItems(items, resolved, {
    getGroup: (item) => item.groupKey
  });
  assert.deepStrictEqual(
    ranked.map((item) => item.id),
    [
      'sg', 'bd', 'gg',
      'gpt',
      'local:history', 'local:topSite',
      'yt', 'gh',
      'aggregate:a1', 'aggregate:a2'
    ],
    'groups should follow the stored block order and items their stored order inside each block'
  );
}

function testGroupLabels() {
  assert.strictEqual(order.getGroupLabelKey('engine'), 'search_scope_group_engines');
  assert.strictEqual(order.getGroupLabelKey('ai'), 'search_scope_group_ai');
  assert.strictEqual(order.getGroupLabelKey('local'), 'search_scope_group_local');
  assert.strictEqual(order.getGroupLabelKey('site'), 'search_scope_group_sites');
  assert.strictEqual(order.getGroupLabelKey('aggregate'), 'search_scope_group_aggregates');
  assert.strictEqual(order.getGroupLabelKey('nope'), '', 'unknown groups must not invent a locale key');
}

testStorageContract();
testInitialOrderIsAlphabetical();
testSortUsesConfiguredOrder();
testUnknownProvidersAppendWithoutDisturbingOrder();
testAggregatesReconcile();
testInvalidRecordsFallBackToTheDefault();
testOrderEntrySanitizing();
testGroupLookup();
testBoundedRecord();
testRankMenuItems();
testGroupLabels();
console.log('search source order tests passed');
