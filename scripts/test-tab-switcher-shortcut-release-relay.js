const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const repoRoot = path.join(__dirname, '..');
const source = fs.readFileSync(
  path.join(repoRoot, 'src', 'content', 'shortcut-key-observer.js'),
  'utf8'
);
const matcherSource = fs.readFileSync(
  path.join(repoRoot, 'src', 'shared', 'shortcut-key-matcher.js'),
  'utf8'
);
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  runScripts: 'outside-only',
  url: 'https://editor.example.test/frame'
});
const { window } = dom;
const runtimeMessages = [];
const shortcutResponseCallbacks = [];
let keydownHandler = null;
let keyupHandler = null;
let runtimeMessageListener = null;
const keydownHandlers = new Set();
const keyupHandlers = new Set();
const runtimeMessageListeners = new Set();
const nativeAddEventListener = window.addEventListener.bind(window);
const nativeRemoveEventListener = window.removeEventListener.bind(window);

window.addEventListener = (type, listener, options) => {
  if (type === 'keydown') {
    keydownHandler = listener;
    keydownHandlers.add(listener);
  }
  if (type === 'keyup') {
    keyupHandler = listener;
    keyupHandlers.add(listener);
  }
  return nativeAddEventListener(type, listener, options);
};
window.removeEventListener = (type, listener, options) => {
  if (type === 'keydown') {
    keydownHandlers.delete(listener);
  }
  if (type === 'keyup') {
    keyupHandlers.delete(listener);
  }
  return nativeRemoveEventListener(type, listener, options);
};
window.chrome = {
  runtime: {
    lastError: null,
    onMessage: {
      addListener(listener) {
        runtimeMessageListener = listener;
        runtimeMessageListeners.add(listener);
      },
      removeListener(listener) {
        runtimeMessageListeners.delete(listener);
      }
    },
    sendMessage(message, callback) {
      if (message && message.action === 'getShowSearchShortcut') {
        shortcutResponseCallbacks.push(callback);
        return;
      }
      runtimeMessages.push(message);
      callback?.();
    }
  }
};

window.eval(matcherSource);
window.eval(source);
assert.strictEqual(typeof keydownHandler, 'function', 'the frame should observe the configured search shortcut');
assert.strictEqual(typeof keyupHandler, 'function', 'the frame should observe configured shortcut-key releases');
assert.strictEqual(typeof runtimeMessageListener, 'function', 'the frame should wait for the switcher command to arm it');
window.eval(source);
assert.strictEqual(
  keydownHandlers.size,
  1,
  'reinjection after an extension reload should replace the stale keydown listener'
);
assert.strictEqual(
  keyupHandlers.size,
  1,
  'reinjection after an extension reload should replace the stale keyup listener'
);
assert.strictEqual(
  runtimeMessageListeners.size,
  1,
  'reinjection after an extension reload should replace the stale runtime listener'
);
const documentStartMessages = runtimeMessages.filter((message) =>
  message && message.action === 'notifyTopFrameDocumentStarted'
);
assert.strictEqual(
  documentStartMessages.length,
  1,
  'the committed top-frame Document should be announced once; a reinjected observer runs in a started page'
);
assert.strictEqual(
  shortcutResponseCallbacks.length,
  2,
  'a replacement made before the shortcut arrived should ask for it again, since the answer reaches the old observer'
);
documentStartMessages.forEach((message) => {
  assert.deepStrictEqual(
    {
      action: message.action,
      documentReadyState: message.documentReadyState,
      documentUrl: message.documentUrl
    },
    {
      action: 'notifyTopFrameDocumentStarted',
      documentReadyState: 'loading',
      documentUrl: 'https://editor.example.test/frame'
    },
    'Document-start recovery should use the real top-frame URL without a site allowlist'
  );
});
runtimeMessages.length = 0;

