// Unit tests for the shared auto PiP core (LumnoAutoPipCore, appended to
// src/shared/settings.js), run against plain fakes with no DOM.
const assert = require('assert');
const settings = require('../src/shared/settings');

const CORE = globalThis.LumnoAutoPipCore;
const KEY = '_x_extension_auto_pip_enabled_2026_unique_';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class FakeElement {}
class FakeMediaElement extends FakeElement {
  constructor(options = {}) {
    super();
    Object.assign(this, { paused: false, ended: false, readyState: 4, width: 0, height: 0 }, options);
    this.pauseCalls = 0;
  }
  pause() {
    this.pauseCalls += 1;
    this.paused = true;
  }
  getBoundingClientRect() {
    return { width: this.width, height: this.height };
  }
}

function createHarness(overrides = {}) {
  const messages = [];
  const storageListeners = [];
  const runtimeListeners = [];
  const storageWrites = [];
  const hookCalls = [];
  const syncValues = { ...(overrides.syncValues || {}) };
  const document = {
    visibilityState: 'hidden',
    pictureInPictureEnabled: true,
    pictureInPictureElement: null,
    media: [],
    exitCalls: 0,
    exitPictureInPicture() {
      document.exitCalls += 1;
      if (!document.pictureInPictureElement) {
        return Promise.reject(new Error('InvalidStateError'));
      }
      document.pictureInPictureElement = null;
      return Promise.resolve();
    },
    querySelectorAll(selector) {
      return selector === 'video' ? document.media.filter((node) => node.kind === 'video') : document.media;
    },
    getElementById() { return null; }
  };
  const window = {
    Element: FakeElement,
    HTMLMediaElement: FakeMediaElement,
    getComputedStyle: (element) => element.style || null,
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {}
  };
  const responders = overrides.responders || {};
  const chrome = {
    runtime: {
      lastError: null,
      onMessage: { addListener: (listener) => runtimeListeners.push(listener) },
      sendMessage(message, callback) {
        messages.push(message);
        const responder = responders[message.action];
        if (responder === 'never') {
          return;
        }
        let response = { ok: true };
        if (message.action === 'pipRequestOwnership') {
          response = { ok: true, granted: true, token: 'token-1' };
        }
        if (typeof responder === 'function') {
          response = responder(message);
        }
        setTimeout(() => callback(response), 0);
      }
    },
    storage: {
      local: { get(_keys, callback) { callback({}); } },
      sync: {
        get(_keys, callback) { callback({ ...syncValues }); },
        set(payload, callback) {
          storageWrites.push(payload);
          if (callback) callback();
        }
      },
      onChanged: { addListener: (listener) => storageListeners.push(listener) }
    }
  };
  const state = {
    autoPipEnabled: false,
    activeVideo: null,
    lastManagedVideo: null,
    enteringPiP: false,
    exitingPiP: false,
    managedPiP: false,
    enterRetryTimer: null,
    recoveryTimer: null,
    suppressEnterUntil: 0,
    hiddenRetryBudget: 0,
    shouldResumeInlinePlayback: false,
    wasPlayingBeforeHide: false,
    ownerToken: '',
    mediaSessionHandlerBound: false,
    runtimeMessageHandlerBound: false
  };
  const hooks = {
    maybeEnterPiP: async (reason) => {
      hookCalls.push(['maybeEnterPiP', reason]);
      return Boolean(overrides.enterSucceeds);
    },
    scheduleVisibleRecovery: () => hookCalls.push(['scheduleVisibleRecovery']),
    isVideoCandidate: (video) => Boolean(video) && video.candidate !== false,
    scoreVideo: (video) => (video.area > 0 ? video.area + (CORE.isVideoPlaying(video) ? 1e9 : 0) : null),
    ...(overrides.hooks || {})
  };
  const core = CORE.createAutoPipCore({
    state,
    window,
    document,
    navigator: overrides.navigator || {},
    chrome,
    providerStorage: settings.getProviderStorage(chrome),
    config: {
      pageBridgeScriptId: 'bridge',
      mainWorldExitAction: 'testExitInMainWorld',
      enterSuppressAfterExitMs: 1100,
      enterSuppressAfterVisibleMs: 1300
    },
    hooks
  });
  return { core, state, document, chrome, messages, storageListeners, runtimeListeners, storageWrites, hookCalls };
}

