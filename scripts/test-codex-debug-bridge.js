const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const repoRoot = path.join(__dirname, '..');
const backgroundBridge = require('../src/background/codex-debug-bridge.js');
const surfaceBridge = require('../src/shared/codex-debug-surface.js');
const manifest = require('../manifest.json');
const { readBackgroundSource } = require('./helpers/background-source');

const CODEX_STABLE_ID = 'hehggadaopoacecdllhhajmbjkdcmajg';
const CODEX_BETA_ID = 'lfkehkpjohcoelkpembgemeipeppanef';

function createEvent() {
  const listeners = [];
  return {
    listeners,
    addListener(listener) {
      listeners.push(listener);
    },
    emit(...args) {
      return listeners.map((listener) => listener(...args));
    }
  };
}

function createPort(sender) {
  const onMessage = createEvent();
  const onDisconnect = createEvent();
  const posted = [];
  return {
    name: backgroundBridge.SURFACE_PORT_NAME,
    sender: sender || {},
    onMessage,
    onDisconnect,
    posted,
    postMessage(message) {
      posted.push(message);
    }
  };
}

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(String(key)) ? values.get(String(key)) : null;
    },
    removeItem(key) {
      values.delete(String(key));
    },
    setItem(key, value) {
      values.set(String(key), String(value));
    }
  };
}

function createDebugChromeApi(runtimeOverrides) {
  return {
    runtime: {
      id: 'kkcjcneagmlhpeaafngjdlpcfjakejgb',
      getManifest() {
        return manifest;
      },
      onConnect: createEvent(),
      onMessageExternal: createEvent(),
      ...runtimeOverrides
    }
  };
}

async function runBackgroundBridgeTests() {
  assert.deepStrictEqual(
    manifest.externally_connectable.ids.slice().sort(),
    [CODEX_BETA_ID, CODEX_STABLE_ID].sort(),
    'source manifest should only allow the official stable and beta Codex extensions'
  );
  assert(!manifest.externally_connectable.ids.includes('*'), 'Codex debug bridge must not allow every extension');

  const chromeApi = createDebugChromeApi();
  const bridge = backgroundBridge.create({ chromeApi, requestTimeoutMs: 100 });
  assert.strictEqual(bridge.isEnabled(), true, 'source development manifest should enable the bridge');
  assert.strictEqual(bridge.attach(), true, 'bridge should attach to runtime events once');
  assert.strictEqual(bridge.attach(), false, 'bridge attachment should be idempotent');

  const port = createPort({
    tab: { id: 27, url: 'chrome-extension://lumno/newtab.html' },
    frameId: 0,
    documentId: 'doc-newtab'
  });
  chromeApi.runtime.onConnect.emit(port);
  port.onMessage.emit({
    channel: backgroundBridge.CHANNEL,
    version: backgroundBridge.VERSION,
    type: 'surface.register',
    surfaceId: 'surface-newtab',
    pageType: 'newtab',
    url: 'chrome-extension://lumno/newtab.html',
    title: 'New Tab',
    readyState: 'complete'
  });

  assert.deepStrictEqual(
    bridge.listSurfaces().map((surface) => ({
      surfaceId: surface.surfaceId,
      type: surface.type,
      tabId: surface.tabId,
      frameId: surface.frameId
    })),
    [{ surfaceId: 'surface-newtab', type: 'newtab', tabId: 27, frameId: 0 }],
    'registered page port should become a targetable debug surface'
  );

  let describeResponse = null;
  const describeAsync = bridge.handleExternalMessage({
    channel: backgroundBridge.CHANNEL,
    version: backgroundBridge.VERSION,
    requestId: 'describe-1',
    method: 'bridge.describe'
  }, { id: CODEX_STABLE_ID }, (response) => {
    describeResponse = response;
  });
  assert.strictEqual(describeAsync, false, 'describe response should be synchronous');
  assert.strictEqual(describeResponse.ok, true);
  assert(describeResponse.result.methods.includes('surface.snapshot'));
  assert(describeResponse.result.methods.includes('surface.performance'));
  assert(describeResponse.result.methods.includes('surface.profileAction'));
  assert(describeResponse.result.methods.includes('surface.performancePanel'));
  assert(describeResponse.result.methods.includes('surface.performanceRecording'));
  assert(describeResponse.result.methods.includes('surface.startupSamples'));
  assert.strictEqual(describeResponse.result.developmentOnly, true);

  let listResponse = null;
  bridge.handleExternalMessage({
    channel: backgroundBridge.CHANNEL,
    version: backgroundBridge.VERSION,
    method: 'surfaces.list'
  }, { id: CODEX_BETA_ID }, (response) => {
    listResponse = response;
  });
  assert.strictEqual(listResponse.result.surfaces[0].surfaceId, 'surface-newtab');

  let snapshotResponse = null;
  const snapshotAsync = bridge.handleExternalMessage({
    channel: backgroundBridge.CHANNEL,
    version: backgroundBridge.VERSION,
    requestId: 'snapshot-1',
    method: 'surface.snapshot',
    target: { tabId: 27, type: 'newtab' },
    params: { selector: 'body' }
  }, { id: CODEX_STABLE_ID }, (response) => {
    snapshotResponse = response;
  });
  assert.strictEqual(snapshotAsync, true, 'surface requests should keep the external response channel open');
  const forwarded = port.posted.at(-1);
  assert.strictEqual(forwarded.method, 'surface.snapshot');
  assert.strictEqual(forwarded.params.selector, 'body');
  port.onMessage.emit({
    channel: backgroundBridge.CHANNEL,
    version: backgroundBridge.VERSION,
    type: 'surface.response',
    requestId: forwarded.requestId,
    response: {
      ok: true,
      result: { title: 'New Tab', markup: '<body>ready</body>' }
    }
  });
  assert.strictEqual(snapshotResponse.ok, true);
  assert.strictEqual(snapshotResponse.requestId, 'snapshot-1');
  assert.strictEqual(snapshotResponse.result.title, 'New Tab');

  let unauthorizedResponse = null;
  const unauthorizedResult = bridge.handleExternalMessage({
    channel: backgroundBridge.CHANNEL,
    version: backgroundBridge.VERSION,
    method: 'surfaces.list'
  }, { id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }, (response) => {
    unauthorizedResponse = response;
  });
  assert.strictEqual(unauthorizedResult, false);
  assert.strictEqual(unauthorizedResponse, null, 'untrusted extensions should receive no debug response');

  port.onDisconnect.emit();
  assert.deepStrictEqual(bridge.listSurfaces(), [], 'disconnect should remove the page surface');

  const storeLikeManifest = { ...manifest };
  delete storeLikeManifest.key;
  delete storeLikeManifest.externally_connectable;
  const productionChromeApi = createDebugChromeApi({
    getManifest() {
      return storeLikeManifest;
    }
  });
  const productionBridge = backgroundBridge.create({ chromeApi: productionChromeApi });
  assert.strictEqual(productionBridge.isEnabled(), false, 'store manifest should disable the bridge');
  assert.strictEqual(productionBridge.attach(), false, 'store build should not attach external listeners');
}

