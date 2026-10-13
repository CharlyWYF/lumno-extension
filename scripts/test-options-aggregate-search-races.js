const assert = require('assert');

const { createAggregateSearchStateCoordinator } = require('../src/options/options-aggregate-search');
const searchUtils = require('../src/shared/search-utils');
const aggregateSearchStore = require('../src/shared/aggregate-search-store');
const siteSearchModel = require('../src/options/options-site-search').createSiteSearchModel({
  searchUtils,
  aggregateSearchStore
});
const conflictState = {
  aggregateSearches: [
    { id: 'aggregate-1', key: 'tech', name: 'Technology' }
  ],
  providers: [{ key: 'gg', name: 'Google' }, { key: 'docs', name: 'Docs' }]
};
const findSiteSearchKeyConflict = (key, allowedKey, allowedAggregateId) => (
  siteSearchModel.findSiteSearchKeyConflict(key, allowedKey, allowedAggregateId, conflictState)
);

assert.strictEqual(
  findSiteSearchKeyConflict('gg', '', '' ).name,
  'Google',
  'aggregate editors must reject built-in search triggers'
);
assert.strictEqual(
  findSiteSearchKeyConflict('docs', '', '').name,
  'Docs',
  'aggregate editors must reject custom search triggers'
);
assert.strictEqual(
  findSiteSearchKeyConflict('tech', '', '').id,
  'aggregate-1',
  'normal search editors must reject aggregate triggers'
);
assert.strictEqual(
  findSiteSearchKeyConflict('tech', '', 'aggregate-1'),
  null,
  'editing an aggregate may retain its own trigger'
);

function cloneItems(items) {
  return (Array.isArray(items) ? items : []).map((item) => ({ ...item }));
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function flushTasks() {
  return new Promise((resolve) => setImmediate(resolve));
}

async function testConcurrentMutationsUseLatestStoredState() {
  let storedItems = [{ id: 'a', name: 'A' }];
  let renderedItems = cloneItems(storedItems);
  const saveCalls = [];
  let loadCount = 0;
  const coordinator = createAggregateSearchStateCoordinator({
    apply(items) {
      renderedItems = cloneItems(items);
    },
    getCurrent() {
      return renderedItems;
    },
    load() {
      loadCount += 1;
      return Promise.resolve(cloneItems(storedItems));
    },
    normalize: cloneItems,
    save(items) {
      const deferred = createDeferred();
      saveCalls.push({ deferred, items: cloneItems(items) });
      return deferred.promise;
    }
  });

  const addPromise = coordinator.enqueueMutation((items) => ({
    items: items.concat({ id: 'b', name: 'B' }),
    ok: true
  }));
  const removePromise = coordinator.enqueueMutation((items) => ({
    items: items.filter((item) => item.id !== 'a'),
    ok: true
  }));

  await flushTasks();
  assert.strictEqual(saveCalls.length, 1, 'a second UI write must wait for the first write');
  assert.deepStrictEqual(saveCalls[0].items.map((item) => item.id), ['a', 'b']);

  storedItems = cloneItems(saveCalls[0].items);
  saveCalls[0].deferred.resolve(cloneItems(storedItems));
  await addPromise;
  await flushTasks();

  assert.strictEqual(saveCalls.length, 2, 'the queued mutation must start after the first save');
  assert.deepStrictEqual(
    saveCalls[1].items.map((item) => item.id),
    ['b'],
    'the second mutation must apply to the state saved by the first mutation'
  );

  storedItems = cloneItems(saveCalls[1].items);
  saveCalls[1].deferred.resolve(cloneItems(storedItems));
  await removePromise;

  assert.strictEqual(loadCount, 2, 'each queued mutation must reload the latest stored list');
  assert.deepStrictEqual(renderedItems.map((item) => item.id), ['b']);
}

async function testStorageChangeInvalidatesPendingMutationRead() {
  let renderedItems = [{ id: 'old', name: 'Old' }];
  const loadCalls = [];
  const saveCalls = [];
  const coordinator = createAggregateSearchStateCoordinator({
    apply(items) {
      renderedItems = cloneItems(items);
    },
    getCurrent() {
      return renderedItems;
    },
    load() {
      const deferred = createDeferred();
      loadCalls.push(deferred);
      return deferred.promise;
    },
    normalize: cloneItems,
    save(items) {
      saveCalls.push(cloneItems(items));
      return Promise.resolve(cloneItems(items));
    }
  });

  const mutationPromise = coordinator.enqueueMutation((items) => ({
    items: items.concat({ id: 'added', name: 'Added' }),
    ok: true
  }));
  await flushTasks();
  assert.strictEqual(loadCalls.length, 1);

  coordinator.applyStorageChange([{ id: 'new', name: 'New' }]);
  loadCalls[0].resolve([{ id: 'old', name: 'Old' }]);
  await flushTasks();

  assert.strictEqual(loadCalls.length, 2, 'a read invalidated by storage change must retry');
  loadCalls[1].resolve([{ id: 'new', name: 'New' }]);
  await mutationPromise;

  assert.deepStrictEqual(saveCalls[0].map((item) => item.id), ['new', 'added']);
  assert.deepStrictEqual(renderedItems.map((item) => item.id), ['new', 'added']);
}

async function testLateRefreshCannotOverwriteNewerState() {
  let renderedItems = [];
  let loadErrorCount = 0;
  const loadCalls = [];
  const coordinator = createAggregateSearchStateCoordinator({
    apply(items) {
      renderedItems = cloneItems(items);
    },
    getCurrent() {
      return renderedItems;
    },
    load() {
      const deferred = createDeferred();
      loadCalls.push(deferred);
      return deferred.promise;
    },
    normalize: cloneItems,
    onLoadError() {
      loadErrorCount += 1;
    },
    save(items) {
      return Promise.resolve(cloneItems(items));
    }
  });

  const initialRefresh = coordinator.refresh();
  coordinator.applyStorageChange([{ id: 'changed', name: 'Changed' }]);
  loadCalls[0].resolve([{ id: 'initial', name: 'Initial' }]);
  await initialRefresh;

  assert.deepStrictEqual(
    renderedItems.map((item) => item.id),
    ['changed'],
    'a late initial read must not replace a newer storage event'
  );
  assert.strictEqual(loadErrorCount, 0);

  const olderRefresh = coordinator.refresh();
  const newerRefresh = coordinator.refresh();
  loadCalls[2].resolve([{ id: 'newest', name: 'Newest' }]);
  await newerRefresh;
  loadCalls[1].resolve([{ id: 'stale', name: 'Stale' }]);
  await olderRefresh;

  assert.deepStrictEqual(
    renderedItems.map((item) => item.id),
    ['newest'],
    'refreshes that complete out of order must keep the newest load result'
  );
}

(async () => {
  await testConcurrentMutationsUseLatestStoredState();
  await testStorageChangeInvalidatesPendingMutationRead();
  await testLateRefreshCannotOverwriteNewerState();
  console.log('options aggregate search race tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
