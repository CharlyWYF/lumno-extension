const assert = require('assert');
const syncApi = require('../src/background/webdav-sync.js');
const settings = require('../src/shared/settings.js');
const { createServer, createDevice, config, set } = require('./test-webdav-sync.js');

async function run() {
  const first = createServer();
  const second = createServer();
  const router = { fetch: (url, options) => (new URL(url).hostname === 'second.test' ? second : first).fetch(url, options) };
  const device = createDevice(router, { sync: { [settings.THEME_STORAGE_KEY]: 'light' } }, [], syncApi.createController);
  const manager = device.controller;
  assert.deepStrictEqual((await manager.status()).connections, []);
  const a = await manager.handle({ operation: 'add', config });
  const b = await manager.handle({ operation: 'add', config: { ...config, endpoint: 'https://second.test/dav/' } });
  assert.notStrictEqual(a.id, b.id);
  assert.strictEqual(first.requests.length + second.requests.length, 0, 'adding only saves local credentials');
  assert.strictEqual((await manager.status()).connections.length, 2);
  assert(!JSON.stringify(await manager.status()).includes(config.password));
  await Promise.all([a, b].map(({ id }) => manager.handle({ operation: 'enable', id })));
  assert((await manager.status()).connections.every((connection) => connection.enabled));
  assert.strictEqual(device.chrome.alarms.names.size, 2, 'each enabled connection has its own recurring alarm');
  await set(device.chrome.storage.sync, { [settings.THEME_STORAGE_KEY]: 'dark' });
  // Both servers must reach this barrier. A global sync queue would deadlock.
  let arrived = 0;
  let release;
  const barrier = new Promise((resolve) => { release = resolve; });
  const waitForBoth = async (path, options) => {
    if (path.endsWith('/state.json') && options.method === 'GET') {
      arrived += 1;
      if (arrived === 2) release();
      await barrier;
    }
  };
  first.beforeRequest = second.beforeRequest = waitForBoth;
  const parallel = Promise.all([a, b].map(({ id }) => manager.handle({ operation: 'sync', id })));
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; release(); }, 1000);
  await parallel;
  clearTimeout(timeout);
  assert.strictEqual(timedOut, false, 'server requests actually overlap instead of waiting for another connection');
  assert(arrived >= 2);
  assert.strictEqual(first.state().data[settings.THEME_STORAGE_KEY], 'dark');
  assert.strictEqual(second.state().data[settings.THEME_STORAGE_KEY], 'dark');
  first.beforeRequest = second.beforeRequest = null;
  // Two incoming versions may download in parallel, but cannot interleave local commits.
  first.replaceState({ ...first.state(), data: { ...first.state().data, _x_extension_language_2024_unique_: 'ja' } });
  second.replaceState({ ...second.state(), data: { ...second.state().data, [settings.THEME_STORAGE_KEY]: 'system' } });
  arrived = 0;
  let releaseIncoming;
  const incomingBarrier = new Promise((resolve) => { releaseIncoming = resolve; });
  first.beforeRequest = second.beforeRequest = async (path, options) => {
    if (path.endsWith('/state.json') && options.method === 'GET') {
      if (++arrived === 2) releaseIncoming();
      await incomingBarrier;
    }
  };
  const incoming = await Promise.allSettled([a, b].map(({ id }) => manager.handle({ operation: 'sync', id })));
  assert.strictEqual(incoming.filter((value) => value.status === 'fulfilled').length, 1);
  assert.strictEqual(incoming.find((value) => value.status === 'rejected').reason.code, 'local-changed');
  first.beforeRequest = second.beforeRequest = null;
  const pending = (await manager.status()).connections.find((value) => value.state === 'pending');
  await manager.handle({ operation: 'sync', id: pending.id });
  await manager.handle({ operation: 'sync', id: pending.id === a.id ? b.id : a.id });
  assert.strictEqual(first.state().data[settings.THEME_STORAGE_KEY], 'system');
  assert.strictEqual(second.state().data._x_extension_language_2024_unique_, 'ja');
  await manager.handle({ operation: 'pause', id: a.id });
  let statuses = (await manager.status()).connections;
  assert.strictEqual(statuses.find((value) => value.id === b.id).enabled, true, 'pausing one leaves the other enabled');
  assert.strictEqual(device.chrome.alarms.names.size, 1);
  first.offline = true;
  await manager.handle({ operation: 'enable', id: b.id });
  await assert.rejects(manager.handle({ operation: 'enable', id: a.id }));
  assert.strictEqual((await manager.status()).connections.find((value) => value.id === b.id).state, 'ready');
  const secondFiles = structuredClone([...second.files]);
  const firstFiles = structuredClone([...first.files]);
  const chromeBefore = structuredClone(device.chrome.storage.sync.values);
  await manager.handle({ operation: 'remove', id: a.id });
  const hintKey = settings.WEBDAV_CONNECTIONS_SYNC_STORAGE_KEY;
  const withoutHints = (values) => Object.fromEntries(Object.entries(values).filter(([key]) => key !== hintKey));
  assert.deepStrictEqual(withoutHints(device.chrome.storage.sync.values), withoutHints(chromeBefore), 'removing a connection retains Chrome preferences');
  assert.deepStrictEqual(device.chrome.storage.sync.values[hintKey].items.map((item) => item.endpoint), ['https://second.test/dav/'],
    'removing a connection withdraws it from other devices');
  assert.deepStrictEqual([...first.files], firstFiles, 'removing makes no remote request');
  assert.deepStrictEqual([...second.files], secondFiles);
  assert(![...device.privateValues.keys()].some((key) => key.startsWith(`connection:${a.id}:`)), 'credentials and private per-connection history are removed');
  assert.strictEqual((await manager.status()).connections.length, 1);
  await assert.rejects(manager.handle({ operation: 'sync', id: a.id }), /connection-missing/);
  await manager.handle({ operation: 'remove', id: b.id });
  assert.deepStrictEqual((await manager.status()).connections, []);
  assert.strictEqual(device.chrome.alarms.names.size, 0);
  assert.deepStrictEqual((await device.createController().status()).connections, [], 'deletion survives a worker restart');

  const legacy = createDevice(createServer(), { sync: { [settings.THEME_STORAGE_KEY]: 'light' } });
  await legacy.controller.handle({ operation: 'save', config });
  await legacy.controller.stop();
  const createMigrated = () => syncApi.createController({ chrome: legacy.chrome, settings,
    contract: require('../src/shared/webdav-contract.js'), shortcuts: require('../src/newtab/shortcuts-store.js'),
    client: require('../src/background/webdav-client.js'), privateStore: legacy.privateStore, wallpaperStore: legacy.wallpaperStore,
    crypto: require('crypto').webcrypto });
  const migrated = createMigrated();
  assert.strictEqual((await migrated.status()).connections[0].id, 'default');
  assert.strictEqual(legacy.privateValues.get('session').config.password, config.password, 'existing credentials migrate in place');
  await migrated.handle({ operation: 'remove', id: 'default' });
  assert.strictEqual(legacy.privateValues.has('session'), false);
  assert.deepStrictEqual((await createMigrated().status()).connections, [], 'a deleted legacy connection is never reimported');
  await assert.rejects(migrated.handle({ operation: 'add', config: { ...config, password: '' } }), /missing-credentials/);
  assert.deepStrictEqual((await migrated.status()).connections, []);

  const partialA = createServer();
  const partialB = createServer();
  const partial = createDevice({ fetch: (url, options) => (new URL(url).hostname === 'second.test' ? partialB : partialA).fetch(url, options) },
    { sync: { [settings.THEME_STORAGE_KEY]: 'light' } }, [], syncApi.createController);
  const pa = await partial.controller.handle({ operation: 'add', config });
  const pb = await partial.controller.handle({ operation: 'add', config: { ...config, endpoint: 'https://second.test/dav/' } });
  await Promise.all([pa, pb].map(({ id }) => partial.controller.handle({ operation: 'enable', id })));
  partialA.replaceState({ ...partialA.state(), data: { [settings.THEME_STORAGE_KEY]: 'dark' } });
  const replace = partial.wallpaperStore.replaceAll;
  let interrupted = false;
  partial.wallpaperStore.replaceAll = async (records) => {
    await replace(records);
    if (!interrupted) { interrupted = true; throw new Error('interrupted media commit'); }
  };
  await assert.rejects(partial.controller.handle({ operation: 'sync', id: pa.id }));
  const beforePartialUpload = partialB.requests.filter((request) => request.method === 'PUT').length;
  await assert.rejects(partial.controller.handle({ operation: 'sync', id: pb.id }), /interrupted-apply/);
  assert.strictEqual(partialB.requests.filter((request) => request.method === 'PUT').length, beforePartialUpload,
    'other connections cannot upload while an interrupted local write is unrecovered');
  await assert.rejects(partial.controller.handle({ operation: 'remove', id: pa.id }), /interrupted-apply/);
  const statusOf = async (id) => (await partial.controller.status()).connections.find((value) => value.id === id);
  assert.strictEqual((await statusOf(pa.id)).needsRecovery, true);
  await partial.controller.handle({ operation: 'sync', id: pb.id });
  assert.strictEqual((await statusOf(pb.id)).state, 'ready',
    'once the journal is recovered, a connection waiting for its restore pauses only itself');
  await partial.controller.handle({ operation: 'restoreBackup', id: pa.id });
  await partial.controller.handle({ operation: 'sync', id: pb.id });
  assert.strictEqual((await statusOf(pb.id)).state, 'ready');
  await partial.controller.handle({ operation: 'remove', id: pa.id });
  await partial.controller.handle({ operation: 'remove', id: pb.id });

  const flowServer = createServer();
  const flow = createDevice(flowServer, { sync: { [settings.THEME_STORAGE_KEY]: 'light' } }, [], syncApi.createController);
  const probes = () => flowServer.requests.filter((request) => request.path.includes('/probe-')).length;
  flowServer.offline = true;
  await assert.rejects(flow.controller.handle({ operation: 'add', config, enable: true }), /network-error/);
  assert.deepStrictEqual((await flow.controller.status()).connections, [], 'a connection that never reached the server stays in the form');
  flowServer.offline = false;
  await flow.controller.handle({ operation: 'test', config });
  const testedProbes = probes();
  assert(testedProbes > 0);
  const added = await flow.controller.handle({ operation: 'add', config, enable: true });
  assert.strictEqual(probes(), testedProbes, 'enabling right after an explicit test reuses its capability check');
  let current = (await flow.controller.status()).connections[0];
  assert.strictEqual(current.id, added.id);
  assert.strictEqual(current.enabled, true, 'adding can save and enable in one step');
  assert.strictEqual(flowServer.state().data[settings.THEME_STORAGE_KEY], 'light');
  await assert.rejects(flow.controller.handle({ operation: 'add', config: { ...config, endpoint: `${config.endpoint}/`, directory: '/lumno/' } }), /duplicate-connection/);
  const other = await flow.controller.handle({ operation: 'add', config: { ...config, directory: 'second' } });
  await assert.rejects(flow.controller.handle({ operation: 'save', id: other.id, config: { ...config, password: '' } }), /duplicate-connection/);
  assert.strictEqual((await flow.controller.status()).connections.length, 2);
  await flow.controller.handle({ operation: 'remove', id: other.id });
  const unchanged = await flow.controller.handle({ operation: 'save', id: added.id, config: { ...config, password: '' } });
  assert.strictEqual(unchanged.unchanged, true);
  assert.strictEqual((await flow.controller.status()).connections[0].enabled, true, 'saving an unchanged form keeps sync running');
  const resumed = await flow.controller.handle({ operation: 'save', id: added.id, resume: true, config: { ...config, directory: 'renamed', password: '' } });
  assert.strictEqual(resumed.resumed, true);
  assert.strictEqual((await flow.controller.status()).connections[0].enabled, true, 'an edited running connection resumes after saving');
  await flow.controller.handle({ operation: 'pause', id: added.id });
  flowServer.offline = true;
  await assert.rejects(flow.controller.handle({ operation: 'enable', id: added.id }));
  current = (await flow.controller.status()).connections[0];
  assert.strictEqual(current.enabled, false);
  assert.strictEqual(current.error, 'network-error', 'a failed enable leaves its reason on the connection');
  flowServer.offline = false;
  await flow.controller.handle({ operation: 'pause', id: added.id });
  assert.strictEqual((await flow.controller.status()).connections[0].error, null);
  await flow.controller.handle({ operation: 'remove', id: added.id });
  // Connection details follow the user to other devices through browser sync;
  // the app password never does.
  {
    const hintKey = settings.WEBDAV_CONNECTIONS_SYNC_STORAGE_KEY;
    const server = createServer();
    const laptop = createDevice(server, {}, [], syncApi.createController);
    const added = await laptop.controller.handle({ operation: 'add', config });
    const published = structuredClone(laptop.chrome.storage.sync.values[hintKey]);
    assert.deepStrictEqual(published, { version: 1, items: [{ endpoint: config.endpoint, directory: 'lumno', username: 'user' }] });
    assert(!JSON.stringify(laptop.chrome.storage.sync.values).includes(config.password), 'the app password never enters browser sync');
    assert.deepStrictEqual((await laptop.controller.status()).suggestions, [], 'a device never suggests its own connection');

    const desktop = createDevice(server, { sync: { [hintKey]: published } }, [], syncApi.createController);
    assert.deepStrictEqual((await desktop.controller.status()).suggestions, published.items, 'another device offers the synced connection');
    await desktop.controller.handle({ operation: 'dismissSuggestion', config: published.items[0] });
    assert.deepStrictEqual((await desktop.controller.status()).suggestions, []);
    assert.deepStrictEqual(desktop.chrome.storage.sync.values[hintKey], published, 'dismissing stays on this device');
    const phone = createDevice(server, { sync: { [hintKey]: published } }, [], syncApi.createController);
    await phone.controller.handle({ operation: 'add', config });
    assert.deepStrictEqual((await phone.controller.status()).suggestions, [], 'adding a suggested connection consumes it');
    assert.deepStrictEqual(phone.chrome.storage.sync.values[hintKey], published, 'the same connection is published once');

    await laptop.controller.handle({ operation: 'save', id: added.id, config: { ...config, directory: 'moved' } });
    assert.deepStrictEqual(laptop.chrome.storage.sync.values[hintKey].items.map((item) => item.directory), ['moved'],
      'editing a connection replaces what other devices see');
    // A device that still uses a connection restores it right after another
    // device withdraws it, without waiting for a restart.
    await new Promise((resolve) => laptop.chrome.storage.sync.set({ [hintKey]: { version: 1, items: [] } }, resolve));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await laptop.controller.status();
    assert.deepStrictEqual(laptop.chrome.storage.sync.values[hintKey].items.map((item) => item.directory), ['moved']);
    // Connections added before hints existed are published on the next start.
    await new Promise((resolve) => laptop.chrome.storage.sync.remove([hintKey], resolve));
    await laptop.createController().status();
    assert.deepStrictEqual(laptop.chrome.storage.sync.values[hintKey].items.map((item) => item.directory), ['moved']);
    // Malformed or oversized entries from another version are ignored, not trusted.
    const noisy = createDevice(server, { sync: { [hintKey]: { version: 1, items: [
      { endpoint: 'http://plain.test/', directory: 'lumno', username: 'user' },
      { endpoint: 'https://long.test/', directory: 'lumno', username: 'x'.repeat(250), password: 'leak' },
      { endpoint: `https://${'a'.repeat(600)}.test/`, directory: 'lumno', username: 'user' }] } } }, [], syncApi.createController);
    const offered = (await noisy.controller.status()).suggestions;
    assert.deepStrictEqual(offered.map((item) => item.endpoint), ['https://long.test/']);
    assert.strictEqual(Object.hasOwn(offered[0], 'password'), false);
  }
  console.log('WebDAV multiple-connection tests passed: migration, parallel requests, isolation, deletion, restart, duplicates, one-step enable and synced connection hints');
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
