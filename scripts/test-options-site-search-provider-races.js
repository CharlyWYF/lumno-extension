const assert = require('assert');
const {
  createOperationQueue,
  createSiteSearchProviderRefreshCoordinator,
  createSnapshotPersister
} = require('../src/options/options-site-search');

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

function prepareSnapshot(snapshot) {
  const value = snapshot && typeof snapshot === 'object' ? snapshot : {};
  return {
    items: (Array.isArray(value.items) ? value.items : []).map((item) => ({
      ...item,
      id: item.id || `stable-${item.key}`
    })),
    needsPersistence: Boolean(value.needsMigration)
  };
}

async function testNewerRefreshInvalidatesOlderRead() {
  const loadCalls = [];
  const persisted = [];
  const applied = [];
  const coordinator = createSiteSearchProviderRefreshCoordinator({
    apply(prepared) {
      applied.push(prepared.items.map((item) => item.key));
    },
    load() {
      const deferred = createDeferred();
      loadCalls.push(deferred);
      return deferred.promise;
    },
    persist(prepared) {
      persisted.push(prepared.items.map((item) => item.key));
      return Promise.resolve();
    },
    prepare: prepareSnapshot
  });

  const olderRefresh = coordinator.refresh();
  await flushTasks();
  const newerRefresh = coordinator.refresh();

  loadCalls[0].resolve({
    items: [{ key: 'old' }],
    needsMigration: true
  });
  await olderRefresh;
  await flushTasks();

  assert.strictEqual(loadCalls.length, 2, 'refreshes must run through one serialized queue');
  loadCalls[1].resolve({
    items: [{ id: 'new-id', key: 'new' }],
    needsMigration: false
  });
  await newerRefresh;

  assert.deepStrictEqual(persisted, [], 'an invalidated snapshot must never be migrated');
  assert.deepStrictEqual(applied, [['new']], 'an invalidated snapshot must never be published');
}

async function testMigrationReloadsLatestStorageAndConfirmsWrite() {
  const snapshots = [
    {
      items: [{ key: 'old' }],
      needsMigration: true
    },
    {
      items: [{ key: 'old' }, { key: 'external' }],
      needsMigration: true
    }
  ];
  const persisted = [];
  const applied = [];
  let storedSnapshot = null;
  let loadCount = 0;
  const coordinator = createSiteSearchProviderRefreshCoordinator({
    apply(prepared) {
      applied.push(prepared.items.map((item) => item.key));
    },
    load() {
      loadCount += 1;
      if (snapshots.length > 0) {
        return Promise.resolve(snapshots.shift());
      }
      return Promise.resolve(storedSnapshot);
    },
    persist(prepared) {
      const items = prepared.items.map((item) => ({ ...item }));
      persisted.push(items);
      storedSnapshot = { items, needsMigration: false };
      return Promise.resolve();
    },
    prepare: prepareSnapshot
  });

  await coordinator.refresh();

  assert.strictEqual(loadCount, 3, 'migration must re-read before and after its storage write');
  assert.deepStrictEqual(
    persisted[0].map((item) => item.key),
    ['old', 'external'],
    'migration must preserve providers added after the first read'
  );
  assert.ok(
    persisted[0].every((item) => item.id),
    'the latest provider snapshot must receive stable ids before persistence'
  );
  assert.deepStrictEqual(
    applied,
    [['old', 'external']],
    'the UI must publish the storage-confirmed provider snapshot'
  );
}

async function testRefreshDuringMigrationCannotPublishOldState() {
  const persistDeferred = createDeferred();
  const applied = [];
  const loadSnapshots = [
    { items: [{ key: 'old' }], needsMigration: true },
    { items: [{ key: 'old' }], needsMigration: true },
    { items: [{ id: 'new-id', key: 'new' }], needsMigration: false }
  ];
  let persistCount = 0;
  let persistContext = null;
  const coordinator = createSiteSearchProviderRefreshCoordinator({
    apply(prepared) {
      applied.push(prepared.items.map((item) => item.key));
    },
    load() {
      return Promise.resolve(loadSnapshots.shift());
    },
    persist(_prepared, context) {
      persistCount += 1;
      persistContext = context;
      return persistDeferred.promise;
    },
    prepare: prepareSnapshot
  });

  const olderRefresh = coordinator.refresh();
  await flushTasks();
  await flushTasks();
  assert.strictEqual(persistCount, 1, 'the older migration should be in flight');

  const newerRefresh = coordinator.refresh();
  assert.strictEqual(
    persistContext.isCurrent(),
    false,
    'a queued provider write must be able to reject an invalidated migration token'
  );
  persistDeferred.resolve();
  await olderRefresh;
  await newerRefresh;

  assert.deepStrictEqual(
    applied,
    [['new']],
    'a refresh invalidated during persistence must not publish its old snapshot'
  );
}

async function testWritesShareOneQueue() {
  const enqueue = createOperationQueue();
  const order = [];
  const first = createDeferred();
  const a = enqueue(() => { order.push('a:start'); return first.promise.then(() => order.push('a:end')); });
  const b = enqueue(() => { order.push('b:start'); return Promise.reject(new Error('b failed')); });
  const c = enqueue(() => { order.push('c:start'); return 'c'; });
  await flushTasks();
  assert.deepStrictEqual(order, ['a:start'], 'a queued write waits for the one before it');
  first.resolve();
  await a;
  await assert.rejects(b, /b failed/, 'each write reports its own failure');
  assert.strictEqual(await c, 'c', 'a failed write does not block the next one');
  assert.deepStrictEqual(order, ['a:start', 'a:end', 'b:start', 'c:start']);
}

async function testPersisterRereadsInsideTheQueue() {
  const enqueue = createOperationQueue();
  const events = [];
  const blocker = createDeferred();
  enqueue(() => blocker.promise.then(() => events.push('earlier save')));
  let stored = { needsPersistence: true, custom: ['old'], disabledKeys: new Set() };
  const persist = createSnapshotPersister({
    enqueue,
    load: () => { events.push('load'); return Promise.resolve(stored); },
    prepare: (snapshot) => snapshot,
    write: (custom, disabledKeys) => { events.push(['write', custom, Array.from(disabledKeys)]); }
  });
  const pending = persist({ custom: ['stale'] }, { isCurrent: () => true });
  stored = { needsPersistence: true, custom: ['old', 'saved meanwhile'], disabledKeys: new Set(['x']) };
  blocker.resolve();
  await pending;
  assert.deepStrictEqual(events, [
    'earlier save',
    'load',
    ['write', ['old', 'saved meanwhile'], ['x']]
  ], 'the migration reads storage again after earlier writes and writes the fresh snapshot');

  events.length = 0;
  stored = { needsPersistence: false, custom: [], disabledKeys: new Set() };
  await persist({}, { isCurrent: () => true });
  assert.deepStrictEqual(events, ['load'], 'nothing is written when the fresh snapshot is clean');

  events.length = 0;
  await persist({}, { isCurrent: () => false });
  assert.deepStrictEqual(events, [], 'an invalidated migration does not even read');
}

(async () => {
  await testWritesShareOneQueue();
  await testPersisterRereadsInsideTheQueue();
  await testNewerRefreshInvalidatesOlderRead();
  await testMigrationReloadsLatestStorageAndConfirmsWrite();
  await testRefreshDuringMigrationCannotPublishOldState();
  console.log('options site-search provider race tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
