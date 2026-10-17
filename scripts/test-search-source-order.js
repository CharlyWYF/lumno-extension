const assert = require('assert');
const order = require('../src/shared/search-source-order.js');

const KEY = '_x_extension_search_source_order_2026_unique_';

function keys(items) {
  return items.map((item) => item.orderKey || item.key || item.id);
}

// The search scope panel as it is built before ranking: aggregates, then
// engines, site searches and AI searches with custom ones first, then browser
// content led by "Search open tabs".
const PANEL_ITEMS = [
  { groupKey: 'aggregate', orderList: 'aggregate', orderKey: 'Agg1' },
  { groupKey: 'aggregate', orderList: 'aggregate', orderKey: 'Agg2' },
  { groupKey: 'engine', orderList: 'engine', orderKey: 'bd' },
  { groupKey: 'engine', orderList: 'engine', orderKey: 'gg' },
  { groupKey: 'site', orderList: 'custom', orderKey: 'mine' },
  { groupKey: 'site', orderList: 'site', orderKey: 'yt' },
  { groupKey: 'site', orderList: 'site', orderKey: 'gh' },
  { groupKey: 'ai', orderList: 'custom', orderKey: 'myai' },
  { groupKey: 'ai', orderList: 'ai', orderKey: 'gpt' },
  { groupKey: 'ai', orderList: 'ai', orderKey: 'ds' },
  { groupKey: 'local', orderList: 'pinned', orderKey: 'openTabs' },
  { groupKey: 'local', orderList: 'local', orderKey: 'topSite' },
  { groupKey: 'local', orderList: 'local', orderKey: 'bookmark' },
  { groupKey: 'local', orderList: 'local', orderKey: 'history' }
];

function testContract() {
  assert.strictEqual(order.STORAGE_KEY, KEY);
  assert.deepStrictEqual(order.DEFAULT_GROUP_ORDER, ['aggregate', 'engine', 'site', 'ai', 'local']);
  assert.deepStrictEqual(order.LIST_IDS, ['custom', 'engine', 'site', 'ai', 'aggregate']);
}

function testNoRecordKeepsTheUsualOrder() {
  [undefined, null, 'x', [], { version: 99, groups: ['ai'] }].forEach((value) => {
    const record = order.normalizeOrder(value);
    assert.deepStrictEqual(record.groups, ['aggregate', 'engine', 'site', 'ai', 'local']);
    assert.deepStrictEqual(record.local, ['topSite', 'bookmark', 'history']);
    order.LIST_IDS.forEach((listId) => assert.deepStrictEqual(record.lists[listId], []));
    assert.deepStrictEqual(
      keys(order.rankScopeItems(PANEL_ITEMS, value)),
      keys(PANEL_ITEMS),
      'without a record the panel keeps the order it builds'
    );
  });
}

function testGroupOrder() {
  const record = order.withGroups(null, ['local', 'ai']);
  assert.deepStrictEqual(record.groups, ['local', 'ai', 'aggregate', 'engine', 'site']);
  assert.deepStrictEqual(
    keys(order.rankScopeItems(PANEL_ITEMS, record)),
    ['openTabs', 'topSite', 'bookmark', 'history', 'myai', 'gpt', 'ds',
      'Agg1', 'Agg2', 'bd', 'gg', 'mine', 'yt', 'gh']
  );
}

function testListsOrderInsideTheirGroup() {
  let record = order.withList(null, 'site', ['gh', 'yt']);
  record = order.withList(record, 'aggregate', ['Agg2']);
  record = order.withLocal(record, ['history']);
  const ranked = keys(order.rankScopeItems(PANEL_ITEMS, record));
  assert.deepStrictEqual(ranked, [
    'Agg2', 'Agg1', 'bd', 'gg', 'mine', 'gh', 'yt', 'myai', 'gpt', 'ds',
    'openTabs', 'history', 'topSite', 'bookmark'
  ], 'custom searches still lead their group and "Search open tabs" leads browser content');
}

function testCustomSearchesOrderAcrossGroups() {
  const record = order.withList(null, 'custom', ['myai', 'mine']);
  const items = [
    { key: 'mine' },
    { key: 'myai' },
    { key: 'later' }
  ];
  assert.deepStrictEqual(
    order.sortList(items, record, 'custom').map((item) => item.key),
    ['myai', 'mine', 'later'],
    'a source the record does not list follows the listed ones in its own order'
  );
}