async function runSurfaceBridgeTests() {
  const dom = new JSDOM(`<!doctype html>
    <html><head><title>New Tab</title></head><body data-lumno-page="newtab">
      <button id="action" class="x-nt-shortcut-tile" data-action="run" data-shortcut-id="fixture-shortcut" aria-label="Run action">Run</button>
      <input id="query" class="x-nt-suggestion-item" value="before" />
      <input id="secret" type="password" value="do-not-return" />
      <input id="checkbox" type="checkbox" />
      <input id="radio" type="radio" checked />
      <img id="wallpaper" class="x-nt-bookmark-card" src="data:image/png;base64,large" />
      <script>window.fixtureScript = true;</script>
    </body></html>`, {
    url: 'chrome-extension://kkcjcneagmlhpeaafngjdlpcfjakejgb/newtab.html',
    pretendToBeVisual: true
  });
  const port = createPort();
  port.disconnect = () => {};
  Object.defineProperty(dom.window, 'localStorage', {
    configurable: true,
    value: createMemoryStorage()
  });
  Object.defineProperty(dom.window, 'sessionStorage', {
    configurable: true,
    value: createMemoryStorage()
  });
  const performanceObservers = new Map();
  class FixturePerformanceObserver {
    static supportedEntryTypes = [
      'longtask',
      'event',
      'layout-shift',
      'largest-contentful-paint'
    ];

    constructor(callback) {
      this.callback = callback;
      this.type = '';
    }

    observe(options) {
      this.type = String(options && options.type || '');
      performanceObservers.set(this.type, this);
    }

    disconnect() {
      if (performanceObservers.get(this.type) === this) {
        performanceObservers.delete(this.type);
      }
    }

    emit(entries) {
      this.callback({ getEntries: () => entries });
    }
  }
  Object.defineProperty(dom.window, 'PerformanceObserver', {
    configurable: true,
    value: FixturePerformanceObserver
  });
  const performanceEntries = {
    navigation: [{
      type: 'navigate',
      duration: 128.5,
      responseEnd: 5.2,
      domInteractive: 91.4,
      domContentLoadedEventEnd: 103.7,
      loadEventEnd: 128.5
    }],
    paint: [
      { name: 'first-paint', startTime: 31.2 },
      { name: 'first-contentful-paint', startTime: 42.6 }
    ],
    resource: [{
      name: 'https://example.com/newtab.js?token=do-not-return#private',
      initiatorType: 'script',
      startTime: 6,
      duration: 61.8,
      transferSize: 4096
    }],
    mark: [{ entryType: 'mark', name: 'lumno-newtab-bootstrap', startTime: 7.5, duration: 0 }],
    measure: [{ entryType: 'measure', name: 'lumno-newtab-ready', startTime: 7.5, duration: 84.2 }]
  };
  Object.defineProperty(dom.window.performance, 'getEntriesByType', {
    configurable: true,
    value(type) {
      return performanceEntries[type] || [];
    }
  });
  Object.defineProperty(dom.window.performance, 'mark', {
    configurable: true,
    value(name) {
      performanceEntries.mark.push({
        entryType: 'mark',
        name: String(name),
        startTime: dom.window.performance.now(),
        duration: 0
      });
    }
  });
  Object.defineProperty(dom.window.performance, 'measure', {
    configurable: true,
    value(name, startName, endName) {
      const getLatestMark = (markName) => performanceEntries.mark
        .filter((entry) => entry.name === markName)
        .at(-1);
      const start = getLatestMark(startName);
      const end = getLatestMark(endName);
      performanceEntries.measure.push({
        entryType: 'measure',
        name: String(name),
        startTime: start ? start.startTime : 0,
        duration: Math.max(0, (end ? end.startTime : 0) - (start ? start.startTime : 0))
      });
    }
  });
  Object.defineProperty(dom.window.performance, 'memory', {
    configurable: true,
    value: {
      usedJSHeapSize: 12_000_000,
      totalJSHeapSize: 24_000_000,
      jsHeapSizeLimit: 256_000_000
    }
  });
  let copiedPerformanceReport = '';
  Object.defineProperty(dom.window.navigator, 'clipboard', {
    configurable: true,
    value: {
      async writeText(value) {
        copiedPerformanceReport = String(value || '');
      }
    }
  });
  let downloadedPerformanceUrl = '';
  let revokedPerformanceUrl = '';
  Object.defineProperty(dom.window.URL, 'createObjectURL', {
    configurable: true,
    value() {
      return 'blob:lumno-performance-report';
    }
  });
  Object.defineProperty(dom.window.URL, 'revokeObjectURL', {
    configurable: true,
    value(value) {
      revokedPerformanceUrl = String(value || '');
    }
  });
  dom.window.HTMLAnchorElement.prototype.click = function() {
    downloadedPerformanceUrl = this.href;
  };
  dom.window.document.documentElement.setAttribute(
    'data-lumno-newtab-bootstrap-storage-requests',
    '1'
  );
  dom.window.document.documentElement.setAttribute(
    'data-lumno-newtab-bootstrap-storage-reads',
    '4'
  );
  dom.window.document.documentElement.setAttribute(
    'data-lumno-newtab-bootstrap-storage-keys',
    'theme,shortcuts,bookmarks'
  );
  const chromeApi = createDebugChromeApi({
    connect(connectInfo) {
      assert.strictEqual(connectInfo.name, surfaceBridge.SURFACE_PORT_NAME);
      return port;
    }
  });

  let clickCount = 0;
  dom.window.document.getElementById('action').addEventListener('click', () => {
    clickCount += 1;
  });
  let inputCount = 0;
  dom.window.document.getElementById('query').addEventListener('input', () => {
    inputCount += 1;
  });

  const agent = surfaceBridge.createSurfaceAgent({
    windowObj: dom.window,
    documentObj: dom.window.document,
    chromeApi
  });
  assert(agent, 'development page should create a debug surface agent');
  assert.strictEqual(agent.surfaceType, 'newtab');
  assert(agent.startupProfiler, 'development New Tab should install startup phase marks');
  agent.startupProfiler.markMilestone('fixture-start');
  agent.startupProfiler.markMilestone('fixture-ready');
  agent.startupProfiler.observeTask('fixture-task', Promise.resolve(true));
  await Promise.resolve();
  assert(
    performanceEntries.measure.some((entry) =>
      entry.name === 'lumno-newtab-phase-fixture-start-to-fixture-ready'
    ),
    'startup profiler should measure consecutive New Tab milestones'
  );
  assert(
    performanceEntries.measure.some((entry) => entry.name === 'lumno-newtab-task-fixture-task'),
    'startup profiler should measure asynchronous startup tasks without changing them'
  );
  assert.strictEqual(dom.window.document.documentElement.dataset.lumnoCodexDebugReady, 'true');
  assert.strictEqual(port.posted[0].type, 'surface.register');
  assert.strictEqual(port.posted[0].pageType, 'newtab');
  assert.strictEqual(
    dom.window.document.querySelector('[data-lumno-performance-panel-host]'),
    null,
    'development performance panel should not mount until explicitly opened'
  );

  performanceObservers.get('longtask').emit([{
    name: 'self',
    startTime: 55,
    duration: 73.4
  }]);
  performanceObservers.get('event').emit([{
    name: 'pointerout',
    startTime: 140,
    duration: 42.2,
    processingStart: 144,
    processingEnd: 170,
    interactionId: 7,
    target: dom.window.document.getElementById('action')
  }, {
    name: 'pointerleave',
    startTime: 140,
    duration: 42.2,
    processingStart: 145,
    processingEnd: 169,
    interactionId: 7,
    target: dom.window.document.getElementById('action')
  }]);
  performanceObservers.get('layout-shift').emit([{
    startTime: 90,
    value: 0.12,
    hadRecentInput: false
  }, {
    startTime: 190,
    value: 0.04,
    hadRecentInput: true
  }]);
  performanceObservers.get('largest-contentful-paint').emit([{
    startTime: 81.5,
    renderTime: 81.5,
    loadTime: 0,
    size: 12000
  }]);
  dom.window.document.body.setAttribute('data-nt-ready', '1');
  await Promise.resolve();

  const startupReport = agent.executeRequest('surface.startupSamples', {
    action: 'capture'
  });
  assert.strictEqual(startupReport.kind, 'cold-start-series');
  assert.strictEqual(startupReport.sampleCount, 1);
  assert.strictEqual(startupReport.samples[0].startup.ready, true);
  assert.strictEqual(startupReport.samples[0].longTasks.longestMs, 73.4);
  assert.strictEqual(startupReport.summary.readyAtMs.count, 1);
  assert.deepStrictEqual(startupReport.navigationTypes, { navigate: 1 });
  assert(
    dom.window.localStorage.getItem('lumno.codex.newtab.startup-samples.v1'),
    'startup samples should use extension-wide localStorage so fresh New Tab pages share a series'
  );
  assert.strictEqual(
    dom.window.sessionStorage.getItem('lumno.codex.newtab.startup-samples.v1'),
    null,
    'startup samples should not be isolated to a single tab session'
  );

  const performanceSnapshot = agent.executeRequest('surface.performance', { maxEntries: 10 });
  assert.strictEqual(performanceSnapshot.surfaceType, 'newtab');
  assert.strictEqual(performanceSnapshot.startup.ready, true);
  assert.strictEqual(typeof performanceSnapshot.startup.readyAtMs, 'number');
  assert.strictEqual(performanceSnapshot.startup.storage.requests, 1);
  assert.strictEqual(performanceSnapshot.startup.storage.reads, 4);
  assert.strictEqual(performanceSnapshot.startup.storage.keys, 'theme,shortcuts,bookmarks');
  assert.strictEqual(performanceSnapshot.startup.navigation.domInteractive, 91.4);
  assert.strictEqual(performanceSnapshot.startup.largestContentfulPaint.startTime, 81.5);
  assert.strictEqual(performanceSnapshot.responsiveness.longTasks.longestMs, 73.4);
  assert.strictEqual(performanceSnapshot.responsiveness.events.longestMs, 42.2);
  assert.strictEqual(performanceSnapshot.responsiveness.events.count, 2);
  assert.strictEqual(performanceSnapshot.responsiveness.events.entries[0].inputDelayMs, 4);
  assert.strictEqual(performanceSnapshot.responsiveness.events.entries[0].processingDurationMs, 26);
  assert.strictEqual(performanceSnapshot.responsiveness.events.entries[0].presentationDelayMs, 12.2);
  assert.strictEqual(
    performanceSnapshot.responsiveness.events.entries[0].target.element.id,
    'action'
  );
  assert.strictEqual(
    performanceSnapshot.responsiveness.events.entries[0].target.element.attributes[
      'data-shortcut-id'
    ],
    'fixture-shortcut'
  );
  assert.strictEqual(performanceSnapshot.responsiveness.eventBursts.count, 1);
  assert.strictEqual(performanceSnapshot.responsiveness.eventBursts.rawEntryCount, 2);
  assert.strictEqual(performanceSnapshot.responsiveness.eventBursts.totalDurationMs, 42.2);
  assert.strictEqual(performanceSnapshot.responsiveness.eventBursts.longestInputDelayMs, 4);
  assert.strictEqual(
    performanceSnapshot.responsiveness.eventBursts.longestProcessingDurationMs,
    26
  );
  assert.strictEqual(
    performanceSnapshot.responsiveness.eventBursts.longestPresentationDelayMs,
    12.2
  );
  assert.deepStrictEqual(
    performanceSnapshot.responsiveness.eventBursts.entries[0].names,
    ['pointerout', 'pointerleave']
  );
  assert.strictEqual(
    performanceSnapshot.responsiveness.eventBursts.entries[0].entryCount,
    2
  );
  assert.strictEqual(performanceSnapshot.responsiveness.cumulativeLayoutShift, 0.12);
  assert.deepStrictEqual(performanceSnapshot.responsiveness.observerSupport, {
    longtask: true,
    event: true,
    layoutShift: true,
    largestContentfulPaint: true
  });
  assert.strictEqual(performanceSnapshot.document.bookmarkCards, 1);
  assert.strictEqual(performanceSnapshot.document.shortcutTiles, 1);
  assert.strictEqual(performanceSnapshot.document.suggestionRows, 1);
  assert.strictEqual(performanceSnapshot.memory.usedJsHeapBytes, 12_000_000);
  assert.strictEqual(
    performanceSnapshot.resources.slowest[0].name,
    'https://example.com/newtab.js'
  );
  assert(!JSON.stringify(performanceSnapshot).includes('do-not-return'));
  const metricsWithoutEntries = agent.executeRequest('surface.performance', { maxEntries: 0 });
  assert.deepStrictEqual(metricsWithoutEntries.responsiveness.longTasks.entries, []);
  assert.deepStrictEqual(metricsWithoutEntries.responsiveness.events.entries, []);
  assert.deepStrictEqual(metricsWithoutEntries.responsiveness.eventBursts.entries, []);
  assert.deepStrictEqual(metricsWithoutEntries.responsiveness.layoutShifts, []);
  assert.deepStrictEqual(metricsWithoutEntries.resources.slowest, []);

  const queryResult = agent.executeRequest('surface.query', { selector: '#action' });
  assert.strictEqual(queryResult.count, 1);
  assert.strictEqual(queryResult.elements[0].text, 'Run');
  assert.strictEqual(queryResult.elements[0].attributes['aria-label'], 'Run action');

  agent.executeRequest('surface.action', { selector: '#action', action: 'click' });
  assert.strictEqual(clickCount, 1, 'click action should invoke the real DOM control');

  const profiledAction = await agent.executeRequest('surface.profileAction', {
    selector: '#action',
    action: 'click',
    frames: 2,
    timeoutMs: 500
  });
  assert.strictEqual(clickCount, 2, 'profileAction should invoke the same real DOM control once');
  assert.strictEqual(profiledAction.action, 'click');
  assert(profiledAction.syncDurationMs >= 0);
  assert.strictEqual(profiledAction.presentation.requestedFrames, 2);
  assert.strictEqual(profiledAction.presentation.completedFrames, 2);
  assert.strictEqual(profiledAction.presentation.timedOut, false);
  assert(profiledAction.presentation.elapsedMs >= 0);
  assert(profiledAction.presentation.firstFrameMs >= 0);
  assert(profiledAction.interactionToFirstFrameMs >= profiledAction.syncDurationMs);
  assert(profiledAction.interactionToSettledFramesMs >= profiledAction.interactionToFirstFrameMs);
  assert.strictEqual(profiledAction.performanceDelta.longTasks.count, 0);

  const recordingStatus = agent.executeRequest('surface.performanceRecording', {
    action: 'start',
    durationMs: 1000,
    scenario: 'search'
  });
  assert.strictEqual(recordingStatus.active, true);
  assert.strictEqual(recordingStatus.scenario, 'search');
  performanceObservers.get('event').emit(Array.from({ length: 205 }, (_, index) => ({
    name: 'pointerover',
    startTime: 1000 + (index * 2),
    duration: index === 0 ? 96 : 24,
    processingStart: 1004 + (index * 2),
    processingEnd: (index === 0 ? 1020 : 1005) + (index * 2),
    interactionId: 0,
    target: dom.window.document.getElementById('action')
  })));
  await new Promise((resolve) => dom.window.requestAnimationFrame(() => {
    dom.window.requestAnimationFrame(resolve);
  }));
  const recordingReport = agent.executeRequest('surface.performanceRecording', {
    action: 'stop'
  });
  assert.strictEqual(recordingReport.surfaceType, 'newtab');
  assert.strictEqual(recordingReport.scenario, 'search');
  assert.strictEqual(recordingReport.finishedBy, 'manual');
  assert(recordingReport.frames.count >= 1);
  assert(recordingReport.durationMs >= 0);
  assert.strictEqual(typeof recordingReport.performanceDelta.longTasks.count, 'number');
  assert.strictEqual(typeof recordingReport.performanceDelta.eventBursts.count, 'number');
  assert.strictEqual(
    recordingReport.performanceDelta.events.longestMs,
    96,
    'recording aggregate maxima should survive bounded raw event eviction'
  );
  assert.strictEqual(
    recordingReport.performanceDelta.eventBursts.longestMs,
    96,
    'recording aggregate maxima should survive bounded event burst eviction'
  );
  assert.strictEqual(
    recordingReport.performanceDelta.eventBursts.longestProcessingDurationMs,
    16
  );
  assert.strictEqual(
    recordingReport.performanceDelta.eventBursts.longestInputDelayMs,
    4
  );
  assert.strictEqual(
    recordingReport.performanceDelta.eventBursts.longestPresentationDelayMs,
    76
  );
  assert.strictEqual(
    agent.executeRequest('surface.performanceRecording', { action: 'latest' }),
    recordingReport
  );

  const shortcutEvent = new dom.window.KeyboardEvent('keydown', {
    altKey: true,
    bubbles: true,
    code: 'KeyP',
    ctrlKey: true,
    key: 'p',
    shiftKey: true
  });
  dom.window.document.body.dispatchEvent(shortcutEvent);
  const performancePanelHost = dom.window.document.querySelector(
    '[data-lumno-performance-panel-host]'
  );
  assert(performancePanelHost, 'development shortcut should mount the performance panel');
  assert.strictEqual(performancePanelHost.hidden, false);
  assert(performancePanelHost.shadowRoot, 'performance panel should isolate its styles in Shadow DOM');
  assert(
    performancePanelHost.shadowRoot.textContent.includes('Lumno Performance'),
    'performance panel should expose scenario recording controls'
  );
  const performancePanelStyles = performancePanelHost.shadowRoot.querySelector('style').textContent;
  assert(!/\b(?:animation|transition|filter|will-change)\s*:/i.test(performancePanelStyles),
    'performance panel should not introduce motion or paint-heavy effects into its own samples');
  const panelStartButton = performancePanelHost.shadowRoot.querySelector('[data-action="start"]');
  const panelStopButton = performancePanelHost.shadowRoot.querySelector('[data-action="stop"]');
  panelStartButton.click();
  assert.strictEqual(
    agent.executeRequest('surface.performanceRecording', { action: 'status' }).active,
    true,
    'panel Start should begin the same bounded performance recorder exposed by the bridge'
  );
  panelStopButton.click();
  assert.strictEqual(
    agent.executeRequest('surface.performanceRecording', { action: 'status' }).active,
    false,
    'panel Stop should finish recording without changing app controls'
  );
  assert(
    performancePanelHost.shadowRoot.querySelector('[data-role="output"]').textContent
      .includes('Estimated dropped frames (60 Hz)'),
    'completed panel recording should render a concise frame and responsiveness summary'
  );
  assert(
    performancePanelHost.shadowRoot.querySelector('[data-role="output"]').textContent
      .includes('max processing'),
    'panel summary should distinguish event processing from total presentation latency'
  );
  performancePanelHost.shadowRoot.querySelector('[data-action="copy-startups"]').click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.strictEqual(
    JSON.parse(copiedPerformanceReport).kind,
    'cold-start-series',
    'Copy startups should export the bounded cross-tab startup report'
  );
  performancePanelHost.shadowRoot.querySelector('[data-action="copy"]').click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.strictEqual(
    JSON.parse(copiedPerformanceReport).scenario,
    'mixed',
    'Copy JSON should export the latest sanitized recording'
  );
  performancePanelHost.shadowRoot.querySelector('[data-action="download"]').click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.strictEqual(downloadedPerformanceUrl, 'blob:lumno-performance-report');
  assert.strictEqual(revokedPerformanceUrl, 'blob:lumno-performance-report');
  const closedPanelStatus = agent.executeRequest('surface.performancePanel', {
    action: 'close'
  });
  assert.strictEqual(closedPanelStatus.open, false);
  assert.strictEqual(performancePanelHost.hidden, true);
  const reopenedPanelStatus = agent.executeRequest('surface.performancePanel', {
    action: 'open'
  });
  assert.strictEqual(reopenedPanelStatus.open, true);

  const fillResult = agent.executeRequest('surface.action', {
    selector: '#query',
    action: 'fill',
    value: 'after'
  });
  assert.strictEqual(dom.window.document.getElementById('query').value, 'after');
  assert.strictEqual(fillResult.element.value, 'after');
  assert.strictEqual(inputCount, 1, 'fill should dispatch an input event for app state handlers');

  const passwordQuery = agent.executeRequest('surface.query', { selector: '#secret' });
  assert.strictEqual(passwordQuery.elements[0].value, '[redacted]');

  const snapshot = agent.executeRequest('surface.snapshot', { selector: 'body' });
  assert.strictEqual(snapshot.surfaceType, 'newtab');
  assert(!snapshot.markup.includes('<script'), 'snapshot should omit executable scripts');
  assert(!snapshot.markup.includes('do-not-return'), 'snapshot should redact password values');
  assert(snapshot.markup.includes('[omitted-url]'), 'snapshot should omit data and blob resource URLs');
  assert(!snapshot.text.includes('fixtureScript'), 'snapshot text should come from the sanitized clone');

  const passwordSnapshot = agent.executeRequest('surface.snapshot', { selector: '#secret' });
  assert(
    !passwordSnapshot.markup.includes('do-not-return'),
    'snapshot should redact a password input selected as the root element'
  );
  assert(passwordSnapshot.markup.includes('[redacted]'));
  const imageSnapshot = agent.executeRequest('surface.snapshot', { selector: '#wallpaper' });
  assert(
    imageSnapshot.markup.includes('[omitted-url]'),
    'snapshot should sanitize a data URL on the selected root element'
  );
  const scriptSnapshot = agent.executeRequest('surface.snapshot', { selector: 'script' });
  assert(!scriptSnapshot.markup.includes('<script'), 'snapshot should omit a selected script root');
  assert(!scriptSnapshot.text.includes('fixtureScript'), 'snapshot should omit selected script text');

  let checkboxInputCount = 0;
  let checkboxChangeCount = 0;
  const checkbox = dom.window.document.getElementById('checkbox');
  checkbox.addEventListener('input', () => {
    checkboxInputCount += 1;
  });
  checkbox.addEventListener('change', () => {
    checkboxChangeCount += 1;
  });
  const checkboxResult = agent.executeRequest('surface.action', {
    selector: '#checkbox',
    action: 'setChecked',
    checked: true
  });
  assert.strictEqual(checkboxResult.element.checked, true);
  assert.strictEqual(checkboxInputCount, 1, 'setChecked should dispatch one input event');
  assert.strictEqual(checkboxChangeCount, 1, 'setChecked should dispatch one change event');

  let radioInputCount = 0;
  let radioChangeCount = 0;
  const radio = dom.window.document.getElementById('radio');
  radio.addEventListener('input', () => {
    radioInputCount += 1;
  });
  radio.addEventListener('change', () => {
    radioChangeCount += 1;
  });
  const radioResult = agent.executeRequest('surface.action', {
    selector: '#radio',
    action: 'setChecked',
    checked: false
  });
  assert.strictEqual(radioResult.element.checked, false, 'setChecked(false) should uncheck a radio');
  assert.strictEqual(radioInputCount, 1);
  assert.strictEqual(radioChangeCount, 1);

  const waitResult = await agent.executeRequest('surface.waitFor', {
    selector: '#action',
    state: 'attached',
    timeoutMs: 50
  });
  assert.strictEqual(waitResult.state, 'attached');

  dom.window.dispatchEvent(new dom.window.ErrorEvent('error', {
    message: 'fixture runtime failure'
  }));
  const logResult = agent.executeRequest('surface.logs', {});
  assert(
    logResult.entries.some((entry) => entry.level === 'error' && entry.message.includes('fixture runtime failure')),
    'surface should expose captured runtime failures'
  );

  port.onMessage.emit({
    channel: surfaceBridge.CHANNEL,
    version: surfaceBridge.VERSION,
    type: 'surface.request',
    requestId: 'query-through-port',
    method: 'surface.query',
    params: { selector: '#query' }
  });
  await new Promise((resolve) => setImmediate(resolve));
  const portResponse = port.posted.find((message) => message.requestId === 'query-through-port');
  assert(portResponse, 'surface port should return external adapter requests');
  assert.strictEqual(portResponse.response.ok, true);
  assert.strictEqual(portResponse.response.result.elements[0].value, 'after');

  const storeLikeManifest = { ...manifest };
  delete storeLikeManifest.key;
  const productionDom = new JSDOM('<!doctype html><body></body>', {
    url: 'https://example.com/'
  });
  let productionObserverConstructions = 0;
  Object.defineProperty(productionDom.window, 'PerformanceObserver', {
    configurable: true,
    value: class ProductionPerformanceObserver {
      constructor() {
        productionObserverConstructions += 1;
      }
    }
  });
  const disabledChromeApi = createDebugChromeApi({
    getManifest() {
      return storeLikeManifest;
    },
    connect() {
      throw new Error('production surface must not connect');
    }
  });
  const disabledAgent = surfaceBridge.createSurfaceAgent({
    windowObj: productionDom.window,
    documentObj: productionDom.window.document,
    chromeApi: disabledChromeApi
  });
  assert.strictEqual(disabledAgent, null, 'store page should not start a debug surface');
  assert.strictEqual(
    productionDom.window.__lumnoCodexDebugStartupProfilerV1,
    undefined,
    'store page should not install New Tab startup instrumentation'
  );
  assert.strictEqual(
    productionObserverConstructions,
    0,
    'store page should not create performance observers for the development-only probe'
  );
  productionDom.window.document.body.dispatchEvent(new productionDom.window.KeyboardEvent(
    'keydown',
    {
      altKey: true,
      bubbles: true,
      code: 'KeyP',
      ctrlKey: true,
      key: 'p',
      shiftKey: true
    }
  ));
  assert.strictEqual(
    productionDom.window.document.querySelector('[data-lumno-performance-panel-host]'),
    null,
    'store page should not install or mount the development performance panel'
  );

  dom.window.dispatchEvent(new dom.window.Event('pagehide'));
  assert.strictEqual(performanceObservers.size, 0, 'page teardown should disconnect performance observers');
  assert.strictEqual(
    dom.window.document.querySelector('[data-lumno-performance-panel-host]'),
    null,
    'page teardown should remove the development performance panel'
  );
  productionDom.window.close();
  dom.window.close();
}

