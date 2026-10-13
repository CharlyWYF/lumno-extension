const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM, VirtualConsole } = require('jsdom');

// Runs the unmodified overlay injection bundle in JSDOM and checks that every
// way of closing an overlay - including a later invocation of the toggle
// helper and the stale-overlay replacement path - releases the page-level
// listeners the overlay registered.

const repoRoot = path.resolve(__dirname, '..');
const backgroundSource = fs.readFileSync(path.join(repoRoot, 'src/background/background.js'), 'utf8');
const injectionList = backgroundSource.match(/const overlayInjectionFiles = (\[[\s\S]*?\n  \]);/);
assert.ok(injectionList, 'the production overlay injection list must be available');
const injectionFiles = vm.runInNewContext(injectionList[1], {
  shouldInjectOverlayCodexDebugSurface: false
});
const HOST_ID = '_x_extension_overlay_host_2026_unique_';
const CONTEXT_TOKEN_KEY = '__lumnoOverlayContextToken2026';

async function waitFor(condition, message, errors) {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    assert.deepStrictEqual(errors, [], 'the full overlay runtime must not throw');
    if (condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail(message);
}

function settle(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms || 30));
}

function createListenerLedger(window) {
  const active = new Map();
  function keyFor(label, type, listener, options) {
    const capture = typeof options === 'boolean'
      ? options
      : Boolean(options && options.capture);
    return { label, type, listener, capture };
  }
  function find(entry) {
    for (const [id, existing] of active) {
      if (existing.label === entry.label && existing.type === entry.type &&
          existing.listener === entry.listener && existing.capture === entry.capture) {
        return id;
      }
    }
    return null;
  }
  let nextId = 1;
  function track(target, label) {
    const originalAdd = target.addEventListener;
    const originalRemove = target.removeEventListener;
    target.addEventListener = function(type, listener, options) {
      const entry = keyFor(label, type, listener, options);
      if (listener && find(entry) === null) {
        active.set(nextId++, entry);
      }
      return originalAdd.call(this, type, listener, options);
    };
    target.removeEventListener = function(type, listener, options) {
      const id = find(keyFor(label, type, listener, options));
      if (id !== null) {
        active.delete(id);
      }
      return originalRemove.call(this, type, listener, options);
    };
  }
  track(window, 'window');
  track(window.document, 'document');
  // React attaches one selectionchange listener per document the first time
  // a root mounts and keeps it for the document's lifetime; it is not owned by
  // an overlay session.
  const isDocumentLifetimeListener = (entry) =>
    entry.label === 'document' && entry.type === 'selectionchange';
  return {
    snapshot() {
      return Array.from(active.values()).filter((entry) => !isDocumentLifetimeListener(entry)).map((entry) => `${entry.label}:${entry.type}${entry.capture ? ':capture' : ''}`).sort();
    },
    size() {
      return this.snapshot().length;
    }
  };
}

function createChromeEvent() {
  const listeners = new Set();
  return {
    listeners,
    addListener(listener) { listeners.add(listener); },
    removeListener(listener) { listeners.delete(listener); },
    hasListener(listener) { return listeners.has(listener); }
  };
}