let prevented = false;
let stopped = false;
const editableTarget = window.document.createElement('input');
keydownHandler({
  altKey: false,
  code: 'KeyK',
  ctrlKey: false,
  isComposing: false,
  isTrusted: false,
  key: 'k',
  metaKey: true,
  preventDefault() {
    prevented = true;
  },
  repeat: false,
  shiftKey: true,
  stopPropagation() {
    stopped = true;
  },
  target: editableTarget
});
assert.deepStrictEqual(runtimeMessages, [], 'synthetic keydowns must not cross the runtime boundary');
keydownHandler({
  altKey: false,
  code: 'KeyK',
  ctrlKey: false,
  isComposing: false,
  isTrusted: true,
  key: 'k',
  metaKey: true,
  preventDefault() {
    prevented = true;
  },
  repeat: false,
  shiftKey: true,
  stopPropagation() {
    stopped = true;
  },
  target: editableTarget
});
assert.strictEqual(prevented, false, 'an unresolved custom shortcut must not suppress an unrelated page action');
assert.strictEqual(stopped, false, 'cold-start verification should not guess the configured shortcut in the page');
assert.strictEqual(runtimeMessages.length, 1, 'the first trusted shortcut should cross the cold-start race');
assert.deepStrictEqual(
  {
    action: runtimeMessages[0].action,
    documentIsTop: runtimeMessages[0].documentIsTop,
    documentUrl: runtimeMessages[0].documentUrl,
    observedShortcut: { ...runtimeMessages[0].observedShortcut },
    requiresShortcutVerification: runtimeMessages[0].requiresShortcutVerification,
    trustedShortcutFallback: runtimeMessages[0].trustedShortcutFallback
  },
  {
    action: 'triggerShowSearchFromPageHotkey',
    documentIsTop: true,
    documentUrl: 'https://editor.example.test/frame',
    observedShortcut: {
      ctrlKey: false,
      altKey: false,
      shiftKey: true,
      metaKey: true,
      key: 'k'
    },
    requiresShortcutVerification: true,
    trustedShortcutFallback: true
  },
  'the observer should ask the background to verify a first trusted keydown while configuration is pending'
);
runtimeMessages.length = 0;
shortcutResponseCallbacks.forEach((callback) => callback?.({ shortcut: 'Command+Shift+K' }));
prevented = false;
stopped = false;

keydownHandler({
  altKey: false,
  code: 'KeyK',
  ctrlKey: false,
  isComposing: false,
  isTrusted: true,
  key: 'k',
  metaKey: true,
  preventDefault() {
    prevented = true;
  },
  repeat: false,
  shiftKey: true,
  stopPropagation() {
    stopped = true;
  },
  target: editableTarget
});
assert.strictEqual(prevented, true, 'a locally matched browser shortcut should suppress the page action');
assert.strictEqual(stopped, true, 'a locally matched browser shortcut should stop page propagation');
assert.strictEqual(runtimeMessages.length, 1, 'an editable field must not suppress the trusted fallback');
assert.deepStrictEqual(
  {
    action: runtimeMessages[0].action,
    documentIsTop: runtimeMessages[0].documentIsTop,
    documentUrl: runtimeMessages[0].documentUrl,
    requiresShortcutVerification: runtimeMessages[0].requiresShortcutVerification,
    trustedShortcutFallback: runtimeMessages[0].trustedShortcutFallback
  },
  {
    action: 'triggerShowSearchFromPageHotkey',
    documentIsTop: true,
    documentUrl: 'https://editor.example.test/frame',
    requiresShortcutVerification: undefined,
    trustedShortcutFallback: true
  },
  'the observer should use the low-latency path after the configured shortcut arrives'
);
runtimeMessages.length = 0;

keyupHandler({ isTrusted: false, key: 'Meta', code: 'MetaLeft' });
keyupHandler({ isTrusted: true, key: '1', code: 'Digit1' });
assert.deepStrictEqual(
  runtimeMessages,
  [],
  'synthetic and unarmed releases must not cross the privileged runtime boundary'
);