function runCrossTabStartupSamplerTests() {
  const sharedStorage = createMemoryStorage();
  let sampleRevision = 0;
  const createSampler = () => {
    sampleRevision += 1;
    const revision = sampleRevision;
    const windowObj = {
      clearTimeout() {},
      localStorage: sharedStorage,
      setTimeout() {
        return revision;
      }
    };
    const documentObj = {
      body: {
        getAttribute() {
          return null;
        }
      }
    };
    const performanceCollector = {
      snapshot() {
        return {
          capturedAtMs: 200 + revision,
          document: { nodeCount: 100 + revision },
          environment: { hardwareConcurrency: 8 },
          memory: null,
          resources: { count: 0, slowest: [], totalDurationMs: 0 },
          responsiveness: {
            longTasks: { count: 0, entries: [], longestMs: 0, totalDurationMs: 0 }
          },
          startup: {
            largestContentfulPaint: { startTime: 180 + revision },
            navigation: { domInteractive: 40 + revision, type: 'navigate' },
            ready: true,
            readyAtMs: 120 + revision
          }
        };
      }
    };
    return surfaceBridge.createStartupSampler(
      windowObj,
      documentObj,
      performanceCollector,
      'newtab'
    );
  };

  const firstTabSampler = createSampler();
  firstTabSampler.capture();
  firstTabSampler.destroy();
  const secondTabSampler = createSampler();
  assert.strictEqual(
    secondTabSampler.getReport().sampleCount,
    1,
    'a fresh New Tab should see samples captured by a previously closed New Tab'
  );
  secondTabSampler.capture();
  assert.strictEqual(secondTabSampler.getReport().sampleCount, 2);
  assert.deepStrictEqual(secondTabSampler.getReport().navigationTypes, { navigate: 2 });
  secondTabSampler.destroy();
}

