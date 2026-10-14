const assert = require('assert');
const { loadBackground, wait } = require('./helpers/background-harness');

// Boots the real background and drives the browser events that trigger tab
// switcher thumbnails, counting chrome.tabs.captureVisibleTab calls.

const TAB_SWITCHER_ENABLED_KEY = '_x_extension_tab_switcher_enabled_2026_unique_';
const TAB_SWITCHER_STATE_KEY = '_x_extension_tab_switcher_state_2026_unique_';
const SETTLE_WAIT_MS = 1100;
const JPEG = 'data:image/jpeg;base64,AAAA';

function createTabs() {
  return [
    { id: 11, windowId: 1, index: 0, active: true, url: 'https://mail.example.com/', title: 'Mail', status: 'complete' },
    { id: 12, windowId: 1, index: 1, active: false, url: 'https://news.example.com/', title: 'News', status: 'complete' },
    { id: 13, windowId: 1, index: 2, active: false, url: 'https://docs.example.com/', title: 'Docs', status: 'complete' }
  ];
}

function bootBackground(options) {
  const config = options || {};
  const tabs = createTabs();
  const windowState = { focused: config.windowFocused !== false };
  const captures = [];
  const harness = loadBackground({
    tabs,
    sync: { [TAB_SWITCHER_ENABLED_KEY]: config.enabled !== false },
    configureChrome(chromeApi) {
      chromeApi.tabs.captureVisibleTab = (windowId, _options, callback) => {
        const activeTab = tabs.find((tab) => tab.windowId === windowId && tab.active);
        captures.push(activeTab ? activeTab.id : null);
        setTimeout(() => callback(JPEG), 0);
      };
      chromeApi.windows.get = (windowId, callback) => {
        setTimeout(() => callback({ id: windowId, focused: windowState.focused }), 0);
      };
    }
  });
  const activate = (tabId) => {
    tabs.forEach((tab) => {
      tab.active = tab.id === tabId;
    });
    harness.chrome.tabs.onActivated.dispatch({ tabId, windowId: 1 });
  };
  const tab = (tabId) => tabs.find((item) => item.id === tabId);
  return { harness, tabs, tab, captures, activate, windowState };
}

function storedThumbnailTabIds(harness) {
  const state = harness.storage.session.data[TAB_SWITCHER_STATE_KEY];
  return (state && Array.isArray(state.thumbnails) ? state.thumbnails : [])
    .filter((entry) => entry && entry.dataUrl)
    .map((entry) => entry.tabId)
    .sort();
}

async function testRapidActivationsCaptureOnlyWhereTheUserStops() {
  const session = bootBackground();
  await wait(30);
  // Ctrl+Tab held down: a new tab every 300ms, then the user stops on 12.
  for (const tabId of [13, 11, 13, 12]) {
    session.activate(tabId);
    await wait(300);
  }
  await wait(SETTLE_WAIT_MS);
  assert.deepStrictEqual(
    session.captures,
    [12],
    'cycling through tabs should capture once, the tab that stayed active'
  );
}

async function testFreshThumbnailIsNotRecapturedButLoadCompleteIs() {
  const session = bootBackground();
  await wait(30);
  session.activate(12);
  await wait(SETTLE_WAIT_MS);
  session.activate(13);
  await wait(SETTLE_WAIT_MS);
  session.activate(12);
  await wait(SETTLE_WAIT_MS);
  session.harness.chrome.windows.onFocusChanged.dispatch(1);
  await wait(SETTLE_WAIT_MS);
  assert.deepStrictEqual(
    session.captures,
    [12, 13],
    'returning to a tab or window whose thumbnail is under a minute old should not capture again'
  );
  session.harness.chrome.tabs.onUpdated.dispatch(12, { status: 'complete' }, session.tab(12));
  await wait(SETTLE_WAIT_MS);
  assert.deepStrictEqual(
    session.captures,
    [12, 13, 12],
    'a finished page load changes what the tab shows, so it always captures'
  );
}

async function testUnfocusedWindowIsNotCaptured() {
  const session = bootBackground({ windowFocused: false });
  await wait(30);
  session.activate(12);
  await wait(SETTLE_WAIT_MS);
  assert.deepStrictEqual(session.captures, [], 'a tab whose window lost focus should not be captured');
}

async function testDisabledSwitcherNeverCaptures() {
  const session = bootBackground({ enabled: false });
  await wait(30);
  session.activate(12);
  session.harness.chrome.windows.onFocusChanged.dispatch(1);
  session.harness.chrome.tabs.onUpdated.dispatch(12, { status: 'complete' }, session.tab(12));
  await wait(SETTLE_WAIT_MS);
  assert.deepStrictEqual(session.captures, [], 'with the tab switcher off, no event should capture the screen');
}

async function testTurningTheSwitcherOffClearsStoredThumbnails() {
  const session = bootBackground();
  await wait(30);
  session.activate(12);
  await wait(SETTLE_WAIT_MS + 400);
  assert.deepStrictEqual(storedThumbnailTabIds(session.harness), [12]);
  session.harness.storage.sync.data[TAB_SWITCHER_ENABLED_KEY] = false;
  session.harness.chrome.storage.onChanged.dispatch({
    [TAB_SWITCHER_ENABLED_KEY]: { oldValue: true, newValue: false }
  }, 'sync');
  await wait(50);
  assert.deepStrictEqual(
    storedThumbnailTabIds(session.harness),
    [],
    'turning the switcher off should drop its screenshots from session storage'
  );
  session.activate(13);
  await wait(SETTLE_WAIT_MS);
  assert.deepStrictEqual(session.captures, [12], 'no capture should follow once the switcher is off');
}

async function testOpeningTheSwitcherTakesAFreshShotFirst() {
  const session = bootBackground();
  await wait(30);
  session.activate(11);
  await wait(SETTLE_WAIT_MS);
  assert.deepStrictEqual(session.captures, [11]);
  // Clear of Chrome's two-captures-per-second limit.
  await wait(700);
  session.harness.chrome.commands.onCommand.dispatch('show-tab-switcher', session.tab(11));
  await wait(300);
  assert.deepStrictEqual(
    session.captures,
    [11, 11],
    'opening the switcher should take a fresh shot of the current tab right away'
  );
}

(async () => {
  await testRapidActivationsCaptureOnlyWhereTheUserStops();
  await testFreshThumbnailIsNotRecapturedButLoadCompleteIs();
  await testUnfocusedWindowIsNotCaptured();
  await testDisabledSwitcherNeverCaptures();
  await testTurningTheSwitcherOffClearsStoredThumbnails();
  await testOpeningTheSwitcherTakesAFreshShotFirst();
  console.log('background switcher thumbnail capture tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
