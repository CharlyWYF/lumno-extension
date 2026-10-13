const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const aggregateSearch = require('../src/background/aggregate-search.js');
const aggregateStore = require('../src/shared/aggregate-search-store.js');
const { readBackgroundSource } = require('./helpers/background-source');

const backgroundSource = readBackgroundSource();
const aggregateSearchSource = fs.readFileSync(
  path.join(__dirname, '..', 'src/background/aggregate-search.js'),
  'utf8'
);
assert.doesNotMatch(
  aggregateSearchSource,
  /MAX_PROVIDER_COUNT/,
  'aggregate execution must rely on the store normalization limit instead of duplicating it'
);
assert.strictEqual(
  aggregateSearch.resolveAggregateSearchAutoGroupEnabled(undefined, []),
  true,
  'missing configuration with no legacy definitions should default to grouping'
);
assert.strictEqual(
  aggregateSearch.resolveAggregateSearchAutoGroupEnabled(undefined, [
    { id: 'new-definition' }
  ]),
  true,
  'definitions without a legacy grouping field should use the new enabled default'
);
assert.strictEqual(
  aggregateSearch.resolveAggregateSearchAutoGroupEnabled(undefined, [
    { id: 'legacy-off', autoCreateTabGroup: false }
  ]),
  false,
  'legacy definitions that all disabled grouping should remain disabled'
);
assert.strictEqual(
  aggregateSearch.resolveAggregateSearchAutoGroupEnabled(undefined, [
    { id: 'legacy-off', autoCreateTabGroup: false },
    { id: 'legacy-on', autoCreateTabGroup: true }
  ]),
  true,
  'any legacy definition with grouping enabled should migrate the global setting to enabled'
);
assert.strictEqual(
  aggregateSearch.resolveAggregateSearchAutoGroupEnabled(false, [
    { id: 'legacy-on', autoCreateTabGroup: true }
  ]),
  false,
  'an explicit global false value must override legacy definitions'
);
assert.ok(
  backgroundSource.includes('AGGREGATE_SEARCH.createAggregateSearchQueryRunner({') &&
    backgroundSource.includes('loadSiteSearchProviders,') &&
    backgroundSource.includes('loadAggregateSearchAutoGroupEnabled()') &&
    backgroundSource.includes('aggregateSearchStore: AGGREGATE_SEARCH_STORE'),
  'the background must use the behavior-tested stored-definition request runner'
);
assert.ok(
  backgroundSource.includes('const SETTINGS = globalThis.LumnoSettings;') &&
  backgroundSource.includes('SETTINGS.readStorageValue('),
  'provider storage reads must use the loaded settings runtime and reject on failure'
);
assert.match(
  backgroundSource,
  /loadGeneration === siteSearchLoadGeneration &&\s*siteSearchPromise === loadTask/,
  'provider publication and cleanup must be gated by load generation and promise identity'
);
assert.doesNotMatch(
  backgroundSource,
  /loadCustomSiteSearchProviders\(\)\.then\(\(customItems\) => \{\s*siteSearchCache = customItems;/,
  'provider storage failures must not cache a custom-only source list'
);
// The runAggregateSearchQuery message itself is covered by
// scripts/test-background-message-handlers.js.

function createChromeApi(options = {}) {
  const created = [];
  const grouped = [];
  const titled = [];
  const activated = [];
  const runtime = { lastError: null };
  let nextTabId = 100;
  const withLastError = (message, callback, value) => {
    runtime.lastError = message ? { message } : null;
    callback(value);
    runtime.lastError = null;
  };
  const tabs = {
    create(createProperties, callback) {
      created.push({ ...createProperties });
      if (options.failAllCreates ||
          (Array.isArray(options.failUrls) && options.failUrls.includes(createProperties.url))) {
        withLastError('create failed', callback, null);
        return;
      }
      nextTabId += 1;
      withLastError('', callback, {
        id: nextTabId,
        windowId: createProperties.windowId,
        url: createProperties.url,
        active: createProperties.active
      });
    },
    update(tabId, updateProperties, callback) {
      activated.push({ tabId, ...updateProperties });
      withLastError(options.activateError, callback, { id: tabId, ...updateProperties });
    }
  };
  if (!options.omitGroupApi) {
    tabs.group = (groupProperties, callback) => {
      grouped.push({ tabIds: [...groupProperties.tabIds] });
      withLastError(options.groupError, callback, 44);
    };
  }
  const api = { runtime, tabs };
  if (!options.omitTabGroupsApi) {
    api.tabGroups = {
      update(groupId, updateProperties, callback) {
        titled.push({ groupId, ...updateProperties });
        withLastError(options.titleError, callback, { id: groupId });
      }
    };
  }
  return { api, created, grouped, titled, activated };
}

const providers = [
  { key: 'google', template: 'https://www.google.com/search?q={query}' },
  {
    key: 'chatgpt',
    template: 'https://chatgpt.com/',
    action: 'openAndSubmit',
    submitStrategy: 'chatgptPrompt'
  }
];

function getEntryUrl(provider, query) {
  return String(provider.template || '').replace('{query}', encodeURIComponent(query));
}

function isInteractiveProvider(provider) {
  return provider && provider.action === 'openAndSubmit';
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function waitForDeferredCount(deferreds, expectedCount) {
  for (let attempt = 0; attempt < 20 && deferreds.length < expectedCount; attempt += 1) {
    await Promise.resolve();
  }
  assert.strictEqual(deferreds.length, expectedCount);
}

function createSiteSearchProviderCacheHarness() {
  const stateSourceMatch = backgroundSource.match(
    /let siteSearchCache = null;\s*let siteSearchPromise = null;\s*let siteSearchLoadGeneration = 0;/
  );
  assert.ok(stateSourceMatch, 'site-search provider cache generation state must remain discoverable');
  const invalidationStart = backgroundSource.indexOf('function invalidateSiteSearchProviderCache()');
  const implementationEnd = backgroundSource.indexOf(
    '\nfunction warmSiteSearchProviderIcons()',
    invalidationStart
  );
  assert.ok(
    invalidationStart >= 0 && implementationEnd > invalidationStart,
    'site-search provider cache loader and invalidation helper must remain discoverable'
  );

  const requests = [];
  const customProviderRequests = [];
  const context = {
    chrome: {
      runtime: {
        getURL(resourcePath) {
          return resourcePath;
        }
      }
    },
    SEARCH_UTILS: {
      getDefaultSiteSearchProviders() {
        return [];
      }
    },
    fetch() {
      const request = createDeferred();
      requests.push(request);
      return request.promise;
    },
    sanitizeSiteSearchProviders(items) {
      return Array.isArray(items) ? items : [];
    },
    loadCustomSiteSearchProviders() {
      const request = createDeferred();
      customProviderRequests.push(request);
      return request.promise;
    },
    loadDisabledSiteSearchKeys() {
      return Promise.resolve([]);
    },
    mergeCustomProviders(items) {
      return items;
    }
  };
  vm.runInNewContext(`
    ${stateSourceMatch[0]}
    ${backgroundSource.slice(invalidationStart, implementationEnd)}
    globalThis.siteSearchProviderCacheHarness = {
      load: loadSiteSearchProviders,
      invalidate: invalidateSiteSearchProviderCache,
      getCache: () => siteSearchCache,
      getPromise: () => siteSearchPromise
    };
  `, context);
  return {
    harness: context.siteSearchProviderCacheHarness,
    requests,
    customProviderRequests
  };
}

async function testSiteSearchProviderCacheInvalidationRace() {
  const { harness, requests, customProviderRequests } = createSiteSearchProviderCacheHarness();
  const firstLoad = harness.load();
  assert.strictEqual(harness.load(), firstLoad, 'concurrent reads should share the current load');

  harness.invalidate();
  const secondLoad = harness.load();
  assert.notStrictEqual(secondLoad, firstLoad, 'invalidation should start a new provider load');
  assert.strictEqual(requests.length, 2);

  requests[1].resolve({
    json: () => Promise.resolve({ items: [{ key: 'new-provider' }] })
  });
  await waitForDeferredCount(customProviderRequests, 1);
  customProviderRequests[0].resolve([]);
  await secondLoad;
  assert.strictEqual(harness.getCache()[0].key, 'new-provider');

  requests[0].resolve({
    json: () => Promise.resolve({ items: [{ key: 'obsolete-provider' }] })
  });
  await waitForDeferredCount(customProviderRequests, 2);
  customProviderRequests[1].resolve([]);
  const staleResult = await firstLoad;
  assert.strictEqual(
    staleResult[0].key,
    'new-provider',
    'an obsolete caller should receive the latest published providers instead of its stale result'
  );
  assert.strictEqual(
    harness.getCache()[0].key,
    'new-provider',
    'an obsolete load that finishes last must not republish removed providers'
  );
  assert.strictEqual(harness.getPromise(), secondLoad);

  harness.invalidate();
  const staleFailure = harness.load();
  harness.invalidate();
  const latestLoad = harness.load();
  requests[3].resolve({
    json: () => Promise.resolve({ items: [{ key: 'latest-provider' }] })
  });
  await waitForDeferredCount(customProviderRequests, 3);
  customProviderRequests[2].resolve([]);
  await latestLoad;
  requests[2].resolve({
    json: () => Promise.resolve({ items: [{ key: 'stale-provider' }] })
  });
  await waitForDeferredCount(customProviderRequests, 4);
  customProviderRequests[3].reject(new Error('stale provider load failed'));
  await assert.rejects(staleFailure, /stale provider load failed/);
  assert.strictEqual(harness.getCache()[0].key, 'latest-provider');
  assert.strictEqual(
    harness.getPromise(),
    latestLoad,
    'an obsolete rejection must not clear the latest provider load identity'
  );
}

async function run() {
  await testSiteSearchProviderCacheInvalidationRace();
  const positioned = createChromeApi({ failUrls: ['https://failed.test/?q=ordered'] });
  await aggregateSearch.openAggregateSearch(positioned.api, {
    query: 'ordered',
    providers: [
      { key: 'first', template: 'https://first.test/?q={query}' },
      { key: 'failed', template: 'https://failed.test/?q={query}' },
      { key: 'last', template: 'https://last.test/?q={query}' }
    ],
    autoCreateTabGroup: false,
    windowId: 7,
    insertIndex: 4,
    getEntryUrl,
    disposition: 'backgroundTab'
  });
  assert.deepStrictEqual(positioned.created.map((tab) => tab.index), [4, 5, 5],
    'aggregate results should remain consecutive and ordered even if a source fails');
  assert.strictEqual(positioned.activated.length, 0);
  const success = createChromeApi();
  const waited = [];
  const submitted = [];
  const successResult = await aggregateSearch.openAggregateSearch(success.api, {
    definition: { name: '人工智能' },
    query: 'Lumno 聚合搜索',
    providers,
    autoCreateTabGroup: true,
    windowId: 7,
    disposition: 'newTab',
    getEntryUrl,
    isInteractiveProvider,
    waitForTabComplete(tabId, timeoutMs) {
      waited.push({ tabId, timeoutMs });
      return Promise.resolve({ id: tabId, status: 'complete' });
    },
    submitPromptInTab(_chromeApi, tabId, prompt, strategy, entryUrl) {
      submitted.push({ tabId, prompt, strategy, entryUrl });
      return Promise.resolve({ ok: true, method: 'content-script' });
    }
  });
  assert.strictEqual(successResult.ok, true);
  assert.strictEqual(successResult.openedCount, 2);
  assert.strictEqual(successResult.failedCount, 0);
  assert.strictEqual(successResult.grouped, true);
  assert.strictEqual(successResult.groupId, 44);
  assert.strictEqual(successResult.groupTitleApplied, true);
  assert.strictEqual(successResult.activatedTabId, 101);
  assert.strictEqual(successResult.interactiveRequestedCount, 1);
  assert.strictEqual(successResult.interactiveSucceededCount, 1);
  assert.deepStrictEqual(success.created, [
    {
      url: 'https://www.google.com/search?q=Lumno%20%E8%81%9A%E5%90%88%E6%90%9C%E7%B4%A2',
      active: false,
      windowId: 7
    },
    { url: 'https://chatgpt.com/', active: false, windowId: 7 }
  ]);
  assert.deepStrictEqual(success.grouped, [{ tabIds: [101, 102] }]);
  assert.deepStrictEqual(success.titled, [{ groupId: 44, title: '人工智能：Lumno 聚合搜索' }]);
  assert.deepStrictEqual(success.activated, [{ tabId: 101, active: true }]);
  assert.deepStrictEqual(waited, [{ tabId: 102, timeoutMs: 15000 }]);
  assert.deepStrictEqual(submitted, [{
    tabId: 102,
    prompt: 'Lumno 聚合搜索',
    strategy: 'chatgptPrompt',
    entryUrl: 'https://chatgpt.com/'
  }]);

  for (const [definition, expectedTitle] of [
    [undefined, '测试'],
    [{}, '测试'],
    [{ name: '' }, '测试'],
    [{ name: ' \n\t ' }, '测试'],
    [{ name: '  人工智能  ' }, '人工智能：测试'],
    [{ name: 'AI 🔎' }, 'AI 🔎：测试']
  ]) {
    const titleCase = createChromeApi();
    const titleCaseResult = await aggregateSearch.openAggregateSearch(titleCase.api, {
      definition,
      query: '  测试  ',
      providers: [providers[0]],
      autoCreateTabGroup: true,
      disposition: 'backgroundTab',
      getEntryUrl
    });
    assert.strictEqual(titleCaseResult.groupTitleApplied, true);
    assert.deepStrictEqual(titleCase.titled, [{ groupId: 44, title: expectedTitle }]);
    assert.strictEqual(titleCase.created[0].url, 'https://www.google.com/search?q=%E6%B5%8B%E8%AF%95');
  }

  const background = createChromeApi();
  const backgroundResult = await aggregateSearch.openAggregateSearch(background.api, {
    definition: { name: '人工智能', autoCreateTabGroup: true },
    query: 'quiet',
    providers: [providers[0]],
    autoCreateTabGroup: false,
    disposition: 'backgroundTab',
    getEntryUrl
  });
  assert.strictEqual(backgroundResult.ok, true);
  assert.strictEqual(backgroundResult.grouped, false);
  assert.strictEqual(backgroundResult.activatedTabId, null);
  assert.deepStrictEqual(background.activated, []);
  assert.deepStrictEqual(background.grouped, []);
  assert.deepStrictEqual(background.titled, [],
    'disabling grouping must skip naming even when the aggregate has a name');

  const degraded = createChromeApi({ groupError: 'group denied' });
  const degradedResult = await aggregateSearch.openAggregateSearch(degraded.api, {
    query: 'degraded',
    providers,
    autoCreateTabGroup: true,
    disposition: 'backgroundTab',
    getEntryUrl
  });
  assert.strictEqual(degradedResult.ok, true,
    'opening the search tabs remains successful when grouping fails');
  assert.strictEqual(degradedResult.openedCount, 2);
  assert.strictEqual(degradedResult.grouped, false);
  assert.strictEqual(degradedResult.groupId, null);
  assert.strictEqual(degradedResult.reason, 'group denied');
  assert.deepStrictEqual(degraded.created.map((item) => item.active), [false, false]);
  assert.deepStrictEqual(degraded.titled, []);

  const partial = createChromeApi({
    failUrls: ['https://www.google.com/search?q=partial']
  });
  const scheduledActivations = [];
  const partialResult = await aggregateSearch.openAggregateSearch(partial.api, {
    query: 'partial',
    providers,
    autoCreateTabGroup: true,
    getEntryUrl,
    isInteractiveProvider,
    scheduleActivation(task, delayMs) {
      scheduledActivations.push({ task, delayMs });
    },
    submitPromptInTab() {
      return Promise.resolve({ ok: true });
    }
  });
  assert.strictEqual(partialResult.ok, true);
  assert.strictEqual(partialResult.requestedCount, 2);
  assert.strictEqual(partialResult.openedCount, 1);
  assert.strictEqual(partialResult.failedCount, 1);
  assert.strictEqual(partialResult.reason, 'partial-tab-create-failure');
  assert.strictEqual(partialResult.activationDeferred, true);
  assert.strictEqual(
    partialResult.activationDelayMs,
    aggregateSearch.ACTIVATION_FEEDBACK_DELAY_MS
  );
  assert.deepStrictEqual(partial.grouped, [{ tabIds: [101] }]);
  assert.deepStrictEqual(partial.activated, []);
  assert.strictEqual(scheduledActivations.length, 1);
  assert.strictEqual(
    scheduledActivations[0].delayMs,
    aggregateSearch.ACTIVATION_FEEDBACK_DELAY_MS
  );

  const allCreatesFailed = createChromeApi({ failAllCreates: true });
  const allCreatesFailedResult = await aggregateSearch.openAggregateSearch(
    allCreatesFailed.api,
    {
      query: 'nothing opened',
      providers,
      autoCreateTabGroup: true,
      getEntryUrl,
      isInteractiveProvider
    }
  );
  assert.strictEqual(allCreatesFailedResult.ok, false);
  assert.strictEqual(allCreatesFailedResult.requestedCount, 2);
  assert.strictEqual(allCreatesFailedResult.openedCount, 0);
  assert.strictEqual(allCreatesFailedResult.failedCount, 2);
  assert.strictEqual(allCreatesFailedResult.reason, 'tab-create-failed');
  assert.deepStrictEqual(allCreatesFailed.grouped, []);
  assert.deepStrictEqual(allCreatesFailed.titled, []);
  assert.deepStrictEqual(allCreatesFailed.activated, []);

  const titleFailure = createChromeApi({ titleError: 'title denied' });
  const titleFailureActivations = [];
  const titleFailureResult = await aggregateSearch.openAggregateSearch(titleFailure.api, {
    query: 'title failure',
    providers: [providers[0]],
    autoCreateTabGroup: true,
    getEntryUrl,
    scheduleActivation(task, delayMs) {
      titleFailureActivations.push({ task, delayMs });
    }
  });
  assert.strictEqual(titleFailureResult.ok, true);
  assert.strictEqual(titleFailureResult.grouped, true);
  assert.strictEqual(titleFailureResult.groupId, 44);
  assert.strictEqual(titleFailureResult.groupTitleApplied, false);
  assert.strictEqual(titleFailureResult.reason, 'title denied');
  assert.strictEqual(titleFailureResult.activationDeferred, true);
  assert.strictEqual(titleFailureActivations.length, 1);
  assert.strictEqual(
    titleFailureActivations[0].delayMs,
    aggregateSearch.ACTIVATION_FEEDBACK_DELAY_MS
  );
  titleFailureActivations[0].task();
  assert.deepStrictEqual(titleFailure.activated, [{ tabId: 101, active: true }]);

  const activationFailure = createChromeApi({ activateError: 'activation denied' });
  const activationFailureResult = await aggregateSearch.openAggregateSearch(
    activationFailure.api,
    {
      query: 'activation failure',
      providers: [providers[0]],
      getEntryUrl
    }
  );
  assert.strictEqual(activationFailureResult.ok, true);
  assert.strictEqual(activationFailureResult.activatedTabId, null);
  assert.strictEqual(activationFailureResult.activationDeferred, false);
  assert.strictEqual(activationFailureResult.activationDelayMs, 0);
  assert.strictEqual(activationFailureResult.reason, 'activation denied');
  assert.deepStrictEqual(activationFailureResult.warnings, ['activation denied']);
  assert.deepStrictEqual(activationFailure.activated, [{ tabId: 101, active: true }]);

  const schedulerFailure = createChromeApi({ groupError: 'group denied' });
  const schedulerFailureResult = await aggregateSearch.openAggregateSearch(
    schedulerFailure.api,
    {
      query: 'scheduler failure',
      providers: [providers[0]],
      autoCreateTabGroup: true,
      getEntryUrl,
      scheduleActivation() {
        throw new Error('scheduler failed');
      }
    }
  );
  assert.strictEqual(schedulerFailureResult.ok, true);
  assert.strictEqual(schedulerFailureResult.activatedTabId, 101,
    'a scheduler failure must fall back to immediate activation');
  assert.strictEqual(schedulerFailureResult.activationDeferred, false);
  assert.strictEqual(schedulerFailureResult.activationDelayMs, 0);
  assert.deepStrictEqual(
    schedulerFailureResult.warnings,
    ['group denied', 'scheduler failed']
  );
  assert.deepStrictEqual(schedulerFailure.activated, [{ tabId: 101, active: true }]);

  const mixedInteractiveFailure = createChromeApi();
  const mixedActivations = [];
  const mixedInteractiveFailureResult = await aggregateSearch.openAggregateSearch(
    mixedInteractiveFailure.api,
    {
      query: 'mixed result',
      providers: [providers[1], providers[0]],
      getEntryUrl,
      isInteractiveProvider,
      scheduleActivation(task, delayMs) {
        mixedActivations.push({ task, delayMs });
      },
      submitPromptInTab() {
        return Promise.resolve({ ok: false, reason: 'injection-failed' });
      }
    }
  );
  assert.strictEqual(mixedInteractiveFailureResult.ok, true);
  assert.strictEqual(mixedInteractiveFailureResult.interactiveFailedCount, 1);
  assert.strictEqual(mixedInteractiveFailureResult.activationDeferred, true);
  assert.strictEqual(mixedActivations.length, 1);
  mixedActivations[0].task();
  assert.deepStrictEqual(
    mixedInteractiveFailure.activated,
    [{ tabId: 102, active: true }],
    'activation must target the successful static result instead of the failed interactive tab'
  );

  const groupUnavailable = createChromeApi({ omitGroupApi: true });
  const groupUnavailableResult = await aggregateSearch.openAggregateSearch(groupUnavailable.api, {
    query: 'ungrouped',
    providers: [providers[0]],
    autoCreateTabGroup: true,
    disposition: 'backgroundTab',
    getEntryUrl
  });
  assert.strictEqual(groupUnavailableResult.ok, true);
  assert.strictEqual(groupUnavailableResult.grouped, false);
  assert.strictEqual(groupUnavailableResult.reason, 'tab-group-api-unavailable');
  assert.strictEqual(groupUnavailable.created.length, 1);

  const unavailableResult = await aggregateSearch.openAggregateSearch({}, {
    query: 'test',
    providers,
    getEntryUrl
  });
  assert.strictEqual(unavailableResult.ok, false);
  assert.strictEqual(unavailableResult.reason, 'tabs-api-unavailable');

  const invalidResult = await aggregateSearch.openAggregateSearch(success.api, {
    query: '   ',
    providers,
    getEntryUrl
  });
  assert.strictEqual(invalidResult.ok, false);
  assert.strictEqual(invalidResult.reason, 'invalid-query');

  const unsafe = createChromeApi();
  const unsafeResult = await aggregateSearch.openAggregateSearch(unsafe.api, {
    query: 'unsafe',
    providers: [{ key: 'unsafe', template: 'data:text/html,unsafe' }],
    getEntryUrl
  });
  assert.strictEqual(unsafeResult.ok, false);
  assert.strictEqual(unsafeResult.reason, 'provider-url-unavailable');
  assert.deepStrictEqual(unsafe.created, [], 'non-http(s) URLs must never reach tabs.create');

  const interactiveFailure = createChromeApi();
  const interactiveFailureResult = await aggregateSearch.openAggregateSearch(
    interactiveFailure.api,
    {
      query: 'not submitted',
      providers: [providers[1]],
      getEntryUrl,
      isInteractiveProvider,
      submitPromptInTab() {
        return Promise.resolve({ ok: false, reason: 'injection-failed' });
      }
    }
  );
  assert.strictEqual(interactiveFailureResult.ok, false);
  assert.strictEqual(interactiveFailureResult.reason, 'interactive-submit-failed');
  assert.strictEqual(interactiveFailureResult.interactiveFailedCount, 1);
  assert.strictEqual(interactiveFailureResult.activationDeferred, false);
  assert.strictEqual(interactiveFailureResult.activationDelayMs, 0);
  assert.deepStrictEqual(interactiveFailure.activated, []);

  let now = 1000;
  let providerLoadCount = 0;
  const runnerOpenCalls = [];
  const storedDefinitions = aggregateStore.serializeAggregateSearches([{
    id: 'research',
    name: 'Research',
    sourceRefs: ['builtin:google', 'custom:docs'],
    autoCreateTabGroup: true
  }]);
  const storedProviders = [
    providers[0],
    {
      id: 'docs',
      key: 'docs',
      name: 'Docs',
      template: 'https://docs.example.test/?q={query}',
      _xIsCustom: true
    }
  ];
  const runner = aggregateSearch.createAggregateSearchQueryRunner({
    aggregateSearchStore: aggregateStore,
    chromeApi: success.api,
    storageArea: {
      get(_keys, callback) {
        callback({ [aggregateStore.STORAGE_KEY]: storedDefinitions });
      }
    },
    storageKey: aggregateStore.STORAGE_KEY,
    loadSiteSearchProviders() {
      providerLoadCount += 1;
      return Promise.resolve(storedProviders);
    },
    loadAggregateSearchAutoGroupEnabled() {
      return Promise.resolve(false);
    },
    resolveTabPlacement(sourceTab) {
      assert.strictEqual(sourceTab.id, 88);
      return Promise.resolve({ windowId: 7, index: 4 });
    },
    openAggregateSearch(_chromeApi, options) {
      runnerOpenCalls.push(options);
      return Promise.resolve({ ok: true, openedCount: options.providers.length });
    },
    getEntryUrl,
    isInteractiveProvider,
    now: () => now,
    dedupeWindowMs: 1000
  });
  const sender = { tab: { id: 88, windowId: 7 } };
  const firstRun = runner(
    'research',
    'stored trust boundary',
    sender,
    'currentTab',
    { providers: [{ template: 'https://attacker.invalid/' }] }
  );
  const duplicateRun = runner('research', 'stored trust boundary', sender, 'currentTab');
  assert.strictEqual(firstRun, duplicateRun, 'duplicate requests must share one execution');
  const firstResult = await firstRun;
  assert.strictEqual(firstResult.ok, true);
  assert.strictEqual(providerLoadCount, 1);
  assert.strictEqual(runnerOpenCalls.length, 1);
  assert.deepStrictEqual(runnerOpenCalls[0].providers, storedProviders);
  assert.strictEqual(
    runnerOpenCalls[0].autoCreateTabGroup,
    false,
    'the global setting must override a legacy per-item true value'
  );
  assert.strictEqual(runnerOpenCalls[0].windowId, 7);
  assert.strictEqual(runnerOpenCalls[0].insertIndex, 4);
  await runner('research', 'stored trust boundary', sender, 'currentTab');
  assert.strictEqual(runnerOpenCalls.length, 1, 'recent identical requests stay deduplicated');
  now += 1001;
  await runner('research', 'stored trust boundary', sender, 'currentTab');
  assert.strictEqual(runnerOpenCalls.length, 2, 'a later intentional search is allowed');

  const missingSourceDefinitions = aggregateStore.serializeAggregateSearches([{
    id: 'broken',
    name: 'Broken',
    sourceRefs: ['builtin:google', 'custom:missing'],
    autoCreateTabGroup: false
  }]);
  const missingSourceRunner = aggregateSearch.createAggregateSearchQueryRunner({
    aggregateSearchStore: aggregateStore,
    chromeApi: success.api,
    storageArea: {
      get(_keys, callback) {
        callback({ [aggregateStore.STORAGE_KEY]: missingSourceDefinitions });
      }
    },
    storageKey: aggregateStore.STORAGE_KEY,
    loadSiteSearchProviders: () => Promise.resolve([providers[0]]),
    openAggregateSearch() {
      throw new Error('must not open a partial aggregate');
    },
    getEntryUrl
  });
  const missingSourceResult = await missingSourceRunner(
    'broken',
    'must stay complete',
    sender,
    'currentTab'
  );
  assert.strictEqual(missingSourceResult.ok, false);
  assert.strictEqual(missingSourceResult.reason, 'aggregate-search-sources-unavailable');
  assert.strictEqual(missingSourceResult.requiredSourceCount, 2);
  assert.strictEqual(missingSourceResult.availableSourceCount, 1);
  assert.strictEqual(missingSourceResult.unavailableSourceCount, 1);

  let delegatedAvailabilityChecks = 0;
  const delegatedAvailabilityOpenCalls = [];
  const delegatedAvailabilityRunner = aggregateSearch.createAggregateSearchQueryRunner({
    aggregateSearchStore: {
      loadAggregateSearches() {
        return Promise.resolve([{ id: 'delegated', name: 'Delegated' }]);
      },
      getAggregateSearchAvailability(definition, availableProviders) {
        delegatedAvailabilityChecks += 1;
        return {
          available: true,
          definition: { ...definition, autoCreateTabGroup: false },
          providers: availableProviders,
          requiredSourceCount: 1,
          availableSourceCount: 1,
          unavailableSourceCount: 0
        };
      }
    },
    chromeApi: success.api,
    loadSiteSearchProviders: () => Promise.resolve([providers[0]]),
    loadAggregateSearchAutoGroupEnabled: () => Promise.resolve(true),
    openAggregateSearch(_chromeApi, options) {
      delegatedAvailabilityOpenCalls.push(options);
      return Promise.resolve({ ok: true });
    }
  });
  const delegatedAvailabilityResult = await delegatedAvailabilityRunner(
    'delegated',
    'single source delegated rule',
    sender,
    'currentTab'
  );
  assert.strictEqual(delegatedAvailabilityResult.ok, true);
  assert.strictEqual(delegatedAvailabilityChecks, 1);
  assert.strictEqual(delegatedAvailabilityOpenCalls.length, 1,
    'the runner must use the store availability result as its only validity rule');
  assert.strictEqual(
    delegatedAvailabilityOpenCalls[0].autoCreateTabGroup,
    true,
    'the global setting must override a legacy per-item false value'
  );

  const fallbackGroupCalls = [];
  const fallbackGroupRunner = aggregateSearch.createAggregateSearchQueryRunner({
    aggregateSearchStore: {
      loadAggregateSearches() {
        return Promise.resolve([{ id: 'legacy-group', name: 'Legacy group' }]);
      },
      getAggregateSearchAvailability(definition, availableProviders) {
        return {
          available: true,
          definition: { ...definition, autoCreateTabGroup: true },
          providers: availableProviders,
          requiredSourceCount: availableProviders.length,
          availableSourceCount: availableProviders.length,
          unavailableSourceCount: 0
        };
      }
    },
    chromeApi: success.api,
    loadSiteSearchProviders: () => Promise.resolve([providers[0]]),
    loadAggregateSearchAutoGroupEnabled: () => Promise.reject(
      new Error('temporary setting failure')
    ),
    openAggregateSearch(_chromeApi, options) {
      fallbackGroupCalls.push(options);
      return Promise.resolve({ ok: true });
    }
  });
  const fallbackGroupResult = await fallbackGroupRunner(
    'legacy-group',
    'fallback to legacy setting',
    sender,
    'currentTab'
  );
  assert.strictEqual(fallbackGroupResult.ok, true);
  assert.strictEqual(
    fallbackGroupCalls[0].autoCreateTabGroup,
    true,
    'a failed global-setting read must not block search and should use the legacy value'
  );

  let storageLoadAttempts = 0;
  const storageRetryRunner = aggregateSearch.createAggregateSearchQueryRunner({
    aggregateSearchStore: {
      loadAggregateSearches() {
        storageLoadAttempts += 1;
        return storageLoadAttempts === 1
          ? Promise.reject(new Error('temporary storage failure'))
          : Promise.resolve([{ id: 'storage-retry', name: 'Storage retry' }]);
      },
      getAggregateSearchAvailability(definition, availableProviders) {
        return {
          available: true,
          definition: { ...definition, autoCreateTabGroup: false },
          providers: availableProviders,
          requiredSourceCount: availableProviders.length,
          availableSourceCount: availableProviders.length,
          unavailableSourceCount: 0
        };
      }
    },
    chromeApi: success.api,
    loadSiteSearchProviders: () => Promise.resolve(storedProviders),
    openAggregateSearch: () => Promise.resolve({ ok: true })
  });
  await assert.rejects(
    storageRetryRunner('storage-retry', 'retry', sender, 'currentTab'),
    /temporary storage failure/
  );
  const storageRetryResult = await storageRetryRunner(
    'storage-retry',
    'retry',
    sender,
    'currentTab'
  );
  assert.strictEqual(storageRetryResult.ok, true);
  assert.strictEqual(storageLoadAttempts, 2,
    'a rejected storage load must not poison the request dedupe cache');

  let providerLoadAttempts = 0;
  const providerRetryRunner = aggregateSearch.createAggregateSearchQueryRunner({
    aggregateSearchStore: {
      loadAggregateSearches() {
        return Promise.resolve([{ id: 'provider-retry', name: 'Provider retry' }]);
      },
      getAggregateSearchAvailability(definition, availableProviders) {
        return {
          available: true,
          definition: { ...definition, autoCreateTabGroup: false },
          providers: availableProviders,
          requiredSourceCount: availableProviders.length,
          availableSourceCount: availableProviders.length,
          unavailableSourceCount: 0
        };
      }
    },
    chromeApi: success.api,
    loadSiteSearchProviders() {
      providerLoadAttempts += 1;
      return providerLoadAttempts === 1
        ? Promise.reject(new Error('temporary provider failure'))
        : Promise.resolve(storedProviders);
    },
    openAggregateSearch: () => Promise.resolve({ ok: true })
  });
  await assert.rejects(
    providerRetryRunner('provider-retry', 'retry', sender, 'currentTab'),
    /temporary provider failure/
  );
  const providerRetryResult = await providerRetryRunner(
    'provider-retry',
    'retry',
    sender,
    'currentTab'
  );
  assert.strictEqual(providerRetryResult.ok, true);
  assert.strictEqual(providerLoadAttempts, 2,
    'a rejected provider load must not poison the request dedupe cache');
}

run()
  .then(() => console.log('background aggregate search tests passed'))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
