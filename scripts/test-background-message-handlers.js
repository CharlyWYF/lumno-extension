const assert = require('assert');
const { loadBackground, wait } = require('./helpers/background-harness');

// Behavior of individual runtime message handlers, exercised through the real
// background router with a recording chrome stub.

const SITE_SEARCH_CUSTOM_KEY = '_x_extension_site_search_custom_2024_unique_';
const DOCUMENT_PIP_ENABLED_KEY = '_x_extension_document_pip_enabled_2026_unique_';
const senderTab = { id: 5, windowId: 1, index: 0, url: 'https://example.com/', title: 'Example' };
const plain = (value) => JSON.parse(JSON.stringify(value === undefined ? null : value));

function boot(options) {
  return loadBackground(Object.assign({
    tabs: [Object.assign({ active: true }, senderTab)],
    commands: [
      { name: 'show-search', shortcut: '⌘⇧K' },
      { name: 'show-tab-switcher', shortcut: 'Alt+Q' }
    ]
  }, options || {}));
}

async function testSiteSearchProviderLoadFailureStillAnswers() {
  const harness = boot({
    configureChrome(chromeApi) {
      const syncGet = chromeApi.storage.sync.get;
      chromeApi.storage.sync.get = (keys, callback) => {
        const keyList = Array.isArray(keys) ? keys : [keys];
        if (keyList.includes(SITE_SEARCH_CUSTOM_KEY)) {
          setTimeout(() => callback(undefined), 0);
          return;
        }
        syncGet(keys, callback);
      };
    }
  });
  const response = await harness.sendMessage({ action: 'getSiteSearchProviders' });
  assert.deepStrictEqual(
    plain(response),
    { items: [], reason: 'site-search-provider-load-failed' },
    'a failed provider load must answer the runtime message so callers can use their local fallback'
  );
}

async function testOpenNewTabUsesBrowserNewtab() {
  const harness = boot();
  const response = await harness.sendMessage(
    { action: 'openNewTab', disposition: 'backgroundTab' },
    { tab: senderTab }
  );
  assert.strictEqual(response && response.ok, true);
  const created = harness.calls.filter((call) => call.name === 'tabs.create').map((call) => plain(call.args[0]));
  assert.strictEqual(created.length, 1);
  assert.strictEqual(created[0].url, undefined, 'openNewTab should omit an extension URL so Chromium opens chrome://newtab');
  assert.strictEqual(created[0].active, false, 'openNewTab should keep the requested background disposition');
}

