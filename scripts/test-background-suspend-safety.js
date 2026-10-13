const assert = require('assert');
const { loadBackground, wait } = require('./helpers/background-harness');

// An MV3 service worker is torn down when idle and re-run from the top on the
// next event. That event's listener runs before any chrome.storage read issued
// at startup has answered, so state the worker mirrors from storage still holds
// its defaults. These tests wake the real background with storage held back and
// fire the waking event first.

const TAB_SWITCHER_ENABLED_KEY = '_x_extension_tab_switcher_enabled_2026_unique_';
const PINNED_RECOVERY_ENABLED_KEY = '_x_extension_pinned_tab_recovery_enabled_2026_unique_';
const PINNED_SNAPSHOT_KEY = '_x_extension_pinned_tab_snapshot_2026_unique_';
const TAB_SWITCH_STATS_KEY = '_x_extension_tab_switch_stats_2026_unique_';
const RESTRICTED_ACTION_KEY = '_x_extension_restricted_action_2024_unique_';

const tabs = [
  { id: 11, windowId: 1, index: 0, active: true, pinned: true, url: 'https://mail.example.com/', title: 'Mail' },
  { id: 12, windowId: 1, index: 1, active: false, pinned: false, url: 'https://news.example.com/', title: 'News' }
];

async function testDisabledTabSwitcherStaysDisabledOnColdCommand() {
  const harness = loadBackground({
    tabs,
    sync: { [TAB_SWITCHER_ENABLED_KEY]: false },
    storageOptions: { sync: { hold: true } }
  });
  harness.chrome.commands.onCommand.dispatch('show-tab-switcher');
  await wait(20);
  harness.storage.sync.release();
  await wait(50);
  const switcherWork = harness.calls.filter((call) => call.name === 'scripting.executeScript');
  assert.deepStrictEqual(
    switcherWork,
    [],
    'a switcher command that wakes the worker must not open the switcher the user turned off'
  );
}

async function testEnabledTabSwitcherStillOpensOnColdCommand() {
  const harness = loadBackground({
    tabs,
    sync: { [TAB_SWITCHER_ENABLED_KEY]: true },
    storageOptions: { sync: { hold: true } }
  });
  harness.chrome.commands.onCommand.dispatch('show-tab-switcher');
  await wait(20);
  harness.storage.sync.release();
  await wait(80);
  assert.ok(
    harness.calls.some((call) => call.name === 'scripting.executeScript' ||
      (call.name === 'tabs.sendMessage' && call.args[0] === 11)),
    'the deferred command should still reach the active tab once settings are known'
  );
}

async function testPinChangeThatWakesWorkerIsSnapshotted() {
  const harness = loadBackground({
    tabs,
    sync: { [PINNED_RECOVERY_ENABLED_KEY]: true },
    storageOptions: { sync: { hold: true } }
  });
  harness.chrome.tabs.onUpdated.dispatch(11, { pinned: true }, tabs[0]);
  await wait(20);
  harness.storage.sync.release();
  await wait(900);
  const snapshot = harness.storage.local.data[PINNED_SNAPSHOT_KEY];
  assert.ok(snapshot, 'the pin change that woke the worker should still be written to the snapshot');
  assert.deepStrictEqual(snapshot.urls, ['https://mail.example.com/']);
}

async function testPinnedSnapshotStaysOffWhenRecoveryIsOff() {
  const harness = loadBackground({
    tabs,
    sync: { [PINNED_RECOVERY_ENABLED_KEY]: false },
    storageOptions: { sync: { hold: true } }
  });
  harness.chrome.tabs.onUpdated.dispatch(11, { pinned: true }, tabs[0]);
  harness.storage.sync.release();
  await wait(900);
  assert.strictEqual(harness.storage.local.data[PINNED_SNAPSHOT_KEY], undefined);
}

async function testPendingPinnedSnapshotIsFlushedOnSuspend() {
  const harness = loadBackground({
    tabs,
    sync: { [PINNED_RECOVERY_ENABLED_KEY]: true }
  });
  await wait(30);
  harness.chrome.tabs.onMoved.dispatch(11, {});
  harness.chrome.runtime.onSuspend.dispatch();
  await wait(50);
  assert.ok(
    harness.storage.local.data[PINNED_SNAPSHOT_KEY],
    'a debounced snapshot pending when the background is unloaded should be written immediately'
  );
}

async function testTabActivationOnWakeKeepsEarlierSwitchStats() {
  const earlier = Date.now() - 60 * 1000;
  const harness = loadBackground({
    tabs,
    session: {
      [TAB_SWITCH_STATS_KEY]: {
        7: { events: [earlier], lastSwitchAt: earlier }
      }
    },
    storageOptions: { session: { hold: true } }
  });
  harness.chrome.tabs.onActivated.dispatch({ tabId: 12, windowId: 1 });
  await wait(20);
  harness.storage.session.release();
  await wait(50);
  const stored = harness.storage.session.data[TAB_SWITCH_STATS_KEY] || {};
  assert.deepStrictEqual(
    Object.keys(stored).sort(),
    ['12', '7'],
    'recording the waking activation must not overwrite the stats saved before the worker slept'
  );
}

async function testRestrictedPageShortcutUsesStoredActionOnColdWake() {
  const restrictedTabs = [
    { id: 21, windowId: 1, index: 0, active: true, url: 'chrome://settings/', title: 'Settings' }
  ];
  const run = async (storedAction) => {
    const harness = loadBackground({
      tabs: restrictedTabs,
      sync: { [RESTRICTED_ACTION_KEY]: storedAction },
      storageOptions: { sync: { hold: true } }
    });
    harness.chrome.commands.onCommand.dispatch('show-search');
    await wait(20);
    harness.storage.sync.release();
    await wait(50);
    return harness.calls.filter((call) => call.name === 'tabs.create').map((call) => call.args[0]);
  };
  const browserChoice = await run('none');
  assert.strictEqual(browserChoice.length, 1, 'the shortcut on a restricted page should open one new tab');
  assert.strictEqual(
    browserChoice[0].url,
    undefined,
    'with the browser-setting action the new tab should be the browser-selected newtab provider'
  );
  const lumnoChoice = await run('default');
  assert.strictEqual(lumnoChoice.length, 1);
  assert.match(String(lumnoChoice[0].url || ''), /newtab\.html/, 'the default action opens Lumno\'s newtab');
}

(async () => {
  await testDisabledTabSwitcherStaysDisabledOnColdCommand();
  await testEnabledTabSwitcherStillOpensOnColdCommand();
  await testPinChangeThatWakesWorkerIsSnapshotted();
  await testPinnedSnapshotStaysOffWhenRecoveryIsOff();
  await testPendingPinnedSnapshotIsFlushedOnSuspend();
  await testTabActivationOnWakeKeepsEarlierSwitchStats();
  await testRestrictedPageShortcutUsesStoredActionOnColdWake();
  console.log('background suspend-safety tests passed');
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