async function createOverlayPage() {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => errors.push(error.message));
  const dom = new JSDOM('<!doctype html><html><head></head><body><p>Host page</p></body></html>', {
    url: 'https://page.example.test/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole
  });
  const { window } = dom;
  const settings = {
    _x_extension_language_2024_unique_: 'en',
    _x_extension_motion_effects_enabled_2026_unique_: false,
    _x_extension_overlay_open_tabs_default_visible_2026_unique_: false
  };
  const storageArea = {
    get(keys, callback) {
      const requestedKeys = typeof keys === 'string'
        ? [keys]
        : (Array.isArray(keys) ? keys : Object.keys(keys || settings));
      const values = {};
      requestedKeys.forEach((key) => {
        if (Object.hasOwn(settings, key)) {
          values[key] = settings[key];
        } else if (keys && !Array.isArray(keys) && typeof keys === 'object') {
          values[key] = keys[key];
        }
      });
      window.setTimeout(() => callback?.(values), 0);
      return Promise.resolve(values);
    },
    set(values, callback) {
      Object.assign(settings, values);
      callback?.();
      return Promise.resolve();
    }
  };
  const storageChanged = createChromeEvent();
  const mediaListeners = new Set();
  window.chrome = {
    runtime: {
      id: 'kkcjcneagmlhpeaafngjdlpcfjakejgb',
      getURL: (resource) => `chrome-extension://kkcjcneagmlhpeaafngjdlpcfjakejgb/${resource}`,
      getManifest: () => ({ version: '0.9.56' }),
      sendMessage(message, callback) {
        let response = {};
        if (message.action === 'getSearchSuggestions') {
          response = { suggestions: [] };
        } else if (message.action === 'getSearchEngineSuggestions') {
          response = { suggestions: message.localSuggestions || [], hasRemoteSuggestions: false };
        } else if (message.action === 'getTabs') {
          response = { tabs: [] };
        }
        window.setTimeout(() => callback?.(response), 0);
        return Promise.resolve(response);
      }
    },
    i18n: { getUILanguage: () => 'en', getMessage: () => '' },
    storage: {
      sync: storageArea,
      local: storageArea,
      onChanged: storageChanged
    }
  };
  window.matchMedia = (media) => ({
    matches: false,
    media,
    addEventListener(type, listener) { mediaListeners.add(listener); },
    removeEventListener(type, listener) { mediaListeners.delete(listener); }
  });
  window.fetch = async (url) => {
    const parsed = new URL(url);
    assert.strictEqual(parsed.protocol, 'chrome-extension:', 'the overlay test must only read packaged resources');
    const resource = fs.readFileSync(path.join(repoRoot, parsed.pathname), 'utf8');
    return { ok: true, json: async () => JSON.parse(resource), text: async () => resource };
  };

  const evalFile = (file) => {
    window.eval(`${fs.readFileSync(path.join(repoRoot, file), 'utf8')}\n//# sourceURL=${file}`);
  };
  injectionFiles.forEach(evalFile);
  // The settings storage runtime is memoized per chrome API object and keeps
  // one storage-mode listener for the page's lifetime; create it up front so
  // it counts as part of the page baseline rather than the overlay session.
  window.LumnoOverlayRuntime.getStorageArea(window.chrome);
  await settle();
  const ledger = createListenerLedger(window);
  const baselineStorageListeners = new Set(storageChanged.listeners);
  return {
    window,
    errors,
    ledger,
    storageChanged,
    sessionStorageListenerCount() {
      return Array.from(storageChanged.listeners)
        .filter((listener) => !baselineStorageListeners.has(listener)).length;
    },
    mediaListeners,
    reinjectSearchPanel() {
      // Background re-runs the injection list when it cannot reuse the
      // runtime, which replaces the toggle helper while an overlay is open.
      injectionFiles
        .filter((file) => file.startsWith('src/overlay/') && !file.endsWith('favicon-view.js'))
        .forEach(evalFile);
    },
    toggle(context) {
      window._x_extension_toggleSearchOverlay_2026_unique_([], Object.assign({
        currentTabId: 1,
        currentTabUrl: window.location.href
      }, context || {}));
    },
    host() {
      return window.document.getElementById(HOST_ID);
    },
    hostCount() {
      return window.document.querySelectorAll(`#${HOST_ID}`).length;
    }
  };
}

async function openAndSettle(page) {
  page.toggle();
  const host = page.host();
  assert.ok(host, 'the overlay host should mount');
  const panel = page.window.LumnoOverlayShell.findOverlayPanel(page.window.document);
  const root = panel._lumnoOverlayRoot;
  const input = root.querySelector('#_x_extension_search_input_2024_unique_');
  await waitFor(() => root.activeElement === input, 'the overlay should finish initialization', page.errors);
  await settle();
  assert.ok(page.ledger.size() > 0, 'an open overlay should listen for page keys');
  assert.ok(page.sessionStorageListenerCount() > 0, 'an open overlay should follow settings changes');
  return host;
}

