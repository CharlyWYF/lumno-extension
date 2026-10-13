const assert = require('assert');
const {
  CONTEXT_TOKEN_KEY,
  createOverlayPage,
  openAndSettle,
  settle,
  waitFor
} = require('./helpers/overlay-runtime-harness');

// Runs the unmodified overlay injection bundle in JSDOM and checks that every
// way of closing an overlay - including a later invocation of the toggle
// helper and the stale-overlay replacement path - releases the page-level
// listeners the overlay registered.

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
