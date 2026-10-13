// Drives site-auto-pip.js and youtube-auto-pip.js in jsdom with a fake
// Picture-in-Picture API and a fake extension runtime, and checks the message
// flow each one produces when a playing tab is hidden, shown again, told to
// surrender PiP, or has auto PiP turned off.
const assert = require('assert');
const fs = require('fs');
const { JSDOM } = require('jsdom');

const AUTO_PIP_KEY = '_x_extension_auto_pip_enabled_2026_unique_';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, message, timeoutMs = 1500) {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`timed out waiting for: ${message}`);
    }
    await wait(5);
  }
}

function loadAutoPip({ url, scripts, syncValues = {}, mainWorld = {} }) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    pretendToBeVisual: true,
    runScripts: 'outside-only',
    url
  });
  const { window } = dom;
  const { document } = window;
  const env = {
    dom,
    window,
    document,
    messages: [],
    storageWrites: [],
    storageListeners: [],
    runtimeListeners: [],
    visibility: 'visible',
    pipElement: null,
    exitCalls: 0,
    playCalls: 0
  };

  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => env.visibility });
  Object.defineProperty(document, 'pictureInPictureEnabled', { configurable: true, value: true });
  Object.defineProperty(document, 'pictureInPictureElement', { configurable: true, get: () => env.pipElement });
  document.exitPictureInPicture = () => {
    env.exitCalls += 1;
    if (!env.pipElement) {
      return Promise.reject(new window.DOMException('Not in Picture-in-Picture', 'InvalidStateError'));
    }
    env.pipElement = null;
    return Promise.resolve();
  };

  const video = document.createElement('video');
  let paused = false;
  Object.defineProperties(video, {
    videoWidth: { value: 1280 },
    videoHeight: { value: 720 },
    readyState: { value: 4 },
    paused: { get: () => paused },
    ended: { value: false }
  });
  video.getBoundingClientRect = () => ({ left: 0, top: 0, right: 640, bottom: 360, width: 640, height: 360 });
  video.play = () => {
    env.playCalls += 1;
    paused = false;
    return Promise.resolve();
  };
  video.pause = () => {
    paused = true;
  };
  video.requestPictureInPicture = () => {
    env.requestedDisablePiP = video.disablePictureInPicture;
    env.pipElement = video;
    return Promise.resolve({});
  };
  document.body.appendChild(video);
  env.video = video;
  env.setPaused = (value) => {
    paused = value;
  };

  window.chrome = {
    runtime: {
      id: 'test-extension',
      lastError: null,
      getURL(path) { return `chrome-extension://lumno/${path}`; },
      onMessage: { addListener(listener) { env.runtimeListeners.push(listener); } },
      sendMessage(message, callback) {
        env.messages.push(String(message.action));
        let response = { ok: true };
        if (message.action === 'pipRequestOwnership') {
          response = { ok: true, granted: true, token: 'owner-token' };
        } else if (typeof mainWorld[message.action] === 'function') {
          response = mainWorld[message.action](env) || { ok: true };
        }
        setTimeout(() => callback && callback(response), 0);
      }
    },
    storage: {
      local: { get(_keys, callback) { callback({}); } },
      sync: {
        get(_keys, callback) { callback({ ...syncValues }); },
        set(payload, callback) {
          env.storageWrites.push(JSON.parse(JSON.stringify(payload)));
          if (callback) callback();
        }
      },
      onChanged: { addListener(listener) { env.storageListeners.push(listener); } }
    }
  };

  env.load = async () => {
    scripts.forEach((file) => window.eval(fs.readFileSync(file, 'utf8')));
    await wait(10);
  };
  env.setVisibility = (value) => {
    env.visibility = value;
    document.dispatchEvent(new window.Event('visibilitychange'));
  };
  env.setAutoPipEnabled = (value) => {
    env.storageListeners.forEach((listener) => listener({
      [AUTO_PIP_KEY]: { oldValue: !value, newValue: value }
    }, 'sync'));
  };
  env.surrender = () => new Promise((resolve) => {
    let kept = false;
    env.runtimeListeners.forEach((listener) => {
      kept = listener({ action: 'lumno:pip-force-surrender', reason: 'other-tab' }, {}, resolve) === true || kept;
    });
    if (!kept) resolve(undefined);
  });
  env.takeMessages = () => env.messages.splice(0);
  return env;
}

