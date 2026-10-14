// Shared auto Picture-in-Picture logic for src/content/site-auto-pip.js and
// src/content/youtube-auto-pip.js, loaded after settings.js by both of their
// content_scripts entries. Nothing here touches the page until a content
// script calls createAutoPipCore.
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.LumnoAutoPipCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const AUTO_PIP_ENABLED_STORAGE_KEY = globalThis.LumnoSettings.AUTO_PIP_ENABLED_STORAGE_KEY;
  const DOCUMENT_PIP_ACTIVE_FLAG = '__lumno_document_pip_active_2026__';
  const PAGE_BRIDGE_REQUEST_EVENT = '__lumno_yt_force_exit_pip_req_2026__';
  const PAGE_BRIDGE_RESPONSE_EVENT = '__lumno_yt_force_exit_pip_res_2026__';
  const PAGE_BRIDGE_SCRIPT_PATH = 'src/content/youtube-auto-pip-page.js';
  const MAIN_WORLD_EXIT_TIMEOUT_MS = 760;
  const PAGE_BRIDGE_EXIT_TIMEOUT_MS = 520;
  const MIN_DEFERRED_ENTER_DELAY_MS = 40;

  function normalizeAutoPipEnabled(value) {
    return value !== false;
  }

  function isVideoPlaying(video) {
    if (!video) {
      return false;
    }
    return !video.paused && !video.ended && Number(video.readyState || 0) >= 2;
  }

  function warnUnexpected(context) {
    return (error) => {
      console.warn(`[Lumno] auto PiP: ${context} failed`, error);
    };
  }

  // options: { state, window, document, navigator, chrome, providerStorage, config, hooks }
  // config: { pageBridgeScriptId, mainWorldExitAction, enterSuppressAfterExitMs,
  //           enterSuppressAfterVisibleMs }
  // hooks:  { maybeEnterPiP, scheduleVisibleRecovery, isVideoCandidate, scoreVideo,
  //           getHiddenRetryDelayMs?, afterExitAttempt?, onPageReturn? }
  // The hooks are the parts each site does differently.
  function createAutoPipCore(options) {
    const { state, window, document, navigator, chrome, providerStorage, config, hooks } = options;

    function setAutoPipEnabled(value) {
      state.autoPipEnabled = normalizeAutoPipEnabled(value);
    }

    function isDocumentPiPActive() {
      return window[DOCUMENT_PIP_ACTIVE_FLAG] === true;
    }

    // Resolves with the response, or with { ok: false, reason } on any
    // failure. With timeout ({ ms, minMs }) it also resolves on timeout.
    function sendRuntimeMessage(message, timeout) {
      return new Promise((resolve) => {
        if (!chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
          resolve({ ok: false, reason: 'no-runtime-sendMessage' });
          return;
        }
        let done = false;
        let timer = null;
        const finish = (result) => {
          if (done) {
            return;
          }
          done = true;
          if (timer) {
            clearTimeout(timer);
          }
          resolve(result || { ok: false });
        };
        if (timeout) {
          timer = setTimeout(() => {
            finish({ ok: false, reason: 'timeout' });
          }, Math.max(timeout.minMs, Number(timeout.ms)));
        }
        try {
          chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime && chrome.runtime.lastError) {
              finish({ ok: false, reason: chrome.runtime.lastError.message || 'runtime-lastError' });
              return;
            }
            finish(response && typeof response === 'object'
              ? response
              : { ok: false, reason: 'empty-response' });
          });
        } catch (error) {
          finish({ ok: false, reason: String(error) });
        }
      });
    }

    async function requestPiPOwnership(kind) {
      const response = await sendRuntimeMessage({ action: 'pipRequestOwnership', kind: kind });
      if (response && response.ok && response.granted && response.token) {
        state.ownerToken = String(response.token);
        return { ok: true, granted: true };
      }
      return {
        ok: false,
        granted: false,
        reason: response && response.reason ? String(response.reason) : 'ownership-denied'
      };
    }

    async function releasePiPOwnership() {
      const token = typeof state.ownerToken === 'string' ? state.ownerToken : '';
      state.ownerToken = '';
      if (!token) {
        return { ok: true, released: false, reason: 'no-owner-token' };
      }
      return sendRuntimeMessage({ action: 'pipReleaseOwnership', token: token });
    }

    function clearEnterRetryTimer() {
      if (!state.enterRetryTimer) {
        return;
      }
      clearTimeout(state.enterRetryTimer);
      state.enterRetryTimer = null;
    }

    function clearRecoveryTimer() {
      if (!state.recoveryTimer) {
        return;
      }
      clearTimeout(state.recoveryTimer);
      state.recoveryTimer = null;
    }

    function clearPlaybackRecoveryState() {
      state.shouldResumeInlinePlayback = false;
      state.wasPlayingBeforeHide = false;
      state.hiddenRetryBudget = 0;
      clearEnterRetryTimer();
      clearRecoveryTimer();
    }

    function syncAutoPipEnabledSetting() {
      if (!chrome || !chrome.storage) {
        return;
      }
      const storageArea = providerStorage.area;
      storageArea.get([AUTO_PIP_ENABLED_STORAGE_KEY], (result) => {
        const rawValue = result ? result[AUTO_PIP_ENABLED_STORAGE_KEY] : undefined;
        const normalized = normalizeAutoPipEnabled(rawValue);
        setAutoPipEnabled(normalized);
        if (rawValue !== normalized) {
          storageArea.set({ [AUTO_PIP_ENABLED_STORAGE_KEY]: normalized });
        }
      });
      if (!chrome.storage.onChanged || typeof chrome.storage.onChanged.addListener !== 'function') {
        return;
      }
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (!providerStorage.runtime.isActiveAreaName(areaName)) {
          return;
        }
        if (!changes || !changes[AUTO_PIP_ENABLED_STORAGE_KEY]) {
          return;
        }
        setAutoPipEnabled(changes[AUTO_PIP_ENABLED_STORAGE_KEY].newValue);
        if (!state.autoPipEnabled) {
          clearPlaybackRecoveryState();
        }
        if (!state.autoPipEnabled && (state.managedPiP || document.pictureInPictureElement)) {
          // maybeExitPiP handles its own failures, so a rejection here is a bug.
          maybeExitPiP().catch(warnUnexpected('leaving PiP after auto PiP was turned off'));
        }
      });
    }

    function canEnterPiP() {
      return typeof document !== 'undefined' && document.pictureInPictureEnabled === true;
    }

    function canExitPiP() {
      return typeof document !== 'undefined' && typeof document.exitPictureInPicture === 'function';
    }

    function isProbablyHiddenByStyles(element) {
      if (!element || !(element instanceof window.Element)) {
        return true;
      }
      const style = window.getComputedStyle(element);
      if (!style) {
        return false;
      }
      return style.display === 'none' ||
        style.visibility === 'hidden' ||
        Number(style.opacity || 1) === 0;
    }

    function getRectArea(video) {
      if (!video || typeof video.getBoundingClientRect !== 'function') {
        return 0;
      }
      const rect = video.getBoundingClientRect();
      const width = Math.max(0, Number(rect.width || 0));
      const height = Math.max(0, Number(rect.height || 0));
      return width * height;
    }

    // The highest hooks.scoreVideo score among candidates wins; a null score
    // skips the video. Falls back to the first video on the page.
    function pickPrimaryVideo() {
      const videos = Array.from(document.querySelectorAll('video'));
      if (!videos.length) {
        return null;
      }
      let best = null;
      let bestScore = -1;
      for (const video of videos) {
        if (!hooks.isVideoCandidate(video)) {
          continue;
        }
        const score = hooks.scoreVideo(video);
        if (score !== null && score > bestScore) {
          bestScore = score;
          best = video;
        }
      }
      return best || videos[0] || null;
    }

    function syncActiveVideo(preferred) {
      state.activeVideo = preferred && hooks.isVideoCandidate(preferred)
        ? preferred
        : pickPrimaryVideo();
      return state.activeVideo;
    }

    function pauseAllManagedMedia() {
      Array.from(document.querySelectorAll('video, audio')).forEach((node) => {
        if (!(node instanceof window.HTMLMediaElement) || node.paused || node.ended) {
          return;
        }
        try {
          node.pause();
        } catch (error) {
          // Ignore pause failures from site-specific players.
        }
      });
    }

    function ensurePageBridgeInjected() {
      if (document.getElementById(config.pageBridgeScriptId)) {
        return;
      }
      const runtime = chrome ? chrome.runtime : null;
      if (!runtime || typeof runtime.getURL !== 'function') {
        return;
      }
      const script = document.createElement('script');
      script.id = config.pageBridgeScriptId;
      script.src = runtime.getURL(PAGE_BRIDGE_SCRIPT_PATH);
      script.async = false;
      const target = document.documentElement || document.head || document.body;
      if (!target) {
        return;
      }
      target.appendChild(script);
    }

    let pageBridgeRequestSeq = 0;

    // Asks youtube-auto-pip-page.js, running in the page's own world, to exit PiP.
    function requestPageBridgeExitPiP(timeoutMs) {
      return new Promise((resolve) => {
        if (typeof window.CustomEvent !== 'function') {
          resolve({ ok: false, reason: 'no-custom-event' });
          return;
        }
        ensurePageBridgeInjected();
        const requestId = ++pageBridgeRequestSeq;
        let done = false;
        const finish = (result) => {
          if (done) {
            return;
          }
          done = true;
          window.removeEventListener(PAGE_BRIDGE_RESPONSE_EVENT, onResponse, true);
          if (timer) {
            clearTimeout(timer);
          }
          resolve(result || { ok: false });
        };
        const onResponse = (event) => {
          const detail = event && event.detail ? event.detail : {};
          if (Number(detail.requestId || 0) !== requestId) {
            return;
          }
          finish({
            ok: true,
            attempted: Boolean(detail.attempted),
            before: Boolean(detail.before),
            after: Boolean(detail.after),
            error: String(detail.error || '')
          });
        };
        window.addEventListener(PAGE_BRIDGE_RESPONSE_EVENT, onResponse, true);
        const timer = setTimeout(() => {
          finish({ ok: false, reason: 'timeout' });
        }, Math.max(120, Number(timeoutMs || PAGE_BRIDGE_EXIT_TIMEOUT_MS)));
        window.dispatchEvent(new window.CustomEvent(PAGE_BRIDGE_REQUEST_EVENT, {
          detail: { requestId: requestId }
        }));
      });
    }

    async function maybeExitPiP() {
      if (!canExitPiP() || state.enteringPiP || state.exitingPiP) {
        return false;
      }
      if (!state.managedPiP && !document.pictureInPictureElement) {
        await releasePiPOwnership();
        return true;
      }
      state.exitingPiP = true;
      state.suppressEnterUntil = Date.now() + config.enterSuppressAfterExitMs;
      try {
        await sendRuntimeMessage(
          { action: config.mainWorldExitAction },
          { ms: MAIN_WORLD_EXIT_TIMEOUT_MS, minMs: 160 }
        );
        if (document.pictureInPictureElement) {
          await requestPageBridgeExitPiP(PAGE_BRIDGE_EXIT_TIMEOUT_MS);
        }
        if (hooks.afterExitAttempt) {
          hooks.afterExitAttempt();
        }
        if (!document.pictureInPictureElement) {
          return true;
        }
        await document.exitPictureInPicture();
        return !document.pictureInPictureElement;
      } catch (error) {
        // exitPictureInPicture rejects when PiP already ended on its own.
        return false;
      } finally {
        state.exitingPiP = false;
        state.managedPiP = false;
        if (hooks.afterExitAttempt) {
          hooks.afterExitAttempt();
        }
        await releasePiPOwnership();
      }
    }

    async function forceSurrenderPiP(reason) {
      const isHidden = document.visibilityState === 'hidden';
      if (isHidden) {
        clearPlaybackRecoveryState();
      }
      state.suppressEnterUntil = Date.now() + config.enterSuppressAfterVisibleMs;
      try {
        await maybeExitPiP();
      } catch (error) {
        // Best effort only.
      }
      if (isHidden) {
        pauseAllManagedMedia();
      }
      state.managedPiP = false;
      await releasePiPOwnership();
      return { ok: true, reason: reason || 'surrendered' };
    }

    // The background asks this tab to give up PiP when another tab takes it.
    function bindRuntimeMessageListener() {
      if (state.runtimeMessageHandlerBound) {
        return;
      }
      if (!chrome || !chrome.runtime || !chrome.runtime.onMessage ||
          typeof chrome.runtime.onMessage.addListener !== 'function') {
        return;
      }
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (!message || message.action !== 'lumno:pip-force-surrender') {
          return;
        }
        forceSurrenderPiP(message.reason ? String(message.reason) : '')
          .then((result) => {
            sendResponse(result);
          })
          .catch((error) => {
            sendResponse({
              ok: false,
              reason: error && error.message ? error.message : String(error || 'surrender-failed')
            });
          });
        return true;
      });
      state.runtimeMessageHandlerBound = true;
    }

    function bindMediaSessionAutoPiP() {
      if (state.mediaSessionHandlerBound) {
        return;
      }
      if (!navigator.mediaSession || typeof navigator.mediaSession.setActionHandler !== 'function') {
        return;
      }
      try {
        navigator.mediaSession.setActionHandler('enterpictureinpicture', async () => {
          await hooks.maybeEnterPiP('media_session_action');
        });
        state.mediaSessionHandlerBound = true;
      } catch (error) {
        // Older browser versions may not support this action type.
      }
    }

    // Retries entering PiP while the tab stays hidden: once after the
    // suppression window or the retry delay, then again while
    // state.hiddenRetryBudget lasts.
    function scheduleDeferredEnterPiP(reason) {
      if (!state.autoPipEnabled) {
        return;
      }
      clearEnterRetryTimer();
      if (document.visibilityState !== 'hidden') {
        return;
      }
      const now = Date.now();
      const suppressUntil = Number(state.suppressEnterUntil || 0);
      const baseDelay = hooks.getHiddenRetryDelayMs
        ? hooks.getHiddenRetryDelayMs()
        : MIN_DEFERRED_ENTER_DELAY_MS;
      const delay = suppressUntil > now
        ? (suppressUntil - now + MIN_DEFERRED_ENTER_DELAY_MS)
        : baseDelay;
      state.enterRetryTimer = setTimeout(async () => {
        state.enterRetryTimer = null;
        if (document.visibilityState !== 'hidden') {
          return;
        }
        const entered = await hooks.maybeEnterPiP(reason || 'deferred_hidden_retry');
        if (entered || document.visibilityState !== 'hidden' || state.enterRetryTimer) {
          return;
        }
        if (Number(state.hiddenRetryBudget || 0) <= 0) {
          return;
        }
        state.hiddenRetryBudget = Math.max(0, Number(state.hiddenRetryBudget || 0) - 1);
        scheduleDeferredEnterPiP(`${reason || 'deferred_hidden_retry'}_loop`);
      }, Math.max(MIN_DEFERRED_ENTER_DELAY_MS, delay));
    }

    // Records, as the tab hides, whether inline playback should resume later.
    function capturePlaybackStateOnHide() {
      const video = syncActiveVideo(state.lastManagedVideo || state.activeVideo);
      const shouldTrackRecovery = state.autoPipEnabled || state.managedPiP ||
        Boolean(document.pictureInPictureElement);
      state.wasPlayingBeforeHide = Boolean(video && isVideoPlaying(video) && !video.ended);
      state.shouldResumeInlinePlayback = Boolean(
        shouldTrackRecovery &&
        (state.wasPlayingBeforeHide || state.managedPiP || document.pictureInPictureElement)
      );
    }

    function onLeavePictureInPicture() {
      state.managedPiP = false;
      if (document.visibilityState === 'visible') {
        hooks.scheduleVisibleRecovery();
      }
    }

    function handlePageReturn() {
      if (hooks.onPageReturn) {
        hooks.onPageReturn();
      }
      state.suppressEnterUntil = Date.now() + config.enterSuppressAfterVisibleMs;
      clearEnterRetryTimer();
      hooks.scheduleVisibleRecovery();
    }

    function bindPageReturnListeners() {
      window.addEventListener('focus', handlePageReturn, true);
      window.addEventListener('pageshow', handlePageReturn, true);
    }

    return Object.freeze({
      setAutoPipEnabled,
      isDocumentPiPActive,
      sendRuntimeMessage,
      requestPiPOwnership,
      releasePiPOwnership,
      clearEnterRetryTimer,
      clearRecoveryTimer,
      clearPlaybackRecoveryState,
      syncAutoPipEnabledSetting,
      canEnterPiP,
      canExitPiP,
      isProbablyHiddenByStyles,
      getRectArea,
      pickPrimaryVideo,
      syncActiveVideo,
      ensurePageBridgeInjected,
      maybeExitPiP,
      bindRuntimeMessageListener,
      bindMediaSessionAutoPiP,
      scheduleDeferredEnterPiP,
      capturePlaybackStateOnHide,
      onLeavePictureInPicture,
      bindPageReturnListeners
    });
  }

  return Object.freeze({
    AUTO_PIP_ENABLED_STORAGE_KEY,
    normalizeAutoPipEnabled,
    isVideoPlaying,
    warnUnexpected,
    createAutoPipCore
  });
});