let armResponse = null;
runtimeMessageListener({ action: 'armTabSwitcherShortcutRelease', keys: ['Meta'] }, {}, (response) => {
  armResponse = response;
});
assert.deepStrictEqual({ ...armResponse }, { ok: true });
keyupHandler({ isTrusted: true, key: '1', code: 'Digit1' });
assert.deepStrictEqual(
  runtimeMessages,
  [],
  'releasing the trigger key must neither commit nor disarm a held Command shortcut'
);
keyupHandler({ isTrusted: true, key: 'Meta', code: 'MetaLeft' });
assert.deepStrictEqual(
  runtimeMessages.map((message) => ({ ...message })),
  [{ action: 'notifyTabSwitcherShortcutModifierReleased', key: 'Meta' }],
  'releasing Command should relay exactly one commit request'
);
keyupHandler({ isTrusted: true, key: 'Meta', code: 'MetaLeft' });
assert.strictEqual(
  runtimeMessages.length,
  1,
  'the observer should disarm after the configured modifier is released'
);

runtimeMessageListener({ action: 'armTabSwitcherShortcutRelease', keys: ['Control'] }, {}, () => {});
keyupHandler({ isTrusted: true, key: '?', code: 'Slash' });
assert.strictEqual(runtimeMessages.length, 1, 'releasing Slash must not commit while Control remains held');
keyupHandler({ isTrusted: true, key: 'Control', code: 'ControlLeft' });
assert.deepStrictEqual(
  runtimeMessages.map((message) => ({ ...message })),
  [
    { action: 'notifyTabSwitcherShortcutModifierReleased', key: 'Meta' },
    { action: 'notifyTabSwitcherShortcutModifierReleased', key: 'Control' }
  ],
  'Ctrl+Shift+/ should commit only when its primary Control modifier is released'
);

const quickReleaseCommandStartedAt = Date.now() - 10;
keyupHandler({ isTrusted: true, key: 'Meta', code: 'MetaRight' });
runtimeMessageListener({
  action: 'armTabSwitcherShortcutRelease',
  keys: ['Meta'],
  commandStartedAt: quickReleaseCommandStartedAt
}, {}, () => {});
assert.deepStrictEqual(
  runtimeMessages.map((message) => ({ ...message })),
  [
    { action: 'notifyTabSwitcherShortcutModifierReleased', key: 'Meta' },
    { action: 'notifyTabSwitcherShortcutModifierReleased', key: 'Control' },
    { action: 'notifyTabSwitcherShortcutModifierReleased', key: 'Meta' }
  ],
  'a trusted shortcut release that beats the async arm message should be replayed for the same command'
);

keydownHandler({
  altKey: true,
  code: 'KeyQ',
  ctrlKey: false,
  isComposing: false,
  isTrusted: true,
  key: 'q',
  metaKey: false,
  preventDefault() {},
  repeat: false,
  shiftKey: false,
  stopPropagation() {},
  target: window.document.body
});
keyupHandler({ isTrusted: true, key: 'Alt', code: 'AltLeft' });
runtimeMessageListener({
  action: 'armTabSwitcherShortcutRelease',
  keys: ['Alt'],
  commandStartedAt: Date.now() + 1
}, {}, () => {});
assert.deepStrictEqual(
  runtimeMessages.map((message) => ({ ...message })),
  [
    { action: 'notifyTabSwitcherShortcutModifierReleased', key: 'Meta' },
    { action: 'notifyTabSwitcherShortcutModifierReleased', key: 'Control' },
    { action: 'notifyTabSwitcherShortcutModifierReleased', key: 'Meta' },
    { action: 'notifyTabSwitcherShortcutModifierReleased', key: 'Alt' }
  ],
  'a trusted keydown/keyup pair should survive a cold background command timestamp that arrives just after keyup'
);