const SITE_SCRIPTS = ['src/shared/settings.js', 'src/content/auto-pip-blacklist.js', 'src/content/site-auto-pip.js'];
const YOUTUBE_SCRIPTS = ['src/shared/settings.js', 'src/content/youtube-auto-pip.js'];
const clearPiP = (env) => {
  env.pipElement = null;
  return { ok: true };
};

async function testIqiyiUsesMainWorldSetupAndEnter() {
  const env = loadAutoPip({
    url: 'https://www.iqiyi.com/v_123.html',
    scripts: SITE_SCRIPTS,
    mainWorld: {
      iqiyiTryEnterPiPInMainWorld: (state) => {
        state.pipElement = state.video;
        return { ok: true };
      },
      forceExitPiPInMainWorld: clearPiP
    }
  });
  await env.load();
  assert.deepStrictEqual(env.takeMessages(), ['iqiyiSetupAutoPiPInMainWorld'],
    'iQIYI pages should prepare main-world auto PiP as soon as the script starts');
  assert.deepStrictEqual(env.storageWrites, [{ [AUTO_PIP_KEY]: true }],
    'a missing auto PiP setting should be stored as its normalized default');
  assert(env.document.getElementById('__lumno_site_auto_pip_page_bridge_script_2026__'),
    'the page bridge script should be injected at start');

  env.setVisibility('hidden');
  await waitFor(() => env.pipElement === env.video, 'iQIYI to enter PiP');
  assert.deepStrictEqual(env.takeMessages(), [
    'iqiyiSetupAutoPiPInMainWorld',
    'pipRequestOwnership',
    'iqiyiSetupAutoPiPInMainWorld',
    'iqiyiTryEnterPiPInMainWorld'
  ]);

  env.setPaused(true);
  env.setVisibility('visible');
  await waitFor(() => env.messages.includes('pipReleaseOwnership'), 'ownership release after exit');
  await wait(20);
  assert.strictEqual(env.pipElement, null);
  assert.deepStrictEqual(env.takeMessages(), ['forceExitPiPInMainWorld', 'pipReleaseOwnership']);
  assert.strictEqual(env.playCalls, 1, 'inline playback should resume after returning to the tab');
  env.dom.window.close();
}

async function testDouyinFallsBackToVideoRequest() {
  const env = loadAutoPip({ url: 'https://www.douyin.com/video/1', scripts: SITE_SCRIPTS });
  await env.load();
  assert.deepStrictEqual(env.takeMessages(), [], 'Douyin needs no main-world setup at start');
  env.video.disablePictureInPicture = true;
  env.setVisibility('hidden');
  await waitFor(() => env.pipElement === env.video, 'Douyin to enter PiP via the video element');
  assert.deepStrictEqual(env.takeMessages(), ['pipRequestOwnership', 'siteTryEnterPiPInMainWorld']);
  assert.strictEqual(env.requestedDisablePiP, false,
    'a site that sets disablePictureInPicture should have it lifted for the request');
  assert.strictEqual(env.video.disablePictureInPicture, true, 'and restored afterwards');
  env.dom.window.close();
}