(async () => {
  assert.strictEqual(CORE.normalizeAutoPipEnabled(undefined), true, 'auto PiP defaults to on');
  assert.strictEqual(CORE.normalizeAutoPipEnabled(false), false);
  assert.strictEqual(CORE.normalizeAutoPipEnabled('false'), true, 'only a stored false turns it off');
  assert.strictEqual(CORE.isVideoPlaying(new FakeMediaElement()), true);
  assert.strictEqual(CORE.isVideoPlaying(new FakeMediaElement({ readyState: 1 })), false,
    'a video without enough data is not playing');
  assert.strictEqual(CORE.isVideoPlaying(null), false);

  // sendRuntimeMessage resolves with a reason instead of rejecting.
  {
    const { core, chrome } = createHarness({ responders: { slow: 'never', empty: () => undefined } });
    assert.deepStrictEqual(await core.sendRuntimeMessage({ action: 'empty' }),
      { ok: false, reason: 'empty-response' });
    assert.deepStrictEqual(await core.sendRuntimeMessage({ action: 'slow' }, { ms: 0, minMs: 30 }),
      { ok: false, reason: 'timeout' }, 'a timeout below the minimum waits for the minimum');
    chrome.runtime.sendMessage = () => { throw new Error('Extension context invalidated.'); };
    assert.deepStrictEqual(await core.sendRuntimeMessage({ action: 'x' }),
      { ok: false, reason: 'Error: Extension context invalidated.' });
    delete chrome.runtime.sendMessage;
    assert.deepStrictEqual(await core.sendRuntimeMessage({ action: 'x' }),
      { ok: false, reason: 'no-runtime-sendMessage' });
  }

  // Ownership: the granted token is kept and released exactly once.
  {
    const { core, state, messages } = createHarness();
    assert.deepStrictEqual(await core.requestPiPOwnership('video'), { ok: true, granted: true });
    assert.strictEqual(state.ownerToken, 'token-1');
    await core.releasePiPOwnership();
    assert.strictEqual(state.ownerToken, '');
    assert.deepStrictEqual(await core.releasePiPOwnership(),
      { ok: true, released: false, reason: 'no-owner-token' });
    assert.deepStrictEqual(messages, [
      { action: 'pipRequestOwnership', kind: 'video' },
      { action: 'pipReleaseOwnership', token: 'token-1' }
    ]);
  }

  // Settings: missing values are normalized and stored; turning auto PiP off
  // clears recovery state and leaves a managed PiP window.
  {
    const harness = createHarness({ responders: { testExitInMainWorld: () => {
      harness.document.pictureInPictureElement = null;
      return { ok: true };
    } } });
    const { core, state, document, storageListeners, storageWrites, messages } = harness;
    core.syncAutoPipEnabledSetting();
    await wait(5);
    assert.strictEqual(state.autoPipEnabled, true);
    assert.deepStrictEqual(storageWrites, [{ [KEY]: true }]);

    state.ownerToken = 'token-1';
    state.managedPiP = true;
    state.shouldResumeInlinePlayback = true;
    state.hiddenRetryBudget = 3;
    document.pictureInPictureElement = {};
    storageListeners.forEach((listener) => listener({ [KEY]: { newValue: true } }, 'local'));
    assert.strictEqual(state.autoPipEnabled, true, 'changes in the inactive area are ignored');
    storageListeners.forEach((listener) => listener({ [KEY]: { newValue: false } }, 'sync'));
    assert.strictEqual(state.autoPipEnabled, false);
    assert.strictEqual(state.shouldResumeInlinePlayback, false);
    assert.strictEqual(state.hiddenRetryBudget, 0);
    await wait(20);
    assert.strictEqual(document.pictureInPictureElement, null);
    assert.deepStrictEqual(messages.map((message) => message.action),
      ['testExitInMainWorld', 'pipReleaseOwnership']);
  }
  {
    const { core, state, storageWrites } = createHarness({ syncValues: { [KEY]: false } });
    core.syncAutoPipEnabledSetting();
    await wait(5);
    assert.strictEqual(state.autoPipEnabled, false);
    assert.deepStrictEqual(storageWrites, [], 'an already-normalized value is not rewritten');
  }

  // maybeExitPiP: falls through main world -> page bridge -> exitPictureInPicture.
  {
    const afterExit = [];
    const { core, state, document, messages } = createHarness({
      hooks: { afterExitAttempt: () => afterExit.push(document.pictureInPictureElement) }
    });
    assert.strictEqual(await core.maybeExitPiP(), true, 'nothing to exit counts as success');
    assert.deepStrictEqual(afterExit, [], 'the after-exit hook only runs when an exit was attempted');

    state.managedPiP = true;
    state.ownerToken = 'token-1';
    document.pictureInPictureElement = {};
    const before = Date.now();
    // No CustomEvent on the fake window, so the page bridge reports failure at once.
    assert.strictEqual(await core.maybeExitPiP(), true);
    assert.strictEqual(document.exitCalls, 1);
    assert.strictEqual(state.managedPiP, false);
    assert.strictEqual(state.exitingPiP, false);
    assert(state.suppressEnterUntil >= before + 1100, 'entering is suppressed right after an exit');
    assert.strictEqual(afterExit.length, 2, 'the after-exit hook runs after the attempt and in cleanup');
    assert.deepStrictEqual(messages.map((message) => message.action),
      ['testExitInMainWorld', 'pipReleaseOwnership']);

    state.managedPiP = true;
    document.exitPictureInPicture = () => Promise.reject(new Error('InvalidStateError'));
    document.pictureInPictureElement = {};
    assert.strictEqual(await core.maybeExitPiP(), false,
      'an exitPictureInPicture rejection is reported as a failed exit, not thrown');
    assert.strictEqual(state.managedPiP, false);
  }

  // Deferred entry retries while hidden and the retry budget lasts.
  {
    const { core, state, hookCalls } = createHarness();
    state.autoPipEnabled = true;
    state.hiddenRetryBudget = 2;
    core.scheduleDeferredEnterPiP('visibility_hidden_retry');
    await wait(400);
    assert.deepStrictEqual(hookCalls.map((call) => call[1]), [
      'visibility_hidden_retry',
      'visibility_hidden_retry_loop',
      'visibility_hidden_retry_loop_loop'
    ]);
    assert.strictEqual(state.hiddenRetryBudget, 0);
    assert.strictEqual(state.enterRetryTimer, null);
  }
  {
    const { core, state, hookCalls, document } = createHarness();
    core.scheduleDeferredEnterPiP('off');
    state.autoPipEnabled = true;
    document.visibilityState = 'visible';
    core.scheduleDeferredEnterPiP('visible');
    await wait(60);
    assert.deepStrictEqual(hookCalls, [], 'no retries while disabled or visible');
  }

  // Video selection uses the hooks' candidate filter and score.
  {
    const { core, state, document } = createHarness();
    const small = Object.assign(new FakeMediaElement({ paused: true }), { kind: 'video', area: 10 });
    const large = Object.assign(new FakeMediaElement({ paused: true }), { kind: 'video', area: 500 });
    const playing = Object.assign(new FakeMediaElement(), { kind: 'video', area: 20 });
    const rejected = Object.assign(new FakeMediaElement(), { kind: 'video', area: 9999, candidate: false });
    document.media = [small, large, rejected];
    assert.strictEqual(core.pickPrimaryVideo(), large);
    document.media.push(playing);
    assert.strictEqual(core.syncActiveVideo(), playing, 'a playing video beats a larger paused one');
    assert.strictEqual(core.syncActiveVideo(small), small, 'a preferred candidate is kept');
    assert.strictEqual(core.syncActiveVideo(rejected), playing);
    assert.strictEqual(state.activeVideo, playing);
    document.media = [rejected];
    assert.strictEqual(core.pickPrimaryVideo(), rejected, 'falls back to the first video');

    state.autoPipEnabled = true;
    state.lastManagedVideo = playing;
    document.media = [playing];
    core.capturePlaybackStateOnHide();
    assert.strictEqual(state.wasPlayingBeforeHide, true);
    assert.strictEqual(state.shouldResumeInlinePlayback, true);
    playing.paused = true;
    core.capturePlaybackStateOnHide();
    assert.strictEqual(state.shouldResumeInlinePlayback, false);
  }

  // The background can make this tab give up PiP; hidden tabs also pause.
  {
    const { core, state, document, runtimeListeners } = createHarness();
    const audio = new FakeMediaElement({ kind: 'audio' });
    document.media = [audio];
    core.bindRuntimeMessageListener();
    core.bindRuntimeMessageListener();
    assert.strictEqual(runtimeListeners.length, 1, 'the listener binds once');
    assert.strictEqual(runtimeListeners[0]({ action: 'other' }, {}, () => {}), undefined);
    state.shouldResumeInlinePlayback = true;
    const response = await new Promise((resolve) => {
      assert.strictEqual(runtimeListeners[0]({ action: 'lumno:pip-force-surrender', reason: 'r' }, {}, resolve), true);
    });
    assert.deepStrictEqual(response, { ok: true, reason: 'r' });
    assert.strictEqual(audio.pauseCalls, 1);
    assert.strictEqual(state.shouldResumeInlinePlayback, false);
  }

  // Media Session's enterpictureinpicture action goes through maybeEnterPiP.
  {
    let handler = null;
    const navigator = { mediaSession: { setActionHandler: (name, fn) => { handler = name === 'enterpictureinpicture' ? fn : null; } } };
    const { core, hookCalls } = createHarness({ navigator });
    core.bindMediaSessionAutoPiP();
    await handler();
    assert.deepStrictEqual(hookCalls, [['maybeEnterPiP', 'media_session_action']]);
  }

  // Leaving PiP while visible starts visible recovery.
  {
    const { core, state, document, hookCalls } = createHarness();
    state.managedPiP = true;
    document.visibilityState = 'visible';
    core.onLeavePictureInPicture();
    assert.strictEqual(state.managedPiP, false);
    assert.deepStrictEqual(hookCalls, [['scheduleVisibleRecovery']]);
  }

  console.log('auto PiP core tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