keyupHandler({ isTrusted: true, key: 'Control', code: 'ControlRight' });
runtimeMessageListener({
  action: 'armTabSwitcherShortcutRelease',
  keys: ['Control'],
  commandStartedAt: Date.now() + 1000
}, {}, () => {});
assert.strictEqual(
  runtimeMessages.length,
  4,
  'a release observed before the current command started must not be replayed'
);
keyupHandler({ isTrusted: true, key: 'Control', code: 'ControlLeft' });
assert.deepStrictEqual(
  runtimeMessages.map((message) => ({ ...message })).at(-1),
  { action: 'notifyTabSwitcherShortcutModifierReleased', key: 'Control' },
  'an armed observer should still relay the next live release after rejecting a stale buffered release'
);

// The configured shortcut comes from chrome.commands in the background. Each
// request wakes the service worker, so typing must never ask for it; only a
// window regaining focus (after a possible shortcut edit) should.
{
  const realNow = window.Date.now;
  let fakeNow = realNow() + 60 * 1000;
  window.Date.now = () => fakeNow;
  try {
    shortcutResponseCallbacks.length = 0;
    for (let i = 0; i < 5; i += 1) {
      fakeNow += 20 * 1000;
      keydownHandler({
        altKey: false,
        code: 'KeyA',
        ctrlKey: false,
        isComposing: false,
        isTrusted: true,
        key: 'a',
        metaKey: false,
        preventDefault() {},
        repeat: false,
        shiftKey: false,
        stopPropagation() {},
        target: editableTarget
      });
    }
    assert.strictEqual(shortcutResponseCallbacks.length, 0, 'keydowns should not poll the background for the shortcut');

    window.document.body.appendChild(editableTarget);
    editableTarget.dispatchEvent(new window.FocusEvent('focus'));
    assert.strictEqual(shortcutResponseCallbacks.length, 0, 'focusing a field inside the page should not poll the background');

    window.dispatchEvent(new window.FocusEvent('focus'));
    assert.strictEqual(shortcutResponseCallbacks.length, 1, 'the window regaining focus should refresh the shortcut once');
    window.dispatchEvent(new window.FocusEvent('focus'));
    assert.strictEqual(shortcutResponseCallbacks.length, 1, 'a focus burst should share one refresh');
    fakeNow += 5 * 1000;
    window.dispatchEvent(new window.FocusEvent('focus'));
    assert.strictEqual(shortcutResponseCallbacks.length, 2, 'a later return to the window should refresh again');
  } finally {
    window.Date.now = realNow;
  }
}

// Each switcher command injects the observer into its tab again. A release
// the running observer buffered just before must survive the replacement,
// and an observer that already knows the shortcut must not ask again.
{
  shortcutResponseCallbacks.length = 0;
  const commandStartedAt = Date.now();
  keydownHandler({
    altKey: true,
    code: 'KeyQ',
    ctrlKey: false,
    isComposing: false,
    isTrusted: true,
    key: 'q',
    metaKey: false,
    preventDefault() {},
    repeat: false,
    shiftKey: false,
    stopPropagation() {},
    target: window.document.body
  });
  keyupHandler({ isTrusted: true, key: 'Alt', code: 'AltLeft' });
  const relayedBefore = runtimeMessages.length;
  window.eval(source);
  assert.strictEqual(keyupHandlers.size, 1, 'the replacement should leave one keyup listener');
  assert.strictEqual(shortcutResponseCallbacks.length, 0,
    'a replacement should reuse the shortcut its predecessor already received');
  assert.strictEqual(
    runtimeMessages.filter((message) => message && message.action === 'notifyTopFrameDocumentStarted').length,
    0,
    'a replacement should not announce a new Document'
  );
  runtimeMessageListener({
    action: 'armTabSwitcherShortcutRelease',
    keys: ['Alt'],
    commandStartedAt
  }, {}, () => {});
  assert.deepStrictEqual(
    runtimeMessages.slice(relayedBefore).map((message) => ({ ...message })),
    [{ action: 'notifyTabSwitcherShortcutModifierReleased', key: 'Alt' }],
    'a release buffered by the replaced observer should still commit the switcher'
  );
}

dom.window.close();
console.log('tab switcher shortcut release relay tests passed');
