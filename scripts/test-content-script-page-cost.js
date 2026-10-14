const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Loads the two manifest content scripts every ordinary page gets (the
// top-frame copy-URL listener and the all-frames shortcut observer) into a
// JSDOM page and counts what they send the background while the user works in
// the page.

const repoRoot = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const LANGUAGE_KEY = '_x_extension_language_2024_unique_';

function loadPage(options) {
  const config = options || {};
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    url: 'https://docs.example.test/page'
  });
  const { window } = dom;
  const sent = [];
  const runtimeListeners = [];
  const syncData = Object.assign({}, config.sync || {});
  const createArea = (data) => ({
    get(keys, callback) {
      const result = {};
      (Array.isArray(keys) ? keys : [keys]).forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          result[key] = data[key];
        }
      });
      setTimeout(() => callback(result), 0);
    }
  });
  let now = 1000000;
  window.Date.now = () => now;
  window.chrome = {
    runtime: {
      lastError: null,
      getURL: (relativePath) => `chrome-extension://lumno/${relativePath}`,
      sendMessage(message, callback) {
        sent.push(message);
        const response = message && message.action === 'getShowSearchShortcut'
          ? { shortcut: config.shortcut || 'Command+Shift+K' }
          : (message && message.action === 'getLocaleMessages'
            ? { messages: { copy_page_url_success: { message: 'URLをコピーしました' } } }
            : undefined);
        if (typeof callback === 'function') {
          setTimeout(() => callback(response), 0);
        }
      },
      onMessage: {
        addListener(listener) {
          runtimeListeners.push(listener);
        },
        removeListener() {}
      }
    },
    storage: {
      sync: createArea(syncData),
      local: createArea({}),
      onChanged: { addListener() {} }
    },
    i18n: {
      getMessage: () => '',
      getUILanguage: () => 'en'
    }
  };
  Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    value: { writeText: () => Promise.resolve() }
  });
  window.eval(read('src/shared/settings.js'));
  window.eval(read('src/content/hotkey-listener.js'));
  window.eval(read('src/shared/shortcut-key-matcher.js'));
  window.eval(read('src/content/shortcut-key-observer.js'));
  const focusElements = (count) => {
    for (let index = 0; index < count; index += 1) {
      const input = window.document.createElement('input');
      window.document.body.appendChild(input);
      input.focus();
    }
  };
  const sendCopyCommand = () => new Promise((resolve) => {
    runtimeListeners.forEach((listener) => {
      listener({ action: 'copyCurrentPageUrlFromCommand' }, {}, resolve);
    });
  });
  return {
    window,
    sent,
    focusElements,
    sendCopyCommand,
    advanceClock(ms) {
      now += ms;
    },
    actions() {
      return sent.map((message) => message && message.action);
    }
  };
}

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 10));
}

async function testElementFocusSendsNothing() {
  const page = loadPage();
  await settle();
  assert.deepStrictEqual(
    page.actions(),
    ['notifyTopFrameDocumentStarted', 'getShowSearchShortcut'],
    'a page load should ask for the search shortcut once and fetch no locale messages'
  );
  page.sent.length = 0;
  page.advanceClock(5000);
  page.focusElements(10);
  await settle();
  assert.deepStrictEqual(page.actions(), [], 'focusing elements inside the page should not message the background');
}

async function testWindowFocusRefreshesTheShortcutAtMostEveryTwoSeconds() {
  const page = loadPage();
  await settle();
  page.sent.length = 0;
  page.window.dispatchEvent(new page.window.FocusEvent('focus'));
  assert.deepStrictEqual(page.actions(), [], 'a focus right after load should fold into the startup request');
  page.advanceClock(2500);
  page.window.dispatchEvent(new page.window.FocusEvent('focus'));
  page.window.document.dispatchEvent(new page.window.Event('visibilitychange'));
  await settle();
  assert.deepStrictEqual(
    page.actions(),
    ['getShowSearchShortcut'],
    'the focus and visibilitychange of one tab switch should ask once, and never report tab visibility'
  );
}

async function testBackForwardCacheRestoreRefreshesTheShortcut() {
  const page = loadPage();
  await settle();
  page.sent.length = 0;
  page.advanceClock(5000);
  page.window.dispatchEvent(new page.window.PageTransitionEvent('pageshow', { persisted: false }));
  assert.deepStrictEqual(page.actions(), [], 'a first page show is covered by the startup request');
  page.window.dispatchEvent(new page.window.PageTransitionEvent('pageshow', { persisted: true }));
  await settle();
  assert.deepStrictEqual(
    page.actions(),
    ['getShowSearchShortcut'],
    'a page restored from the back/forward cache should pick up a shortcut changed meanwhile'
  );
}

async function testCopyToastUsesBrowserLanguageWithoutMessaging() {
  const page = loadPage();
  await settle();
  page.sent.length = 0;
  const response = await page.sendCopyCommand();
  assert.deepStrictEqual(JSON.parse(JSON.stringify(response)), { ok: true });
  assert.deepStrictEqual(page.actions(), [], 'with the browser language, chrome.i18n serves the toast strings');
  const document = page.window.document;
  assert.strictEqual(
    document.querySelector('link[href*="remixicon"]'),
    null,
    'the toast should not link remixicon.css into the host page'
  );
  const pageRules = Array.from(document.querySelectorAll('style'))
    .map((style) => style.textContent)
    .join('\n');
  assert.doesNotMatch(pageRules, /\[class/, 'no class rule should reach the host page');
  assert.match(pageRules, /font-family: "lumno-remixicon"/, 'only the scoped icon face is declared on the page');
  const host = document.getElementById('_x_extension_page_toast_2026_unique_');
  assert.ok(host, 'the toast should be mounted');
  assert.strictEqual(host.children.length, 0, 'the toast content should live in its shadow root');
}

async function testCopyToastFetchesOnlyItsStringsForAChosenLanguage() {
  const page = loadPage({ sync: { [LANGUAGE_KEY]: 'ja' } });
  await settle();
  page.sent.length = 0;
  await page.sendCopyCommand();
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(page.sent)),
    [{
      action: 'getLocaleMessages',
      locale: 'ja',
      keys: ['copy_page_url_failed_retry', 'copy_page_url_success', 'copy_page_url_failed_permission']
    }],
    'a chosen UI language should fetch just the toast strings, when the toast is shown'
  );
  await page.sendCopyCommand();
  assert.strictEqual(page.sent.length, 1, 'the toast strings should be fetched once per page');
}

(async () => {
  await testElementFocusSendsNothing();
  await testWindowFocusRefreshesTheShortcutAtMostEveryTwoSeconds();
  await testBackForwardCacheRestoreRefreshesTheShortcut();
  await testCopyToastUsesBrowserLanguageWithoutMessaging();
  await testCopyToastFetchesOnlyItsStringsForAChosenLanguage();
  console.log('content script page cost tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
