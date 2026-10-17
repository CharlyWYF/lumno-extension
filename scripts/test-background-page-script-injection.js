const assert = require('assert');
const { loadBackground, wait } = require('./helpers/background-harness');

// What the background injects into ordinary web pages, and when: the copy-URL
// listener only on the first copy command in a tab, and the shortcut observer
// into already-open tabs only after an install, reload or update, a few tabs
// at a time.

const COPY_URL_FILES = [
  'src/shared/settings.js',
  'src/shared/page-color-scheme.js',
  'src/content/hotkey-listener.js'
];
const OBSERVER_FILES = ['src/shared/shortcut-key-matcher.js', 'src/content/shortcut-key-observer.js'];

function executeScriptCalls(harness, files) {
  return harness.calls
    .filter((call) => call.name === 'scripting.executeScript')
    .map((call) => call.args[0])
    .filter((options) => JSON.stringify(options.files) === JSON.stringify(files));
}

async function testCopyUrlInjectsItsListenerOnFirstUse() {
  const harness = loadBackground({ tabs: [] });
  const tab = { id: 7, windowId: 1, url: 'https://example.com/' };
  let listenerInstalled = false;
  harness.chrome.tabs.sendMessage = (tabId, message, callback) => {
    harness.calls.push({ name: 'tabs.sendMessage', args: [tabId, message] });
    setTimeout(() => {
      if (!listenerInstalled) {
        harness.chrome.runtime.lastError = { message: 'Could not establish connection. Receiving end does not exist.' };
        callback(undefined);
        harness.chrome.runtime.lastError = null;
        return;
      }
      callback({ ok: true });
    }, 0);
  };
  const nativeExecuteScript = harness.chrome.scripting.executeScript;
  harness.chrome.scripting.executeScript = (options, callback) => {
    if (JSON.stringify(options.files) === JSON.stringify(COPY_URL_FILES)) {
      listenerInstalled = true;
    }
    return nativeExecuteScript(options, callback);
  };

  const first = await harness.sendMessage({ action: 'copyCurrentPageUrl' }, { tab, url: tab.url });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(first)), { ok: true },
    'a tab without the listener should get it and then copy');
  const injections = executeScriptCalls(harness, COPY_URL_FILES);
  assert.strictEqual(injections.length, 1, 'the listener should be injected once');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(injections[0].target)), { tabId: 7 },
    'the copy listener belongs to the top frame only');

  const second = await harness.sendMessage({ action: 'copyCurrentPageUrl' }, { tab, url: tab.url });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(second)), { ok: true });
  assert.strictEqual(executeScriptCalls(harness, COPY_URL_FILES).length, 1,
    'a later copy in the same tab should reuse the injected listener');
}

async function testCopyUrlReportsAPageScriptsCannotReach() {
  const harness = loadBackground({ tabs: [] });
  const tab = { id: 8, windowId: 1, url: 'chrome://settings/' };
  harness.chrome.tabs.sendMessage = (_tabId, _message, callback) => {
    setTimeout(() => {
      harness.chrome.runtime.lastError = { message: 'Receiving end does not exist.' };
      callback(undefined);
      harness.chrome.runtime.lastError = null;
    }, 0);
  };
  harness.chrome.scripting.executeScript = (_options, callback) => {
    setTimeout(() => {
      harness.chrome.runtime.lastError = { message: 'Cannot access a chrome:// URL' };
      callback(undefined);
      harness.chrome.runtime.lastError = null;
    }, 0);
  };
  const response = await harness.sendMessage({ action: 'copyCurrentPageUrl' }, { tab, url: 'https://example.com/' });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(response)), { ok: false });
}

async function testInstallSweepsOnlyReachableLoadedTabsActiveFirst() {
  const tabs = [
    { id: 1, windowId: 1, active: false, status: 'complete', url: 'https://a.example/' },
    { id: 2, windowId: 1, active: false, status: 'complete', url: 'https://b.example/', discarded: true },
    { id: 3, windowId: 1, active: false, status: 'unloaded', url: 'https://c.example/' },
    { id: 4, windowId: 1, active: false, status: 'complete', url: 'chrome://extensions/' },
    { id: 5, windowId: 1, active: true, status: 'complete', url: 'https://d.example/' },
    { id: 6, windowId: 2, active: false, status: 'loading', url: 'https://e.example/' },
    { id: 7, windowId: 2, active: false, status: 'complete', url: 'https://f.example/' },
    { id: 8, windowId: 2, active: false, status: 'complete', url: 'https://g.example/' },
    { id: 9, windowId: 2, active: true, status: 'complete', url: 'file:///Users/me/notes.html' }
  ];
  const harness = loadBackground({ tabs, version: '1.0.0' });
  await wait(20);
  let inFlight = 0;
  let maxInFlight = 0;
  const injectedTabIds = [];
  harness.chrome.scripting.executeScript = (options, callback) => {
    if (JSON.stringify(options.files) === JSON.stringify(OBSERVER_FILES)) {
      injectedTabIds.push(options.target.tabId);
      assert.strictEqual(options.target.allFrames, true, 'the observer is swept into every frame of a tab');
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      setTimeout(() => {
        inFlight -= 1;
        callback([]);
      }, 5);
      return undefined;
    }
    setTimeout(() => callback([]), 0);
    return undefined;
  };

  harness.chrome.runtime.onInstalled.dispatch({ reason: 'update', previousVersion: '1.0.0' });
  await wait(120);
  assert.deepStrictEqual(injectedTabIds.slice(0, 2).sort(), [5, 9],
    'the active tab of each window should be prepared first');
  assert.deepStrictEqual(injectedTabIds.slice().sort((a, b) => a - b), [1, 5, 6, 7, 8, 9],
    'discarded, unloaded and browser pages should be skipped');
  assert.ok(maxInFlight <= 3, `the sweep should inject a few tabs at a time, saw ${maxInFlight}`);

  injectedTabIds.length = 0;
  harness.chrome.runtime.onStartup.dispatch();
  await wait(60);
  assert.deepStrictEqual(injectedTabIds, [],
    'restored tabs load with the manifest observer, so browser startup should not sweep them');
}

(async () => {
  await testCopyUrlInjectsItsListenerOnFirstUse();
  await testCopyUrlReportsAPageScriptsCannotReach();
  await testInstallSweepsOnlyReachableLoadedTabsActiveFirst();
  console.log('background page script injection tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