function assertReleased(page, baselineDocumentListeners, message) {
  assert.deepStrictEqual(page.ledger.snapshot(), baselineDocumentListeners,
    `${message}: no window/document listeners should remain`);
  assert.strictEqual(page.sessionStorageListenerCount(), 0,
    `${message}: no chrome.storage.onChanged listeners should remain`);
  assert.strictEqual(page.mediaListeners.size, 0,
    `${message}: no color-scheme listeners should remain`);
  assert.strictEqual(page.window._x_extension_search_overlay_open_2026_unique_, false,
    `${message}: the overlay should report itself closed`);
}

async function testToggleCloseFromNewInvocation() {
  const page = await createOverlayPage();
  try {
    const baseline = page.ledger.snapshot();
    await openAndSettle(page);
    // A second hotkey press runs the toggle helper again; that invocation
    // has its own closure and must still release the first one's listeners.
    page.toggle();
    await settle();
    assert.strictEqual(page.hostCount(), 0, 'the second press should close the overlay');
    assertReleased(page, baseline, 'closing from a new invocation');
  } finally {
    page.window.close();
  }
}

async function testToggleCloseAfterReinjection() {
  const page = await createOverlayPage();
  try {
    const baseline = page.ledger.snapshot();
    await openAndSettle(page);
    page.reinjectSearchPanel();
    page.toggle();
    await settle();
    assert.strictEqual(page.hostCount(), 0, 'the reinjected helper should close the open overlay');
    assertReleased(page, baseline, 'closing after reinjection');
  } finally {
    page.window.close();
  }
}

async function testStaleReplacementThenClose() {
  const page = await createOverlayPage();
  try {
    const baseline = page.ledger.snapshot();
    const firstHost = await openAndSettle(page);
    const listenersWhileOpen = page.ledger.snapshot();
    const storageListenersWhileOpen = page.sessionStorageListenerCount();
    // A different context token marks the mounted overlay as stale, so the
    // next invocation replaces it instead of toggling it closed.
    page.window[CONTEXT_TOKEN_KEY] = 'replacement-context';
    const secondHost = await openAndSettle(page);
    assert.notStrictEqual(secondHost, firstHost, 'the stale overlay should be replaced');
    assert.strictEqual(firstHost.isConnected, false, 'the stale overlay host should be removed');
    assert.strictEqual(page.hostCount(), 1, 'exactly one overlay should stay mounted');
    assert.deepStrictEqual(page.ledger.snapshot(), listenersWhileOpen,
      'replacing a stale overlay should not stack a second set of page listeners');
    assert.strictEqual(page.sessionStorageListenerCount(), storageListenersWhileOpen,
      'replacing a stale overlay should not stack a second set of storage listeners');
    page.toggle();
    await settle();
    assert.strictEqual(page.hostCount(), 0, 'the replacement overlay should close');
    assertReleased(page, baseline, 'closing after a stale replacement');
  } finally {
    page.window.close();
  }
}

async function testEscapeCloseReleasesListeners() {
  const page = await createOverlayPage();
  try {
    const baseline = page.ledger.snapshot();
    await openAndSettle(page);
    page.toggle();
    await settle();
    await openAndSettle(page);
    page.toggle();
    await settle();
    assertReleased(page, baseline, 'repeated open/close cycles');
  } finally {
    page.window.close();
  }
}

async function testMountGuardRestoresHostUntilClose() {
  const page = await createOverlayPage();
  try {
    const host = await openAndSettle(page);
    // A host page that rewrites its DOM must not silently drop the open
    // overlay; only an intentional close may detach it.
    host.remove();
    await waitFor(() => host.isConnected, 'the open overlay host should be restored', page.errors);
    page.toggle();
    await settle(60);
    assert.strictEqual(host.isConnected, false, 'a closed overlay must stay detached');
    assert.strictEqual(page.hostCount(), 0);
  } finally {
    page.window.close();
  }
}

(async () => {
  await testToggleCloseFromNewInvocation();
  await testMountGuardRestoresHostUntilClose();
  await testToggleCloseAfterReinjection();
  await testStaleReplacementThenClose();
  await testEscapeCloseReleasesListeners();
  console.log('overlay session teardown tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
