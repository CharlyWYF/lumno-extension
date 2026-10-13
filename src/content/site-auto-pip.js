(function () {
  if (window._x_lumno_site_auto_pip_2026_unique_) {
    return;
  }
  window._x_lumno_site_auto_pip_2026_unique_ = true;

  if (window.top !== window.self) {
    return;
  }

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
    lastVisibleAt: 0,
    hadUserGesture: false,
    mediaSessionHandlerBound: false,
    hiddenRetryBudget: 0,
    shouldResumeInlinePlayback: false,
    wasPlayingBeforeHide: false,
    ownerToken: '',
    runtimeMessageHandlerBound: false,
    douyinModalReloadAt: 0
  };

  const ENTER_SUPPRESS_AFTER_EXIT_MS = 1100;
  const ENTER_SUPPRESS_AFTER_VISIBLE_MS = 1300;
  const QUICK_REHIDE_BYPASS_MS = 900;
  const DEFAULT_HIDDEN_RETRY_LIMIT = 4;
  const DEFAULT_HIDDEN_RETRY_DELAY_MS = 220;
  const MIN_VISIBLE_WIDTH = 220;
  const MIN_VISIBLE_HEIGHT = 124;
  const MIN_VISIBLE_AREA = 60000;
  const PAGE_BRIDGE_SCRIPT_ID = "__lumno_site_auto_pip_page_bridge_script_2026__";
  const DOUYIN_MODAL_RECOVERY_RELOAD_GUARD_MS = 15000;
  // Timeouts for asking the background to run PiP code in the page's world.
  const MAIN_WORLD_SETUP_TIMEOUT_MS = 960;
  const MAIN_WORLD_ENTER_TIMEOUT_MS = 920;
  // After the tab is shown again, retry leaving PiP a few times: quickly at
  // first, then more slowly while the site's player settles.
  const VISIBLE_RECOVERY_MAX_ATTEMPTS = 5;
  const VISIBLE_RECOVERY_FAST_ATTEMPTS = 3;
  const VISIBLE_RECOVERY_FAST_DELAY_MS = 120;
  const VISIBLE_RECOVERY_SLOW_DELAY_MS = 280;

  const host = String(location.hostname || "").toLowerCase();
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
      mainWorldExitAction: "forceExitPiPInMainWorld",
      enterSuppressAfterExitMs: ENTER_SUPPRESS_AFTER_EXIT_MS,
      enterSuppressAfterVisibleMs: ENTER_SUPPRESS_AFTER_VISIBLE_MS
    },
    hooks: {
      maybeEnterPiP,
      scheduleVisibleRecovery,
      isVideoCandidate,
      scoreVideo,
      getHiddenRetryDelayMs,
      onPageReturn: markPlaybackIntentFromActiveVideo
    }
  });
  const syncActiveVideo = core.syncActiveVideo;
  const clearEnterRetryTimer = core.clearEnterRetryTimer;
  const clearRecoveryTimer = core.clearRecoveryTimer;
  const maybeExitPiP = core.maybeExitPiP;

  core.syncAutoPipEnabledSetting();
  const autoPipBlacklist = window.__lumnoAutoPipBlacklist2026;
  if (host && autoPipBlacklist && Array.isArray(autoPipBlacklist.hostRules)) {
    const isBlacklisted = autoPipBlacklist.hostRules.some((rule) => {
      if (!(rule instanceof RegExp)) {
        return false;
      }
      return rule.test(host);
    });
    if (isBlacklisted) {
      return;
    }
  }

  const IQIYI_PLAYER_PROFILE = {
    selectors: [
      ".iqp-player video",
      ".iqp-player-videolayer video",
      "#flashbox video",
      "#player video"
    ],
    rejectSelectors: [
      ".player_outer_video video",
      "video[outer='1']"
    ],
    allowDisablePiP: true,
    minVisibleArea: 38000,
    allowEnterWhenHiddenVideo: true,
    autoResumeOnHiddenEnter: true,
    allowNoUserGesture: true
  };

  // Per-site player profiles, keyed by site. The first profile whose test
  // matches the host applies. mainWorldEnter marks sites whose player only
  // enters PiP reliably from the page's own world: the background runs
  // `action` there (after `setupAction`, when set). With requiresPlaying, the
  // main-world attempt is skipped unless the video is playing.
  const SITE_PROFILES = {
    douyin: {
      test: /(^|\.)douyin\.com$/,
      selectors: [
        ".xgplayer video",
        ".xgplayer-video-wrap video",
        ".xg-video-container video",
        "[class*='videoPlayer'] video",
        "[class*='Player'] video",
        "video"
      ],
      rejectSelectors: [
        ".discover-video-card-item video",
        ".waterfall-videoCardContainer video",
        ".jingxuanVideoCard video"
      ],
      allowDisablePiP: true,
      minVisibleArea: 24000,
      allowEnterWhenHiddenVideo: true,
      autoResumeOnHiddenEnter: true,
      allowNoUserGesture: true,
      allowEnterWhenNotPlaying: true,
      hiddenRetryLimit: 24,
      hiddenRetryDelayMs: 180,
      mainWorldEnter: {
        action: "siteTryEnterPiPInMainWorld",
        requiresPlaying: true
      },
      // The Jingxuan feed's video modal can lose its player while in PiP;
      // reloading the modal URL is the only reliable way back.
      reloadsJingxuanModal: true
    },
    bilibili: {
      test: /(^|\.)bilibili\.com$/,
      selectors: [
        ".bpx-player-video-wrap video",
        ".bilibili-player-video-wrap video",
        ".bilibili-player-video video",
        "#bilibili-player video",
        "#player video"
      ]
    },
    bilibiliTv: {
      test: /(^|\.)bilibili\.tv$/,
      selectors: [
        ".bpx-player-video-wrap video",
        ".bilibili-player-video-wrap video",
        ".bilibili-player-video video",
        "#bilibili-player video",
        "#player video"
      ]
    },
    youku: {
      test: /(^|\.)youku\.com$/,
      selectors: [
        ".html5player-video video",
        ".youku-player video",
        "#player video",
        "#ykPlayer video"
      ]
    },
    tencentVideo: {
      test: /(^|\.)v\.qq\.com$/,
      selectors: [
        ".txp_video_container video",
        ".txp-player video",
        ".txp_videos_container video",
        ".txp_video video",
        ".mod_player video",
        "#mod_player video",
        "#player video",
        "video"
      ],
      rejectSelectors: [
        "[class*='preview'] video",
        "[class*='recommend'] video"
      ],
      allowDisablePiP: true,
      allowEnterWhenHiddenVideo: true,
      autoResumeOnHiddenEnter: true,
      allowNoUserGesture: true,
      allowEnterWhenNotPlaying: true,
      minVisibleArea: 30000,
      hiddenRetryLimit: 16,
      hiddenRetryDelayMs: 180
    },
    iqiyi: Object.assign({
      test: /(^|\.)iqiyi\.com$/,
      mainWorldEnter: {
        action: "iqiyiTryEnterPiPInMainWorld",
        setupAction: "iqiyiSetupAutoPiPInMainWorld"
      }
    }, IQIYI_PLAYER_PROFILE),
    // iQIYI's international site shares the player but not the main-world setup.
    iqiyiInternational: Object.assign({
      test: /(^|\.)iq\.com$/
    }, IQIYI_PLAYER_PROFILE),
    kuaishou: {
      test: /(^|\.)(kuaishou\.com|kwai\.com)$/,
      selectors: [
        ".ks-player video",
        ".video-player video",
        "[class*='player'] video",
        "video"
      ],
      rejectSelectors: [
        ".video-card video",
        ".sidebar video",
        "[class*='preview'] video"
      ],
      minVisibleArea: 36000
    },
    netflix: {
      test: /(^|\.)netflix\.com$/,
      selectors: [
        ".watch-video video",
        "[data-uia='video-canvas'] video",
        ".NFPlayer video",
        "video"
      ],
      rejectSelectors: [
        ".previewModal video",
        "[class*='preview'] video",
        "[class*='billboard'] video"
      ],
      minVisibleArea: 56000
    },
    vimeo: {
      test: /(^|\.)vimeo\.com$/,
      selectors: [
        ".vp-video video",
        ".player video",
        ".js-player video",
        "video"
      ],
      rejectSelectors: [
        ".vp-preview video",
        "[class*='thumbnail'] video"
      ]
    },
    dailymotion: {
      test: /(^|\.)dailymotion\.com$/,
      selectors: [
        ".dmp_Player video",
        ".dmp_VideoContainer video",
        "#player video",
        "video"
      ],
      rejectSelectors: [
        ".sd_video_list video",
        "[class*='preview'] video"
      ]
    },
    primeVideo: {
      test: /(^|\.)(primevideo\.com|amazon\.(com|co\.uk|de|co\.jp|in))$/,
      selectors: [
        ".webPlayerSDKContainer video",
        ".atvwebplayersdk-video video",
        "#dv-web-player video",
        "video"
      ],
      rejectSelectors: [
        "[class*='trailer'] video",
        "[class*='preview'] video"
      ],
      minVisibleArea: 56000
    },
    disneyPlus: {
      test: /(^|\.)(disneyplus\.com|hotstar\.com)$/,
      selectors: [
        ".btm-media-client-element video",
        ".video-container video",
        "[data-testid='videoPlayer'] video",
        "video"
      ],
      rejectSelectors: [
        "[class*='preview'] video",
        "[class*='trailer'] video"
      ],
      minVisibleArea: 56000
    },
    max: {
      test: /(^|\.)(max\.com|hbomax\.com)$/,
      selectors: [
        ".video-player video",
        ".player-container video",
        "[data-testid='video-player'] video",
        "video"
      ],
      rejectSelectors: [
        "[class*='preview'] video",
        "[class*='sizzle'] video"
      ],
      minVisibleArea: 56000
    },
    tiktok: {
      test: /(^|\.)tiktok\.com$/,
      selectors: [
        "[data-e2e='video-player'] video",
        ".tiktok-player video",
        "[class*='DivVideoContainer'] video",
        "video"
      ],
      rejectSelectors: [
        "[class*='recommend'] video",
        "[class*='preview'] video"
      ],
      allowEnterWhenHiddenVideo: true,
      autoResumeOnHiddenEnter: true,
      allowNoUserGesture: true,
      minVisibleArea: 26000
    },
    tubi: {
      test: /(^|\.)tubitv\.com$/,
      selectors: [
        ".video-js video",
        ".vjs-tech",
        "#video_player video",
        "video"
      ],
      rejectSelectors: [
        ".poster video",
        "[class*='preview'] video"
      ]
    },
    pluto: {
      test: /(^|\.)pluto\.tv$/,
      selectors: [
        ".video-js video",
        ".vjs-tech",
        ".player video",
        "video"
      ],
      rejectSelectors: [
        "[class*='grid'] video",
        "[class*='preview'] video"
      ]
    },
    twitch: {
      test: /(^|\.)twitch\.tv$/,
      selectors: [
        ".video-player video",
        ".persistent-player video",
        "[data-a-target='player-overlay-click-handler'] video",
        "video"
      ],
      rejectSelectors: [
        ".channel-root__player-container--theatre + * video",
        "[class*='preview'] video"
      ],
      minVisibleArea: 42000
    }
  };

  function getMatchedProfile() {
    const matched = Object.values(SITE_PROFILES).find((profile) => profile.test.test(host));
    return matched && typeof matched === "object" ? matched : null;
  }

  const matchedProfile = getMatchedProfile();
  const profileSelectors = matchedProfile && Array.isArray(matchedProfile.selectors)
    ? matchedProfile.selectors
    : [];
  const profileRejectSelectors = matchedProfile && Array.isArray(matchedProfile.rejectSelectors)
    ? matchedProfile.rejectSelectors
    : [];
  const mainWorldEnter = matchedProfile && matchedProfile.mainWorldEnter
    ? matchedProfile.mainWorldEnter
    : null;

  function isJingxuanModalUrl() {
    if (!matchedProfile || !matchedProfile.reloadsJingxuanModal) {
      return false;
    }
    try {
      const url = new URL(location.href);
      return url.pathname === "/jingxuan" && url.searchParams.has("modal_id");
    } catch (error) {
      return false;
    }
  }

  function requestMainWorldSetup() {
    if (!mainWorldEnter || !mainWorldEnter.setupAction) {
      return Promise.resolve({ ok: false, reason: "no-main-world-setup" });
    }
    return core.sendRuntimeMessage(
      { action: mainWorldEnter.setupAction },
      { ms: MAIN_WORLD_SETUP_TIMEOUT_MS, minMs: 200 }
    );
  }

  function getHiddenRetryLimit() {
    const value = Number(matchedProfile && matchedProfile.hiddenRetryLimit);
    if (Number.isFinite(value) && value >= 0) {
      return Math.floor(value);
    }
    return DEFAULT_HIDDEN_RETRY_LIMIT;
  }

  function getHiddenRetryDelayMs() {
    const value = Number(matchedProfile && matchedProfile.hiddenRetryDelayMs);
    if (Number.isFinite(value) && value >= 40) {
      return Math.floor(value);
    }
    return DEFAULT_HIDDEN_RETRY_DELAY_MS;
  }

  function getVisibleArea(video) {
    if (!video || typeof video.getBoundingClientRect !== "function") {
      return 0;
    }
    const rect = video.getBoundingClientRect();
    const vw = window.innerWidth || document.documentElement.clientWidth || 0;
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    if (vw <= 0 || vh <= 0) {
      return 0;
    }
    const left = Math.max(0, Math.min(vw, rect.left));
    const right = Math.max(0, Math.min(vw, rect.right));
    const top = Math.max(0, Math.min(vh, rect.top));
    const bottom = Math.max(0, Math.min(vh, rect.bottom));
    const width = Math.max(0, right - left);
    const height = Math.max(0, bottom - top);
    return width * height;
  }

  function isVideoVisibleEnough(video) {
    if (!video || !video.isConnected || core.isProbablyHiddenByStyles(video)) {
      return false;
    }
    const rect = video.getBoundingClientRect();
    const width = Number(rect.width || 0);
    const height = Number(rect.height || 0);
    if (width < MIN_VISIBLE_WIDTH || height < MIN_VISIBLE_HEIGHT) {
      return false;
    }
    const minArea = Number(matchedProfile && matchedProfile.minVisibleArea) > 0
      ? Number(matchedProfile.minVisibleArea)
      : MIN_VISIBLE_AREA;
    return getVisibleArea(video) >= minArea;
  }

  function hasAnyPlayingMedia() {
    const mediaNodes = Array.from(document.querySelectorAll("video, audio"));
    return mediaNodes.some((node) => {
      return node instanceof HTMLMediaElement &&
        !node.paused &&
        !node.ended &&
        Number(node.readyState || 0) >= 2;
    });
  }

  function shouldRecoverJingxuanModalByReload() {
    if (!isJingxuanModalUrl()) {
      return false;
    }
    const activeVideo = syncActiveVideo(state.lastManagedVideo || state.activeVideo);
    if (activeVideo && activeVideo.isConnected && isVideoVisibleEnough(activeVideo)) {
      return false;
    }
    return hasAnyPlayingMedia() || state.shouldResumeInlinePlayback;
  }

  function reloadJingxuanModalIfNeeded() {
    if (!shouldRecoverJingxuanModalByReload()) {
      return false;
    }
    const now = Date.now();
    if ((now - Number(state.douyinModalReloadAt || 0)) < DOUYIN_MODAL_RECOVERY_RELOAD_GUARD_MS) {
      return false;
    }
    state.douyinModalReloadAt = now;
    location.replace(location.href);
    return true;
  }

  function isLikelyAudible(video) {
    if (!video) {
      return false;
    }
    if (video.muted || Number(video.volume || 0) === 0) {
      return false;
    }
    if (typeof video.audioTracks === "object" && video.audioTracks && video.audioTracks.length > 0) {
      for (let i = 0; i < video.audioTracks.length; i += 1) {
        if (video.audioTracks[i] && video.audioTracks[i].enabled !== false) {
          return true;
        }
      }
      return false;
    }
    return true;
  }

  function isRejectedByProfile(video) {
    if (!video || profileRejectSelectors.length === 0) {
      return false;
    }
    for (const selector of profileRejectSelectors) {
      try {
        if (video.matches(selector)) {
          return true;
        }
      } catch (error) {
        // Ignore invalid selector and continue.
      }
      try {
        const node = document.querySelector(selector);
        if (!node) {
          continue;
        }
        if (node === video) {
          return true;
        }
        if (typeof node.contains === "function" && node.contains(video)) {
          return true;
        }
      } catch (error) {
        // Ignore invalid selector and continue.
      }
    }
    return false;
  }

  function isVideoCandidate(video) {
    if (isRejectedByProfile(video)) {
      return false;
    }
    const allowDisablePiP = Boolean(matchedProfile && matchedProfile.allowDisablePiP);
    return video instanceof HTMLVideoElement &&
      video.isConnected &&
      (allowDisablePiP || !video.disablePictureInPicture) &&
      Number(video.videoWidth || 0) > 0 &&
      Number(video.videoHeight || 0) > 0;
  }

  function hasProfileBoost(video) {
    if (!video || profileSelectors.length === 0) {
      return false;
    }
    for (const selector of profileSelectors) {
      try {
        const node = document.querySelector(selector);
        if (!node) {
          continue;
        }
        if (node === video) {
          return true;
        }
        if (typeof node.contains === "function" && node.contains(video)) {
          return true;
        }
      } catch (error) {
        // Ignore invalid selector and continue.
      }
    }
    return false;
  }

  // Playing beats audible beats profile-matched beats recently used; the
  // on-screen area breaks ties. Videos with no area are skipped.
  function scoreVideo(video) {
    const visibleArea = getVisibleArea(video);
    const area = Math.max(visibleArea, core.getRectArea(video));
    if (area <= 0) {
      return null;
    }
    const playingBoost = isVideoPlaying(video) ? 1_000_000_000 : 0;
    const audibleBoost = isLikelyAudible(video) ? 250_000_000 : 0;
    const profileBoost = hasProfileBoost(video) ? 180_000_000 : 0;
    const lastManagedBoost = video === state.lastManagedVideo ? 20_000_000 : 0;
    const activeBoost = video === state.activeVideo ? 10_000_000 : 0;
    return playingBoost + audibleBoost + profileBoost + lastManagedBoost + activeBoost + area;
  }

  function markPlaybackIntentFromActiveVideo() {
    const activeVideo = syncActiveVideo(state.lastManagedVideo || state.activeVideo);
    if (isVideoPlaying(activeVideo)) {
      state.hadUserGesture = true;
      state.wasPlayingBeforeHide = true;
      return true;
    }
    return false;
  }

  async function requestVideoPictureInPicture(video) {
    if (!video || typeof video.requestPictureInPicture !== "function") {
      return false;
    }
    const allowDisablePiP = Boolean(matchedProfile && matchedProfile.allowDisablePiP);
    const hadDisableAttr = video.hasAttribute("disablepictureinpicture");
    const previousDisable = Boolean(video.disablePictureInPicture);
    if (allowDisablePiP && previousDisable) {
      try {
        video.disablePictureInPicture = false;
        if (hadDisableAttr) {
          video.removeAttribute("disablepictureinpicture");
        }
      } catch (error) {
        // Ignore property/attribute write errors.
      }
    }
    try {
      await video.requestPictureInPicture();
      return true;
    } finally {
      if (allowDisablePiP && previousDisable) {
        try {
          video.disablePictureInPicture = previousDisable;
          if (hadDisableAttr) {
            video.setAttribute("disablepictureinpicture", "");
          }
        } catch (error) {
          // Ignore restore errors.
        }
      }
    }
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
    const allowNoUserGesture = Boolean(matchedProfile && matchedProfile.allowNoUserGesture);
    if (!state.hadUserGesture && !allowNoUserGesture && reason !== "media_session_action") {
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

    let activeVideo = syncActiveVideo();
    if ((!activeVideo || !isVideoPlaying(activeVideo)) &&
        isVideoCandidate(state.lastManagedVideo)) {
      activeVideo = syncActiveVideo(state.lastManagedVideo);
    }

    let ownershipGranted = false;
    const ensureOwnership = async () => {
      if (ownershipGranted || state.ownerToken) {
        ownershipGranted = true;
        return true;
      }
      const ownershipResult = await core.requestPiPOwnership("video");
      if (!ownershipResult.granted) {
        core.clearPlaybackRecoveryState();
        return false;
      }
      ownershipGranted = true;
      return true;
    };

    if (mainWorldEnter && mainWorldEnter.requiresPlaying && !isVideoPlaying(activeVideo)) {
      return false;
    }

    if (mainWorldEnter) {
      if (!(await ensureOwnership())) {
        return false;
      }
      if (mainWorldEnter.setupAction) {
        await requestMainWorldSetup();
      }
      await core.sendRuntimeMessage(
        { action: mainWorldEnter.action },
        { ms: MAIN_WORLD_ENTER_TIMEOUT_MS, minMs: 160 }
      );
      if (document.pictureInPictureElement) {
        state.managedPiP = true;
        if (document.pictureInPictureElement instanceof HTMLVideoElement) {
          state.lastManagedVideo = document.pictureInPictureElement;
        }
        state.hiddenRetryBudget = 0;
        clearEnterRetryTimer();
        return true;
      }
    }

    if (!isVideoPlaying(activeVideo)) {
      return false;
    }

    const allowEnterWhenHiddenVideo = Boolean(
      matchedProfile &&
      matchedProfile.allowEnterWhenHiddenVideo &&
      document.visibilityState === "hidden"
    );
    if (!allowEnterWhenHiddenVideo && !isVideoVisibleEnough(activeVideo)) {
      return false;
    }

    if (!(await ensureOwnership())) {
      return false;
    }

    state.enteringPiP = true;
    try {
      const entered = await requestVideoPictureInPicture(activeVideo);
      if (!entered) {
        return false;
      }
      state.managedPiP = true;
      state.lastManagedVideo = activeVideo;
      state.hiddenRetryBudget = 0;
      clearEnterRetryTimer();
      return true;
    } catch (error) {
      return false;
    } finally {
      state.enteringPiP = false;
      if (!state.managedPiP && ownershipGranted) {
        await core.releasePiPOwnership();
      }
    }
  }

  function recoverInlinePlaybackIfNeeded() {
    if (document.visibilityState !== "visible") {
      return;
    }
    if (!state.shouldResumeInlinePlayback) {
      return;
    }
    if (document.pictureInPictureElement) {
      return;
    }
    if (reloadJingxuanModalIfNeeded()) {
      return;
    }
    const video = syncActiveVideo(state.lastManagedVideo || state.activeVideo);
    if (video && video.paused && !video.ended) {
      video.play().catch(() => {
        // Expected when autoplay policy blocks playback or a pause interrupts it.
      });
    }
  }

  function scheduleVisibleRecovery() {
    clearRecoveryTimer();
    if (!state.shouldResumeInlinePlayback &&
        !state.managedPiP &&
        !document.pictureInPictureElement) {
      return;
    }
    if (!state.managedPiP && !document.pictureInPictureElement) {
      recoverInlinePlaybackIfNeeded();
      return;
    }

    let attempts = 0;
    const run = async () => {
      attempts += 1;
      await maybeExitPiP();
      if (reloadJingxuanModalIfNeeded()) {
        clearRecoveryTimer();
        return;
      }
      recoverInlinePlaybackIfNeeded();
      if (document.visibilityState !== "visible") {
        clearRecoveryTimer();
        return;
      }
      if (document.pictureInPictureElement && attempts < VISIBLE_RECOVERY_MAX_ATTEMPTS) {
        state.recoveryTimer = setTimeout(
          run,
          attempts < VISIBLE_RECOVERY_FAST_ATTEMPTS
            ? VISIBLE_RECOVERY_FAST_DELAY_MS
            : VISIBLE_RECOVERY_SLOW_DELAY_MS
        );
        return;
      }
      clearRecoveryTimer();
    };
    run();
  }

  function handleVisibilityChange() {
    if (document.visibilityState === "hidden") {
      core.capturePlaybackStateOnHide();
      state.hiddenRetryBudget = getHiddenRetryLimit();
      if (mainWorldEnter && mainWorldEnter.setupAction) {
        // sendRuntimeMessage reports failures in its result instead of rejecting.
        requestMainWorldSetup().catch(CORE.warnUnexpected("main-world PiP setup"));
      }
      const now = Date.now();
      const visibleSuppressStart = Number(state.lastVisibleAt || 0);
      const isQuickRehide = visibleSuppressStart > 0 &&
        (now - visibleSuppressStart) <= QUICK_REHIDE_BYPASS_MS;
      if (isQuickRehide && Number(state.suppressEnterUntil || 0) > now) {
        state.suppressEnterUntil = 0;
      }
      clearRecoveryTimer();
      core.scheduleDeferredEnterPiP("visibility_hidden_retry");
      maybeEnterPiP("visibility_hidden");
      return;
    }
    if (document.visibilityState === "visible") {
      markPlaybackIntentFromActiveVideo();
      state.hiddenRetryBudget = 0;
      state.lastVisibleAt = Date.now();
      clearEnterRetryTimer();
      state.suppressEnterUntil = Date.now() + ENTER_SUPPRESS_AFTER_VISIBLE_MS;
      scheduleVisibleRecovery();
    }
  }

  function onVideoEvent(event) {
    const target = event && event.target;
    if (!(target instanceof HTMLVideoElement)) {
      return;
    }
    syncActiveVideo(target);
    if (event.type === "pause" || event.type === "ended") {
      state.shouldResumeInlinePlayback = false;
      state.wasPlayingBeforeHide = false;
    }
    if ((event.type === "play" || event.type === "playing") && !state.hadUserGesture) {
      state.hadUserGesture = true;
    }
    if (event.type === "play" || event.type === "playing") {
      state.wasPlayingBeforeHide = true;
      if (document.visibilityState === "hidden") {
        state.shouldResumeInlinePlayback = true;
      }
    }
    if ((event.type === "play" || event.type === "playing") && document.visibilityState === "hidden") {
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
    if (state.enteringPiP || document.visibilityState === "hidden") {
      state.managedPiP = true;
      return;
    }
    const target = event && event.target;
    state.managedPiP = Boolean(target && target === state.lastManagedVideo);
  }

  function markUserGesture() {
    state.hadUserGesture = true;
  }

  function init() {
    if (!core.canExitPiP()) {
      return;
    }
    if (mainWorldEnter && mainWorldEnter.setupAction) {
      // sendRuntimeMessage reports failures in its result instead of rejecting.
      requestMainWorldSetup().catch(CORE.warnUnexpected("main-world PiP setup"));
    }
    syncActiveVideo();
    markPlaybackIntentFromActiveVideo();
    core.ensurePageBridgeInjected();
    core.bindMediaSessionAutoPiP();
    core.bindRuntimeMessageListener();

    document.addEventListener("pointerdown", markUserGesture, true);
    document.addEventListener("keydown", markUserGesture, true);
    document.addEventListener("touchstart", markUserGesture, true);
    document.addEventListener("visibilitychange", handleVisibilityChange, true);
    document.addEventListener("play", onVideoEvent, true);
    document.addEventListener("playing", onVideoEvent, true);
    document.addEventListener("pause", onVideoEvent, true);
    document.addEventListener("ended", onVideoEvent, true);
    document.addEventListener("loadedmetadata", onVideoEvent, true);
    document.addEventListener("enterpictureinpicture", onEnterPictureInPicture, true);
    document.addEventListener("leavepictureinpicture", core.onLeavePictureInPicture, true);
    core.bindPageReturnListeners();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
    return;
  }
  init();
})();