function runWiringTests() {
  const pagePaths = [
    'newtab.html',
    'src/options/options.html',
    'src/onboarding/onboarding.html'
  ];
  pagePaths.forEach((relativePath) => {
    const source = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
    assert(
      source.includes('../shared/codex-debug-surface.js'),
      `${relativePath} should load the shared Codex debug surface`
    );
  });

  const redirectShellSource = fs.readFileSync(
    path.join(repoRoot, 'src/newtab/lumno-newtab.html'),
    'utf8'
  );
  assert(
    !redirectShellSource.includes('../shared/codex-debug-surface.js'),
    'the redirect-only newtab shell should not bootstrap a debug surface before navigation'
  );

  const backgroundSource = readBackgroundSource();
  assert(backgroundSource.includes("importScripts(chrome.runtime.getURL('src/background/codex-debug-bridge.js'))"));
  assert(
    (backgroundSource.match(/'src\/shared\/codex-debug-surface\.js'/g) || []).length >= 3,
    'search overlay, tab switcher, and document PiP injection paths should install the debug surface'
  );

  const packageSource = fs.readFileSync(path.join(repoRoot, 'scripts/package-store.js'), 'utf8');
  assert(
    packageSource.includes('delete storeManifest.externally_connectable;'),
    'store packaging should remove the development-only external connection declaration'
  );
}

(async () => {
  await runBackgroundBridgeTests();
  await runSurfaceBridgeTests();
  runCrossTabStartupSamplerTests();
  runWiringTests();
  console.log('Codex debug bridge tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