async function testGenericSiteNeedsGestureAndExitsWhenDisabled() {
  const env = loadAutoPip({ url: 'https://www.bilibili.com/video/BV1', scripts: SITE_SCRIPTS });
  await env.load();
  env.setPaused(true);
  env.setVisibility('hidden');
  await wait(300);
  assert.strictEqual(env.pipElement, null, 'a paused video without a user gesture should not enter PiP');
  env.setVisibility('visible');
  await wait(20);
  env.takeMessages();

  env.setPaused(false);
  env.document.dispatchEvent(new env.window.Event('pointerdown'));
  await wait(1400);
  env.setVisibility('hidden');
  await waitFor(() => env.pipElement === env.video, 'Bilibili to enter PiP');
  assert.deepStrictEqual(env.takeMessages(), ['pipRequestOwnership']);

  env.setAutoPipEnabled(false);
  await waitFor(() => env.messages.includes('pipReleaseOwnership'), 'release after disabling', 2500);
  assert.strictEqual(env.pipElement, null);
  assert.strictEqual(env.exitCalls, 1,
    'when neither the main world nor the page bridge exits PiP, the content script should exit it');
  assert.deepStrictEqual(env.takeMessages(), ['forceExitPiPInMainWorld', 'pipReleaseOwnership']);
  env.dom.window.close();
}

async function testBlacklistedHostDoesNothing() {
  const env = loadAutoPip({ url: 'https://www.taobao.com/item', scripts: SITE_SCRIPTS });
  await env.load();
  env.setVisibility('hidden');
  await wait(50);
  assert.deepStrictEqual(env.takeMessages(), []);
  assert.strictEqual(env.runtimeListeners.length, 0);
  env.dom.window.close();
}

async function testYoutubeEnterExitAndSurrender() {
  const env = loadAutoPip({
    url: 'https://www.youtube.com/watch?v=abc&lumno_pip_recover=1',
    scripts: YOUTUBE_SCRIPTS,
    mainWorld: { ytForceExitPiPInMainWorld: clearPiP }
  });
  await env.load();
  assert.strictEqual(env.window.location.search, '?v=abc',
    'the recovery marker should be removed from the URL on load');
  assert(env.document.getElementById('__lumno_yt_auto_pip_page_bridge_script_2026__'));
  assert.deepStrictEqual(env.takeMessages(), []);

  env.setVisibility('hidden');
  await waitFor(() => env.pipElement === env.video, 'YouTube to enter PiP');
  assert.deepStrictEqual(env.takeMessages(), ['pipRequestOwnership']);

  env.setVisibility('visible');
  await waitFor(() => env.messages.includes('pipReleaseOwnership'), 'YouTube to release ownership');
  await wait(20);
  assert.strictEqual(env.pipElement, null);
  assert.deepStrictEqual(env.takeMessages(), ['ytForceExitPiPInMainWorld', 'pipReleaseOwnership']);

  await wait(1500);
  env.setVisibility('hidden');
  await waitFor(() => env.pipElement === env.video, 'YouTube to enter PiP again');
  env.takeMessages();
  const response = await env.surrender();
  assert.deepStrictEqual(JSON.parse(JSON.stringify(response)), { ok: true, reason: 'other-tab' });
  assert.strictEqual(env.pipElement, null, 'surrendering should leave PiP');
  assert.strictEqual(env.video.paused, true, 'surrendering while hidden should pause the media');
  assert.deepStrictEqual(env.takeMessages(), ['ytForceExitPiPInMainWorld', 'pipReleaseOwnership']);
  env.dom.window.close();
}

async function testYoutubeStaysOffWhenDisabled() {
  const env = loadAutoPip({
    url: 'https://www.youtube.com/watch?v=abc',
    scripts: YOUTUBE_SCRIPTS,
    syncValues: { [AUTO_PIP_KEY]: false }
  });
  await env.load();
  assert.deepStrictEqual(env.storageWrites, [], 'a stored false needs no normalization write');
  env.setVisibility('hidden');
  await wait(100);
  assert.strictEqual(env.pipElement, null);
  assert.deepStrictEqual(env.takeMessages(), []);
  env.dom.window.close();
}

(async () => {
  await testIqiyiUsesMainWorldSetupAndEnter();
  await testDouyinFallsBackToVideoRequest();
  await testGenericSiteNeedsGestureAndExitsWhenDisabled();
  await testBlacklistedHostDoesNothing();
  await testYoutubeEnterExitAndSurrender();
  await testYoutubeStaysOffWhenDisabled();
  console.log('auto PiP content script tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
