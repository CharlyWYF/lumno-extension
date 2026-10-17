const assert = require('assert');
const { loadBackground, wait } = require('./helpers/background-harness');

// Boots the real background and drives the browser events that trigger tab
// switcher thumbnails, counting chrome.tabs.captureVisibleTab calls.

const TAB_SWITCHER_ENABLED_KEY = '_x_extension_tab_switcher_enabled_2026_unique_';
const TAB_SWITCHER_STATE_KEY = '_x_extension_tab_switcher_state_2026_unique_';
const TAB_SWITCHER_THUMBNAIL_KEY_PREFIX = '_x_extension_tab_switcher_thumbnail_2026_unique_:';
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
    session: config.session,
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

// The state record lists the tabs with thumbnails; each thumbnail has its own key.
function storedThumbnailTabIds(harness) {
  const data = harness.storage.session.data;
  const state = data[TAB_SWITCHER_STATE_KEY];
  return (state && Array.isArray(state.thumbnailTabIds) ? state.thumbnailTabIds : [])
    .map((tabId) => data[`${TAB_SWITCHER_THUMBNAIL_KEY_PREFIX}${tabId}`])
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

function writtenSessionKeys(harness, fromIndex) {
  return harness.storage.session.writes.slice(fromIndex || 0)
    .reduce((keys, write) => keys.concat(Object.keys(write)), []);
}

async function testTabSwitchesWriteOnlyTheThumbnailsThatChanged() {
  const session = bootBackground();
  await wait(30);
  session.activate(12);
  await wait(SETTLE_WAIT_MS + 400);
  assert.deepStrictEqual(storedThumbnailTabIds(session.harness), [12]);
  const writesBefore = session.harness.storage.session.writes.length;
  session.activate(11);
  await wait(SETTLE_WAIT_MS + 400);
  assert.deepStrictEqual(storedThumbnailTabIds(session.harness), [11, 12]);
  const written = writtenSessionKeys(session.harness, writesBefore);
  assert.ok(written.includes(`${TAB_SWITCHER_THUMBNAIL_KEY_PREFIX}11`), 'the new thumbnail should be saved');
  assert.ok(!written.includes(`${TAB_SWITCHER_THUMBNAIL_KEY_PREFIX}12`),
    'a tab switch should not rewrite a thumbnail that did not change');

  // A restarted worker reads the split state back and keeps writing only changes.
  const restarted = bootBackground({ session: JSON.parse(JSON.stringify(session.harness.storage.session.data)) });
  await wait(30);
  restarted.harness.chrome.tabs.onActivated.dispatch({ tabId: 13, windowId: 1 });
  await wait(600);
  assert.deepStrictEqual(storedThumbnailTabIds(restarted.harness), [11, 12],
    'a restarted worker should keep the saved thumbnails');
  assert.ok(
    writtenSessionKeys(restarted.harness).every((key) => !key.startsWith(TAB_SWITCHER_THUMBNAIL_KEY_PREFIX)),
    'a restarted worker should not rewrite thumbnails it read back unchanged'
  );
}

async function testInlineThumbnailStateFromAnEarlierVersionIsRead() {
  const now = Date.now();
  const session = bootBackground({
    session: {
      [TAB_SWITCHER_STATE_KEY]: {
        version: 1,
        savedAt: now,
        stack: [{ id: 12, windowId: 1, url: 'https://news.example.com/', title: 'News', visitedAt: now }],
        thumbnails: [{ tabId: 12, url: 'https://news.example.com/', dataUrl: JPEG, capturedAt: now, updatedAt: now, status: 'ok' }]
      }
    }
  });
  await wait(30);
  session.harness.chrome.tabs.onActivated.dispatch({ tabId: 13, windowId: 1 });
  await wait(600);
  assert.deepStrictEqual(storedThumbnailTabIds(session.harness), [12],
    'a state saved with inline thumbnails should move to the split layout');
  assert.ok(!Array.isArray(session.harness.storage.session.data[TAB_SWITCHER_STATE_KEY].thumbnails),
    'the state record should no longer carry the images');
}

(async () => {
  await testRapidActivationsCaptureOnlyWhereTheUserStops();
  await testTabSwitchesWriteOnlyTheThumbnailsThatChanged();
  await testInlineThumbnailStateFromAnEarlierVersionIsRead();
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
