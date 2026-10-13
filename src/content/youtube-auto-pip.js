(function () {
  if (window._x_lumno_youtube_auto_pip_2026_unique_) {
    return;
  }
  window._x_lumno_youtube_auto_pip_2026_unique_ = true;

  if (window.top !== window.self) {
    return;
  }

  const host = String(location.hostname || "").toLowerCase();
  if (!host || !/(^|\.)youtube\.com$/.test(host)) {
    return;
  }
  const state = {
    autoPipEnabled: false,
    activeVideo: null,
    enteringPiP: false,
    exitingPiP: false,
    managedPiP: false,
    mediaSessionHandlerBound: false,
    lastManagedVideo: null,
    recoveryTimer: null,
    enterRetryTimer: null,
    hiddenRetryBudget: 0,
    suppressEnterUntil: 0,
    uiRecoverySuppressUntil: 0,
    shouldResumeInlinePlayback: false,
    wasPlayingBeforeHide: false,
    ownerToken: "",
    runtimeMessageHandlerBound: false
  };
  const RECOVERY_RELOAD_GUARD_KEY = "_x_lumno_yt_pip_recovery_reload_at_2026_";
  const RECOVERY_RELOAD_GUARD_MS = 15000;
  const PAGE_BRIDGE_SCRIPT_ID = "__lumno_yt_auto_pip_page_bridge_script_2026__";
  const ENTER_SUPPRESS_AFTER_EXIT_MS = 1200;
  const ENTER_SUPPRESS_AFTER_VISIBLE_MS = 1400;
  // After the tab is shown again, keep undoing PiP and mini-player leftovers:
  // quickly at first, then more slowly; reload as a last resort.
  const VISIBLE_RECOVERY_MAX_ATTEMPTS = 10;
  const VISIBLE_RECOVERY_FAST_ATTEMPTS = 3;
  const VISIBLE_RECOVERY_FAST_DELAY_MS = 120;
  const VISIBLE_RECOVERY_SLOW_DELAY_MS = 320;
  const VISIBLE_RECOVERY_UI_DEFER_MS = 160;
  const HARD_RECOVERY_ATTEMPT = 8;

  const CORE = globalThis.LumnoAutoPipCore;
  const isVideoPlaying = CORE.isVideoPlaying;
  const core = CORE.createAutoPipCore({
    state,
    window,
    document,
    navigator,
    chrome,
    providerStorage: globalThis.LumnoSettings.getProviderStorage(chrome),
    config: {
      pageBridgeScriptId: PAGE_BRIDGE_SCRIPT_ID,
      mainWorldExitAction: "ytForceExitPiPInMainWorld",
      enterSuppressAfterExitMs: ENTER_SUPPRESS_AFTER_EXIT_MS,
      enterSuppressAfterVisibleMs: ENTER_SUPPRESS_AFTER_VISIBLE_MS
    },
    hooks: {
      maybeEnterPiP,
      scheduleVisibleRecovery,
      isVideoCandidate,
      scoreVideo,
      afterExitAttempt: forceUnminimizeViaPlayerApi
    }
  });
  const syncActiveVideo = core.syncActiveVideo;
  const clearEnterRetryTimer = core.clearEnterRetryTimer;
  const clearRecoveryTimer = core.clearRecoveryTimer;
  const maybeExitPiP = core.maybeExitPiP;

  core.syncAutoPipEnabledSetting();

  function shouldAllowRecoveryReload() {
    try {
      const raw = sessionStorage.getItem(RECOVERY_RELOAD_GUARD_KEY);
      const lastAt = Number(raw || 0);
      if (!lastAt) {
        return true;
      }
      return (Date.now() - lastAt) > RECOVERY_RELOAD_GUARD_MS;
    } catch (error) {
      return true;
    }
  }

  function markRecoveryReloadNow() {
    try {
      sessionStorage.setItem(RECOVERY_RELOAD_GUARD_KEY, String(Date.now()));
    } catch (error) {
      // Ignore storage write failures.
    }
  }

  function isVideoCandidate(video) {
    return Boolean(video) &&
      !video.disablePictureInPicture &&
      Number(video.videoWidth || 0) > 0 &&
      Number(video.videoHeight || 0) > 0;
  }

  // A playing video always wins; otherwise the largest one does.
  function scoreVideo(video) {
    const playingBoost = isVideoPlaying(video) ? 1000000000 : 0;
    return playingBoost + core.getRectArea(video);
  }

  function getFirstHTMLElement(selectors) {
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      if (node instanceof HTMLElement) {
        return node;
      }
    }
    return null;
  }

  function getYouTubePiPButton() {
    return getFirstHTMLElement([
      ".ytp-pip-button",
      ".ytp-right-controls .ytp-button.ytp-pip-button"
    ]);
  }

  function getYouTubeMiniPlayerButton() {
    return getFirstHTMLElement([
      ".ytp-miniplayer-button",
      ".ytp-right-controls .ytp-button.ytp-miniplayer-button"
    ]);
  }

  function isPressedButton(button) {
    if (!button) {
      return false;
    }
    const ariaPressed = button.getAttribute("aria-pressed");
    if (ariaPressed === "true") {
      return true;
    }
    if (button.classList.contains("ytp-button-active") || button.classList.contains("ytp-active")) {
      return true;
    }
    return false;
  }

  function clickButton(button) {
    if (!button) {
      return false;
    }
    try {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      return true;
    } catch (error) {
      return false;
    }
  }

  function getYouTubePiPToggleButtonIfPressed() {
    const pipButton = getYouTubePiPButton();
    if (isPressedButton(pipButton)) {
      return pipButton;
    }
    const miniplayerButton = getYouTubeMiniPlayerButton();
    if (isPressedButton(miniplayerButton)) {
      return miniplayerButton;
    }
    return null;
  }

  function isInlineVideoVisible(video) {
    if (!video || !video.isConnected) {
      return false;
    }
    if (core.isProbablyHiddenByStyles(video)) {
      return false;
    }
    const rect = video.getBoundingClientRect();
    return Number(rect.width || 0) >= 160 && Number(rect.height || 0) >= 90;
  }

  function isElementVisible(element) {
    if (!element || !(element instanceof Element) || !element.isConnected) {
      return false;
    }
    const style = window.getComputedStyle(element);
    if (!style) {
      return true;
    }
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity || 1) === 0) {
      return false;
    }
    const rect = element.getBoundingClientRect();
    return Number(rect.width || 0) > 0 && Number(rect.height || 0) > 0;
  }

  function markUiRecoverySuppressed(ms) {
    const duration = Math.max(0, Number(ms || 0));
    if (!duration) {
      return;
    }
    state.uiRecoverySuppressUntil = Math.max(
      Number(state.uiRecoverySuppressUntil || 0),
      Date.now() + duration
    );
  }

  function isSettingsMenuExpanded() {
    const settingsButton = document.querySelector(".ytp-settings-button");
    if (settingsButton instanceof Element && settingsButton.getAttribute("aria-expanded") === "true") {
      return true;
    }
    const visibleMenu = document.querySelector(".ytp-settings-menu, .ytp-panel-menu");
    return isElementVisible(visibleMenu);
  }

  function shouldDeferVisibleRecoveryForUi() {
    const suppressUntil = Number(state.uiRecoverySuppressUntil || 0);
    if (Date.now() < suppressUntil) {
      return true;
    }
    if (isSettingsMenuExpanded()) {
      markUiRecoverySuppressed(380);
      return true;
    }
    return false;
  }

  function hasYouTubeMiniPlayerState() {
    return Boolean(
      document.querySelector(
        "ytd-app[miniplayer-active_], ytd-app[miniplayer-is-active], ytd-app[miniplayer-active]"
      )
    );
  }

  function forceRestoreYouTubeInlineContainer() {
    const app = document.querySelector("ytd-app");
    if (app && app instanceof Element) {
      app.removeAttribute("miniplayer-active_");
      app.removeAttribute("miniplayer-is-active");
      app.removeAttribute("miniplayer-active");
    }

    document.querySelectorAll("ytd-watch-flexy[hidden], #player[hidden], #movie_player[hidden]").forEach((node) => {
      if (node instanceof HTMLElement) {
        node.hidden = false;
      }
      if (node instanceof Element) {
        node.removeAttribute("hidden");
      }
    });

    document.querySelectorAll(".ytp-player-minimized").forEach((node) => {
      if (node instanceof Element) {
        node.classList.remove("ytp-player-minimized");
      }
    });
    document.body.classList.remove("ytp-player-minimized");
    document.documentElement.classList.remove("ytp-player-minimized");
  }

  function getYouTubePlayerApi() {
    const moviePlayer = document.getElementById("movie_player");
    if (moviePlayer && typeof moviePlayer === "object") {
      return moviePlayer;
    }
    const ytdPlayer = document.querySelector("ytd-player");
    if (ytdPlayer && typeof ytdPlayer.getPlayer === "function") {
      try {
        const player = ytdPlayer.getPlayer();
        if (player && typeof player === "object") {
          return player;
        }
      } catch (error) {
        // Ignore API retrieval errors.
      }
    }
    return null;
  }

  function callPlayerMethod(player, methodName, args) {
    if (!player || typeof player[methodName] !== "function") {
      return { called: false, value: undefined };
    }
    try {
      return { called: true, value: player[methodName].apply(player, Array.isArray(args) ? args : []) };
    } catch (error) {
      return { called: false, value: undefined };
    }
  }

  function forceUnminimizeViaPlayerApi() {
    const player = getYouTubePlayerApi();
    if (!player) {
      return false;
    }
    let changed = false;
    const candidates = [
      [false],
      [0],
      [null],
      []
    ];
    for (const args of candidates) {
      const result = callPlayerMethod(player, "setMinimized", args);
      changed = result.called || changed;
    }
    return changed;
  }

  function tryExitYouTubeViaPlayerApi(video) {
    const player = getYouTubePlayerApi();
    if (!player) {
      return false;
    }

    let changed = false;
    changed = forceUnminimizeViaPlayerApi() || changed;
    const miniActive = callPlayerMethod(player, "isMiniplayerActive", []).value;
    if (miniActive === true) {
      const toggled = callPlayerMethod(player, "toggleMiniplayer", []);
      changed = toggled.called || changed;
    }

    const exitCandidates = [
      ["exitPictureInPicture", []],
      ["togglePictureInPicture", []],
      ["togglePip", []],
      ["setPictureInPicture", [false]]
    ];
    for (const [name, args] of exitCandidates) {
      const result = callPlayerMethod(player, name, args);
      changed = result.called || changed;
    }

    if (video && isVideoPlaying(video) && !isInlineVideoVisible(video)) {
      const paused = callPlayerMethod(player, "pauseVideo", []);
      const played = callPlayerMethod(player, "playVideo", []);
      changed = paused.called || played.called || changed;
    }

    return changed;
  }

  function looksLikeYouTubeGhostPiP(video) {
    if (document.pictureInPictureElement) {
      return true;
    }
    if (hasYouTubeMiniPlayerState()) {
      return true;
    }
    if (isPressedButton(getYouTubePiPButton()) || isPressedButton(getYouTubeMiniPlayerButton())) {
      return true;
    }
    if (video && isVideoPlaying(video) && !isInlineVideoVisible(video)) {
      return true;
    }
    return false;
  }

  function tryExitYouTubePipLikeModes(video) {
    const ghostState = looksLikeYouTubeGhostPiP(video);
    if (!ghostState) {
      return false;
    }
    let changed = false;
    const pipButton = getYouTubePiPButton();
    const miniButton = getYouTubeMiniPlayerButton();
    if (pipButton && isPressedButton(pipButton)) {
      changed = clickButton(pipButton) || changed;
    }
    if (miniButton && (isPressedButton(miniButton) || hasYouTubeMiniPlayerState())) {
      changed = clickButton(miniButton) || changed;
    }
    changed = tryExitYouTubeViaPlayerApi(video) || changed;
    return changed;
  }

  function trySoftResetPlayerRender(video) {
    if (!video) {
      return;
    }
    try {
      // Nudges Chromium compositor to repaint when YouTube leaves stale mini-player state.
      video.style.transform = "translateZ(0)";
      requestAnimationFrame(() => {
        video.style.transform = "";
      });
    } catch (error) {
      // Ignore style mutation errors.
    }
  }

  function maybeHardRecoverByReload(video) {
    if (document.visibilityState !== "visible") {
      return;
    }
    if (!video || !isVideoPlaying(video) || isInlineVideoVisible(video) || document.pictureInPictureElement) {
      return;
    }
    const url = new URL(location.href);
    const seconds = Math.max(0, Math.floor(Number(video.currentTime || 0)));
    if (seconds > 0) {
      url.searchParams.set("t", String(seconds));
    }
    url.searchParams.set("autoplay", "1");
    location.replace(url.toString());
  }

  function forceReloadToReturnInlinePlayback() {
    if (document.visibilityState !== "visible") {
      return false;
    }
    if (!shouldAllowRecoveryReload()) {
      return false;
    }

    let seconds = 0;
    const pipElement = document.pictureInPictureElement;
    if (pipElement && pipElement instanceof HTMLVideoElement) {
      seconds = Math.max(0, Math.floor(Number(pipElement.currentTime || 0)));
    }

    if (!seconds) {
      const fallbackVideo = syncActiveVideo(state.lastManagedVideo || state.activeVideo);
      if (fallbackVideo) {
        seconds = Math.max(0, Math.floor(Number(fallbackVideo.currentTime || 0)));
      }
    }

    const url = new URL(location.href);
    if (seconds > 0) {
      url.searchParams.set("t", String(seconds));
    }
    url.searchParams.set("autoplay", "1");
    url.searchParams.set("lumno_pip_recover", "1");
    markRecoveryReloadNow();
    location.replace(url.toString());
    return true;
  }

  async function maybeEnterPiP(reason) {
    if (!state.autoPipEnabled) {
      return false;
    }
    if (core.isDocumentPiPActive()) {
      return false;
    }
    if (!core.canEnterPiP() || !core.canExitPiP() || state.enteringPiP || state.exitingPiP) {
      return false;
    }
    if (Date.now() < Number(state.suppressEnterUntil || 0)) {
      core.scheduleDeferredEnterPiP(`${reason || "enter"}_suppressed_retry`);
      return false;
    }
    if (document.visibilityState !== "hidden") {
      return false;
    }
    if (document.pictureInPictureElement) {
      return true;
    }

    const activeVideo = syncActiveVideo();
    if (!isVideoPlaying(activeVideo)) {
      return false;
    }

    const ownershipResult = await core.requestPiPOwnership("video");
    if (!ownershipResult.granted) {
      core.clearPlaybackRecoveryState();
      return false;
    }

    state.enteringPiP = true;
    try {
      await activeVideo.requestPictureInPicture();
      state.managedPiP = true;
      state.lastManagedVideo = activeVideo;
      clearEnterRetryTimer();
      return true;
    } catch (error) {
      // Best effort: hidden-tab requests can fail without user activation.
      return false;
    } finally {
      state.enteringPiP = false;
      if (!state.managedPiP) {
        await core.releasePiPOwnership();
      }
    }
  }

  function recoverInlinePlaybackIfNeeded(attemptIndex) {
    if (document.visibilityState !== "visible") {
      return;
    }
    if (!state.shouldResumeInlinePlayback) {
      return;
    }

    if (document.pictureInPictureElement) {
      return;
    }

    const video = syncActiveVideo(state.lastManagedVideo || state.activeVideo);
    forceUnminimizeViaPlayerApi();
    const pressedPipButton = getYouTubePiPToggleButtonIfPressed();
    const shouldTryYTReset = Boolean(pressedPipButton) || looksLikeYouTubeGhostPiP(video);

    if (shouldTryYTReset) {
      if (pressedPipButton) {
        clickButton(pressedPipButton);
      }
      tryExitYouTubePipLikeModes(video);
      forceUnminimizeViaPlayerApi();
      forceRestoreYouTubeInlineContainer();
      trySoftResetPlayerRender(video);
      window.dispatchEvent(new Event("resize"));
    }

    if (video && video.paused && !video.ended) {
      video.play().catch(() => {
        // Ignore autoplay/activation errors on recovery.
      });
    }

    if (attemptIndex >= HARD_RECOVERY_ATTEMPT) {
      maybeHardRecoverByReload(video);
    }
  }

  function scheduleVisibleRecovery() {
    clearRecoveryTimer();
    if (!state.shouldResumeInlinePlayback &&
        !state.managedPiP &&
        !document.pictureInPictureElement) {
      return;
    }

    let attempts = 0;
    const run = async () => {
      if (shouldDeferVisibleRecoveryForUi()) {
        state.recoveryTimer = setTimeout(() => {
          run();
        }, VISIBLE_RECOVERY_UI_DEFER_MS);
        return;
      }
      attempts += 1;
      await maybeExitPiP();
      recoverInlinePlaybackIfNeeded(attempts);

      if (document.visibilityState !== "visible") {
        clearRecoveryTimer();
        return;
      }

      const stillInPiP = Boolean(document.pictureInPictureElement);
      const video = syncActiveVideo(state.lastManagedVideo || state.activeVideo);
      const stillGhost = looksLikeYouTubeGhostPiP(video);
      if ((stillInPiP || stillGhost) && attempts < VISIBLE_RECOVERY_MAX_ATTEMPTS) {
        const delay = attempts < VISIBLE_RECOVERY_FAST_ATTEMPTS
          ? VISIBLE_RECOVERY_FAST_DELAY_MS
          : VISIBLE_RECOVERY_SLOW_DELAY_MS;
        state.recoveryTimer = setTimeout(() => {
          run();
        }, delay);
        return;
      }
      if (stillInPiP || stillGhost) {
        forceReloadToReturnInlinePlayback();
      }
      clearRecoveryTimer();
    };

    run();
  }

  function handleVisibilityChange() {
    if (document.visibilityState === "hidden") {
      core.capturePlaybackStateOnHide();
      clearRecoveryTimer();
      core.scheduleDeferredEnterPiP("visibility_hidden_retry");
      maybeEnterPiP("visibility_hidden");
      return;
    }
    if (document.visibilityState === "visible") {
      clearEnterRetryTimer();
      state.suppressEnterUntil = Date.now() + ENTER_SUPPRESS_AFTER_VISIBLE_MS;
      scheduleVisibleRecovery();
    }
  }

  function onVideoEvent(event) {
    const target = event && event.target;
    if (!target || target.tagName !== "VIDEO") {
      return;
    }
    syncActiveVideo(target);
    if (event.type === "pause" || event.type === "ended") {
      state.shouldResumeInlinePlayback = false;
      state.wasPlayingBeforeHide = false;
    }

    if (event.type === "play" || event.type === "playing") {
      state.wasPlayingBeforeHide = true;
      if (document.visibilityState === "hidden") {
        state.shouldResumeInlinePlayback = true;
      }
    }

    if (event.type === "play" && document.visibilityState === "hidden") {
      maybeEnterPiP("video_play_hidden");
      return;
    }

    if (event.type === "ended" &&
        target === document.pictureInPictureElement &&
        state.managedPiP) {
      maybeExitPiP();
    }
  }

  function onEnterPictureInPicture(event) {
    if (state.enteringPiP) {
      state.managedPiP = true;
      return;
    }
    const target = event && event.target;
    state.managedPiP = Boolean(target && target === state.activeVideo);
  }

  function init() {
    if (!core.canExitPiP()) {
      return;
    }
    try {
      const url = new URL(location.href);
      if (url.searchParams.has("lumno_pip_recover")) {
        url.searchParams.delete("lumno_pip_recover");
        history.replaceState(history.state, "", url.toString());
      }
    } catch (error) {
      // Ignore URL cleanup errors.
    }
    core.ensurePageBridgeInjected();
    syncActiveVideo();
    core.bindMediaSessionAutoPiP();
    core.bindRuntimeMessageListener();

    document.addEventListener("visibilitychange", handleVisibilityChange, true);
    document.addEventListener("play", onVideoEvent, true);
    document.addEventListener("playing", onVideoEvent, true);
    document.addEventListener("pause", onVideoEvent, true);
    document.addEventListener("ended", onVideoEvent, true);
    document.addEventListener("enterpictureinpicture", onEnterPictureInPicture, true);
    document.addEventListener("leavepictureinpicture", core.onLeavePictureInPicture, true);
    document.addEventListener("pointerdown", (event) => {
      const target = event && event.target instanceof Element ? event.target : null;
      if (!target || !target.closest) {
        return;
      }
      if (target.closest(".ytp-settings-button, .ytp-panel-menu, .ytp-settings-menu")) {
        markUiRecoverySuppressed(1200);
      }
    }, true);
    core.bindPageReturnListeners();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
    return;
  }
  init();
})();