function testKeysMatchWithoutCase() {
  const record = order.withList(null, 'site', ['GH', 'YT']);
  assert.deepStrictEqual(record.lists.site, ['gh', 'yt']);
  assert.deepStrictEqual(
    order.sortList([{ key: 'yt' }, { key: 'Gh' }], record, 'site').map((item) => item.key),
    ['Gh', 'yt']
  );
  const aggregates = order.withList(null, 'aggregate', ['AbC']);
  assert.deepStrictEqual(aggregates.lists.aggregate, ['AbC'], 'aggregate ids keep their case');
}

// Source types are camelCase; a stored 'topSite' must not be lowercased away.
function testLocalSourceTypes() {
  const record = order.normalizeOrder({ version: 1, local: ['TOPSITE', 'history', 'nope'] });
  assert.deepStrictEqual(record.local, ['topSite', 'history', 'bookmark']);
  assert.deepStrictEqual(
    order.sortLocalSourceTypes(['bookmark', 'history', 'topSite'], record),
    ['topSite', 'history', 'bookmark']
  );
}

function testApplyMoveKeepsHiddenKeys() {
  // A disabled built-in ('sf') is stored but not on screen; moving the shown
  // rows must leave its slot alone.
  const stored = order.withList(null, 'site', ['yt', 'sf', 'gh', 'bb']);
  const next = order.applyMove(stored, 'site', ['yt', 'gh', 'bb'], ['bb', 'yt', 'gh']);
  assert.deepStrictEqual(next.lists.site, ['bb', 'sf', 'yt', 'gh']);
  const fresh = order.applyMove(null, 'engine', ['bd', 'gg', 'bi'], ['gg', 'bd', 'bi']);
  assert.deepStrictEqual(fresh.lists.engine, ['gg', 'bd', 'bi']);
}

function testScopeMenuMove() {
  // The panel reports custom searches of one group; custom searches of other
  // groups keep their slots in the shared custom list.
  const stored = order.withList(null, 'custom', ['mine', 'myai', 'other']);
  const next = order.applyScopeMenuMove(stored, {
    list: 'custom',
    listItems: [{ orderKey: 'other' }, { orderKey: 'mine' }, { orderKey: 'myai' }],
    movedItems: [{ orderKey: 'other' }, { orderKey: 'mine' }]
  });
  assert.deepStrictEqual(next.lists.custom, ['other', 'myai', 'mine']);
  const local = order.applyScopeMenuMove(null, {
    list: 'local',
    listItems: [{ orderKey: 'history' }, { orderKey: 'topSite' }],
    movedItems: [{ orderKey: 'history' }, { orderKey: 'topSite' }]
  });
  assert.deepStrictEqual(local.local, ['history', 'bookmark', 'topSite']);
  assert.deepStrictEqual(
    order.applyScopeMenuMove(stored, { list: 'pinned', movedItems: [] }),
    order.normalizeOrder(stored),
    'an unknown list changes nothing'
  );
}

function testRecordStaysInsideTheSyncBudget() {
  const many = Array.from({ length: 400 }, (_, index) => `provider-key-${index}-padding-text`);
  const record = order.normalizeOrder({
    version: 1,
    lists: { custom: many, engine: many, site: many, ai: many, aggregate: many }
  });
  const bytes = JSON.stringify(record).length + KEY.length;
  assert.ok(bytes <= order.MAX_RECORD_BYTES, `record is ${bytes} bytes`);
  order.LIST_IDS.forEach((listId) => {
    assert.ok(record.lists[listId].length <= order.MAX_LIST_ENTRIES);
  });
}

function testMoveIndex() {
  assert.deepStrictEqual(order.moveIndex(['a', 'b', 'c'], 2, 0), ['c', 'a', 'b']);
  assert.deepStrictEqual(order.moveIndex(['a', 'b', 'c'], 0, 5), ['a', 'b', 'c']);
}

testContract();
testNoRecordKeepsTheUsualOrder();
testGroupOrder();
testListsOrderInsideTheirGroup();
testCustomSearchesOrderAcrossGroups();
testKeysMatchWithoutCase();
testLocalSourceTypes();
testApplyMoveKeepsHiddenKeys();
testScopeMenuMove();
testRecordStaysInsideTheSyncBudget();
testMoveIndex();

console.log('search source order tests passed');