async function testOpenOptionsPageKeepsRequestedHash() {
  const harness = boot();
  const response = await harness.sendMessage({ action: 'openOptionsPage', hash: 'labs' }, { tab: senderTab });
  assert.strictEqual(response && response.ok, true);
  const created = harness.calls.filter((call) => call.name === 'tabs.create').map((call) => plain(call.args[0]));
  assert.strictEqual(created.length, 1);
  assert.match(String(created[0].url || ''), /options\.html#labs$/, 'the Labs entry should open the Labs settings route');
}

async function testLoadingSessionUpdatesAreAsyncAndAnswered() {
  const harness = boot();
  const listener = harness.chrome.runtime.onMessage.listeners[harness.chrome.runtime.onMessage.listeners.length - 1];
  let response;
  const result = listener(
    { action: 'updateOverlayLoadingSession', session: { inputValue: 'draft', revision: 1 } },
    { tab: senderTab, frameId: 0 },
    (value) => {
      response = value;
    }
  );
  assert.strictEqual(result, true, 'the loading-session update answers asynchronously');
  await wait(30);
  assert.ok(response && typeof response.ok === 'boolean', 'the loading-session update should be answered');
}

async function testTopFrameDocumentStartIsAnswered() {
  const harness = boot();
  const response = await harness.sendMessage(
    { action: 'notifyTopFrameDocumentStarted', documentUrl: senderTab.url, observedAt: Date.now() },
    { tab: senderTab, frameId: 0 }
  );
  assert.ok(response && typeof response.ok === 'boolean', 'every committed top-frame Document is reported back');
}

async function testColdStartPageHotkeyIsVerifiedAgainstLiveShortcut() {
  const harness = boot();
  const mismatch = await harness.sendMessage({
    action: 'triggerShowSearchFromPageHotkey',
    requiresShortcutVerification: true,
    observedShortcut: { ctrlKey: false, altKey: false, shiftKey: true, metaKey: true, key: 'j' }
  }, { tab: senderTab });
  assert.deepStrictEqual(
    { ok: mismatch.ok, reason: mismatch.reason },
    { ok: false, reason: 'shortcut-mismatch' },
    'a key that is not the live browser shortcut must not open Lumno'
  );
  const match = await harness.sendMessage({
    action: 'triggerShowSearchFromPageHotkey',
    requiresShortcutVerification: true,
    observedShortcut: { ctrlKey: false, altKey: false, shiftKey: true, metaKey: true, key: 'k' }
  }, { tab: senderTab });
  assert.strictEqual(match.ok, true, 'the live browser shortcut should open Lumno after verification');
  assert.strictEqual(typeof match.shortcut, 'string');
}

async function testWebClipCommandOpensPickerOnSenderTab() {
  const enabled = boot({ sync: { [DOCUMENT_PIP_ENABLED_KEY]: true } });
  const response = await enabled.sendMessage({ action: 'openDocumentPipPicker' }, { tab: senderTab });
  assert.deepStrictEqual(plain(response), { ok: true, enabled: true });
  await wait(50);
  assert.ok(
    enabled.calls.some((call) => call.name === 'scripting.executeScript' &&
      call.args[0] && call.args[0].target && call.args[0].target.tabId === senderTab.id),
    'web clip command messages should open the Document PiP picker on the sender tab'
  );

  const disabled = boot({ sync: { [DOCUMENT_PIP_ENABLED_KEY]: false } });
  const disabledResponse = await disabled.sendMessage({ action: 'openDocumentPipPicker' }, { tab: senderTab });
  assert.deepStrictEqual(plain(disabledResponse), { ok: false, enabled: false });
  await wait(50);
  assert.ok(!disabled.calls.some((call) => call.name === 'scripting.executeScript' &&
    call.args[0] && call.args[0].target && call.args[0].target.tabId === senderTab.id));

  const noTab = await enabled.sendMessage({ action: 'openDocumentPipPicker' }, {});
  assert.deepStrictEqual(plain(noTab), { ok: false, reason: 'no-sender-tab' });
}

async function testAggregateSearchIgnoresPageSuppliedTargets() {
  const harness = boot();
  await harness.sendMessage({
    action: 'runAggregateSearchQuery',
    aggregateId: 'missing-definition',
    query: 'hello',
    disposition: 'newTab',
    provider: { template: 'https://evil.test/?q={query}' },
    providers: [{ template: 'https://evil.test/?q={query}' }],
    urls: ['https://evil.test/']
  }, { tab: senderTab }, 300);
  const opened = harness.calls
    .filter((call) => call.name === 'tabs.create' || call.name === 'tabs.update')
    .map((call) => JSON.stringify(call.args));
  assert.ok(
    !opened.some((args) => args.includes('evil.test')),
    'the page must not be allowed to supply provider definitions or arbitrary target URLs'
  );
}

async function testLocaleMessagesAreCachedAndCanBeNarrowed() {
  const fetched = [];
  const harness = loadBackground({
    fetch: async (url) => {
      fetched.push(String(url));
      return {
        json: async () => ({
          copy_page_url_success: { message: 'Copied' },
          unrelated_key: { message: 'Other' }
        })
      };
    }
  });
  const narrowed = await harness.sendMessage({
    action: 'getLocaleMessages',
    locale: 'en',
    keys: ['copy_page_url_success', 'missing_key']
  });
  // Objects built inside the background's vm realm compare by value only.
  assert.deepStrictEqual(JSON.parse(JSON.stringify(narrowed)), {
    messages: { copy_page_url_success: { message: 'Copied' } }
  }, 'a caller naming its keys should receive only those messages');
  const full = await harness.sendMessage({ action: 'getLocaleMessages', locale: 'en' });
  assert.deepStrictEqual(Object.keys(full.messages).sort(), ['copy_page_url_success', 'unrelated_key']);
  assert.strictEqual(
    fetched.filter((url) => url.endsWith('_locales/en/messages.json')).length,
    1,
    'a locale file should be read once per worker lifetime'
  );
}

(async () => {
  await testLocaleMessagesAreCachedAndCanBeNarrowed();
  await testSiteSearchProviderLoadFailureStillAnswers();
  await testOpenNewTabUsesBrowserNewtab();
  await testOpenOptionsPageKeepsRequestedHash();
  await testLoadingSessionUpdatesAreAsyncAndAnswered();
  await testTopFrameDocumentStartIsAnswered();
  await testColdStartPageHotkeyIsVerifiedAgainstLiveShortcut();
  await testWebClipCommandOpensPickerOnSenderTab();
  await testAggregateSearchIgnoresPageSuppliedTargets();
  console.log('background message handler tests passed');
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
