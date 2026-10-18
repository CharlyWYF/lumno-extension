// Classic service-worker imports run in dependency order. A missing file is a
// packaging error, so let it fail loudly instead of starting half-initialized.
importScripts(
  chrome.runtime.getURL('src/shared/blacklist-utils.js'),
  chrome.runtime.getURL('src/shared/url-guards.js'),
  chrome.runtime.getURL('src/shared/favicon-utils.js'),
  chrome.runtime.getURL('src/shared/shortcut-favicon.js'),
  chrome.runtime.getURL('src/shared/shortcut-key-matcher.js'),
  chrome.runtime.getURL('src/shared/favicon-cache.js'),
  chrome.runtime.getURL('src/newtab/favicon-theme.js'),
  chrome.runtime.getURL('src/shared/extension-routes.js'),
  chrome.runtime.getURL('src/background/command-target-policy.js'),
  chrome.runtime.getURL('src/shared/settings.js'),
  chrome.runtime.getURL('src/shared/bookmark-folder-reference.js'),
  chrome.runtime.getURL('src/newtab/shortcuts-store.js'),
  chrome.runtime.getURL('src/newtab/wallpaper-local-store.js'),
  chrome.runtime.getURL('src/shared/webdav-contract.js'),
  chrome.runtime.getURL('src/background/webdav-client.js'),
  chrome.runtime.getURL('src/background/webdav-sync.js'),
  chrome.runtime.getURL('src/shared/update-notice.js'),
  chrome.runtime.getURL('src/shared/search-utils.js'),
  chrome.runtime.getURL('src/shared/selection-intent.js'),
  chrome.runtime.getURL('src/shared/site-search-store.js'),
  chrome.runtime.getURL('src/shared/community-links.js'),
  chrome.runtime.getURL('src/shared/help-center-search.js'),
  chrome.runtime.getURL('src/shared/aggregate-search-store.js'),
  chrome.runtime.getURL('src/background/ai-provider-submit.js'),
  chrome.runtime.getURL('src/background/aggregate-search.js'),
  chrome.runtime.getURL('src/background/extension-pages.js'),
  chrome.runtime.getURL('src/background/tab-groups.js'),
  chrome.runtime.getURL('src/background/search-result-tabs.js'),
  chrome.runtime.getURL('src/background/bookmark-tab-groups.js'),
  chrome.runtime.getURL('src/background/selection-target.js'),
  chrome.runtime.getURL('src/background/selection-quick-action-provider.js'),
  chrome.runtime.getURL('src/background/selection-script-registration.js'),
  chrome.runtime.getURL('src/background/message-router.js'),
  chrome.runtime.getURL('src/background/newtab-fallback.js'),
  chrome.runtime.getURL('src/shared/browser-profile.js'),
  chrome.runtime.getURL('src/background/shortcut-rules.js'),
  chrome.runtime.getURL('src/background/pip-ownership.js'),
  chrome.runtime.getURL('src/background/pip-main-world.js'),
  chrome.runtime.getURL('src/background/recent-tab-switcher.js'),
  chrome.runtime.getURL('src/shared/progress-match.js'),
  chrome.runtime.getURL('src/shared/progress-history.js'),
  chrome.runtime.getURL('src/background/progress-tracker.js'),
  chrome.runtime.getURL('src/background/overlay-loading-lifecycle.js'),
  chrome.runtime.getURL('src/background/dev-extension-startup.js'),
  // Background services split out of this file. They share its global scope
  // and only define functions and their own state while loading.
  chrome.runtime.getURL('src/background/tab-switcher-service.js'),
  chrome.runtime.getURL('src/background/pinned-tab-recovery.js'),
  chrome.runtime.getURL('src/background/favicon-service.js'),
  chrome.runtime.getURL('src/background/search-suggestions-service.js')
);
// pinyin-pro (~320 KB) only matters when a Han-character title is matched
// against a pinyin query, so the worker loads it on first use instead of on
// every wake (see getPinyinPro). A service worker may only importScripts() a
// file after installation if it imported that file while installing, hence
// the install hook. Firefox's build lists this path in background.scripts.
const PINYIN_PRO_SCRIPT_PATH = 'assets/vendor/pinyin-pro.js';
if (typeof globalThis.addEventListener === 'function') {
  globalThis.addEventListener('install', () => {
    importScripts(chrome.runtime.getURL(PINYIN_PRO_SCRIPT_PATH));
  });
}
// Development-only; the store package strips this import.
importScripts(chrome.runtime.getURL('src/background/codex-debug-bridge.js'));

const BACKGROUND_PAGES = globalThis.LumnoBackgroundPages;
const getExtensionDetailsUrl = BACKGROUND_PAGES.getExtensionDetailsUrl;
const openExtensionOptionsPage = BACKGROUND_PAGES.openExtensionOptionsPage;
const openOnboardingPage = BACKGROUND_PAGES.openOnboardingPage;
const shouldOpenOnboardingForUpdate = BACKGROUND_PAGES.shouldOpenOnboardingForUpdate;
const openReleasePage = BACKGROUND_PAGES.openReleasePage;
const openBookmarkManagerPage = BACKGROUND_PAGES.openBookmarkManagerPage;
const openExtensionShortcutsPage = BACKGROUND_PAGES.openExtensionShortcutsPage;
const openSiteSearchOptionsPage = BACKGROUND_PAGES.openSiteSearchOptionsPage;
const BACKGROUND_MESSAGE_ROUTER = globalThis.LumnoBackgroundMessageRouter;
const BOOKMARK_TAB_GROUPS = globalThis.LumnoBookmarkTabGroups;
const EXTENSION_ROUTES = globalThis.LumnoExtensionRoutes;
const UPDATE_NOTICE = globalThis.LumnoUpdateNotice;
const SETTINGS = globalThis.LumnoSettings;
const COMMAND_TARGET_POLICY = globalThis.LumnoCommandTargetPolicy;
const FAVICON_UTILS = globalThis.LumnoFaviconUtils;
const FAVICON_CACHE = globalThis.LumnoFaviconCache;
const SHORTCUT_FAVICON = globalThis.LumnoShortcutFavicon;
const SHORTCUT_KEY_MATCHER = globalThis.LumnoShortcutKeyMatcher;
const NEWTAB_FAVICON_THEME = globalThis.LumnoNewtabFaviconTheme;
const BACKGROUND_NEWTAB_FALLBACK = globalThis.LumnoBackgroundNewtabFallback;
const BROWSER_PROFILE = globalThis.LumnoBrowserProfile;
const BACKGROUND_TAB_GROUPS = globalThis.LumnoBackgroundTabGroups;
const SEARCH_RESULT_TABS = globalThis.LumnoSearchResultTabs;
const isLocalFileLikeTargetUrl = BACKGROUND_NEWTAB_FALLBACK.isLocalFileLikeTargetUrl;
const checkFileSchemeAccess = BACKGROUND_NEWTAB_FALLBACK.checkFileSchemeAccess;
const openBrowserNewtabFallback = BACKGROUND_NEWTAB_FALLBACK.openBrowserNewtabFallback;
const openNewtabFallback = BACKGROUND_NEWTAB_FALLBACK.openNewtabFallback;
const openNewtabFallbackForUrl = BACKGROUND_NEWTAB_FALLBACK.openNewtabFallbackForUrl;
const swapNewtabForFocus = BACKGROUND_NEWTAB_FALLBACK.swapNewtabForFocus;
const BACKGROUND_SHORTCUT_RULES = globalThis.LumnoShortcutRules;
const OVERLAY_LOADING_LIFECYCLE = globalThis.LumnoOverlayLoadingLifecycle;
const DEV_EXTENSION_STARTUP = globalThis.LumnoDevExtensionStartup;
const CODEX_DEBUG_BRIDGE = globalThis.LumnoCodexDebugBackground;
const codexDebugBridge = CODEX_DEBUG_BRIDGE.create({ chromeApi: chrome });
const shortcutRules = BACKGROUND_SHORTCUT_RULES.create({
  chromeApi: chrome,
  fetchImpl: fetch,
  navigatorLike: navigator
});
const loadShortcutRules = shortcutRules.loadShortcutRules;
const getShortcutUrl = shortcutRules.getShortcutUrl;

function isBrowserExtensionProtocol(protocol) {
  const guards = globalThis.LumnoUrlGuards;
  return guards.isBrowserExtensionProtocol(protocol);
}

function isBrowserInternalUrl(url) {
  const guards = globalThis.LumnoUrlGuards;
  return guards.isBrowserInternalUrl(url);
}

function isRestrictedUrl(url) {
  const guards = globalThis.LumnoUrlGuards;
  return guards.isRestrictedUrl(url);
}

function canOpenOverlayOnUrl(url) {
  const guards = globalThis.LumnoUrlGuards;
  return guards.canOpenOverlayOnUrl(url);
}

function canFetchPageForFavicon(url) {
  const guards = globalThis.LumnoUrlGuards;
  return guards.canFetchPageForFavicon(url);
}

// Firefox hosts extension pages on a per-install UUID, not runtime.id. Compare
// protocol and host: URL.origin is "null" for these schemes outside browsers.
function getExtensionUrlKey(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname ? `${parsed.protocol}//${parsed.hostname}` : '';
  } catch (error) {
    return '';
  }
}

function getOwnExtensionOrigin() {
  return getExtensionUrlKey(chrome.runtime.getURL(''));
}

function isOwnExtensionPageUrl(url) {
  if (!url || !chrome || !chrome.runtime || !chrome.runtime.id) {
    return false;
  }
  try {
    const origin = getOwnExtensionOrigin();
    return Boolean(origin) && getExtensionUrlKey(url) === origin;
  } catch (error) {
    return false;
  }
}

function getResolvedTabUrl(tab) {
  if (!tab || typeof tab !== 'object') {
    return '';
  }
  const directUrl = typeof tab.url === 'string' ? String(tab.url).trim() : '';
  if (directUrl) {
    return directUrl;
  }
  const pendingUrl = typeof tab.pendingUrl === 'string' ? String(tab.pendingUrl).trim() : '';
  return pendingUrl;
}

function getSourceTabGroupContext(tab) {
  return BACKGROUND_TAB_GROUPS.getSourceTabGroupContext(tab, chrome);
}

function createTabWithSourceGroup(createProperties, sourceTab, callback) {
  const done = typeof callback === 'function' ? callback : () => {};
  BACKGROUND_TAB_GROUPS.createTabInSourceGroup(chrome, createProperties, sourceTab, done);
}

function resolveSearchResultTabPlacement(sourceTab) {
  return SETTINGS.readStorageValue(storageArea, chrome, SETTINGS.SEARCH_RESULT_TAB_POSITION_STORAGE_KEY)
    .catch(() => undefined)
    .then((value) => SEARCH_RESULT_TABS.resolvePlacement(
      chrome,
      sourceTab,
      SETTINGS.normalizeSearchResultTabPosition(value)
    ));
}

function createSearchResultTab(createProperties, sourceTab, callback, resolvedPlacement) {
  const placementTask = resolvedPlacement
    ? Promise.resolve(resolvedPlacement)
    : resolveSearchResultTabPlacement(sourceTab);
  placementTask.then((placement) => {
    const props = { ...createProperties };
    if (typeof placement.index === 'number') {
      props.index = placement.index;
      props.windowId = placement.windowId;
    }
    createTabWithSourceGroup(props, placement.sourceTab, callback);
  });
}

function moveTabToSourceGroupContext(tab, sourceContext, callback, createProperties) {
  BACKGROUND_TAB_GROUPS.moveTabToSourceGroupContext(chrome, tab, sourceContext, callback, createProperties);
}

const pipOwnership = globalThis.LumnoPipOwnership.create({
  chromeApi: chrome,
  getResolvedTabUrl: getResolvedTabUrl
});

const pipMainWorld = globalThis.LumnoPipMainWorld.create({
  chromeApi: chrome
});

function isLumnoNewtabUrl(url) {
  const value = String(url || '');
  if (!value || !chrome || !chrome.runtime || typeof chrome.runtime.getURL !== 'function') {
    return false;
  }
  const routeType = EXTENSION_ROUTES.classifyExtensionUrl(value);
  if (routeType === 'newtab' && isOwnExtensionUrl(value)) {
    return true;
  }
  const routeBuilders = [
    EXTENSION_ROUTES.buildNewtabUrl,
    EXTENSION_ROUTES.buildLumnoNewtabUrl
  ].filter((builder) => typeof builder === 'function');
  const prefixes = routeBuilders.length > 0
    ? routeBuilders.map((builder) => builder(chrome))
    : [
        chrome.runtime.getURL('newtab.html'),
        chrome.runtime.getURL('src/newtab/lumno-newtab.html')
      ];
  return prefixes.some((prefix) => value === prefix || value.startsWith(`${prefix}?`));
}

function isBrowserNewtabUrl(url) {
  const lower = String(url || '').toLowerCase();
  return lower === 'chrome://newtab/' ||
    lower === 'chrome://new-tab-page/' ||
    lower === 'edge://newtab/' ||
    lower === 'brave://newtab/' ||
    lower === 'opera://startpage/' ||
    lower === 'about:newtab' ||
    lower === 'about:home';
}

function isOwnExtensionUrl(url) {
  if (!url || !chrome || !chrome.runtime || !chrome.runtime.id) {
    return false;
  }
  try {
    const parsed = new URL(url);
    const protocol = String(parsed.protocol || '').toLowerCase();
    const origin = getOwnExtensionOrigin();
    return isBrowserExtensionProtocol(protocol) && Boolean(origin) && getExtensionUrlKey(url) === origin;
  } catch (e) {
    return false;
  }
}

function isLumnoBrowserOverrideNewtabUrl(url) {
  const value = String(url || '');
  if (!value || !isOwnExtensionUrl(value) || !chrome || !chrome.runtime || typeof chrome.runtime.getURL !== 'function') {
    return false;
  }
  const newtabPrefix = EXTENSION_ROUTES.buildNewtabUrl(chrome);
  return value === newtabPrefix || value.startsWith(`${newtabPrefix}?`);
}

function isOtherExtensionUrl(url) {
  if (!url || !chrome || !chrome.runtime || !chrome.runtime.id) {
    return false;
  }
  try {
    const parsed = new URL(String(url));
    return isBrowserExtensionProtocol(parsed.protocol) &&
      String(parsed.hostname || '') !== String(chrome.runtime.id);
  } catch (e) {
    return false;
  }
}

function pruneBrowserNewtabProviderCandidates(now) {
  const currentTime = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  browserNewtabProviderCandidateTabIds.forEach((createdAt, tabId) => {
    if (currentTime - Number(createdAt || 0) > BROWSER_NEWTAB_PROVIDER_DETECTION_MS) {
      browserNewtabProviderCandidateTabIds.delete(tabId);
    }
  });
}

function isPotentialBrowserNewtabProviderCandidate(tab) {
  if (!tab || typeof tab.id !== 'number') {
    return false;
  }
  const directUrl = typeof tab.url === 'string' ? tab.url : '';
  const pendingUrl = typeof tab.pendingUrl === 'string' ? tab.pendingUrl : '';
  const resolvedUrl = getResolvedTabUrl(tab);
  return isBrowserNewtabUrl(directUrl) ||
    isBrowserNewtabUrl(pendingUrl) ||
    isBrowserNewtabUrl(resolvedUrl) ||
    (!directUrl && !pendingUrl && tab.status === 'loading');
}

function rememberBrowserNewtabProviderCandidate(tab) {
  pruneBrowserNewtabProviderCandidates();
  if (!isPotentialBrowserNewtabProviderCandidate(tab)) {
    return;
  }
  browserNewtabProviderCandidateTabIds.set(tab.id, Date.now());
}

function isRecentBrowserNewtabProviderCandidate(tab) {
  if (!tab || typeof tab.id !== 'number') {
    return false;
  }
  pruneBrowserNewtabProviderCandidates();
  return browserNewtabProviderCandidateTabIds.has(tab.id);
}

function getBrowserNewtabProviderType(tab) {
  const url = getResolvedTabUrl(tab);
  if (!url) {
    return '';
  }
  if (isLumnoBrowserOverrideNewtabUrl(url)) {
    return 'lumno';
  }
  if (isOtherExtensionUrl(url)) {
    return 'other-extension';
  }
  if (isBrowserNewtabUrl(url) && tab && tab.status === 'complete') {
    return 'browser';
  }
  return '';
}

function setRestrictedActionFromBrowserNewtabProvider(providerType, tab, stage) {
  if (providerType !== 'other-extension') {
    return;
  }
  if (!backgroundSettingsLoaded) {
    // The one-time auto choice must not overwrite a later manual choice just
    // because the done flag has not been read yet on this wake.
    whenBackgroundSettingsReady(() => {
      setRestrictedActionFromBrowserNewtabProvider(providerType, tab, stage);
    });
    return;
  }
  if (restrictedActionAutoBrowserSettingDoneCache) {
    return;
  }
  const url = getResolvedTabUrl(tab);
  restrictedActionAutoBrowserSettingDoneCache = true;
  restrictedActionCache = 'none';
  const payload = {
    [RESTRICTED_ACTION_STORAGE_KEY]: 'none',
    [RESTRICTED_ACTION_AUTO_BROWSER_SETTING_DONE_STORAGE_KEY]: true
  };
  if (storageArea && typeof storageArea.set === 'function') {
    storageArea.set(payload);
  }
  logHotkeyDebug('restricted-action-auto-browser-setting', {
    providerType,
    stage: stage || '',
    url: String(url || '')
  });
}

function maybeAutoSelectRestrictedBrowserSetting(tab, stage) {
  if (!tab || typeof tab.id !== 'number') {
    return;
  }
  if (restrictedActionAutoBrowserSettingDoneCache) {
    return;
  }
  const isCandidate = isRecentBrowserNewtabProviderCandidate(tab) ||
    isPotentialBrowserNewtabProviderCandidate(tab);
  if (!isCandidate) {
    return;
  }
  const providerType = getBrowserNewtabProviderType(tab);
  if (!providerType) {
    return;
  }
  if (providerType === 'lumno') {
    browserNewtabProviderCandidateTabIds.delete(tab.id);
    return;
  }
  if (providerType === 'other-extension') {
    setRestrictedActionFromBrowserNewtabProvider(providerType, tab, stage);
    browserNewtabProviderCandidateTabIds.delete(tab.id);
    return;
  }
}

function isLumnoOnboardingUrl(url) {
  return EXTENSION_ROUTES.isOnboardingUrl(url) &&
    isOwnExtensionUrl(url);
}

function shouldTriggerOnboardingOverlayFromCommand(source, url) {
  return COMMAND_TARGET_POLICY.shouldTriggerOnboardingOverlayFromCommand(source, url, {
    isOwnExtensionUrl,
    isOnboardingUrl: isLumnoOnboardingUrl
  });
}

function triggerOnboardingOverlayFromCommand(activeTab, source) {
  if (!activeTab || typeof activeTab.id !== 'number') {
    return;
  }
  const action = COMMAND_TARGET_POLICY.ONBOARDING_SEARCH_OVERLAY_COMMAND_ACTION ||
    'triggerOnboardingSearchOverlayFromCommand';
  if (!chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
    logHotkeyDebug('onboarding-command-forward-missed', {
      tabId: activeTab.id,
      source: source || '',
      reason: 'runtime-send-message-unavailable'
    });
    return;
  }
  chrome.runtime.sendMessage({
    action,
    tabId: activeTab.id,
    source: source || ''
  }, (response) => {
    if (chrome.runtime && chrome.runtime.lastError) {
      logHotkeyDebug('onboarding-command-forward-failed', {
        tabId: activeTab.id,
        source: source || '',
        error: chrome.runtime.lastError.message || 'unknown'
      });
      return;
    }
    logHotkeyDebug('onboarding-command-forwarded', {
      tabId: activeTab.id,
      source: source || '',
      handled: Boolean(response && response.ok)
    });
  });
}

function getOwnExtensionFaviconUrl() {
  if (!chrome || !chrome.runtime || typeof chrome.runtime.getURL !== 'function') {
    return '';
  }
  return chrome.runtime.getURL('assets/images/lumno.png');
}

function shouldRecoverFromCommandNewtab(activeTab, source) {
  if (source !== 'commands' || !activeTab) {
    return false;
  }
  const activeUrl = getResolvedTabUrl(activeTab);
  return isLumnoNewtabUrl(activeUrl) || isBrowserNewtabUrl(activeUrl);
}

function pickRecoveryTargetTab(activeTab, tabs) {
  const tabList = Array.isArray(tabs) ? tabs : [];
  if (!activeTab || typeof activeTab.id !== 'number') {
    return null;
  }
  const openerTabId = typeof activeTab.openerTabId === 'number' ? activeTab.openerTabId : null;
  if (typeof openerTabId === 'number') {
    const openerTab = tabList.find((item) =>
      item &&
      item.id === openerTabId &&
      canOpenOverlayOnUrl(item.url || '')
    );
    if (openerTab) {
      return openerTab;
    }
  }
  const candidates = tabList
    .filter((item) =>
      item &&
      typeof item.id === 'number' &&
      item.id !== activeTab.id &&
      canOpenOverlayOnUrl(item.url || '')
    )
    .sort((a, b) => Number(b.lastAccessed || 0) - Number(a.lastAccessed || 0));
  return candidates[0] || null;
}

function recoverOverlayTargetFromCommandNewtab(activeTab, tabs, source) {
  if (!shouldRecoverFromCommandNewtab(activeTab, source)) {
    return false;
  }
  const targetTab = pickRecoveryTargetTab(activeTab, tabs);
  if (!targetTab || typeof targetTab.id !== 'number') {
    logHotkeyDebug('command-newtab-recover-missed', {
      reason: 'no-target',
      tabId: activeTab && typeof activeTab.id === 'number' ? activeTab.id : null,
      source: source || ''
    });
    return false;
  }
  logHotkeyDebug('command-newtab-recover-start', {
    source: source || '',
    fromTabId: activeTab.id,
    toTabId: targetTab.id,
    fromUrl: activeTab.url || '',
    toUrl: targetTab.url || ''
  });
  chrome.tabs.update(targetTab.id, { active: true }, () => {
    if (chrome.runtime && chrome.runtime.lastError) {
      logHotkeyDebug('command-newtab-recover-failed', {
        source: source || '',
        targetTabId: targetTab.id,
        error: chrome.runtime.lastError.message || 'unknown'
      });
      return;
    }
    if (typeof activeTab.id === 'number') {
      chrome.tabs.remove(activeTab.id, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          logHotkeyDebug('command-newtab-close-failed', {
            source: source || '',
            tabId: activeTab.id,
            error: chrome.runtime.lastError.message || 'unknown'
          });
        }
      });
    }
    openOverlayOnTab(targetTab, tabs, 'commands-recover');
  });
  return true;
}

function isSearchCommandSource(source) {
  return source === 'commands' || source === 'commands-prefill';
}

function requestFocusVisibleNewtabInput(source, tabId) {
  const payload = {
    action: 'lumno:newtab-focus-input',
    source: source || '',
    tabId: typeof tabId === 'number' ? tabId : null
  };
  try {
    chrome.runtime.sendMessage(payload, (response) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        logHotkeyDebug('command-newtab-focus-send-failed', {
          source: source || '',
          tabId: typeof tabId === 'number' ? tabId : null,
          error: chrome.runtime.lastError.message || 'unknown'
        });
        return;
      }
      logHotkeyDebug('command-newtab-focus-send-done', {
        source: source || '',
        tabId: typeof tabId === 'number' ? tabId : null,
        ok: Boolean(response && response.ok)
      });
    });
  } catch (e) {
    logHotkeyDebug('command-newtab-focus-send-error', {
      source: source || '',
      tabId: typeof tabId === 'number' ? tabId : null,
      error: e && e.message ? e.message : String(e || '')
    });
  }
}

const HOTKEY_DEBUG_ENABLED = false;
function logHotkeyDebug(stage, payload) {
  if (!HOTKEY_DEBUG_ENABLED) {
    return;
  }
  try {
    const detail = payload && typeof payload === 'object' ? payload : {};
    console.log(`[Lumno][hotkey] ${stage}`, detail);
  } catch (e) {
    // Ignore logging errors.
  }
}

// Callback for chrome.* calls whose failure is routine for a background that
// talks to arbitrary tabs and storage: a tab or frame that closed or navigated
// ("No tab with id", "Frame was removed"), a restricted page, or a best-effort
// cleanup. Reading lastError keeps Chrome from logging it as unchecked.
function ignoreExpectedChromeError() {
  void (chrome && chrome.runtime && chrome.runtime.lastError);
}

// Rejection handler for work that is not expected to fail (storage writes,
// startup restores). Failures stay non-fatal but leave a trace with context.
function warnBackgroundFailure(context) {
  return (error) => {
    console.warn(`[Lumno] ${context}`, error);
  };
}

const providerStorageRuntime = globalThis.LumnoSettings.createProviderStorageRuntime(chrome);
const storageArea = providerStorageRuntime
  ? providerStorageRuntime.area
  : ((chrome && chrome.storage && chrome.storage.sync)
      ? chrome.storage.sync
      : (chrome && chrome.storage ? chrome.storage.local : null));
const localStorageArea = (chrome && chrome.storage && chrome.storage.local)
  ? chrome.storage.local
  : storageArea;
const storageAreaName = providerStorageRuntime ? providerStorageRuntime.name : (storageArea
  ? (storageArea === (chrome && chrome.storage ? chrome.storage.sync : null) ? 'sync' : 'local')
  : null);
function isPrimaryStorageAreaName(areaName) {
  return providerStorageRuntime
    ? providerStorageRuntime.isActiveAreaName(areaName)
    : Boolean(storageAreaName) && areaName === storageAreaName;
}
const THEME_STORAGE_KEY = '_x_extension_theme_mode_2024_unique_';
const LANGUAGE_STORAGE_KEY = '_x_extension_language_2024_unique_';
const LANGUAGE_MESSAGES_STORAGE_KEY = '_x_extension_language_messages_2024_unique_';
const RECENT_MODE_STORAGE_KEY = '_x_extension_recent_mode_2024_unique_';
const RECENT_COUNT_STORAGE_KEY = '_x_extension_recent_count_2024_unique_';
const NEWTAB_WIDTH_MODE_STORAGE_KEY = '_x_extension_newtab_width_mode_2026_unique_';
const NEWTAB_SEARCH_WIDTH_STORAGE_KEY = '_x_extension_newtab_search_width_2026_unique_';
const NEWTAB_TOP_CONTENT_MODE_STORAGE_KEY = (
  globalThis.LumnoSettings.NEWTAB_TOP_CONTENT_MODE_STORAGE_KEY
) || '_x_extension_newtab_wordmark_visible_2026_unique_';
const NEWTAB_THEME_MODE_STORAGE_KEY = '_x_extension_newtab_theme_mode_2026_unique_';
const NEWTAB_THEME_SCOPE_STORAGE_KEY = '_x_extension_newtab_theme_scope_2026_unique_';
const NEWTAB_ZEN_MODE_STORAGE_KEY = '_x_extension_newtab_zen_mode_2026_unique_';
const NEWTAB_WALLPAPER_STORAGE_KEY = '_x_extension_newtab_wallpaper_2026_unique_';
const NEWTAB_WALLPAPER_OVERLAY_STORAGE_KEY = '_x_extension_newtab_wallpaper_overlay_2026_unique_';
const NEWTAB_WALLPAPER_EFFECT_STORAGE_KEY = '_x_extension_newtab_wallpaper_effect_2026_unique_';
const NEWTAB_FAVICON_STORAGE_KEY = '_x_extension_newtab_favicon_2026_unique_';
const OVERLAY_SIZE_MODE_STORAGE_KEY = '_x_extension_overlay_size_mode_2026_unique_';
const OVERLAY_ENTER_ANIMATION_STORAGE_KEY = '_x_extension_overlay_enter_animation_2026_unique_';
const BOOKMARK_COUNT_STORAGE_KEY = '_x_extension_bookmark_count_2024_unique_';
const BOOKMARK_COLUMNS_STORAGE_KEY = '_x_extension_bookmark_columns_2024_unique_';
const BOOKMARK_VIEW_MODE_STORAGE_KEY = '_x_extension_bookmark_view_mode_2026_unique_';
const BOOKMARK_FOLDER_ICONS_VISIBLE_STORAGE_KEY = '_x_extension_bookmark_folder_icons_visible_2026_unique_';
const BOOKMARK_TOPBAR_LOCAL_STORAGE_KEYS = Array.isArray(globalThis.LumnoSettings.BOOKMARK_TOPBAR_LOCAL_STORAGE_KEYS)
  ? globalThis.LumnoSettings.BOOKMARK_TOPBAR_LOCAL_STORAGE_KEYS
  : [];
const PINNED_RECENT_SITES_STORAGE_KEY = '_x_extension_newtab_pinned_recent_sites_2026_unique_';
const PROGRESS_TRACKING_ENABLED_STORAGE_KEY = globalThis.LumnoSettings.PROGRESS_TRACKING_ENABLED_STORAGE_KEY;
// Labs: tracked pinned cards follow the episode or chapter the person is on.
let progressTrackingEnabled = false;
const progressTracker = globalThis.LumnoProgressTracker.createProgressTracker({
  chromeApi: chrome,
  progressMatch: globalThis.LumnoProgressMatch,
  progressHistory: globalThis.LumnoProgressHistory,
  getPinnedArea: () => storageArea,
  historyArea: localStorageArea,
  pinnedKey: PINNED_RECENT_SITES_STORAGE_KEY,
  isEnabled: () => progressTrackingEnabled
});
progressTracker.attach();
if (storageArea) {
  storageArea.get([PROGRESS_TRACKING_ENABLED_STORAGE_KEY], (result) => {
    progressTrackingEnabled = globalThis.LumnoSettings.normalizeProgressTrackingEnabled(
      result && result[PROGRESS_TRACKING_ENABLED_STORAGE_KEY]
    );
  });
}
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (!isPrimaryStorageAreaName(areaName) || !changes[PROGRESS_TRACKING_ENABLED_STORAGE_KEY]) return;
  progressTrackingEnabled = globalThis.LumnoSettings.normalizeProgressTrackingEnabled(
    changes[PROGRESS_TRACKING_ENABLED_STORAGE_KEY].newValue
  );
});
const HIDDEN_RECENT_SITES_STORAGE_KEY = '_x_extension_newtab_hidden_recent_sites_2026_unique_';
const NEWTAB_SHORTCUTS_STORAGE_KEY = '_x_extension_newtab_shortcuts_2026_unique_';
const RESTRICTED_ACTION_STORAGE_KEY = '_x_extension_restricted_action_2024_unique_';
const RESTRICTED_ACTION_AUTO_BROWSER_SETTING_DONE_STORAGE_KEY = '_x_extension_restricted_action_auto_browser_setting_done_2026_unique_';
const OVERLAY_TAB_PRIORITY_STORAGE_KEY = '_x_extension_overlay_tab_priority_2024_unique_';
const TAB_RANK_SCORE_DEBUG_STORAGE_KEY = '_x_extension_tab_rank_score_debug_2026_unique_';
const AUTO_PIP_ENABLED_STORAGE_KEY = '_x_extension_auto_pip_enabled_2026_unique_';
const TAB_SWITCHER_ENABLED_STORAGE_KEY = '_x_extension_tab_switcher_enabled_2026_unique_';
const DOCUMENT_PIP_ENABLED_STORAGE_KEY = '_x_extension_document_pip_enabled_2026_unique_';
const PINNED_TAB_RECOVERY_ENABLED_STORAGE_KEY = '_x_extension_pinned_tab_recovery_enabled_2026_unique_';
const SELECTION_QUICK_ACTIONS_ENABLED_STORAGE_KEY = '_x_extension_selection_quick_actions_enabled_2026_unique_';
const SELECTION_QUICK_ACTIONS_PROVIDER_STORAGE_KEY = '_x_extension_selection_quick_actions_provider_2026_unique_';
const SELECTION_QUICK_ACTIONS_GROUP_ENABLED_STORAGE_KEY = '_x_extension_selection_quick_actions_group_enabled_2026_unique_';
const FALLBACK_SHORTCUT_STORAGE_KEY = '_x_extension_fallback_hotkey_2024_unique_';
const SEARCH_RESULT_PRIORITY_STORAGE_KEY = '_x_extension_search_result_priority_2026_unique_';
const SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY = '_x_extension_search_result_source_types_2026_unique_';
const SEARCH_SELECTION_STATS_STORAGE_KEY = '_x_extension_search_selection_stats_2026_unique_';
const FAVICON_VISIT_DIRTY_STORAGE_KEY = '_x_extension_favicon_visit_dirty_2026_unique_';
const PINNED_TAB_SNAPSHOT_STORAGE_KEY = '_x_extension_pinned_tab_snapshot_2026_unique_';
const REMOVED_AI_SYNC_STORAGE_KEYS = [
  '_x_extension_ai_search_mode_2026_unique_',
  '_x_extension_ai_provider_2026_unique_',
  '_x_extension_ai_entitlement_cache_2026_unique_'
];
const REMOVED_AI_LOCAL_STORAGE_KEYS = [
  '_x_extension_ai_api_key_2026_unique_'
];
const SHOW_SEARCH_COMMAND_NAME = 'show-search';
const SHOW_SEARCH_PREFILL_COMMAND_NAME = 'show-search-prefill';
const SHOW_SEARCH_PREFILL_V_COMMAND_NAME = 'show-search-prefill-v';
const SHOW_TAB_SWITCHER_COMMAND_NAME = 'show-tab-switcher';
const HOTKEY_DUP_GUARD_MS = 180;
const OVERLAY_OPENING_GUARD_MS = 5000;
const OVERLAY_RUNTIME_VERSION = '2026-10-01-favicon-source-scope-v16';
const OVERLAY_HOST_ID = '_x_extension_overlay_host_2026_unique_';
const OVERLAY_NAVIGATION_STATE_STORAGE_PREFIX =
  '_x_extension_overlay_navigation_state_2026_unique_:';
const OVERLAY_NAVIGATION_STATE_TTL_MS = Number(
  OVERLAY_LOADING_LIFECYCLE.DEFAULT_NAVIGATION_STATE_TTL_MS
) || (5 * 60 * 1000);
const OVERLAY_LOADING_RECORD_STORAGE_PREFIX =
  '_x_extension_overlay_loading_record_2026_unique_:';
const OVERLAY_LOADING_RECORD_TTL_MS = Number(
  OVERLAY_LOADING_LIFECYCLE.DEFAULT_RECORD_TTL_MS
) || (5 * 60 * 1000);
const OVERLAY_LOADING_RECOVERY_MAX_ATTEMPTS = 3;
const OVERLAY_LOADING_RECOVERY_RETRY_MS = 120;
const OVERLAY_LOADING_PRE_COMPLETE_RETRY_MAX_ATTEMPTS = 3;
const OVERLAY_LOADING_PRE_COMPLETE_RETRY_MS = 120;
const OVERLAY_LOADING_STABLE_COMPLETE_MS = 1500;
const PAGE_HOTKEY_NEWTAB_RECOVER_MS = 1200;
const BROWSER_NEWTAB_PROVIDER_DETECTION_MS = 6000;
const TAB_SWITCHER_THUMBNAIL_STORAGE_KEY = '_x_extension_tab_switcher_state_2026_unique_';
const TAB_SWITCH_WINDOW_SHORT_MS = 30 * 60 * 1000;
const TAB_SWITCH_WINDOW_DAY_MS = 24 * 60 * 60 * 1000;
const TAB_SWITCH_HIGH_FREQ_SHORT_THRESHOLD = 2;
const TAB_SWITCH_HIGH_FREQ_DAY_THRESHOLD = 5;
const TAB_SWITCH_EVENT_HISTORY_LIMIT = 60;
const TAB_SWITCH_STATS_STORAGE_KEY = '_x_extension_tab_switch_stats_2026_unique_';
// Service-worker lifetime: everything below is lost when the worker suspends
// and is re-created on the next wake. Each group says how it survives that;
// the service scripts in the first importScripts block document their own.
//
// Settings mirrors, re-read from storage on every wake (see the storageArea.get
// below). Until that read lands they hold defaults, so event paths that act on
// them wait for backgroundSettingsReady (see whenBackgroundSettingsReady).
let restrictedActionCache = 'default';
let restrictedActionAutoBrowserSettingDoneCache = false;
let documentPipEnabledCache = false;
let resolveDocumentPipEnabledReady = () => {};
// A service worker woken by the toolbar button or a clip command handles that
// event before its stored settings arrive, so web clip waits for the real value.
const documentPipEnabledReady = new Promise((resolve) => {
  resolveDocumentPipEnabledReady = resolve;
});
let tabSwitcherEnabledCache = true;
let backgroundSettingsLoaded = false;
let resolveBackgroundSettingsReady = () => {};
const backgroundSettingsReady = new Promise((resolve) => {
  resolveBackgroundSettingsReady = resolve;
});
// Short-lived guards (<= a few seconds) that may be lost: a fresh worker simply
// treats the next hotkey/open as new.
const hotkeyInvokeAtByTabId = new Map();
const overlayOpeningByTabId = new Map();
const overlayLoadingRecoveryInFlightByTabId = new Set();
const overlayLoadingPendingUpdateByTabId = new Map();
const browserNewtabProviderCandidateTabIds = new Map();
let lastPageHotkeyContext = null;
// Write-through caches of chrome.storage.session records, re-read on a miss.
const overlayNavigationStateByTabId = new Map();
const overlayLoadingRecordsByTabId = new Map();
// Tab switch stats: persisted on every change to session storage and merged
// back by ensureTabSwitchStatsLoaded on wake.
const tabSwitchEventsByTabId = new Map();
// Rebuilt from tab.lastAccessed on the next tab listing.
const tabLastAccessedByTabId = new Map();
// Debug counter and request sequence numbers; restarting them is harmless.
let tabSwitchEventDebugTotal = 0;
let tabOverlayFetchSeq = 0;
let tabSwitchStatsLoaded = false;
let tabSwitchStatsLoadPromise = null;
// Tabs whose stats were cleared before the stored stats were merged back; the
// merge skips their stored entries so a cleared stat is not resurrected.
const tabSwitchStatsClearedBeforeLoad = new Set();
function cleanupRemovedAiStorageKeys() {
  if (!chrome || !chrome.storage) {
    return;
  }
  const syncArea = chrome.storage.sync;
  const localArea = chrome.storage.local;
  if (syncArea && typeof syncArea.remove === 'function') {
    syncArea.remove(REMOVED_AI_SYNC_STORAGE_KEYS, ignoreExpectedChromeError);
  }
  if (localArea && typeof localArea.remove === 'function') {
    localArea.remove(REMOVED_AI_LOCAL_STORAGE_KEYS, ignoreExpectedChromeError);
  }
}

function cleanupLocalOnlyBookmarkTopbarSyncStorage() {
  if (!chrome || !chrome.storage || !chrome.storage.sync ||
      typeof chrome.storage.sync.remove !== 'function' ||
      BOOKMARK_TOPBAR_LOCAL_STORAGE_KEYS.length === 0) {
    return;
  }
  chrome.storage.sync.remove(BOOKMARK_TOPBAR_LOCAL_STORAGE_KEYS, ignoreExpectedChromeError);
}

function getTabSwitchStorageArea() {
  if (!chrome || !chrome.storage) {
    return null;
  }
  if (chrome.storage.session) {
    return chrome.storage.session;
  }
  if (chrome.storage.local) {
    return chrome.storage.local;
  }
  return null;
}

function normalizeTabSwitchStatEntry(raw, now) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const minTs = now - TAB_SWITCH_WINDOW_DAY_MS;
  const rawEvents = Array.isArray(raw.events) ? raw.events : [];
  const events = rawEvents
    .map((item) => Number(item) || 0)
    .filter((item) => item >= minTs)
    .sort((a, b) => a - b)
    .slice(-TAB_SWITCH_EVENT_HISTORY_LIMIT);
  const lastSwitchAtRaw = Number(raw.lastSwitchAt) || 0;
  const lastSwitchAt = Math.max(lastSwitchAtRaw, events.length > 0 ? events[events.length - 1] : 0);
  if (events.length <= 0 && lastSwitchAt <= 0) {
    return null;
  }
  return {
    events: events,
    lastSwitchAt: lastSwitchAt
  };
}

function mergeTabSwitchStat(target, incoming, now) {
  const left = normalizeTabSwitchStatEntry(target, now) || { events: [], lastSwitchAt: 0 };
  const right = normalizeTabSwitchStatEntry(incoming, now) || { events: [], lastSwitchAt: 0 };
  const mergedEvents = left.events.concat(right.events)
    .filter((item) => typeof item === 'number' && item > 0)
    .sort((a, b) => a - b)
    .slice(-TAB_SWITCH_EVENT_HISTORY_LIMIT);
  const lastSwitchAt = Math.max(left.lastSwitchAt || 0, right.lastSwitchAt || 0, mergedEvents.length > 0 ? mergedEvents[mergedEvents.length - 1] : 0);
  if (mergedEvents.length <= 0 && lastSwitchAt <= 0) {
    return null;
  }
  return {
    events: mergedEvents,
    lastSwitchAt: lastSwitchAt
  };
}

function applyPersistedTabSwitchStats(payload) {
  const now = Date.now();
  if (!payload || typeof payload !== 'object') {
    return;
  }
  Object.keys(payload).forEach((tabIdKey) => {
    const tabId = Number.parseInt(tabIdKey, 10);
    if (!Number.isFinite(tabId) || tabSwitchStatsClearedBeforeLoad.has(tabId)) {
      return;
    }
    const incoming = normalizeTabSwitchStatEntry(payload[tabIdKey], now);
    if (!incoming) {
      return;
    }
    const existing = tabSwitchEventsByTabId.get(tabId) || null;
    const merged = mergeTabSwitchStat(existing, incoming, now);
    if (merged) {
      tabSwitchEventsByTabId.set(tabId, merged);
    }
  });
}

function exportTabSwitchStatsSnapshot() {
  const now = Date.now();
  const out = {};
  tabSwitchEventsByTabId.forEach((stat, tabId) => {
    if (typeof tabId !== 'number') {
      return;
    }
    const normalized = normalizeTabSwitchStatEntry(stat, now);
    if (!normalized) {
      return;
    }
    out[String(tabId)] = normalized;
  });
  return out;
}

function persistTabSwitchStatsNow() {
  const area = getTabSwitchStorageArea();
  if (!area) {
    return Promise.resolve(false);
  }
  if (!tabSwitchStatsLoaded) {
    // A tab activation can wake the worker; writing before the stored stats
    // are merged back would replace them with just this one event.
    return ensureTabSwitchStatsLoaded().then(() => persistTabSwitchStatsNow());
  }
  const snapshot = exportTabSwitchStatsSnapshot();
  return new Promise((resolve) => {
    area.set({ [TAB_SWITCH_STATS_STORAGE_KEY]: snapshot }, () => {
      resolve(!(chrome.runtime && chrome.runtime.lastError));
    });
  });
}

function ensureTabSwitchStatsLoaded() {
  if (tabSwitchStatsLoaded) {
    return Promise.resolve();
  }
  if (tabSwitchStatsLoadPromise) {
    return tabSwitchStatsLoadPromise;
  }
  const area = getTabSwitchStorageArea();
  if (!area) {
    tabSwitchStatsLoaded = true;
    return Promise.resolve();
  }
  tabSwitchStatsLoadPromise = new Promise((resolve) => {
    area.get([TAB_SWITCH_STATS_STORAGE_KEY], (result) => {
      const payload = result ? result[TAB_SWITCH_STATS_STORAGE_KEY] : null;
      applyPersistedTabSwitchStats(payload);
      tabSwitchStatsClearedBeforeLoad.clear();
      tabSwitchStatsLoaded = true;
      tabSwitchStatsLoadPromise = null;
      resolve();
    });
  });
  return tabSwitchStatsLoadPromise;
}

function getTabSwitchStat(tabId, createIfMissing) {
  if (typeof tabId !== 'number') {
    return null;
  }
  const existing = tabSwitchEventsByTabId.get(tabId);
  if (existing || !createIfMissing) {
    return existing || null;
  }
  const created = {
    events: [],
    lastSwitchAt: 0
  };
  tabSwitchEventsByTabId.set(tabId, created);
  return created;
}

function pruneTabSwitchStat(stat, now) {
  if (!stat || !Array.isArray(stat.events)) {
    return;
  }
  const minTs = now - TAB_SWITCH_WINDOW_DAY_MS;
  stat.events = stat.events.filter((ts) => typeof ts === 'number' && ts >= minTs);
  if (stat.events.length > TAB_SWITCH_EVENT_HISTORY_LIMIT) {
    stat.events = stat.events.slice(-TAB_SWITCH_EVENT_HISTORY_LIMIT);
  }
}

function recordTabSwitchEvent(tabId, at) {
  const stat = getTabSwitchStat(tabId, true);
  if (!stat) {
    return;
  }
  const now = typeof at === 'number' ? at : Date.now();
  const lastRecordedAt = Number(stat.lastSwitchAt) || 0;
  if (lastRecordedAt > 0 && Math.abs(now - lastRecordedAt) < 450) {
    return;
  }
  stat.events.push(now);
  stat.lastSwitchAt = now;
  tabSwitchEventDebugTotal += 1;
  pruneTabSwitchStat(stat, now);
  persistTabSwitchStatsNow().catch(warnBackgroundFailure('Failed to save tab switch stats.'));
}

function clearTabSwitchStat(tabId) {
  if (typeof tabId !== 'number') {
    return;
  }
  tabLastAccessedByTabId.delete(tabId);
  const hadStat = tabSwitchEventsByTabId.delete(tabId);
  if (!tabSwitchStatsLoaded) {
    // The stored copy of this stat has not been merged in yet; drop it too.
    tabSwitchStatsClearedBeforeLoad.add(tabId);
  }
  if (hadStat || !tabSwitchStatsLoaded) {
    persistTabSwitchStatsNow().catch(warnBackgroundFailure('Failed to save tab switch stats.'));
  }
}

function syncTabSwitchStatsFromTabList(tabs) {
  const list = Array.isArray(tabs) ? tabs : [];
  const aliveIds = new Set();
  let mostRecentTabId = null;
  let mostRecentLastAccessed = 0;
  for (let i = 0; i < list.length; i += 1) {
    const tab = list[i];
    if (!tab || typeof tab.id !== 'number') {
      continue;
    }
    const tabId = tab.id;
    aliveIds.add(tabId);
    const lastAccessed = Number(tab.lastAccessed) || 0;
    if (lastAccessed <= 0) {
      continue;
    }
    if (lastAccessed > mostRecentLastAccessed) {
      mostRecentLastAccessed = lastAccessed;
      mostRecentTabId = tabId;
    }
    const previous = Number(tabLastAccessedByTabId.get(tabId)) || 0;
    tabLastAccessedByTabId.set(tabId, lastAccessed);
    if (previous > 0 && lastAccessed > previous + 250) {
      recordTabSwitchEvent(tabId, lastAccessed);
    }
  }
  const staleIds = [];
  tabLastAccessedByTabId.forEach((_, tabId) => {
    if (!aliveIds.has(tabId)) {
      staleIds.push(tabId);
    }
  });
  staleIds.forEach((tabId) => {
    tabLastAccessedByTabId.delete(tabId);
  });
  if (typeof mostRecentTabId === 'number' && mostRecentLastAccessed > 0) {
    const existing = getTabSwitchStat(mostRecentTabId, false);
    const lastRecordedAt = Number(existing && existing.lastSwitchAt) || 0;
    if (mostRecentLastAccessed > (lastRecordedAt + 250)) {
      recordTabSwitchEvent(mostRecentTabId, mostRecentLastAccessed);
    }
  }
}

function getTabSwitchRank(tab, now) {
  const safeNow = typeof now === 'number' ? now : Date.now();
  const stat = getTabSwitchStat(tab && typeof tab.id === 'number' ? tab.id : null, false);
  if (!stat) {
    return {
      score: 0,
      shortCount: 0,
      dayCount: 0,
      highFreq: false,
      hint: '',
      lastSwitchAt: 0
    };
  }
  pruneTabSwitchStat(stat, safeNow);
  const shortBoundary = safeNow - TAB_SWITCH_WINDOW_SHORT_MS;
  const dayBoundary = safeNow - TAB_SWITCH_WINDOW_DAY_MS;
  let shortCount = 0;
  let dayCount = 0;
  for (let i = 0; i < stat.events.length; i += 1) {
    const ts = Number(stat.events[i]) || 0;
    if (ts >= dayBoundary) {
      dayCount += 1;
    }
    if (ts >= shortBoundary) {
      shortCount += 1;
    }
  }
  const lastSwitchAt = Number(stat.lastSwitchAt) || 0;
  const minutesSinceSwitch = lastSwitchAt > 0 ? (safeNow - lastSwitchAt) / 60000 : 999999;
  const recencyBoost = Math.exp(-Math.max(0, minutesSinceSwitch) / 16);
  const score = (shortCount * 8) + (dayCount * 2.6) + (recencyBoost * 3.2);
  const highFreq = shortCount >= TAB_SWITCH_HIGH_FREQ_SHORT_THRESHOLD || dayCount >= TAB_SWITCH_HIGH_FREQ_DAY_THRESHOLD;
  const hint = highFreq
    ? (shortCount >= TAB_SWITCH_HIGH_FREQ_SHORT_THRESHOLD
      ? `近30分钟切换${shortCount}次`
      : `近24小时切换${dayCount}次`)
    : '';
  return {
    score: score,
    shortCount: shortCount,
    dayCount: dayCount,
    highFreq: highFreq,
    hint: hint,
    lastSwitchAt: lastSwitchAt
  };
}

function sortTabsForOverlay(tabs) {
  const list = Array.isArray(tabs) ? tabs.slice() : [];
  const now = Date.now();
  const sortAt = now;
  return list
    .map((tab, index) => {
      const rank = getTabSwitchRank(tab, now);
      const lastAccessed = Number(tab && tab.lastAccessed) || 0;
      const idleMinutes = lastAccessed > 0 ? (now - lastAccessed) / 60000 : 999999;
      const accessBoost = Math.exp(-Math.max(0, idleMinutes) / 30);
      return {
        tab: {
          ...tab,
          _xTabRankScore: rank.score,
          _xTabSwitchCount30m: rank.shortCount,
          _xTabSwitchCount24h: rank.dayCount,
          _xTabDebugEventTotal: tabSwitchEventDebugTotal,
          _xTabLastAccessedRaw: lastAccessed,
          _xTabSortAt: sortAt,
          _xTabRankHighFreq: rank.highFreq,
          _xTabRankHint: rank.hint
        },
        score: rank.score + accessBoost,
        lastAccessed: lastAccessed,
        index: index
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (b.lastAccessed !== a.lastAccessed) {
        return b.lastAccessed - a.lastAccessed;
      }
      return a.index - b.index;
    })
    .map((item) => item.tab);
}

function createOverlayTabPayload(tab, fetchSeq) {
  return {
    id: tab.id,
    title: typeof tab.title === 'string' ? tab.title : '',
    url: typeof tab.url === 'string' ? tab.url : '',
    favIconUrl: typeof tab.favIconUrl === 'string' ? tab.favIconUrl : '',
    _xTabRankScore: tab._xTabRankScore,
    _xTabSwitchCount30m: tab._xTabSwitchCount30m,
    _xTabSwitchCount24h: tab._xTabSwitchCount24h,
    _xTabDebugEventTotal: tab._xTabDebugEventTotal,
    _xTabLastAccessedRaw: tab._xTabLastAccessedRaw,
    _xTabSortAt: tab._xTabSortAt,
    _xTabRankHighFreq: tab._xTabRankHighFreq,
    _xTabRankHint: tab._xTabRankHint,
    _xTabFetchSeq: fetchSeq
  };
}

if (storageArea) {
  storageArea.get([
    RESTRICTED_ACTION_STORAGE_KEY,
    RESTRICTED_ACTION_AUTO_BROWSER_SETTING_DONE_STORAGE_KEY,
    DOCUMENT_PIP_ENABLED_STORAGE_KEY,
    TAB_SWITCHER_ENABLED_STORAGE_KEY,
    PINNED_TAB_RECOVERY_ENABLED_STORAGE_KEY
  ], (storedResult) => {
    const result = storedResult || {};
    const stored = result[RESTRICTED_ACTION_STORAGE_KEY];
    const normalized = stored === 'none' ? 'none' : 'default';
    if (normalized !== stored) {
      storageArea.set({ [RESTRICTED_ACTION_STORAGE_KEY]: normalized });
    }
    restrictedActionCache = normalized;
    restrictedActionAutoBrowserSettingDoneCache = result[RESTRICTED_ACTION_AUTO_BROWSER_SETTING_DONE_STORAGE_KEY] === true;
    const documentPipStored = result[DOCUMENT_PIP_ENABLED_STORAGE_KEY];
    const normalizedDocumentPip = documentPipStored === true;
    if (documentPipStored !== normalizedDocumentPip) {
      storageArea.set({ [DOCUMENT_PIP_ENABLED_STORAGE_KEY]: normalizedDocumentPip });
    }
    documentPipEnabledCache = normalizedDocumentPip;
    resolveDocumentPipEnabledReady();
    const tabSwitcherStored = result[TAB_SWITCHER_ENABLED_STORAGE_KEY];
    const normalizedTabSwitcher = SETTINGS.normalizeTabSwitcherEnabled(tabSwitcherStored);
    if (tabSwitcherStored !== normalizedTabSwitcher) {
      storageArea.set({ [TAB_SWITCHER_ENABLED_STORAGE_KEY]: normalizedTabSwitcher });
    }
    applyTabSwitcherEnabledSetting(normalizedTabSwitcher);
    const pinnedTabRecoveryStored = result[PINNED_TAB_RECOVERY_ENABLED_STORAGE_KEY];
    applyPinnedTabRecoverySetting(pinnedTabRecoveryStored);
    markBackgroundSettingsLoaded();
  });
} else {
  resolveDocumentPipEnabledReady();
  markBackgroundSettingsLoaded();
}

function markBackgroundSettingsLoaded() {
  backgroundSettingsLoaded = true;
  resolveBackgroundSettingsReady();
}

// A worker woken by a command, a tab event or a page hotkey runs that handler
// before its stored settings arrive. Run the callback now when they are known,
// otherwise as soon as they are, so a disabled feature stays disabled.
function whenBackgroundSettingsReady(callback) {
  if (backgroundSettingsLoaded) {
    callback();
    return;
  }
  backgroundSettingsReady.then(callback);
}

function migrateStorageIfNeeded(keys) {
  if (!storageArea || !chrome || !chrome.storage || !chrome.storage.local) {
    return;
  }
  if (isPrimaryStorageAreaName('local')) {
    return;
  }
  SETTINGS.migrateLocalSettingsToSync(chrome.storage.local, storageArea, keys);
}

function shouldIgnoreDuplicateHotkey(tabId) {
  if (typeof tabId !== 'number') {
    return false;
  }
  const now = Date.now();
  const lastAt = hotkeyInvokeAtByTabId.get(tabId) || 0;
  hotkeyInvokeAtByTabId.set(tabId, now);
  return (now - lastAt) <= HOTKEY_DUP_GUARD_MS;
}

function finishOverlayOpening(opening) {
  if (!opening || typeof opening.tabId !== 'number') {
    return;
  }
  if (opening.timer) {
    clearTimeout(opening.timer);
    opening.timer = null;
  }
  if (overlayOpeningByTabId.get(opening.tabId) === opening) {
    overlayOpeningByTabId.delete(opening.tabId);
  }
}

function beginOverlayOpening(tab, source) {
  if (!tab || typeof tab.id !== 'number') {
    return null;
  }
  const existing = overlayOpeningByTabId.get(tab.id);
  if (existing) {
    logHotkeyDebug('overlay-opening-guarded', {
      tabId: tab.id,
      source: source || '',
      age: Date.now() - existing.startedAt
    });
    return null;
  }
  const opening = {
    tabId: tab.id,
    source: source || '',
    startedAt: Date.now(),
    timer: null
  };
  opening.timer = setTimeout(() => {
    finishOverlayOpening(opening);
  }, OVERLAY_OPENING_GUARD_MS);
  overlayOpeningByTabId.set(tab.id, opening);
  return opening;
}

function rememberPageHotkeyContext(tab) {
  if (!tab || typeof tab.id !== 'number' || typeof tab.windowId !== 'number') {
    lastPageHotkeyContext = null;
    return;
  }
  lastPageHotkeyContext = {
    at: Date.now(),
    tabId: tab.id,
    windowId: tab.windowId
  };
}

function getRecentPageHotkeyContext(windowId) {
  if (!lastPageHotkeyContext) {
    return null;
  }
  const age = Date.now() - Number(lastPageHotkeyContext.at || 0);
  if (age > PAGE_HOTKEY_NEWTAB_RECOVER_MS) {
    lastPageHotkeyContext = null;
    return null;
  }
  if (typeof windowId === 'number' && lastPageHotkeyContext.windowId !== windowId) {
    return null;
  }
  return lastPageHotkeyContext;
}

function clearRecentPageHotkeyContext() {
  lastPageHotkeyContext = null;
}

function getOverlayPrefillQueryForSource(tab, source) {
  if (source !== 'page-hotkey-prefill' && source !== 'commands-prefill') {
    return '';
  }
  return getResolvedTabUrl(tab);
}

function recoverFromPageHotkeyNewtab(newTabId, windowId) {
  const recentContext = getRecentPageHotkeyContext(windowId);
  if (!recentContext || typeof newTabId !== 'number') {
    return;
  }
  chrome.tabs.query({ windowId: recentContext.windowId }, (tabs) => {
    const tabList = Array.isArray(tabs) ? tabs : [];
    const newTab = tabList.find((item) => item && item.id === newTabId) || null;
    const sourceTab = tabList.find((item) => item && item.id === recentContext.tabId) || null;
    const newTabUrl = getResolvedTabUrl(newTab);
    if (!newTab || (!isLumnoNewtabUrl(newTabUrl) && !isBrowserNewtabUrl(newTabUrl))) {
      return;
    }
    if (!sourceTab || !canOpenOverlayOnUrl(getResolvedTabUrl(sourceTab))) {
      clearRecentPageHotkeyContext();
      return;
    }
    clearRecentPageHotkeyContext();
    logHotkeyDebug('page-hotkey-newtab-recover-start', {
      windowId: recentContext.windowId,
      sourceTabId: sourceTab.id,
      newTabId: newTab.id,
      sourceUrl: getResolvedTabUrl(sourceTab),
      newTabUrl: newTabUrl
    });
    chrome.tabs.update(sourceTab.id, { active: true }, () => {
      if (chrome.runtime && chrome.runtime.lastError) {
        logHotkeyDebug('page-hotkey-newtab-recover-failed', {
          step: 'activate-source',
          sourceTabId: sourceTab.id,
          error: chrome.runtime.lastError.message || 'unknown'
        });
        return;
      }
      chrome.tabs.remove(newTab.id, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          logHotkeyDebug('page-hotkey-newtab-close-failed', {
            newTabId: newTab.id,
            error: chrome.runtime.lastError.message || 'unknown'
          });
        }
      });
    });
  });
}

loadFirefoxBrandIcon();

function getOverlayLoadingRecordStorageArea() {
  return chrome && chrome.storage && chrome.storage.session &&
    typeof chrome.storage.session.get === 'function'
    ? chrome.storage.session
    : null;
}

function getOverlayNavigationStateStorageKey(tabId) {
  return `${OVERLAY_NAVIGATION_STATE_STORAGE_PREFIX}${tabId}`;
}

function setOverlayNavigationState(state) {
  if (!state || typeof state.tabId !== 'number') {
    return;
  }
  overlayNavigationStateByTabId.set(state.tabId, state);
  const sessionArea = getOverlayLoadingRecordStorageArea();
  if (!sessionArea || typeof sessionArea.set !== 'function') {
    return;
  }
  try {
    sessionArea.set({
      [getOverlayNavigationStateStorageKey(state.tabId)]: state
    }, ignoreExpectedChromeError);
  } catch (error) {
    // The in-memory state still covers the current service-worker lifetime.
  }
}

function clearOverlayNavigationState(tabId) {
  if (typeof tabId !== 'number') {
    return;
  }
  overlayNavigationStateByTabId.delete(tabId);
  const sessionArea = getOverlayLoadingRecordStorageArea();
  if (!sessionArea || typeof sessionArea.remove !== 'function') {
    return;
  }
  try {
    sessionArea.remove(getOverlayNavigationStateStorageKey(tabId), ignoreExpectedChromeError);
  } catch (error) {
    // Ignore session-storage cleanup failures.
  }
}

function getOverlayNavigationState(tabId, callback) {
  const done = typeof callback === 'function' ? callback : () => {};
  if (typeof tabId !== 'number') {
    done(null);
    return;
  }
  const isExpired = (state) => OVERLAY_LOADING_LIFECYCLE.isNavigationStateExpired(
      state,
      Date.now(),
      OVERLAY_NAVIGATION_STATE_TTL_MS
    );
  const cached = overlayNavigationStateByTabId.get(tabId) || null;
  if (cached) {
    if (isExpired(cached)) {
      clearOverlayNavigationState(tabId);
      done(null);
      return;
    }
    done(cached);
    return;
  }
  const sessionArea = getOverlayLoadingRecordStorageArea();
  if (!sessionArea) {
    done(null);
    return;
  }
  const storageKey = getOverlayNavigationStateStorageKey(tabId);
  try {
    sessionArea.get(storageKey, (result) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        done(null);
        return;
      }
      const stored = result && result[storageKey] && typeof result[storageKey] === 'object'
        ? result[storageKey]
        : null;
      if (!stored || stored.tabId !== tabId || isExpired(stored)) {
        if (stored) {
          clearOverlayNavigationState(tabId);
        }
        done(null);
        return;
      }
      overlayNavigationStateByTabId.set(tabId, stored);
      done(stored);
    });
  } catch (error) {
    done(null);
  }
}

function rememberOverlayTopFrameNavigation(details) {
  const state = OVERLAY_LOADING_LIFECYCLE.createTopFrameNavigationState(details, Date.now());
  if (state) {
    setOverlayNavigationState(state);
  }
}

function updateOverlayTopFrameNavigation(details) {
  if (!details || typeof details.tabId !== 'number' || details.frameId !== 0) {
    return;
  }
  getOverlayNavigationState(details.tabId, (state) => {
    if (!state) {
      return;
    }
    const nextState = OVERLAY_LOADING_LIFECYCLE.updateTopFrameNavigationState(
      state,
      details,
      Date.now()
    );
    if (nextState) {
      setOverlayNavigationState(nextState);
    }
  });
}

function getOverlayLoadingRecordStorageKey(tabId) {
  return `${OVERLAY_LOADING_RECORD_STORAGE_PREFIX}${tabId}`;
}

function setOverlayLoadingRecord(record) {
  if (!record || typeof record.tabId !== 'number') {
    return;
  }
  const currentRecord = overlayLoadingRecordsByTabId.get(record.tabId) || null;
  const currentSession = currentRecord && currentRecord.session &&
    typeof currentRecord.session === 'object'
    ? currentRecord.session
    : null;
  const incomingSession = record.session && typeof record.session === 'object'
    ? record.session
    : null;
  const shouldPreserveCurrentSession = Boolean(
    currentSession &&
    (!incomingSession ||
      Number(currentSession.revision || 0) > Number(incomingSession.revision || 0) ||
      (Number(currentSession.revision || 0) === Number(incomingSession.revision || 0) &&
        Number(currentSession.updatedAt || 0) > Number(incomingSession.updatedAt || 0)))
  );
  const currentStableCompletionToken = Math.max(
    0,
    Number(currentRecord && currentRecord.stableCompletionToken) || 0
  );
  const incomingStableCompletionToken = Math.max(
    0,
    Number(record.stableCompletionToken) || 0
  );
  const shouldPreserveCurrentStability = Boolean(
    currentRecord && currentStableCompletionToken >= incomingStableCompletionToken
  );
  const nextRecord = {
    ...record,
    session: shouldPreserveCurrentSession ? currentSession : incomingSession,
    stableCompletionToken: shouldPreserveCurrentStability
      ? currentStableCompletionToken
      : incomingStableCompletionToken,
    stableCompletionStartedAt: shouldPreserveCurrentStability
      ? Number(currentRecord.stableCompletionStartedAt) || 0
      : Number(record.stableCompletionStartedAt) || 0,
    stableCompletionUrl: shouldPreserveCurrentStability
      ? String(currentRecord.stableCompletionUrl || '')
      : String(record.stableCompletionUrl || '')
  };
  overlayLoadingRecordsByTabId.set(record.tabId, nextRecord);
  const sessionArea = getOverlayLoadingRecordStorageArea();
  if (!sessionArea || typeof sessionArea.set !== 'function') {
    return;
  }
  try {
    sessionArea.set({
      [getOverlayLoadingRecordStorageKey(record.tabId)]: nextRecord
    }, ignoreExpectedChromeError);
  } catch (error) {
    // The in-memory record still covers ordinary loading lifetimes.
  }
}

function clearOverlayLoadingRecord(tabId) {
  if (typeof tabId !== 'number') {
    return;
  }
  overlayLoadingRecordsByTabId.delete(tabId);
  overlayLoadingRecoveryInFlightByTabId.delete(tabId);
  overlayLoadingPendingUpdateByTabId.delete(tabId);
  const sessionArea = getOverlayLoadingRecordStorageArea();
  if (!sessionArea || typeof sessionArea.remove !== 'function') {
    return;
  }
  try {
    sessionArea.remove(getOverlayLoadingRecordStorageKey(tabId), ignoreExpectedChromeError);
  } catch (error) {
    // Ignore session-storage cleanup failures.
  }
}

function getOverlayLoadingRecord(tabId, callback) {
  const done = typeof callback === 'function' ? callback : () => {};
  if (typeof tabId !== 'number') {
    done(null);
    return;
  }
  const cached = overlayLoadingRecordsByTabId.get(tabId) || null;
  if (cached) {
    if (OVERLAY_LOADING_LIFECYCLE.isExpired(
          cached,
          Date.now(),
          OVERLAY_LOADING_RECORD_TTL_MS
        )) {
      clearOverlayLoadingRecord(tabId);
      done(null);
      return;
    }
    done(cached);
    return;
  }
  const sessionArea = getOverlayLoadingRecordStorageArea();
  if (!sessionArea) {
    done(null);
    return;
  }
  const storageKey = getOverlayLoadingRecordStorageKey(tabId);
  try {
    sessionArea.get(storageKey, (result) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        done(null);
        return;
      }
      const stored = result && result[storageKey] && typeof result[storageKey] === 'object'
        ? result[storageKey]
        : null;
      if (!stored || stored.tabId !== tabId ||
          (OVERLAY_LOADING_LIFECYCLE.isExpired(
              stored,
              Date.now(),
              OVERLAY_LOADING_RECORD_TTL_MS
            ))) {
        if (stored) {
          clearOverlayLoadingRecord(tabId);
        }
        done(null);
        return;
      }
      overlayLoadingRecordsByTabId.set(tabId, stored);
      done(stored);
    });
  } catch (error) {
    done(null);
  }
}

function rememberOverlayLoadingRecord(activeTab, source, options) {
  const settings = options && typeof options === 'object' ? options : {};
  if (settings.loadingRecovery === true) {
    return settings.loadingRecord || overlayLoadingRecordsByTabId.get(activeTab.id) || null;
  }
  const record = OVERLAY_LOADING_LIFECYCLE.createRecord(activeTab, source, Date.now());
  if (!record) {
    clearOverlayLoadingRecord(activeTab.id);
    return null;
  }
  setOverlayLoadingRecord(record);
  overlayLoadingRecoveryInFlightByTabId.add(activeTab.id);
  return record;
}

function getPendingOverlayNavigationUrl(tab) {
  return OVERLAY_LOADING_LIFECYCLE.getPendingInjectableUrl(
    tab,
    canOpenOverlayOnUrl
  );
}

function shouldDeferRestrictedOverlayNavigation(tab) {
  return OVERLAY_LOADING_LIFECYCLE.shouldDeferRestrictedLoadingTab(
    tab,
    canOpenOverlayOnUrl
  );
}

function rememberOverlayPendingNavigationIntent(activeTab, source, pendingUrl) {
  if (!activeTab || typeof activeTab.id !== 'number') {
    return null;
  }
  const record = OVERLAY_LOADING_LIFECYCLE.createRecord(activeTab, source, Date.now());
  if (!record) {
    return null;
  }
  const currentRecord = overlayLoadingRecordsByTabId.get(activeTab.id) || null;
  const nextRecord = {
    ...record,
    documentId: currentRecord && currentRecord.documentId
      ? currentRecord.documentId
      : record.documentId,
    session: currentRecord && currentRecord.session
      ? currentRecord.session
      : record.session,
    pendingNavigationDeferred: true,
    pendingNavigationUrl: typeof pendingUrl === 'string' ? pendingUrl : ''
  };
  setOverlayLoadingRecord(nextRecord);
  logHotkeyDebug('overlay-deferred-for-pending-navigation', {
    tabId: activeTab.id,
    currentUrl: typeof activeTab.url === 'string' ? activeTab.url : '',
    pendingUrl: typeof pendingUrl === 'string' ? pendingUrl : '',
    source: source || ''
  });
  return nextRecord;
}

function queueOverlayLoadingUpdate(tabId, changeInfo, tab) {
  const current = overlayLoadingPendingUpdateByTabId.get(tabId) || null;
  const incomingComplete = Boolean(changeInfo && changeInfo.status === 'complete');
  const incomingDocumentStarted = Boolean(changeInfo && changeInfo.documentStarted === true);
  const currentComplete = Boolean(current && current.changeInfo &&
    current.changeInfo.status === 'complete');
  if (currentComplete && !incomingComplete && !incomingDocumentStarted) {
    return;
  }
  overlayLoadingPendingUpdateByTabId.set(tabId, {
    changeInfo: { ...(changeInfo || {}) },
    tab: tab ? { ...tab } : null
  });
}

function finishOverlayLoadingOpenAttempt(tabId) {
  if (typeof tabId !== 'number' ||
      !overlayLoadingRecoveryInFlightByTabId.has(tabId)) {
    return;
  }
  overlayLoadingRecoveryInFlightByTabId.delete(tabId);
  const pendingUpdate = overlayLoadingPendingUpdateByTabId.get(tabId) || null;
  overlayLoadingPendingUpdateByTabId.delete(tabId);
  if (!pendingUpdate) {
    return;
  }
  setTimeout(() => {
    recoverOverlayAfterLoadingUpdate(
      tabId,
      pendingUpdate.changeInfo,
      pendingUpdate.tab
    );
  }, 0);
}

function markOverlayLoadingRecordUnstable(tabId, callback) {
  const done = typeof callback === 'function' ? callback : () => {};
  getOverlayLoadingRecord(tabId, (record) => {
    if (!record) {
      done(null);
      return;
    }
    const nextRecord = {
      ...record,
      stableCompletionToken: Math.max(0, Number(record.stableCompletionToken) || 0) + 1,
      stableCompletionStartedAt: 0,
      stableCompletionUrl: '',
      updatedAt: Date.now()
    };
    setOverlayLoadingRecord(nextRecord);
    done(nextRecord);
  });
}

function scheduleOverlayLoadingStableCompletion(tab, record) {
  if (!tab || typeof tab.id !== 'number' || !record) {
    return;
  }
  const currentRecord = overlayLoadingRecordsByTabId.get(tab.id) || record;
  const stableCompletionToken = Math.max(
    0,
    Number(currentRecord.stableCompletionToken) || 0
  ) + 1;
  const stableCompletionUrl = getResolvedTabUrl(tab);
  const nextRecord = {
    ...currentRecord,
    stableCompletionToken,
    stableCompletionStartedAt: Date.now(),
    stableCompletionUrl,
    updatedAt: Date.now()
  };
  setOverlayLoadingRecord(nextRecord);
  setTimeout(() => {
    getOverlayLoadingRecord(tab.id, (latestRecord) => {
      if (!latestRecord ||
          Number(latestRecord.stableCompletionToken) !== stableCompletionToken ||
          latestRecord.stableCompletionUrl !== stableCompletionUrl) {
        return;
      }
      const finalizeWithCurrentTab = (currentTab) => {
        if (!currentTab || currentTab.status !== 'complete' ||
            getResolvedTabUrl(currentTab) !== stableCompletionUrl) {
          return;
        }
        recoverOverlayAfterLoadingUpdate(
          tab.id,
          {
            status: 'complete',
            stable: true,
            stableCompletionToken
          },
          currentTab
        );
      };
      if (chrome.tabs && typeof chrome.tabs.get === 'function') {
        chrome.tabs.get(tab.id, (currentTab) => {
          if (chrome.runtime && chrome.runtime.lastError) {
            return;
          }
          finalizeWithCurrentTab(currentTab);
        });
        return;
      }
      finalizeWithCurrentTab(tab);
    });
  }, OVERLAY_LOADING_STABLE_COMPLETE_MS);
}

function updateOverlayLoadingRecordFromInvocation(activeTab, results) {
  if (!activeTab || typeof activeTab.id !== 'number') {
    return;
  }
  const record = overlayLoadingRecordsByTabId.get(activeTab.id) || null;
  if (!record) {
    return;
  }
  const outcome = OVERLAY_LOADING_LIFECYCLE.applyInvocationResult(
    record,
    results,
    Date.now()
  );
  if (outcome.action === 'clear') {
    clearOverlayLoadingRecord(activeTab.id);
    return;
  }
  if (outcome.record) {
    setOverlayLoadingRecord(outcome.record);
  }
}

function updateOverlayLoadingSessionFromMessage(request, sender, sendResponse) {
  const senderTab = sender && sender.tab ? sender.tab : null;
  if (!senderTab || typeof senderTab.id !== 'number' ||
      (typeof sender.frameId === 'number' && sender.frameId !== 0)) {
    sendResponse({ ok: false, tracked: false });
    return;
  }
  getOverlayLoadingRecord(senderTab.id, (record) => {
    if (!record) {
      sendResponse({ ok: true, tracked: false });
      return;
    }
    const outcome = OVERLAY_LOADING_LIFECYCLE.applySessionUpdate(
      record,
      request && request.session,
      {
        documentId: sender && typeof sender.documentId === 'string'
          ? sender.documentId
          : '',
        now: Date.now()
      }
    );
    if (!outcome.record) {
      sendResponse({ ok: true, tracked: false });
      return;
    }
    setOverlayLoadingRecord(outcome.record);
    sendResponse({
      ok: true,
      tracked: outcome.reason !== 'stale-document'
    });
  });
}

function probeOverlayLoadingState(tabId, callback) {
  chrome.scripting.executeScript({
    target: { tabId },
    injectImmediately: true,
    func: (runtimeVersion, hostId) => {
      const rawOpenState = window._x_extension_search_overlay_open_2026_unique_;
      const host = document.getElementById(hostId);
      return {
        runtimeReady:
          window._x_extension_search_overlay_runtime_version_2026_unique_ === runtimeVersion &&
          typeof window._x_extension_toggleSearchOverlay_2026_unique_ === 'function',
        overlayOpenState: rawOpenState === true
          ? 'open'
          : (rawOpenState === false ? 'closed' : 'unknown'),
        overlayConnected: Boolean(host && host.isConnected)
      };
    },
    args: [OVERLAY_RUNTIME_VERSION, OVERLAY_HOST_ID]
  }, callback);
}

function scheduleOverlayLoadingRecoveryRetry(tab, record) {
  if (!tab || typeof tab.id !== 'number' || !record) {
    return;
  }
  const recoveryAttempts = Math.max(0, Number(record.recoveryAttempts) || 0) + 1;
  if (recoveryAttempts > OVERLAY_LOADING_RECOVERY_MAX_ATTEMPTS) {
    clearOverlayLoadingRecord(tab.id);
    return;
  }
  const nextRecord = {
    ...record,
    recoveryAttempts,
    updatedAt: Date.now()
  };
  setOverlayLoadingRecord(nextRecord);
  setTimeout(() => {
    recoverOverlayAfterLoadingUpdate(tab.id, { status: 'complete' }, tab);
  }, OVERLAY_LOADING_RECOVERY_RETRY_MS * recoveryAttempts);
}

function scheduleOverlayLoadingPreCompleteRetry(tab, record) {
  if (!tab || typeof tab.id !== 'number' || !record) {
    return;
  }
  const committedUrl = getResolvedTabUrl(tab);
  if (!canOpenOverlayOnUrl(committedUrl)) {
    return;
  }
  const currentRecord = overlayLoadingRecordsByTabId.get(tab.id) || record;
  const previousAttempts = currentRecord.preCompleteRetryUrl === committedUrl
    ? Math.max(0, Number(currentRecord.preCompleteRecoveryAttempts) || 0)
    : 0;
  const preCompleteRecoveryAttempts = previousAttempts + 1;
  if (preCompleteRecoveryAttempts > OVERLAY_LOADING_PRE_COMPLETE_RETRY_MAX_ATTEMPTS) {
    logHotkeyDebug('loading-pre-complete-retry-paused', {
      tabId: tab.id,
      url: committedUrl,
      source: currentRecord.source || ''
    });
    return;
  }
  const nextRecord = {
    ...currentRecord,
    preCompleteRetryUrl: committedUrl,
    preCompleteRecoveryAttempts,
    updatedAt: Date.now()
  };
  setOverlayLoadingRecord(nextRecord);
  setTimeout(() => {
    getOverlayLoadingRecord(tab.id, (latestRecord) => {
      if (!latestRecord || latestRecord.preCompleteRetryUrl !== committedUrl ||
          Number(latestRecord.preCompleteRecoveryAttempts) !== preCompleteRecoveryAttempts) {
        return;
      }
      const retryWithCurrentTab = (currentTab) => {
        const stillTracked = overlayLoadingRecordsByTabId.get(tab.id) || null;
        if (!stillTracked || stillTracked.preCompleteRetryUrl !== committedUrl ||
            Number(stillTracked.preCompleteRecoveryAttempts) !== preCompleteRecoveryAttempts) {
          return;
        }
        const retryTab = currentTab && typeof currentTab === 'object'
          ? currentTab
          : tab;
        const retryUrl = getResolvedTabUrl(retryTab);
        if (!canOpenOverlayOnUrl(retryUrl)) {
          return;
        }
        const retryChangeInfo = retryTab.status === 'complete'
          ? { status: retryTab.status }
          : { url: retryUrl };
        recoverOverlayAfterLoadingUpdate(tab.id, retryChangeInfo, retryTab);
      };
      if (chrome.tabs && typeof chrome.tabs.get === 'function') {
        chrome.tabs.get(tab.id, (currentTab) => {
          if (chrome.runtime && chrome.runtime.lastError) {
            return;
          }
          retryWithCurrentTab(currentTab);
        });
        return;
      }
      retryWithCurrentTab(tab);
    });
  }, OVERLAY_LOADING_PRE_COMPLETE_RETRY_MS * preCompleteRecoveryAttempts);
}

function restoreOverlayAfterLoadingDocumentChange(tab, record, complete) {
  if (!tab || typeof tab.id !== 'number' || !record) {
    return;
  }
  openOverlayOnTab(tab, [], record.source, {
    loadingRecovery: true,
    loadingRecord: record,
    ensureOpen: true,
    skipDuplicateGuard: true,
    onComplete: (ok) => {
      if (complete === true) {
        if (ok) {
          const restoredRecord = overlayLoadingRecordsByTabId.get(tab.id) || record;
          if (!overlayLoadingPendingUpdateByTabId.has(tab.id)) {
            scheduleOverlayLoadingStableCompletion(tab, restoredRecord);
          }
        } else {
          scheduleOverlayLoadingRecoveryRetry(tab, record);
        }
        return;
      }
      if (!ok) {
        logHotkeyDebug('loading-recovery-failed', {
          tabId: tab.id,
          source: record.source || ''
        });
        scheduleOverlayLoadingPreCompleteRetry(tab, record);
      }
    }
  });
}

function recoverOverlayAfterLoadingUpdate(tabId, changeInfo, tab) {
  const isComplete = Boolean(changeInfo && changeInfo.status === 'complete');
  const isStableComplete = Boolean(isComplete && changeInfo && changeInfo.stable === true);
  const isCommittedUrl = Boolean(changeInfo && typeof changeInfo.url === 'string');
  if (!isComplete && !isCommittedUrl) {
    return;
  }
  if (overlayLoadingRecoveryInFlightByTabId.has(tabId)) {
    queueOverlayLoadingUpdate(tabId, changeInfo, tab);
    return;
  }
  getOverlayLoadingRecord(tabId, (record) => {
    if (!record) {
      return;
    }
    if (isStableComplete &&
        Number(changeInfo.stableCompletionToken) !== Number(record.stableCompletionToken)) {
      return;
    }
    if (overlayLoadingRecoveryInFlightByTabId.has(tabId)) {
      queueOverlayLoadingUpdate(tabId, changeInfo, tab);
      return;
    }
    const resolvedTab = Object.assign({}, tab || {}, { id: tabId });
    if (isCommittedUrl) {
      resolvedTab.url = changeInfo.url;
    }
    const resolvedUrl = getResolvedTabUrl(resolvedTab);
    if (!canOpenOverlayOnUrl(resolvedUrl)) {
      const trackedPendingUrl = typeof record.pendingNavigationUrl === 'string'
        ? record.pendingNavigationUrl
        : '';
      if (!isComplete && canOpenOverlayOnUrl(trackedPendingUrl)) {
        return;
      }
      const shouldReplayRestrictedIntent = isComplete &&
        record.pendingNavigationDeferred === true;
      clearOverlayLoadingRecord(tabId);
      if (shouldReplayRestrictedIntent) {
        const settledTab = {
          ...resolvedTab,
          status: 'complete',
          pendingUrl: ''
        };
        setTimeout(() => {
          openOverlayOnTab(settledTab, [], record.source, {
            skipDuplicateGuard: true
          });
        }, 0);
      }
      return;
    }
    overlayLoadingRecoveryInFlightByTabId.add(tabId);
    probeOverlayLoadingState(tabId, (results) => {
      const pendingDocumentStart = overlayLoadingPendingUpdateByTabId.get(tabId);
      if (pendingDocumentStart && pendingDocumentStart.changeInfo &&
          pendingDocumentStart.changeInfo.documentStarted === true) {
        finishOverlayLoadingOpenAttempt(tabId);
        return;
      }
      if (chrome.runtime && chrome.runtime.lastError) {
        if (isComplete) {
          restoreOverlayAfterLoadingDocumentChange(resolvedTab, record, true);
        } else {
          finishOverlayLoadingOpenAttempt(tabId);
          scheduleOverlayLoadingPreCompleteRetry(resolvedTab, record);
        }
        return;
      }
      const outcome = OVERLAY_LOADING_LIFECYCLE.decideRecovery(record, results, {
        complete: isComplete,
        stable: isStableComplete,
        now: Date.now(),
        ttlMs: OVERLAY_LOADING_RECORD_TTL_MS
      });
      if (outcome.action === 'clear' || outcome.action === 'none') {
        clearOverlayLoadingRecord(tabId);
        return;
      }
      if (outcome.record) {
        setOverlayLoadingRecord(outcome.record);
      }
      if (outcome.action === 'keep') {
        const hasPendingLoadingUpdate = overlayLoadingPendingUpdateByTabId.has(tabId);
        finishOverlayLoadingOpenAttempt(tabId);
        if (isComplete && !isStableComplete && !hasPendingLoadingUpdate) {
          scheduleOverlayLoadingStableCompletion(
            resolvedTab,
            outcome.record || record
          );
        }
        return;
      }
      restoreOverlayAfterLoadingDocumentChange(
        resolvedTab,
        outcome.record || record,
        isComplete
      );
    });
  });
}

function recoverOverlayAfterTopFrameDocumentStart(request, sender) {
  const senderTab = sender && sender.tab ? sender.tab : null;
  if (!senderTab || typeof senderTab.id !== 'number' ||
      (typeof sender.frameId === 'number' && sender.frameId !== 0)) {
    return false;
  }
  const documentUrl = request && typeof request.documentUrl === 'string' &&
    request.documentUrl.trim()
    ? request.documentUrl.trim()
    : getResolvedTabUrl(senderTab);
  const committedTab = {
    ...senderTab,
    status: 'loading',
    url: documentUrl
  };
  markOverlayLoadingRecordUnstable(senderTab.id, () => {
    recoverOverlayAfterLoadingUpdate(
      senderTab.id,
      { url: documentUrl, documentStarted: true },
      committedTab
    );
  });
  return true;
}

function openRestrictedOverlayFallback(activeTab, activeUrl, source) {
  const action = restrictedActionCache || 'default';
  logHotkeyDebug('restricted-url', {
    action: action,
    url: activeUrl,
    source: source || ''
  });
  if (action === 'none') {
    logHotkeyDebug('fallback-open-browser-newtab', { reason: 'restricted_url', source: source || '' });
    openBrowserNewtabFallback({ sourceTab: activeTab });
    return;
  }
  if (action === 'default') {
    logHotkeyDebug('fallback-open-create-newtab', { reason: 'restricted_url', source: source || '' });
    openNewtabFallbackForUrl(activeUrl, { sourceTab: activeTab });
    return;
  }
  logHotkeyDebug('fallback-open-lumno-newtab', { reason: 'restricted_url', source: source || '' });
  openNewtabFallbackForUrl(activeUrl, { sourceTab: activeTab });
}

function openOverlayOnTab(activeTab, tabs, source, options) {
  const openOptions = options && typeof options === 'object' ? options : {};
  const overlayOpenStartedAt = Date.now();
  let overlayOpening = null;
  let didFinishOpenAttempt = false;
  let shouldRetryPreCompleteFailure = false;
  const finishOpenAttempt = (ok) => {
    if (didFinishOpenAttempt) {
      return;
    }
    didFinishOpenAttempt = true;
    if (typeof openOptions.onComplete === 'function') {
      openOptions.onComplete(ok === true);
    }
    if (overlayOpening) {
      finishOverlayOpening(overlayOpening);
      overlayOpening = null;
    }
    if (ok !== true && openOptions.loadingRecovery !== true &&
        shouldRetryPreCompleteFailure && activeTab &&
        typeof activeTab.id === 'number') {
      const trackedRecord = overlayLoadingRecordsByTabId.get(activeTab.id) || null;
      if (trackedRecord) {
        scheduleOverlayLoadingPreCompleteRetry(activeTab, trackedRecord);
      }
    }
    if ((openOptions.loadingRecovery === true || shouldRetryPreCompleteFailure) &&
        activeTab && typeof activeTab.id === 'number') {
      finishOverlayLoadingOpenAttempt(activeTab.id);
    }
  };
  if (!activeTab || typeof activeTab.id !== 'number') {
    logHotkeyDebug('no-active-tab', { source: source || '' });
    openNewtabFallback();
    finishOpenAttempt(false);
    return;
  }
  if (openOptions.skipDuplicateGuard !== true && shouldIgnoreDuplicateHotkey(activeTab.id)) {
    logHotkeyDebug('duplicate-ignored', { tabId: activeTab.id, source: source || '' });
    finishOpenAttempt(false);
    return;
  }
  const pendingNavigationUrl = getPendingOverlayNavigationUrl(activeTab);
  if (openOptions.loadingRecovery !== true &&
      shouldDeferRestrictedOverlayNavigation(activeTab) &&
      rememberOverlayPendingNavigationIntent(activeTab, source, pendingNavigationUrl)) {
    finishOpenAttempt(false);
    return;
  }
  const activeUrl = getResolvedTabUrl(activeTab);
  const rawUrl = typeof activeTab.url === 'string' ? activeTab.url : '';
  const rawPendingUrl = typeof activeTab.pendingUrl === 'string' ? activeTab.pendingUrl : '';
  const restricted = !canOpenOverlayOnUrl(activeUrl);
  logHotkeyDebug('active-tab', {
    tabId: activeTab.id,
    resolvedUrl: activeUrl,
    tabUrl: rawUrl,
    pendingUrl: rawPendingUrl,
    url: activeUrl,
    restricted: restricted,
    source: source || ''
  });
  if (restricted) {
    finishOpenAttempt(false);
    if (isSearchCommandSource(source) && (isLumnoNewtabUrl(activeUrl) || isBrowserNewtabUrl(activeUrl))) {
      requestFocusVisibleNewtabInput(source, activeTab.id);
      return;
    }
    if (shouldTriggerOnboardingOverlayFromCommand(source, activeUrl)) {
      triggerOnboardingOverlayFromCommand(activeTab, source);
      logHotkeyDebug('suppressed', { reason: 'restricted_onboarding_command', source: source || '' });
      return;
    }
    if (recoverOverlayTargetFromCommandNewtab(activeTab, tabs, source)) {
      return;
    }
    whenBackgroundSettingsReady(() => {
      openRestrictedOverlayFallback(activeTab, activeUrl, source);
    });
    return;
  }
  overlayOpening = beginOverlayOpening(activeTab, source);
  if (!overlayOpening) {
    finishOpenAttempt(false);
    return;
  }
  const overlayLoadingRecord = rememberOverlayLoadingRecord(activeTab, source, openOptions);
  shouldRetryPreCompleteFailure = Boolean(overlayLoadingRecord);
  const shouldInjectOverlayCodexDebugSurface = codexDebugBridge.isEnabled();
  const overlayInjectionFiles = [
    'src/shared/icon-font-preload.js',
    'src/shared/cjk-font-faces.js',
    ...(shouldInjectOverlayCodexDebugSurface ? ['src/shared/codex-debug-surface.js'] : []),
    'src/shared/settings.js',
    'src/shared/blacklist-utils.js',
    'src/shared/navigation-disposition.js',
    'src/shared/search-utils.js',
    'src/shared/site-search-store.js',
    'src/shared/aggregate-search-store.js',
    'src/shared/aggregate-search-surface.js',
    'src/shared/suggestion-action-model.js',
    'src/shared/suggestion-navigation.js',
    'src/shared/suggestions-height-layout.js',
    'src/shared/ime-key-guard.js',
    'src/shared/search-input-history.js',
    'src/shared/toast.js',
    'src/shared/menu-surface.js',
    'src/shared/search-source-order.js',
    'src/shared/sortable-drag.js',
    'src/shared/search-input-mode.js',
    'src/shared/shortcut-display.js',
    'src/shared/favicon-utils.js',
    'src/shared/shortcut-favicon.js',
    'src/shared/community-links.js',
    'src/shared/community-qr-dialog.js',
    'src/shared/help-center-search.js',
    'src/shared/browser-profile.js',
    'src/shared/feature-hints.js',
    'src/shared/update-notice.js',
    'src/shared/engagement-notice.js',
    'src/shared/tooltip.js',
    'src/shared/cursor-tooltip.js',
    'src/overlay/runtime.js',
    'src/newtab/favicon-theme.js',
    'src/shared/favicon-cache.js',
    'src/shared/favicon-view-core.js',
    'src/overlay/favicon-view.js',
    'src/overlay/lifecycle.js',
    'src/overlay/site-fixes.js',
    'src/overlay/page-theme.js',
    'src/overlay/notices.js',
    'src/overlay/keyboard.js',
    'src/react/overlay-islands.js',
    'src/overlay/search-panel.js'
  ];
  const runOverlayScript = (tabZoomFactor) => {
      const prefillQuery = getOverlayPrefillQueryForSource(activeTab, source);
      const prioritizeCurrentPageMatch = source === 'page-hotkey-prefill';
      const siteSearchProviders = Array.isArray(siteSearchCache) ? siteSearchCache : [];
      // Icon warmup is best effort; the overlay falls back to bundled icons.
      loadSiteSearchProviders()
        .then((providers) => {
          scheduleSiteSearchProviderIconWarmup(providers, '');
        })
        .catch(() => {});
      chrome.scripting.executeScript({
            target: {tabId: activeTab.id},
            injectImmediately: true,
            func: (overlayTabs, overlayPanelContext, overlayHostId) => {
              const toggleOverlay = window._x_extension_toggleSearchOverlay_2026_unique_;
              if (typeof toggleOverlay !== 'function') {
                console.warn('Lumno: overlay search panel helper not available.');
                return { ok: false, reason: 'search_panel_missing' };
              }
              toggleOverlay(overlayTabs, overlayPanelContext);
              const overlayHost = document.getElementById(overlayHostId);
              return {
                ok: true,
                overlayOpen:
                  window._x_extension_search_overlay_open_2026_unique_ === true &&
                  Boolean(overlayHost && overlayHost.isConnected)
              };
            },
            args: [tabs, {
              tabZoomFactor: tabZoomFactor,
              prefillQuery: prefillQuery,
              prioritizeCurrentPageMatch: prioritizeCurrentPageMatch,
              currentTabId: typeof activeTab.id === 'number' ? activeTab.id : null,
              currentTabUrl: getResolvedTabUrl(activeTab),
              openedAt: overlayOpenStartedAt,
              documentPipEnabled: documentPipEnabledCache,
              siteSearchProviders: Array.isArray(siteSearchProviders) ? siteSearchProviders : [],
              ensureOpen: openOptions.ensureOpen === true,
              loadingSessionTracked: Boolean(overlayLoadingRecord),
              loadingSession: overlayLoadingRecord && overlayLoadingRecord.session
                ? overlayLoadingRecord.session
                : null
            }, OVERLAY_HOST_ID]
          }, function(results) {
            if (chrome.runtime.lastError) {
              logHotkeyDebug('inject-failed', {
                step: 'src/overlay/search-panel.js',
                tabId: activeTab.id,
                error: chrome.runtime.lastError.message || 'unknown',
                source: source || ''
              });
              if (openOptions.loadingRecovery !== true &&
                  !overlayLoadingRecordsByTabId.has(activeTab.id)) {
                openNewtabFallback({ sourceTab: activeTab });
              }
              finishOpenAttempt(false);
              return;
            }
            const mainResult = OVERLAY_LOADING_LIFECYCLE.getMainFrameResult(results);
            const result = mainResult ? mainResult.result : null;
            if (result && result.ok === false) {
              logHotkeyDebug('inject-failed', {
                step: 'src/overlay/search-panel.js',
                tabId: activeTab.id,
                error: result.reason || 'unknown',
                source: source || ''
              });
              if (openOptions.loadingRecovery !== true &&
                  !overlayLoadingRecordsByTabId.has(activeTab.id)) {
                openNewtabFallback({ sourceTab: activeTab });
              }
              finishOpenAttempt(false);
              return;
            }
            updateOverlayLoadingRecordFromInvocation(activeTab, results);
            logHotkeyDebug('overlay-opened', {
              tabId: activeTab.id,
              tabCount: Array.isArray(tabs) ? tabs.length : 0,
              source: source || '',
              tabZoomFactor: tabZoomFactor,
              siteSearchProviderCount: Array.isArray(siteSearchProviders) ? siteSearchProviders.length : 0
            });
            finishOpenAttempt(Boolean(result && result.overlayOpen === true));
          });
  };
  const runOverlayWithResolvedZoom = () => {
    if (chrome.tabs && typeof chrome.tabs.getZoom === 'function') {
      chrome.tabs.getZoom(activeTab.id, (zoomFactor) => {
        const zoom = Number.isFinite(Number(zoomFactor)) && Number(zoomFactor) > 0
          ? Number(zoomFactor)
          : 1;
        runOverlayScript(zoom);
      });
      return;
    }
    runOverlayScript(1);
  };
  const injectOverlayRuntime = () => {
    logHotkeyDebug('inject-start', { tabId: activeTab.id, file: overlayInjectionFiles.join(','), source: source || '' });
    chrome.scripting.executeScript({
      target: {tabId: activeTab.id},
      injectImmediately: true,
      files: overlayInjectionFiles
    }, function() {
      if (chrome.runtime.lastError) {
        logHotkeyDebug('inject-failed', {
          step: overlayInjectionFiles.join(','),
          tabId: activeTab.id,
          error: chrome.runtime.lastError.message || 'unknown',
          source: source || ''
        });
        if (openOptions.loadingRecovery !== true &&
            !overlayLoadingRecordsByTabId.has(activeTab.id)) {
          openNewtabFallbackForUrl(activeUrl, { sourceTab: activeTab });
        }
        finishOpenAttempt(false);
        return;
      }
      runOverlayWithResolvedZoom();
    });
  };
  chrome.scripting.executeScript({
    target: {tabId: activeTab.id},
    injectImmediately: true,
    func: (runtimeVersion) => {
      return window._x_extension_search_overlay_runtime_version_2026_unique_ === runtimeVersion &&
        typeof window._x_extension_toggleSearchOverlay_2026_unique_ === 'function';
    },
    args: [OVERLAY_RUNTIME_VERSION]
  }, (results) => {
    const probeError = chrome.runtime.lastError;
    const runtimeReady = !probeError &&
      Array.isArray(results) &&
      results[0] &&
      results[0].result === true;
    if (runtimeReady) {
      logHotkeyDebug('runtime-reused', {
        tabId: activeTab.id,
        source: source || '',
        version: OVERLAY_RUNTIME_VERSION
      });
      runOverlayWithResolvedZoom();
      return;
    }
    injectOverlayRuntime();
  });
}

function triggerShowSearchForResolvedTab(tab, source) {
  if (!tab || typeof tab.id !== 'number') {
    logHotkeyDebug('no-active-tab', { source: source || '' });
    openNewtabFallback();
    return;
  }
  if (shouldDeferRestrictedOverlayNavigation(tab)) {
    openOverlayOnTab(tab, [], source);
    return;
  }
  const activeUrl = getResolvedTabUrl(tab);
  if (canOpenOverlayOnUrl(activeUrl)) {
    openOverlayOnTab(tab, [], source);
    return;
  }
  const windowQuery = (typeof tab.windowId === 'number')
    ? { windowId: tab.windowId }
    : { currentWindow: true };
  chrome.tabs.query(windowQuery, (tabs) => {
    const tabList = Array.isArray(tabs) ? tabs : [];
    const resolvedTab = tabList.find((item) => item && item.id === tab.id) || tab;
    openOverlayOnTab(resolvedTab, tabList, source);
  });
}

function triggerShowSearchForTab(tab, source) {
  if (!tab || typeof tab.id !== 'number') {
    triggerShowSearchForResolvedTab(tab, source);
    return;
  }
  const cachedNavigationState = overlayNavigationStateByTabId.get(tab.id) || null;
  if (cachedNavigationState) {
    const navigationTab = OVERLAY_LOADING_LIFECYCLE.applyTopFrameNavigationState(
      tab,
      cachedNavigationState,
      { now: Date.now(), ttlMs: OVERLAY_NAVIGATION_STATE_TTL_MS }
    );
    if (navigationTab !== tab) {
      triggerShowSearchForResolvedTab(navigationTab, source);
      return;
    }
    clearOverlayNavigationState(tab.id);
  }
  if (shouldDeferRestrictedOverlayNavigation(tab)) {
    openOverlayOnTab(tab, [], source);
    return;
  }
  const activeUrl = getResolvedTabUrl(tab);
  if (canOpenOverlayOnUrl(activeUrl)) {
    openOverlayOnTab(tab, [], source);
    return;
  }
  getOverlayNavigationState(tab.id, (storedNavigationState) => {
    if (storedNavigationState) {
      const navigationTab = OVERLAY_LOADING_LIFECYCLE.applyTopFrameNavigationState(
        tab,
        storedNavigationState,
        { now: Date.now(), ttlMs: OVERLAY_NAVIGATION_STATE_TTL_MS }
      );
      if (navigationTab !== tab) {
        triggerShowSearchForResolvedTab(navigationTab, source);
        return;
      }
    }
    const windowQuery = (typeof tab.windowId === 'number')
      ? { windowId: tab.windowId }
      : { currentWindow: true };
    chrome.tabs.query(windowQuery, (tabs) => {
      const tabList = Array.isArray(tabs) ? tabs : [];
      const resolvedTab = tabList.find((item) => item && item.id === tab.id) || tab;
      openOverlayOnTab(resolvedTab, tabList, source);
    });
  });
}

function detectAnyActiveVideoPiP(callback) {
  chrome.tabs.query({}, (tabs) => {
    const tabList = Array.isArray(tabs) ? tabs : [];
    const candidates = tabList.filter((tab) => {
      if (!tab || typeof tab.id !== 'number') {
        return false;
      }
      const tabUrl = getResolvedTabUrl(tab);
      if (isRestrictedUrl(tabUrl)) {
        return false;
      }
      return true;
    });
    if (!candidates.length) {
      callback(false, { checked: 0, foundTabId: null });
      return;
    }
    let pending = candidates.length;
    let finished = false;
    let checked = 0;
    const done = (active, tabId) => {
      if (finished) {
        return;
      }
      finished = true;
      callback(Boolean(active), {
        checked: checked,
        foundTabId: typeof tabId === 'number' ? tabId : null
      });
    };
    candidates.forEach((tab) => {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        func: () => {
          const pipElement = document.pictureInPictureElement;
          return {
            hasPiP: Boolean(pipElement),
            isVideoPiP: Boolean(pipElement && pipElement.tagName === 'VIDEO')
          };
        }
      }, (results) => {
        checked += 1;
        pending -= 1;
        if (finished) {
          return;
        }
        if (!chrome.runtime.lastError) {
          const payload = Array.isArray(results) && results[0] ? results[0].result : null;
          if (payload && payload.hasPiP && payload.isVideoPiP) {
            done(true, tab.id);
            return;
          }
        }
        if (pending <= 0) {
          done(false, null);
        }
      });
    });
  });
}

function openDocumentPipSettings() {
  openExtensionOptionsPage({ hash: 'labs:document-pip' });
}

function openDocumentPipPickerOnTab(activeTab, source) {
  return documentPipEnabledReady.then(() => {
    openDocumentPipPickerOnReadyTab(activeTab, source);
    return documentPipEnabledCache;
  });
}

function openDocumentPipPickerOnReadyTab(activeTab, source) {
  if (!documentPipEnabledCache) {
    logHotkeyDebug('document-pip-disabled', { source: source || '' });
    openDocumentPipSettings();
    return;
  }
  if (!activeTab || typeof activeTab.id !== 'number') {
    logHotkeyDebug('document-pip-no-active-tab', { source: source || '' });
    openExtensionOptionsPage();
    return;
  }
  const activeUrl = getResolvedTabUrl(activeTab);
  const restricted = isRestrictedUrl(activeUrl);
  logHotkeyDebug('document-pip-active-tab', {
    tabId: activeTab.id,
    url: activeUrl,
    restricted: restricted,
    source: source || ''
  });
  if (restricted) {
    logHotkeyDebug('document-pip-restricted-url', {
      tabId: activeTab.id,
      url: activeUrl,
      source: source || ''
    });
    openExtensionOptionsPage();
    return;
  }
  const injectAndInvoke = (invokeMode) => {
    chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      files: [
        'src/shared/codex-debug-surface.js',
        'src/shared/toast.js',
        'src/content/document-pip-picker.js'
      ]
    }, () => {
      if (chrome.runtime.lastError) {
        logHotkeyDebug('document-pip-inject-failed', {
          step: 'src/content/document-pip-picker.js',
          tabId: activeTab.id,
          error: chrome.runtime.lastError.message || 'unknown',
          source: source || ''
        });
        openExtensionOptionsPage();
        return;
      }
      chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: (mode) => {
          const controller = window.__lumnoDocumentPiPPicker2026;
          if (!controller || typeof controller.toggle !== 'function') {
            return { ok: false, reason: 'picker-missing' };
          }
          if (mode === 'conflict-toast') {
            if (typeof controller.notifyVideoPiPConflict === 'function') {
              return controller.notifyVideoPiPConflict();
            }
            return { ok: false, reason: 'picker-conflict-handler-missing' };
          }
          return controller.toggle();
        },
        args: [invokeMode]
      }, (results) => {
        if (chrome.runtime.lastError) {
          logHotkeyDebug('document-pip-toggle-failed', {
            step: 'toggle',
            tabId: activeTab.id,
            error: chrome.runtime.lastError.message || 'unknown',
            source: source || '',
            mode: invokeMode || 'toggle'
          });
          return;
        }
        const result = Array.isArray(results) && results[0] ? results[0].result : null;
        logHotkeyDebug('document-pip-toggle', {
          tabId: activeTab.id,
          source: source || '',
          mode: invokeMode || 'toggle',
          result: result && typeof result === 'object' ? result : {}
        });
      });
    });
  };

  detectAnyActiveVideoPiP((hasActiveVideoPiP, detail) => {
    if (hasActiveVideoPiP) {
      logHotkeyDebug('document-pip-blocked-by-active-video-pip', {
        tabId: activeTab.id,
        source: source || '',
        checkedTabs: detail && typeof detail.checked === 'number' ? detail.checked : 0,
        pipTabId: detail && typeof detail.foundTabId === 'number' ? detail.foundTabId : null
      });
      injectAndInvoke('conflict-toast');
      return;
    }
    injectAndInvoke('toggle');
  });
}

function getDefaultFallbackShortcutByPlatform(platformOs) {
  return platformOs === 'mac' ? 'Command+Shift+K' : 'Ctrl+Shift+K';
}

function getDefaultFallbackShortcut(callback) {
  if (!chrome || !chrome.runtime || typeof chrome.runtime.getPlatformInfo !== 'function') {
    callback('Ctrl+Shift+K');
    return;
  }
  chrome.runtime.getPlatformInfo((info) => {
    const os = info && typeof info.os === 'string' ? info.os : '';
    callback(getDefaultFallbackShortcutByPlatform(os));
  });
}

function getConfiguredFallbackShortcut(callback) {
  getDefaultFallbackShortcut((defaultShortcut) => {
    if (!chrome || !chrome.commands || typeof chrome.commands.getAll !== 'function') {
      callback(defaultShortcut);
      return;
    }
    chrome.commands.getAll((commands) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        callback(defaultShortcut);
        return;
      }
      const items = Array.isArray(commands) ? commands : [];
      const command = items.find((item) => item && item.name === SHOW_SEARCH_COMMAND_NAME);
      const shortcut = command && typeof command.shortcut === 'string'
        ? normalizeShortcutFromCommandsValue(command.shortcut)
        : '';
      callback(shortcut || defaultShortcut);
    });
  });
}

function normalizeShortcutFromCommandsValue(value) {
  const text = String(value || '').trim();
  if (!text || text.includes('%')) {
    return '';
  }
  const parts = text.split('+').map((item) => String(item || '').trim()).filter(Boolean);
  if (parts.length < 2) {
    return '';
  }
  const keyToken = parts[parts.length - 1];
  if (!/^[A-Za-z0-9]$/.test(keyToken) && !/^F\d{1,2}$/i.test(keyToken)) {
    const specialKeys = new Set([
      'Tab', 'Enter', 'Return', 'Escape', 'Esc', 'Space', 'Spacebar',
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      ',', '.', '/', ';', '\'', '-', '+', '\\', '`', '[', ']'
    ]);
    if (!specialKeys.has(keyToken)) {
      return '';
    }
  }
  let hasModifier = false;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const token = parts[i].toLowerCase();
    const isModifier =
      token === 'ctrl' ||
      token === 'control' ||
      token === 'macctrl' ||
      token === 'alt' ||
      token === 'option' ||
      token === 'shift' ||
      token === 'command' ||
      token === 'cmd' ||
      token === 'meta' ||
      token === 'super';
    if (!isModifier) {
      return '';
    }
    hasModifier = true;
  }
  return hasModifier ? text : '';
}

function getConfiguredCopyUrlCommandShortcut(callback) {
  if (!chrome || !chrome.commands || typeof chrome.commands.getAll !== 'function') {
    callback('');
    return;
  }
  chrome.commands.getAll((commands) => {
    if (chrome.runtime && chrome.runtime.lastError) {
      callback('');
      return;
    }
    const items = Array.isArray(commands) ? commands : [];
    const command = items.find((item) => item && item.name === SHOW_SEARCH_PREFILL_V_COMMAND_NAME);
    const shortcut = command && typeof command.shortcut === 'string'
      ? normalizeShortcutFromCommandsValue(command.shortcut)
      : '';
    callback(shortcut || '');
  });
}

// The copy-URL listener is injected into a tab the first time the command
// runs there instead of being a content script of every page: it is the only
// user of these files in a page, and most tabs never copy their URL.
const COPY_URL_LISTENER_FILES = Object.freeze([
  'src/shared/settings.js',
  'src/shared/page-color-scheme.js',
  'src/content/hotkey-listener.js'
]);

function sendCopyCurrentUrlCommand(tabId, callback) {
  chrome.tabs.sendMessage(tabId, { action: 'copyCurrentPageUrlFromCommand' }, (response) => {
    const error = chrome.runtime && chrome.runtime.lastError
      ? chrome.runtime.lastError.message || 'unknown'
      : '';
    callback(error, response);
  });
}

function triggerCopyCurrentUrlForTab(activeTab, source, callback) {
  const finish = typeof callback === 'function' ? callback : function() {};
  if (!activeTab || typeof activeTab.id !== 'number') {
    logHotkeyDebug('copy-url-no-active-tab', { source: source || '' });
    finish(false);
    return;
  }
  const tabId = activeTab.id;
  const report = (error, response) => {
    if (error) {
      logHotkeyDebug('copy-url-send-message-failed', {
        tabId,
        source: source || '',
        error
      });
      finish(false);
      return;
    }
    logHotkeyDebug('copy-url-triggered', {
      tabId,
      source: source || '',
      ok: Boolean(response && response.ok)
    });
    finish(Boolean(response && response.ok));
  };
  sendCopyCurrentUrlCommand(tabId, (error, response) => {
    if (!error) {
      report('', response);
      return;
    }
    // No listener in the page yet: install it and ask again.
    chrome.scripting.executeScript({
      target: { tabId },
      files: COPY_URL_LISTENER_FILES.slice()
    }, () => {
      if (chrome.runtime && chrome.runtime.lastError) {
        report(chrome.runtime.lastError.message || 'unknown');
        return;
      }
      sendCopyCurrentUrlCommand(tabId, report);
    });
  });
}

function publishExtensionUpdateNotice(details) {
  const version = UPDATE_NOTICE.getCurrentVersionTag(chrome);
  UPDATE_NOTICE.publishUpdateNotice({
    chromeApi: chrome,
    fetchImpl: typeof fetch === 'function' ? fetch : null,
    version,
    previousVersion: details && details.previousVersion ? details.previousVersion : '',
    reason: 'update'
  }).catch(warnBackgroundFailure('Failed to publish the extension update notice.'));
}

chrome.commands.onCommand.addListener(function(command) {
  if (
    command !== SHOW_SEARCH_COMMAND_NAME &&
    command !== SHOW_SEARCH_PREFILL_COMMAND_NAME &&
    command !== SHOW_SEARCH_PREFILL_V_COMMAND_NAME &&
    command !== SHOW_TAB_SWITCHER_COMMAND_NAME
  ) {
    return;
  }
  const commandObservedAt = Date.now();
  const source = command === SHOW_SEARCH_COMMAND_NAME
    ? 'commands'
    : (command === SHOW_SEARCH_PREFILL_COMMAND_NAME
      ? 'commands-prefill'
      : (command === SHOW_SEARCH_PREFILL_V_COMMAND_NAME ? 'commands-copy-url' : 'commands-tab-switcher'));
  logHotkeyDebug('received', { command: command, source: source });
  chrome.tabs.query({active: true, currentWindow: true}, function(activeTabs) {
    if (command === SHOW_SEARCH_PREFILL_V_COMMAND_NAME) {
      triggerCopyCurrentUrlForTab(activeTabs[0], source);
      return;
    }
    if (command === SHOW_TAB_SWITCHER_COMMAND_NAME) {
      triggerTabSwitcherForTab(activeTabs[0], source, commandObservedAt);
      return;
    }
    triggerShowSearchForTab(activeTabs[0], source);
  });
});

if (chrome && chrome.runtime && chrome.runtime.onConnect) {
  chrome.runtime.onConnect.addListener(registerTabSwitcherExtensionPagePortConnection);
}

codexDebugBridge.attach();

chrome.tabs.onCreated.addListener((tab) => {
  rememberBrowserNewtabProviderCandidate(tab);
  maybeAutoSelectRestrictedBrowserSetting(tab, 'created');
  const recentContext = getRecentPageHotkeyContext(tab && typeof tab.windowId === 'number' ? tab.windowId : null);
  if (!recentContext || !tab || typeof tab.id !== 'number') {
    schedulePersistPinnedTabSnapshot();
    return;
  }
  setTimeout(() => {
    recoverFromPageHotkeyNewtab(tab.id, recentContext.windowId);
  }, 120);
  schedulePersistPinnedTabSnapshot();
});

chrome.runtime.onInstalled.addListener((details) => {
  // Static manifest content scripts only apply to future document loads. A
  // development-extension reload keeps existing tabs alive, so install the
  // shortcut observer there now instead of waiting for the next shortcut.
  prepareShortcutKeyObserversInOpenTabs();
  if (!details) {
    schedulePersistPinnedTabSnapshot();
    return;
  }
  const reason = String(details.reason || '');
  if (reason === 'install') {
    openOnboardingPage({ reason: 'install' });
    schedulePersistPinnedTabSnapshot();
    return;
  }
  if (reason === 'update') {
    const isSameVersionReload = DEV_EXTENSION_STARTUP.isSameVersionReload(details, chrome.runtime.getManifest().version);
    if (!isSameVersionReload) {
      if (typeof shouldOpenOnboardingForUpdate === 'function' && shouldOpenOnboardingForUpdate(details)) {
        openOnboardingPage({ reason: 'update' });
      }
      publishExtensionUpdateNotice(details);
    }
  }
  if (reason === 'update' || reason === 'chrome_update') {
    restorePinnedTabsFromSnapshotOnStartup().catch(warnBackgroundFailure('Failed to restore pinned tabs.')).finally(() => {
      schedulePersistPinnedTabSnapshot({ skipEmptyWhenNoNormalWindows: true });
    });
    return;
  }
  schedulePersistPinnedTabSnapshot({ skipEmptyWhenNoNormalWindows: true });
});

function restoreBackgroundStateOnStartup() {
  return restorePinnedTabsFromSnapshotOnStartup().catch(warnBackgroundFailure('Failed to restore pinned tabs.')).finally(() => {
    schedulePersistPinnedTabSnapshot({ skipEmptyWhenNoNormalWindows: true });
  });
}

if (chrome && chrome.runtime && chrome.runtime.onStartup) {
  // Tabs restored at browser startup load with the manifest content scripts,
  // and each tab switcher command prepares its own tab, so startup does not
  // sweep the open tabs.
  chrome.runtime.onStartup.addListener(() => {
    restoreBackgroundStateOnStartup();
  });
}
// Both loaders settle even when storage is unreadable; the catch only keeps
// an unforeseen rejection from surfacing as unhandled during startup.
ensureTabSwitchStatsLoaded().catch(() => {});
ensureTabSwitcherStateLoaded().catch(() => {});
// Chrome keeps a worker alive for its short debounce timers, but Firefox's
// event page can be unloaded with one pending; write it out first.
if (chrome && chrome.runtime && chrome.runtime.onSuspend) {
  chrome.runtime.onSuspend.addListener(() => {
    flushPendingPinnedTabSnapshot();
    flushPendingTabSwitcherState();
  });
}
cleanupRemovedAiStorageKeys();
cleanupLocalOnlyBookmarkTopbarSyncStorage();

if (chrome.action && chrome.action.onClicked) {
  chrome.action.onClicked.addListener((tab) => {
    openDocumentPipPickerOnTab(tab, 'action');
  });
}

if (chrome && chrome.tabs && chrome.tabs.onActivated) {
  chrome.tabs.onActivated.addListener((activeInfo) => {
    if (!activeInfo || typeof activeInfo.tabId !== 'number') {
      return;
    }
    recordTabSwitchEvent(activeInfo.tabId);
    if (chrome.tabs && typeof chrome.tabs.get === 'function') {
      chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          return;
        }
        ensureTabSwitcherStateLoaded().catch(() => {}).finally(() => {
          recordRecentSwitcherTab(tab);
          scheduleSwitcherThumbnailCapture(tab, 'activated');
        });
      });
    }
  });
}

if (chrome && chrome.windows && chrome.windows.onFocusChanged) {
  chrome.windows.onFocusChanged.addListener((windowId) => {
    if (typeof windowId !== 'number' ||
        windowId === chrome.windows.WINDOW_ID_NONE ||
        !chrome.tabs ||
        typeof chrome.tabs.query !== 'function') {
      return;
    }
    chrome.tabs.query({ active: true, windowId }, (tabs) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        return;
      }
      const tab = Array.isArray(tabs) && tabs.length > 0 ? tabs[0] : null;
      if (!tab || typeof tab.id !== 'number') {
        return;
      }
      ensureTabSwitcherStateLoaded().catch(() => {}).finally(() => {
        recordRecentSwitcherTab(tab);
        scheduleSwitcherThumbnailCapture(tab, 'window-focus');
      });
    });
  });
}

if (chrome && chrome.tabs && chrome.tabs.onRemoved) {
  chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    const overlayOpening = overlayOpeningByTabId.get(tabId);
    if (overlayOpening) {
      finishOverlayOpening(overlayOpening);
    }
    clearOverlayNavigationState(tabId);
    clearOverlayLoadingRecord(tabId);
    clearTabSwitchStat(tabId);
    removeRecentSwitcherTab(tabId);
    pipOwnership.clearGlobalPipOwnerForTabId(tabId);
    Array.from(tabSwitcherHostTabIdByWindowId.entries()).forEach(([windowId, hostTabId]) => {
      if (hostTabId === tabId) {
        tabSwitcherHostTabIdByWindowId.delete(windowId);
      }
    });
    if (removeInfo && removeInfo.isWindowClosing) {
      return;
    }
    schedulePersistPinnedTabSnapshot();
  });
}

if (chrome && chrome.tabs && chrome.tabs.onUpdated) {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!changeInfo) {
      return;
    }
    if (changeInfo.status === 'loading') {
      rememberOverlayTopFrameNavigation({
        tabId,
        frameId: 0,
        url: typeof changeInfo.url === 'string'
          ? changeInfo.url
          : (tab && typeof tab.pendingUrl === 'string' ? tab.pendingUrl : '')
      });
      markOverlayLoadingRecordUnstable(tabId);
    } else if (typeof changeInfo.url === 'string') {
      updateOverlayTopFrameNavigation({
        tabId,
        frameId: 0,
        url: changeInfo.url
      });
    }
    recoverOverlayAfterLoadingUpdate(tabId, changeInfo, tab);
    if (changeInfo.status === 'complete') {
      clearOverlayNavigationState(tabId);
    }
    if (typeof changeInfo.url === 'string' || changeInfo.status === 'complete') {
      const providerTab = Object.assign({}, tab || {}, {
        id: typeof tabId === 'number' ? tabId : (tab && tab.id),
        status: changeInfo.status || (tab && tab.status)
      });
      if (typeof changeInfo.url === 'string') {
        providerTab.url = changeInfo.url;
      }
      maybeAutoSelectRestrictedBrowserSetting(
        providerTab,
        changeInfo.status === 'complete' ? 'updated-complete' : 'updated'
      );
    }
    if (typeof changeInfo.url === 'string') {
      // URL changed means the tab semantic target changed; reset historical switch stats.
      clearTabSwitchStat(tabId);
      pipOwnership.clearGlobalPipOwnerForTabId(tabId);
      clearSwitcherThumbnailPriority(tabId);
      updateRecentSwitcherTab(tab);
    }
    if (tab && tab.active === true && (typeof changeInfo.title === 'string' || typeof changeInfo.favIconUrl === 'string')) {
      updateRecentSwitcherTab(tab);
    }
    if (tab && tab.active === true && changeInfo.status === 'complete') {
      recordRecentSwitcherTab(tab);
      scheduleSwitcherThumbnailCapture(tab, 'updated-complete');
    }
    if (changeInfo.pinned !== undefined || typeof changeInfo.url === 'string' || changeInfo.status === 'complete') {
      schedulePersistPinnedTabSnapshot();
    }
    if (typeof changeInfo.favIconUrl === 'string' && changeInfo.favIconUrl) {
      const completedUrl = typeof changeInfo.url === 'string'
        ? changeInfo.url
        : (tab && typeof tab.url === 'string' ? tab.url : '');
      markFaviconDirtyForUrl(completedUrl);
    } else if (changeInfo.status === 'complete' && !(tab && tab.favIconUrl)) {
      const completedUrl = typeof changeInfo.url === 'string'
        ? changeInfo.url
        : (tab && typeof tab.url === 'string' ? tab.url : '');
      markFaviconDirtyForUrl(completedUrl);
    }
  });
}

if (chrome && chrome.tabs && chrome.tabs.onMoved) {
  chrome.tabs.onMoved.addListener(() => {
    schedulePersistPinnedTabSnapshot();
  });
}

if (chrome && chrome.windows && chrome.windows.onCreated) {
  chrome.windows.onCreated.addListener((windowInfo) => {
    if (windowInfo && windowInfo.incognito === true) {
      return;
    }
    if (windowInfo && windowInfo.type && windowInfo.type !== 'normal') {
      return;
    }
    restorePinnedTabsFromSnapshotOnStartup().catch(warnBackgroundFailure('Failed to restore pinned tabs.')).finally(() => {
      schedulePersistPinnedTabSnapshot({ skipEmptyWhenNoNormalWindows: true });
    });
  });
}

if (chrome && chrome.windows && chrome.windows.onRemoved) {
  chrome.windows.onRemoved.addListener((windowId) => {
    tabSwitcherHostTabIdByWindowId.delete(windowId);
    schedulePersistPinnedTabSnapshot({ skipEmptyWhenNoNormalWindows: true });
  });
}

function waitForTabComplete(tabId, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timeoutId = null;
    const finish = (tab, error) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      chrome.tabs.onUpdated.removeListener(handleUpdated);
      if (error) {
        reject(error);
        return;
      }
      resolve(tab || null);
    };
    const handleUpdated = (updatedTabId, changeInfo, tab) => {
      if (updatedTabId !== tabId) {
        return;
      }
      if (changeInfo && changeInfo.status === 'complete') {
        finish(tab || null);
      }
    };
    chrome.tabs.onUpdated.addListener(handleUpdated);
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        finish(null, new Error(chrome.runtime.lastError.message || 'tab-unavailable'));
        return;
      }
      if (tab && tab.status === 'complete') {
        finish(tab);
      }
    });
    timeoutId = setTimeout(() => {
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          finish(null, new Error(chrome.runtime.lastError.message || 'tab-unavailable'));
          return;
        }
        finish(tab || null);
      });
    }, Math.max(1000, Number(timeoutMs) || 15000));
  });
}

function loadSelectionQuickActionsEnabled() {
  return new Promise((resolve) => {
    if (!storageArea || typeof storageArea.get !== 'function') {
      resolve(false);
      return;
    }
    storageArea.get([SELECTION_QUICK_ACTIONS_ENABLED_STORAGE_KEY], (result) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        resolve(false);
        return;
      }
      resolve(Boolean(result && result[SELECTION_QUICK_ACTIONS_ENABLED_STORAGE_KEY] === true));
    });
  });
}

const selectionScriptRegistration = globalThis.LumnoSelectionScriptRegistration
  .createSelectionScriptRegistration({ chromeApi: chrome });
loadSelectionQuickActionsEnabled().then((enabled) => selectionScriptRegistration.sync(enabled));
chrome.storage.onChanged.addListener((changes, areaName) => {
  const storageModeChanged = areaName === 'local' && Boolean(changes[SETTINGS.LOCAL_PRIMARY_STORAGE_KEY]);
  if (!storageModeChanged &&
      !(isPrimaryStorageAreaName(areaName) && changes[SELECTION_QUICK_ACTIONS_ENABLED_STORAGE_KEY])) {
    return;
  }
  loadSelectionQuickActionsEnabled().then((enabled) => {
    selectionScriptRegistration.sync(enabled, { injectOpenTabs: enabled });
  });
});

function loadSelectionQuickActionsProvider() {
  return new Promise((resolve) => {
    if (!storageArea || typeof storageArea.get !== 'function') {
      resolve('gpt');
      return;
    }
    storageArea.get([SELECTION_QUICK_ACTIONS_PROVIDER_STORAGE_KEY], (result) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        resolve('gpt');
        return;
      }
      const rawValue = result && result[SELECTION_QUICK_ACTIONS_PROVIDER_STORAGE_KEY];
      const providerKey = SETTINGS.normalizeSelectionQuickActionsProvider(rawValue);
      resolve(providerKey || 'gpt');
    });
  });
}

function loadSelectionQuickActionsGroupEnabled() {
  return new Promise((resolve) => {
    if (!storageArea || typeof storageArea.get !== 'function') {
      resolve(false);
      return;
    }
    storageArea.get([SELECTION_QUICK_ACTIONS_GROUP_ENABLED_STORAGE_KEY], (result) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        resolve(false);
        return;
      }
      resolve(Boolean(result && result[SELECTION_QUICK_ACTIONS_GROUP_ENABLED_STORAGE_KEY] === true));
    });
  });
}

let selectionTargetOpenQueue = Promise.resolve();
let selectionQuickActionFallbackProvidersPromise = null;
const selectionQuickActionGroupTitlePromises = new Map();

function loadSelectionQuickActionGroupTitle(locale) {
  const normalizedLocale = SETTINGS.normalizeLocale(locale);
  if (selectionQuickActionGroupTitlePromises.has(normalizedLocale)) {
    return selectionQuickActionGroupTitlePromises.get(normalizedLocale);
  }
  const fallbackTitle = String(SELECTION_TARGET.DEFAULT_GROUP_TITLE || 'AI Search');
  const localePath = chrome.runtime.getURL(`_locales/${normalizedLocale}/messages.json`);
  const titlePromise = fetch(localePath, { cache: 'no-store' })
    .then((response) => response.json())
    .then((messages) => {
      const title = messages && messages.selection_quick_actions_group_name
        ? String(messages.selection_quick_actions_group_name.message || '').trim()
        : '';
      return title || fallbackTitle;
    })
    .catch(() => fallbackTitle);
  selectionQuickActionGroupTitlePromises.set(normalizedLocale, titlePromise);
  return titlePromise;
}

function queueSelectionTargetOpen(options) {
  // The previous open reported its own failure to its caller; only order matters here.
  const task = selectionTargetOpenQueue
    .catch(() => {})
    .then(() => new Promise((resolve) => {
      SELECTION_TARGET.openSelectionTarget(chrome, options, resolve);
    }));
  selectionTargetOpenQueue = task.then(() => undefined, () => undefined);
  return task;
}

function loadSelectionQuickActionFallbackProviders() {
  if (selectionQuickActionFallbackProvidersPromise) {
    return selectionQuickActionFallbackProvidersPromise;
  }
  const localUrl = chrome.runtime.getURL('assets/data/site-search.json');
  const fallbackDefaults = SEARCH_UTILS.getDefaultSiteSearchProviders();
  selectionQuickActionFallbackProvidersPromise = fetch(localUrl)
    .then((response) => response.json())
    .then((data) => {
      const items = data && Array.isArray(data.items) ? data.items : [];
      return sanitizeSiteSearchProviders(items.length > 0 ? items : fallbackDefaults);
    })
    .catch(() => sanitizeSiteSearchProviders(fallbackDefaults));
  return selectionQuickActionFallbackProvidersPromise;
}

function submitSelectionPromptInTab(provider, prompt, entryUrl, tab, targetInfo) {
  const submitStrategy = String(provider && provider.submitStrategy || '').trim();
  if (!tab || typeof tab.id !== 'number') {
    return Promise.resolve({ ok: false, reason: 'tab-unavailable' });
  }
  return waitForTabComplete(tab.id, 15000)
    .catch(() => tab)
    .then(() => AI_PROVIDER_SUBMIT.submitPromptInTab(
      chrome,
      tab.id,
      prompt,
      submitStrategy,
      entryUrl
    ))
    .then((result) => ({
      ok: Boolean(result && result.ok),
      tabId: tab.id,
      url: entryUrl,
      strategy: submitStrategy,
      method: result && result.method ? result.method : '',
      reason: result && result.reason ? result.reason : '',
      openMode: targetInfo && targetInfo.mode ? targetInfo.mode : 'tab',
      groupId: targetInfo && typeof targetInfo.groupId === 'number' ? targetInfo.groupId : null,
      providerKey: String(provider && provider.key || '')
    }));
}

async function openAndSubmitSelectionPrompt(
  provider,
  prompt,
  entryUrl,
  sourceTab,
  groupEnabled,
  groupTitle
) {
  const targetOptions = {
    url: entryUrl,
    sourceTab,
    groupEnabled,
    groupTitle: groupTitle || SELECTION_TARGET.DEFAULT_GROUP_TITLE,
    groupColor: 'blue'
  };
  let targetInfo = await queueSelectionTargetOpen(targetOptions);
  if (!targetInfo || targetInfo.ok === false || !targetInfo.tab) {
    return {
      ok: false,
      reason: targetInfo && targetInfo.reason ? targetInfo.reason : 'selection-target-open-failed'
    };
  }
  const firstResult = await submitSelectionPromptInTab(provider, prompt, entryUrl, targetInfo.tab, targetInfo);
  if (targetInfo.mode === 'reused' && !firstResult.ok) {
    targetInfo = await queueSelectionTargetOpen({
      ...targetOptions,
      reuseExisting: false
    });
    if (!targetInfo || targetInfo.ok === false || !targetInfo.tab) {
      return {
        ok: false,
        reason: targetInfo && targetInfo.reason
          ? targetInfo.reason
          : (firstResult.reason || 'selection-target-open-failed')
      };
    }
    return submitSelectionPromptInTab(provider, prompt, entryUrl, targetInfo.tab, targetInfo);
  }
  return firstResult;
}

async function runSelectionQuickAction(request, sender) {
  const [enabled, preferredProviderKey, groupEnabled, bundledProviders, groupTitle] = await Promise.all([
    loadSelectionQuickActionsEnabled(),
    loadSelectionQuickActionsProvider(),
    loadSelectionQuickActionsGroupEnabled(),
    loadSelectionQuickActionFallbackProviders(),
    loadSelectionQuickActionGroupTitle(request.locale)
  ]);
  if (!enabled) {
    return { ok: false, reason: 'selection-quick-actions-disabled' };
  }
  const rawText = typeof request.text === 'string' ? request.text : '';
  const normalizedText = SELECTION_INTENT.normalizeText(rawText);
  const maxLength = Number(SELECTION_INTENT.MAX_SELECTION_LENGTH) || 2400;
  const actions = Array.isArray(SELECTION_INTENT.ACTIONS) ? SELECTION_INTENT.ACTIONS : [];
  const intent = actions.includes(request.intent) ? request.intent : 'ask';
  if (!normalizedText || normalizedText.length > maxLength) {
    return { ok: false, reason: 'invalid-selection-text' };
  }
  const providers = await loadSiteSearchProviders();
  const provider = SELECTION_QUICK_ACTION_PROVIDER.resolveSelectionQuickActionProvider(
    providers,
    bundledProviders,
    preferredProviderKey,
    isInteractiveSiteSearchProvider
  );
  if (!provider) {
    return { ok: false, reason: 'selection-provider-unavailable' };
  }
  const prompt = SELECTION_INTENT.buildPrompt(intent, normalizedText, request.locale);
  const entryUrl = getSiteSearchProviderEntryUrl(provider, prompt);
  if (!entryUrl) {
    return { ok: false, reason: 'selection-provider-url-unavailable' };
  }
  const sourceTab = sender && sender.tab ? sender.tab : null;
  return openAndSubmitSelectionPrompt(
    provider,
    prompt,
    entryUrl,
    sourceTab,
    groupEnabled,
    groupTitle
  );
}

function runInteractiveSiteSearchProvider(provider, query, sender, disposition) {
  const prompt = String(query || '').trim();
  const entryUrl = getSiteSearchProviderEntryUrl(provider, prompt);
  const submitStrategy = String((provider && provider.submitStrategy) || '').trim();
  const targetDisposition = disposition === 'currentTab'
    ? 'currentTab'
    : (disposition === 'backgroundTab' ? 'backgroundTab' : 'newTab');
  return new Promise((resolve) => {
    if (!entryUrl || !prompt || !isInteractiveSiteSearchProvider(provider)) {
      resolve({ ok: false, reason: 'invalid-provider-request' });
      return;
    }
    const finish = (result) => {
      resolve(result && typeof result === 'object' ? result : { ok: false, reason: 'unknown' });
    };
    const handleReadyTab = (tab) => {
      if (!tab || typeof tab.id !== 'number') {
        finish({ ok: false, reason: 'tab-unavailable' });
        return;
      }
      waitForTabComplete(tab.id, 15000)
        .catch(() => tab)
        .then(() => AI_PROVIDER_SUBMIT.submitPromptInTab(
          chrome,
          tab.id,
          prompt,
          submitStrategy,
          entryUrl
        ))
        .then((result) => {
          finish({
            ok: Boolean(result && result.ok),
            tabId: tab.id,
            url: entryUrl,
            strategy: submitStrategy,
            method: result && result.method ? result.method : '',
            reason: result && result.reason ? result.reason : ''
          });
        })
        .catch((error) => {
          finish({
            ok: false,
            tabId: tab.id,
            url: entryUrl,
            reason: error && error.message ? error.message : 'interactive-site-search-failed'
          });
        });
    };
    const updateTab = (tabId) => {
      chrome.tabs.update(tabId, { url: entryUrl, active: true }, (tab) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          finish({ ok: false, reason: chrome.runtime.lastError.message || 'tab-update-failed' });
          return;
        }
        handleReadyTab(tab);
      });
    };
    if (targetDisposition === 'currentTab') {
      if (sender && sender.tab && typeof sender.tab.id === 'number') {
        updateTab(sender.tab.id);
        return;
      }
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          finish({ ok: false, reason: chrome.runtime.lastError.message || 'active-tab-unavailable' });
          return;
        }
        const activeTab = Array.isArray(tabs) && tabs.length > 0 ? tabs[0] : null;
        if (activeTab && typeof activeTab.id === 'number') {
          updateTab(activeTab.id);
          return;
        }
        finish({ ok: false, reason: 'active-tab-unavailable' });
      });
      return;
    }
    const sourceTab = sender && sender.tab ? sender.tab : null;
    createSearchResultTab({ url: entryUrl, active: targetDisposition !== 'backgroundTab' }, sourceTab, (tab, info) => {
      if (!info || info.ok === false) {
        finish({ ok: false, reason: (info && info.reason) || 'tab-create-failed' });
        return;
      }
      handleReadyTab(tab);
    });
  });
}

let aggregateSearchQueryRunner = null;
function runAggregateSearchQuery(aggregateId, query, sender, disposition) {
  if (!aggregateSearchQueryRunner) {
    aggregateSearchQueryRunner = AGGREGATE_SEARCH.createAggregateSearchQueryRunner({
      aggregateSearchStore: AGGREGATE_SEARCH_STORE,
      chromeApi: chrome,
      storageArea,
      storageKey: AGGREGATE_SEARCH_STORAGE_KEY,
      loadSiteSearchProviders,
      resolveTabPlacement: resolveSearchResultTabPlacement,
      loadAggregateSearchAutoGroupEnabled() {
        return SETTINGS.readStorageValue(
          storageArea,
          chrome,
          AGGREGATE_SEARCH_AUTO_GROUP_ENABLED_STORAGE_KEY
        );
      },
      openAggregateSearch: AGGREGATE_SEARCH.openAggregateSearch,
      getEntryUrl: getSiteSearchProviderEntryUrl,
      isInteractiveProvider: isInteractiveSiteSearchProvider,
      waitForTabComplete,
      submitPromptInTab: AI_PROVIDER_SUBMIT.submitPromptInTab
    });
  }
  return aggregateSearchQueryRunner(aggregateId, query, sender, disposition);
}

const shortcutFolderSyncController = providerStorageRuntime &&
  chrome.bookmarks && typeof chrome.bookmarks.getTree === 'function'
  ? globalThis.LumnoBookmarkFolderReference.createSyncController({ chrome, provider: providerStorageRuntime,
    onError: (error) => console.warn('[Lumno] Could not refresh folder shortcuts.', error) }) : null;
if (shortcutFolderSyncController) shortcutFolderSyncController.start();
const webDavSyncController = typeof indexedDB !== 'undefined'
  ? globalThis.LumnoWebDavSync.createController({ chrome }) : null;
if (webDavSyncController) webDavSyncController.start();

function handleWebDavMessage(request, sender, sendResponse) {
  // Content scripts and externally connected extensions cannot use stored
  // credentials, configure endpoints, or request arbitrary remote resources.
  if (!globalThis.LumnoWebDavSync.isTrustedSender(chrome, sender)) {
    sendResponse({ ok: false, error: 'forbidden' });
    return;
  }
  if (!webDavSyncController) {
    sendResponse({ ok: false, error: 'private-storage-unavailable' });
    return;
  }
  webDavSyncController.handle(request).then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({ ok: false, error: error.code || 'sync-failed',
      diagnostic: globalThis.LumnoWebDavClient.diagnostic(error.diagnostic) }));
  return true;
}

// Tabs, overlay lifecycle and tab visibility.
const TAB_MESSAGE_HANDLERS = Object.freeze({
  swapNewtabForFocus(request, sender, sendResponse) {
    swapNewtabForFocus(sender && sender.tab ? sender.tab : null, sender && sender.url, (result) => {
      sendResponse(result);
    });
    return true;
  },
  switchToTab(request, sender, sendResponse) {
    if (typeof request.tabId === 'number') {
      recordTabSwitchEvent(request.tabId);
    }
    focusWindowAndActivateTab(
      request.tabId,
      typeof request.windowId === 'number' ? request.windowId : null,
      (result) => {
        sendResponse(result || { ok: false });
      }
    );
    return true;
  },
  closeTabFromTabSwitcher(request, sender, sendResponse) {
    const tabId = request ? request.tabId : null;
    if (typeof tabId !== 'number') {
      sendResponse({ ok: false, reason: 'invalid-tab' });
      return;
    }
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError || !tab) {
        sendResponse({ ok: false, reason: 'tab-missing' });
        return;
      }
      // The switcher never lists incognito tabs, so it never closes one.
      if (tab.incognito === true) {
        sendResponse({ ok: false, reason: 'tab-not-allowed' });
        return;
      }
      chrome.tabs.remove(tabId, () => {
        if (chrome.runtime.lastError) {
          sendResponse({ ok: false, reason: chrome.runtime.lastError.message || 'remove-failed' });
          return;
        }
        sendResponse({ ok: true });
      });
    });
    return true;
  },
  notifyOverlayClosed(request, sender, sendResponse) {
    const senderTab = sender && sender.tab ? sender.tab : null;
    if (senderTab && typeof senderTab.id === 'number') {
      clearOverlayLoadingRecord(senderTab.id);
    }
    sendResponse({ ok: true });
    return;
  },
  notifyTopFrameDocumentStarted(request, sender, sendResponse) {
    const accepted = recoverOverlayAfterTopFrameDocumentStart(request, sender);
    sendResponse({ ok: accepted });
    return;
  },
  updateOverlayLoadingSession(request, sender, sendResponse) {
    updateOverlayLoadingSessionFromMessage(request, sender, sendResponse);
    return true;
  },
  getTabsForOverlay(request, sender, sendResponse) {
    ensureTabSwitchStatsLoaded()
      .catch(() => {}) // Settles even when storage fails; list tabs regardless.
      .finally(() => {
        const requestedCurrentTabId = Number.isFinite(Number(request && request.currentTabId))
          ? Number(request.currentTabId)
          : null;
        const currentTabId = sender && sender.tab && typeof sender.tab.id === 'number'
          ? sender.tab.id
          : requestedCurrentTabId;
        chrome.tabs.query({}, (tabs) => {
          const normalizedTabs = (Array.isArray(tabs) ? tabs : [])
            .filter((tab) => tab && tab.incognito !== true)
            .map((tab) => {
              const resolvedUrl = getResolvedTabUrl(tab);
              return {
                id: tab.id,
                title: typeof tab.title === 'string' ? tab.title : '',
                url: resolvedUrl || '',
                favIconUrl: typeof tab.favIconUrl === 'string' ? tab.favIconUrl : '',
                lastAccessed: Number(tab.lastAccessed) || 0
              };
            });
          syncTabSwitchStatsFromTabList(normalizedTabs);
          const sortedTabs = sortTabsForOverlay(normalizedTabs);
          tabOverlayFetchSeq += 1;
          const withSeq = sortedTabs.map((tab) => createOverlayTabPayload(tab, tabOverlayFetchSeq));
          sendResponse({ tabs: withSeq, currentTabId: currentTabId });
        });
      });
    return true;
  },
  trackSearchTab(request, sender, sendResponse) {
    if (typeof request.tabId === 'number') {
      markPendingSearchTab(request.tabId, sender && sender.tab ? sender.tab : null);
      sendResponse({ ok: true });
    } else {
      sendResponse({ ok: false });
    }
    return true;
  },
  closeOtherTabsForOverlay(request, sender, sendResponse) {
    const senderTab = sender && sender.tab ? sender.tab : null;
    if (!senderTab || typeof senderTab.id !== 'number' || typeof senderTab.windowId !== 'number') {
      sendResponse({ ok: false, reason: 'invalid-sender' });
      return;
    }
    chrome.tabs.query({ windowId: senderTab.windowId }, (tabs) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        sendResponse({ ok: false, reason: chrome.runtime.lastError.message || 'query-failed' });
        return;
      }
      const ungroupedId = chrome && chrome.tabGroups && typeof chrome.tabGroups.TAB_GROUP_ID_NONE === 'number'
        ? chrome.tabGroups.TAB_GROUP_ID_NONE
        : -1;
      const toCloseIds = (Array.isArray(tabs) ? tabs : [])
        .filter((tab) => {
          if (!tab || typeof tab.id !== 'number') {
            return false;
          }
          if (tab.id === senderTab.id) {
            return false;
          }
          if (tab.pinned) {
            return false;
          }
          if (typeof tab.groupId === 'number' && tab.groupId !== ungroupedId) {
            return false;
          }
          return true;
        })
        .map((tab) => tab.id);
      if (toCloseIds.length <= 0) {
        sendResponse({ ok: true, closedCount: 0 });
        return;
      }
      chrome.tabs.remove(toCloseIds, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          sendResponse({ ok: false, reason: chrome.runtime.lastError.message || 'remove-failed' });
          return;
        }
        sendResponse({ ok: true, closedCount: toCloseIds.length });
      });
    });
    return true;
  }
});

// Configured shortcuts and page hotkeys.
const SHORTCUT_MESSAGE_HANDLERS = Object.freeze({
  getShowSearchShortcut(request, sender, sendResponse) {
    getConfiguredFallbackShortcut((shortcut) => {
      sendResponse({ shortcut: shortcut || '' });
    });
    return true;
  },
  getCopyCurrentUrlCommandShortcut(request, sender, sendResponse) {
    getConfiguredCopyUrlCommandShortcut((shortcut) => {
      sendResponse({ shortcut: shortcut || '' });
    });
    return true;
  },
  copyCurrentPageUrl(request, sender, sendResponse) {
    const senderTab = sender && sender.tab ? sender.tab : null;
    triggerCopyCurrentUrlForTab(senderTab, 'slash-command', (ok) => {
      sendResponse({ ok: Boolean(ok) });
    });
    return true;
  },
  triggerShowSearchFromPageHotkey(request, sender, sendResponse) {
    const senderTab = sender && sender.tab ? sender.tab : null;
    if (!senderTab || typeof senderTab.id !== 'number') {
      logHotkeyDebug('page-hotkey-invalid-sender', {
        hasSender: Boolean(sender),
        hasTab: Boolean(sender && sender.tab)
      });
      sendResponse({ ok: false });
      return;
    }
    const triggerVerifiedPageHotkey = (shortcut) => {
      const shouldPrefillCurrentUrl = Boolean(request && request.prefillCurrentUrl);
      const triggerSource = shouldPrefillCurrentUrl ? 'page-hotkey-prefill' : 'page-hotkey';
      logHotkeyDebug('received', {
        command: SHOW_SEARCH_COMMAND_NAME,
        source: triggerSource,
        tabId: senderTab.id,
        url: senderTab.url || '',
        pendingUrl: senderTab.pendingUrl || '',
        prefillCurrentUrl: shouldPrefillCurrentUrl,
        verifiedAfterColdStart: Boolean(request && request.requiresShortcutVerification)
      });
      rememberPageHotkeyContext(senderTab);
      triggerShowSearchForTab(senderTab, triggerSource);
      sendResponse({ ok: true, shortcut: shortcut || '' });
    };
    if (request && request.requiresShortcutVerification === true) {
      getConfiguredFallbackShortcut((shortcut) => {
        const spec = SHORTCUT_KEY_MATCHER.parseShortcut(shortcut);
        const matched = SHORTCUT_KEY_MATCHER.descriptorMatchesShortcut(request.observedShortcut, spec);
        if (!matched) {
          sendResponse({ ok: false, reason: 'shortcut-mismatch', shortcut: shortcut || '' });
          return;
        }
        triggerVerifiedPageHotkey(shortcut);
      });
      return true;
    }
    triggerVerifiedPageHotkey('');
    return;
  },
  notifyTabSwitcherShortcutModifierReleased(request, sender, sendResponse) {
    const senderTab = sender && sender.tab ? sender.tab : null;
    handleTabSwitcherShortcutModifierReleased(senderTab, request && request.key, (didCommit) => {
      sendResponse({ ok: true, committed: didCommit === true });
    });
    return true;
  },
  getShortcutRules(request, sender, sendResponse) {
    loadShortcutRules().then((items) => {
      sendResponse({ items: items });
    });
    return true;
  }
});

function sendPipMainWorldResponse(methodName, sender, sendResponse) {
  if (typeof pipMainWorld[methodName] !== 'function') {
    sendResponse({ ok: false, reason: 'pip-main-world-unavailable' });
    return;
  }
  pipMainWorld[methodName](sender)
    .then((result) => {
      sendResponse(result);
    })
    .catch((error) => {
      sendResponse({
        ok: false,
        reason: error && error.message ? error.message : String(error || 'pip-main-world-failed')
      });
    });
}

// Picture-in-picture ownership and main-world helpers.
const PIP_MESSAGE_HANDLERS = Object.freeze({
  pipRequestOwnership(request, sender, sendResponse) {
    pipOwnership.requestGlobalPipOwnership(sender, request && request.kind ? String(request.kind) : '')
      .then((result) => {
        sendResponse(result);
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          granted: false,
          reason: error && error.message ? error.message : String(error || 'ownership-request-failed')
        });
      });
    return true;
  },
  pipReleaseOwnership(request, sender, sendResponse) {
    pipOwnership.releaseGlobalPipOwnership(sender, request && request.token ? String(request.token) : '')
      .then((result) => {
        sendResponse(result);
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          released: false,
          reason: error && error.message ? error.message : String(error || 'ownership-release-failed')
        });
      });
    return true;
  },
  openDocumentPipPicker(request, sender, sendResponse) {
    const senderTab = sender && sender.tab ? sender.tab : null;
    if (!senderTab || typeof senderTab.id !== 'number') {
      sendResponse({ ok: false, reason: 'no-sender-tab' });
      return;
    }
    openDocumentPipPickerOnTab(senderTab, 'search-command').then((enabled) => {
      sendResponse({
        ok: enabled === true,
        enabled: enabled === true
      });
    });
    return true;
  },
  siteTryEnterPiPInMainWorld(request, sender, sendResponse) {
    sendPipMainWorldResponse('siteTryEnterPiPInMainWorld', sender, sendResponse);
    return true;
  },
  iqiyiTryEnterPiPInMainWorld(request, sender, sendResponse) {
    sendPipMainWorldResponse('iqiyiTryEnterPiPInMainWorld', sender, sendResponse);
    return true;
  },
  iqiyiSetupAutoPiPInMainWorld(request, sender, sendResponse) {
    sendPipMainWorldResponse('iqiyiSetupAutoPiPInMainWorld', sender, sendResponse);
    return true;
  },
  forceExitPiPInMainWorld(request, sender, sendResponse) {
    sendPipMainWorldResponse('forceExitPiPInMainWorld', sender, sendResponse);
    return true;
  },
  ytForceExitPiPInMainWorld(request, sender, sendResponse) {
    sendPipMainWorldResponse('youtubeForceExitPiPInMainWorld', sender, sendResponse);
    return true;
  }
});

// Search, suggestions and history.
const SEARCH_MESSAGE_HANDLERS = Object.freeze({
  searchOrNavigate(request, sender, sendResponse) {
    const query = request.query ? String(request.query) : '';
    const forceSearch = Boolean(request.forceSearch);
    const openInBackgroundTab = request.disposition === 'backgroundTab';
    const sourceTab = sender && sender.tab ? sender.tab : null;
    Promise.all([loadShortcutRules(), resolveSearchResultTabPlacement(sourceTab)]).then(([rules, placement]) => {
      const createResolvedTab = (url, callback) => {
        createSearchResultTab({
          url,
          active: !openInBackgroundTab
        }, sourceTab, callback, placement);
      };
      const shortcutUrl = getShortcutUrl(query, rules);
      if (shortcutUrl) {
        createResolvedTab(shortcutUrl, () => {
          sendResponse({ ok: true, url: shortcutUrl });
        });
        return;
      }
      const directUrl = !forceSearch ? getDirectNavigationUrl(query) : '';
      if (directUrl) {
        createResolvedTab(directUrl, () => {
          sendResponse({ ok: true, url: directUrl });
        });
      } else {
        // It's a search query - use browser default search engine
        const fallbackUrl = buildDefaultSearchUrl(query);
        // Preserve the original browser search path unless an adjacent position is selected.
        if (typeof placement.index !== 'number') {
          if (openInBackgroundTab) {
            createResolvedTab(fallbackUrl, () => {
              sendResponse({ ok: true, url: fallbackUrl });
            });
            return;
          }
          if (chrome && chrome.search && typeof chrome.search.query === 'function') {
            markPendingSearchTab(null, sourceTab);
            try {
              chrome.search.query({ text: query, disposition: 'NEW_TAB' }, () => {
                if (chrome.runtime && chrome.runtime.lastError) {
                  pendingSearchAt = 0;
                  pendingSearchTabId = null;
                  pendingSearchGroupContext = null;
                  createResolvedTab(fallbackUrl, () => {
                    sendResponse({ ok: true, url: fallbackUrl });
                  });
                  return;
                }
                sendResponse({ ok: true, url: fallbackUrl });
              });
              return;
            } catch (error) {
              pendingSearchAt = 0;
              pendingSearchTabId = null;
              pendingSearchGroupContext = null;
            }
          }
          createResolvedTab(fallbackUrl, () => {
            sendResponse({ ok: true, url: fallbackUrl });
          });
          return;
        }
        if (chrome && chrome.search && typeof chrome.search.query === 'function') {
          createResolvedTab('about:blank', (tab, info) => {
            if (!tab || typeof tab.id !== 'number' || !info || !info.ok) {
              sendResponse({ ok: false, reason: (info && info.reason) || 'tab-create-failed' });
              return;
            }
            markPendingSearchTab(tab.id, sourceTab);
            SEARCH_RESULT_TABS.searchInTab(chrome, {
              query,
              tabId: tab.id,
              fallbackUrl,
              onFallback() {
                if (pendingSearchTabId === tab.id) {
                  pendingSearchAt = 0;
                  pendingSearchTabId = null;
                  pendingSearchGroupContext = null;
                }
              }
            }, (result) => {
              sendResponse({ ...result, url: fallbackUrl });
            });
          });
          return;
        }
        createResolvedTab(fallbackUrl, () => {
          sendResponse({ ok: true, url: fallbackUrl });
        });
      }
    });
    return true;
  },
  getSearchSuggestions(request, sender, sendResponse) {
    const query = request.query;
    const requestKey = getSearchEngineSuggestionRequestKey(request, sender);
    if (shouldPrefetchSearchEngineSuggestions(request, query)) {
      scheduleSearchEngineSuggestionPrefetch(requestKey, query);
    } else {
      abortSearchEngineSuggestionRequest(requestKey);
    }
    getSearchSuggestions(query, {
      sourceTypes: request.sourceTypes,
      includeOpenTabs: request.includeOpenTabs
    }).then(suggestions => {
      sendResponse({ suggestions: suggestions });
    }).catch(() => {
      sendResponse({ suggestions: [] });
    });
    return true; // Keep the message channel open for async response
  },
  getSearchEngineSuggestions(request, sender, sendResponse) {
    const query = request.query;
    const requestKey = getSearchEngineSuggestionRequestKey(request, sender);
    const requestRecord = consumeSearchEngineSuggestionRequest(requestKey, query);
    if (!requestRecord) {
      sendResponse({ suggestions: [], aborted: false, hasRemoteSuggestions: false });
      return;
    }
    const controller = requestRecord.controller;
    getSearchEngineSuggestions(query, request.localSuggestions, {
      signal: controller.signal,
      rawEngineSuggestionsPromise: startSearchEngineSuggestionRequest(requestRecord),
      searchFirst: request.searchFirst === true
    }).then((suggestions) => {
      const isCurrent = searchEngineSuggestionRequests.get(requestKey) === requestRecord;
      const hasRemoteSuggestions = isCurrent && !controller.signal.aborted && suggestions.some((suggestion) => (
        suggestion && suggestion.type === 'googleSuggest'
      ));
      sendResponse({
        suggestions: isCurrent && !controller.signal.aborted ? suggestions : [],
        aborted: !isCurrent || controller.signal.aborted,
        hasRemoteSuggestions
      });
    }).catch(() => {
      sendResponse({ suggestions: [], aborted: controller.signal.aborted, hasRemoteSuggestions: false });
    }).finally(() => {
      if (searchEngineSuggestionRequests.get(requestKey) === requestRecord) {
        releaseSearchEngineSuggestionRequest(requestKey, requestRecord);
      }
    });
    return true;
  },
  recordSearchSuggestionSelection(request, sender, sendResponse) {
    recordSearchSuggestionSelection(request)
      .then((result) => {
        sendResponse(result);
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          reason: error && error.message ? error.message : 'record-selection-failed'
        });
      });
    return true;
  },
  deleteHistoryUrl(request, sender, sendResponse) {
    const targetUrl = typeof request.url === 'string' ? request.url : '';
    return deleteHistoryUrlFromSearch(targetUrl, sendResponse);
  }
});

let helpCenterIndexLoader = null;
let helpCenterSynonymsLoader = null;

// Help center pages matching the query, read from the index and synonym list of the given
// interface language. Without synonyms the search still runs, only more literally.
function getHelpCenterSearchResults(query, locale) {
  if (!String(query || '').trim()) {
    return Promise.resolve([]);
  }
  if (!helpCenterIndexLoader) {
    const fetchImpl = (url, init) => fetch(url, init);
    helpCenterIndexLoader = HELP_CENTER_SEARCH.createIndexLoader({ fetchImpl });
    // A language with no synonym list (404) is cached as empty rather than asked for on every key.
    helpCenterSynonymsLoader = HELP_CENTER_SEARCH.createIndexLoader({
      fetchImpl: (url, init) => fetch(url, init).then((response) => (
        response.status === 404 ? { ok: true, json: () => [] } : response
      )),
      parse: HELP_CENTER_SEARCH.normalizeSynonyms
    });
  }
  return Promise.all([
    helpCenterIndexLoader.load(COMMUNITY_LINKS.getHelpSearchIndexUrl(locale)),
    helpCenterSynonymsLoader.load(COMMUNITY_LINKS.getHelpSearchSynonymsUrl(locale)).catch(() => [])
  ]).then(([index, synonyms]) => HELP_CENTER_SEARCH.searchIndex(index, query, {
    origin: COMMUNITY_LINKS.WEB_ORIGIN,
    synonyms
  }));
}

// Site search, help center and aggregate search.
const SITE_SEARCH_MESSAGE_HANDLERS = Object.freeze({
  getSiteSearchProviders(request, sender, sendResponse) {
    loadSiteSearchProviders().then((items) => {
      sendResponse({ items: items });
    }).catch(() => {
      sendResponse({
        items: [],
        reason: 'site-search-provider-load-failed'
      });
    });
    return true;
  },
  getHelpCenterSearchResults(request, sender, sendResponse) {
    getHelpCenterSearchResults(request.query, request.locale).then((items) => {
      sendResponse({ items });
    }).catch(() => {
      sendResponse({ items: [], reason: 'help-center-index-unavailable' });
    });
    return true;
  },
  runSiteSearchProviderQuery(request, sender, sendResponse) {
    runInteractiveSiteSearchProvider(
      request.provider,
      request.query,
      sender,
      request.disposition
    ).then((result) => {
      sendResponse(result);
    }).catch((error) => {
      sendResponse({
        ok: false,
        reason: error && error.message ? error.message : 'interactive-site-search-failed'
      });
    });
    return true;
  },
  runAggregateSearchQuery(request, sender, sendResponse) {
    runAggregateSearchQuery(
      request.aggregateId,
      request.query,
      sender,
      request.disposition
    ).then(sendResponse).catch((error) => {
      sendResponse({
        ok: false,
        reason: error && error.message ? error.message : 'aggregate-search-failed'
      });
    });
    return true;
  }
});

// Selection quick actions.
const SELECTION_QUICK_ACTION_MESSAGE_HANDLERS = Object.freeze({
  runSelectionQuickAction(request, sender, sendResponse) {
    runSelectionQuickAction(request, sender)
      .then((result) => {
        sendResponse(result);
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          reason: error && error.message ? error.message : 'selection-quick-action-failed'
        });
      });
    return true;
  }
});

// Parsed _locales files by locale. They only change with the extension, which
// restarts this worker, so each is read once per worker lifetime.
const localeMessagesByLocale = new Map();

function loadLocaleMessages(rawLocale) {
  const locale = SETTINGS.normalizeLocale(rawLocale);
  if (localeMessagesByLocale.has(locale)) {
    return localeMessagesByLocale.get(locale);
  }
  const loading = fetch(chrome.runtime.getURL(`_locales/${locale}/messages.json`))
    .then((response) => response.json())
    .then((messages) => (messages && typeof messages === 'object' ? messages : {}))
    .catch(() => {
      localeMessagesByLocale.delete(locale);
      return {};
    });
  localeMessagesByLocale.set(locale, loading);
  return loading;
}

// A page script that names the few strings it shows gets only those.
function pickLocaleMessages(messages, keys) {
  if (!Array.isArray(keys)) {
    return messages;
  }
  const picked = {};
  keys.forEach((key) => {
    if (typeof key === 'string' && Object.prototype.hasOwnProperty.call(messages, key)) {
      picked[key] = messages[key];
    }
  });
  return picked;
}

// Locale messages and permission probes.
const LOCALE_AND_PERMISSION_MESSAGE_HANDLERS = Object.freeze({
  getLocaleMessages(request, sender, sendResponse) {
    loadLocaleMessages(request && request.locale).then((messages) => {
      sendResponse({ messages: pickLocaleMessages(messages, request && request.keys) });
    });
    return true;
  },
  getFileSchemeAccessStatus(request, sender, sendResponse) {
    checkFileSchemeAccess((isAllowed) => {
      sendResponse({
        ok: true,
        allowed: isAllowed === true,
        supported: isAllowed !== null,
        detailsUrl: getExtensionDetailsUrl()
      });
    });
    return true;
  }
});

// Extension pages, tab creation and progress probes.
const EXTENSION_PAGE_MESSAGE_HANDLERS = Object.freeze({
  probeProgressSeries(request, sender, sendResponse) {
    // Pinning from New Tab: does the open page read as an episode or chapter?
    if (!progressTrackingEnabled) {
      sendResponse({ ok: true, series: false });
      return false;
    }
    progressTracker.probeSeries(String(request.url || '')).then((series) => {
      sendResponse({ ok: true, series: series === true });
    }, () => sendResponse({ ok: false, series: false }));
    return true;
  },
  openOptionsPage(request, sender, sendResponse) {
    openExtensionOptionsPage({ disposition: request.disposition, hash: request.hash }, (ok) => {
      sendResponse({ ok: ok !== false });
    });
    return true;
  },
  openOnboardingPage(request, sender, sendResponse) {
    openOnboardingPage({ reason: 'manual', disposition: request.disposition }, (ok) => {
      sendResponse({ ok: ok !== false });
    });
    return true;
  },
  openReleasePage(request, sender, sendResponse) {
    const reason = typeof request.reason === 'string' ? request.reason : 'manual';
    openReleasePage({ reason, disposition: request.disposition }, (ok) => {
      sendResponse({ ok: ok !== false });
    });
    return true;
  },
  openExtensionShortcutsPage(request, sender, sendResponse) {
    openExtensionShortcutsPage({ disposition: request.disposition }, (ok) => {
      sendResponse({ ok: ok !== false });
    });
    return true;
  },
  openSiteSearchOptionsPage(request, sender, sendResponse) {
    openSiteSearchOptionsPage({ disposition: request.disposition }, (ok) => {
      sendResponse({ ok: ok !== false });
    });
    return true;
  },
  openBookmarkManager(request, sender, sendResponse) {
    openBookmarkManagerPage().then((url) => {
      sendResponse({ ok: true, url: url });
    }).catch(() => {
      sendResponse({ ok: false });
    });
    return true;
  },
  openBookmarkFolderInNewTabGroup(request, sender, sendResponse) {
    const sourceTab = sender && sender.tab ? sender.tab : null;
    BOOKMARK_TAB_GROUPS.openBookmarkFolderInNewTabGroup(chrome, {
      folderId: request.folderId,
      title: request.title,
      windowId: sourceTab && typeof sourceTab.windowId === 'number'
        ? sourceTab.windowId
        : undefined,
      insertIndex: sourceTab && typeof sourceTab.index === 'number'
        ? sourceTab.index + 1
        : undefined
    }).then(sendResponse).catch((error) => {
      sendResponse({
        ok: false,
        reason: error && error.message
          ? error.message
          : 'bookmark-tab-group-failed'
      });
    });
    return true;
  },
  createTab(request, sender, sendResponse) {
    const targetUrl = typeof request.url === 'string' ? request.url : '';
    const sourceTab = sender && sender.tab ? sender.tab : null;
    if (!targetUrl) {
      sendResponse({ ok: false });
      return;
    }
    if (request.disposition === 'currentTab') {
      const senderTabId = sender && sender.tab && typeof sender.tab.id === 'number'
        ? sender.tab.id
        : null;
      const updateTab = (tabId) => {
        chrome.tabs.update(tabId, { url: targetUrl, active: true }, () => {
          sendResponse({ ok: !(chrome.runtime && chrome.runtime.lastError) });
        });
      };
      if (typeof senderTabId === 'number') {
        updateTab(senderTabId);
        return true;
      }
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = Array.isArray(tabs) && tabs.length > 0 ? tabs[0] : null;
        if (activeTab && typeof activeTab.id === 'number') {
          updateTab(activeTab.id);
          return;
        }
        sendResponse({ ok: false });
      });
      return true;
    }
    createSearchResultTab({ url: targetUrl, active: request.disposition !== 'backgroundTab' }, sourceTab, (_tab, info) => {
      sendResponse({ ok: Boolean(info && info.ok) });
    });
    return true;
  },
  openNewTab(request, sender, sendResponse) {
    createTabWithSourceGroup({
      active: request.disposition !== 'backgroundTab'
    }, sender && sender.tab ? sender.tab : null, (_tab, info) => {
      sendResponse({ ok: Boolean(info && info.ok) });
    });
    return true;
  },
  openExtensionDetailsPage(request, sender, sendResponse) {
    const detailsUrl = getExtensionDetailsUrl();
    createTabWithSourceGroup({
      url: detailsUrl,
      active: request.disposition !== 'backgroundTab'
    }, sender && sender.tab ? sender.tab : null, (_tab, info) => {
      sendResponse({ ok: Boolean(info && info.ok), url: detailsUrl });
    });
    return true;
  }
});

// Favicons and site theme colors.
const FAVICON_MESSAGE_HANDLERS = Object.freeze({
  resolveFaviconCandidates(request, sender, sendResponse) {
    const targetUrl = request.url || '';
    const hostOverride = request.host || '';
    const fallbackUrl = request.fallbackUrl || '';
    const preferredTheme = request.preferredTheme || '';
    const options = {
      includeChromeFallback: request.excludeChromeFallback ? false : true,
      forceFresh: request.forceFresh === true
    };
    resolveFaviconCandidates(targetUrl, hostOverride, fallbackUrl, preferredTheme, options).then((urls) => {
      sendResponse({ urls: Array.isArray(urls) ? urls : [] });
    }).catch(() => {
      sendResponse({ urls: [] });
    });
    return true;
  },
  getFaviconData(request, sender, sendResponse) {
    const targetUrl = request.url || '';
    const pageUrl = request.pageUrl || '';
    if (!targetUrl || typeof targetUrl !== 'string' || targetUrl.startsWith('data:')) {
      sendResponse({ data: '' });
      return;
    }
    loadFaviconRequestBlacklistItems().then(() => {
      if (isBlockedLocalFaviconUrl(targetUrl)) {
        logBlockedLocalFavicon(targetUrl, 'message:getFaviconData');
        sendResponse({ data: '' });
        return;
      }
      try {
        const targetHost = new URL(targetUrl).hostname;
        if (shouldBlockFaviconForHost(targetHost)) {
          sendResponse({ data: '' });
          return;
        }
      } catch (e) {
        // Ignore parse failures and continue with non-local handling.
      }
      fetchFaviconData(targetUrl, pageUrl).then((dataUrl) => {
        sendResponse({ data: dataUrl || '' });
      }).catch(() => {
        sendResponse({ data: '' });
      });
    }).catch(() => {
      sendResponse({ data: '' });
    });
    return true;
  },
  getShortcutFaviconData(request, sender, sendResponse) {
    const pageUrl = request.pageUrl || '';
    const preferredTheme = request.preferredTheme || '';
    fetchShortcutFaviconData(pageUrl, preferredTheme, '', request.refresh === true, request.iconSource).then((result) => {
      sendResponse(result || {
        data: '',
        sourceUrl: '',
        width: 0,
        height: 0,
        vector: false
      });
    }).catch(() => {
      sendResponse({
        data: '',
        sourceUrl: '',
        width: 0,
        height: 0,
        vector: false
      });
    });
    return true;
  },
  resolveSiteThemeColor(request, sender, sendResponse) {
    const targetUrl = request.url || '';
    const hostOverride = request.host || '';
    const preferredTheme = request.preferredTheme || '';
    resolveSiteThemeColor(targetUrl, hostOverride, preferredTheme).then((result) => {
      sendResponse(result || { accentRgb: null, source: '' });
    }).catch(() => {
      sendResponse({ accentRgb: null, source: '' });
    });
    return true;
  }
});

// One action -> handler registry for runtime messages. Each feature area
// above owns its handlers; adding an action is one entry in its area's map,
// and the router rejects an action registered twice.
const backgroundMessageRouter = BACKGROUND_MESSAGE_ROUTER.createRouter(
  { webdav: handleWebDavMessage },
  TAB_MESSAGE_HANDLERS,
  SHORTCUT_MESSAGE_HANDLERS,
  PIP_MESSAGE_HANDLERS,
  SEARCH_MESSAGE_HANDLERS,
  SITE_SEARCH_MESSAGE_HANDLERS,
  SELECTION_QUICK_ACTION_MESSAGE_HANDLERS,
  LOCALE_AND_PERMISSION_MESSAGE_HANDLERS,
  EXTENSION_PAGE_MESSAGE_HANDLERS,
  FAVICON_MESSAGE_HANDLERS
);

// Actions the in-page surfaces (content scripts, the injected overlay, tab
// switcher, selection toolbar and picture-in-picture helpers) send. Those run
// inside web pages; every other action is accepted from extension pages only.
const WEB_PAGE_MESSAGE_ACTIONS = Object.freeze([
  'switchToTab', 'closeTabFromTabSwitcher', 'notifyOverlayClosed', 'notifyTopFrameDocumentStarted',
  'updateOverlayLoadingSession', 'getTabsForOverlay', 'closeOtherTabsForOverlay',
  'getShowSearchShortcut', 'copyCurrentPageUrl', 'triggerShowSearchFromPageHotkey',
  'notifyTabSwitcherShortcutModifierReleased', 'getShortcutRules',
  'pipRequestOwnership', 'pipReleaseOwnership', 'openDocumentPipPicker', 'siteTryEnterPiPInMainWorld',
  'iqiyiTryEnterPiPInMainWorld', 'iqiyiSetupAutoPiPInMainWorld', 'forceExitPiPInMainWorld',
  'ytForceExitPiPInMainWorld',
  'searchOrNavigate', 'getSearchSuggestions', 'getSearchEngineSuggestions',
  'recordSearchSuggestionSelection', 'deleteHistoryUrl',
  'getSiteSearchProviders', 'getHelpCenterSearchResults', 'runSiteSearchProviderQuery',
  'runAggregateSearchQuery', 'runSelectionQuickAction',
  'getLocaleMessages', 'openOptionsPage', 'openReleasePage', 'createTab', 'openNewTab',
  'getFaviconData'
]);

const backgroundMessageSenderPolicy = BACKGROUND_MESSAGE_ROUTER.createSenderPolicy({
  extensionBaseUrl: chrome.runtime.getURL(''),
  pageActions: WEB_PAGE_MESSAGE_ACTIONS,
  pageArgumentGuards: {
    // Typed, bookmarked and history targets stay openable; script, inline data
    // documents and other extensions' pages do not.
    createTab: (request) => globalThis.LumnoUrlGuards.canOpenUrlFromWebPageContext(
      request.url,
      chrome.runtime.getURL('')
    ),
    runSiteSearchProviderQuery: (request) => {
      const entryUrl = getSiteSearchProviderEntryUrl(request.provider, request.query);
      return /^https?:\/\//i.test(entryUrl);
    }
  }
});

function dispatchBackgroundMessage(request, sender, sendResponse) {
  return BACKGROUND_MESSAGE_ROUTER.dispatch(
    backgroundMessageRouter,
    request,
    sender,
    sendResponse,
    backgroundMessageSenderPolicy
  );
}

// Listen for extension runtime messages.
chrome.runtime.onMessage.addListener(dispatchBackgroundMessage);

const SITE_SEARCH_STORAGE_KEY = '_x_extension_site_search_custom_2024_unique_';
const SITE_SEARCH_DISABLED_STORAGE_KEY = '_x_extension_site_search_disabled_2024_unique_';
const AGGREGATE_SEARCH_STORE = globalThis.LumnoAggregateSearchStore;
const AGGREGATE_SEARCH = globalThis.LumnoBackgroundAggregateSearch;
const AGGREGATE_SEARCH_STORAGE_KEY = AGGREGATE_SEARCH_STORE.STORAGE_KEY ||
  '_x_extension_aggregate_searches_2026_unique_';
const AGGREGATE_SEARCH_AUTO_GROUP_ENABLED_STORAGE_KEY =
  SETTINGS.AGGREGATE_SEARCH_AUTO_GROUP_ENABLED_STORAGE_KEY ||
  '_x_extension_aggregate_search_auto_group_enabled_2026_unique_';
const SEARCH_BLACKLIST_STORAGE_KEY = '_x_extension_search_blacklist_2026_unique_';
const FAVICON_REQUEST_BLACKLIST_STORAGE_KEY = '_x_extension_favicon_request_blacklist_2026_unique_';
const FAVICON_ENHANCED_FETCH_ENABLED_STORAGE_KEY = '_x_extension_favicon_enhanced_fetch_enabled_2026_unique_';
const OVERLAY_OPEN_TABS_DEFAULT_VISIBLE_STORAGE_KEY = '_x_extension_overlay_open_tabs_default_visible_2026_unique_';
const BLACKLIST_UTILS = globalThis.LumnoBlacklistUtils;
const SEARCH_UTILS = globalThis.LumnoSearchUtils;
const COMMUNITY_LINKS = globalThis.LumnoCommunityLinks;
const HELP_CENTER_SEARCH = globalThis.LumnoHelpCenterSearch;
const AI_PROVIDER_SUBMIT = globalThis.LumnoAiProviderSubmit;
const SELECTION_INTENT = globalThis.LumnoSelectionIntent;
const SELECTION_TARGET = globalThis.LumnoSelectionTarget;
const SELECTION_QUICK_ACTION_PROVIDER = globalThis.LumnoSelectionQuickActionProvider;
const DEFAULT_SEARCH_ENGINE_STORAGE_KEY = '_x_extension_default_search_engine_2024_unique_';
const CHROME_SYNC_STORAGE_KEYS = Array.isArray(globalThis.LumnoSettings.CHROME_SYNC_STORAGE_KEYS)
  ? globalThis.LumnoSettings.CHROME_SYNC_STORAGE_KEYS
  : [];
if (providerStorageRuntime) {
  providerStorageRuntime.ready.then(() => {
    migrateStorageIfNeeded(CHROME_SYNC_STORAGE_KEYS);
  });
} else {
  migrateStorageIfNeeded(CHROME_SYNC_STORAGE_KEYS);
}
if (chrome && chrome.storage && chrome.storage.sync &&
    typeof chrome.storage.sync.remove === 'function') {
  chrome.storage.sync.remove(LANGUAGE_MESSAGES_STORAGE_KEY, ignoreExpectedChromeError);
}
const SITE_SEARCH_ICON_STORAGE_KEY = SHORTCUT_FAVICON.SITE_SEARCH_STORAGE_KEY ||
  '_x_extension_site_search_icon_cache_canonical_2026_unique_';

const SITE_SEARCH_ICON_CACHE_OPTIONS = SHORTCUT_FAVICON.SITE_SEARCH_CACHE_OPTIONS || Object.freeze({
  cacheTtlMs: 1000 * 60 * 60 * 24 * 180,
  cacheMaxEntries: 40,
  maxDataUrlLength: 192 * 1024
});
const SITE_SEARCH_PINNED_ICON_KEYS = new Set(Object.keys(
  SHORTCUT_FAVICON.SITE_SEARCH_PINNED_ICON_ASSETS || {}
));
const logBackgroundFaviconDecision = FAVICON_UTILS.createFaviconDecisionLogger({ surface: 'background' });

getBackgroundFaviconCacheRuntime();

function normalizeHost(hostname) {
  if (!hostname) {
    return '';
  }
  const lower = String(hostname).toLowerCase();
  const stripped = lower.replace(/^www\./i, '');
  if (stripped === 'my.feishu.cn') {
    return 'feishu.cn';
  }
  return stripped;
}

defaultSearchEngineStateReady = loadDefaultSearchEngineState();

if (chrome && chrome.tabs) {
  chrome.tabs.onCreated.addListener((tab) => {
    if (!pendingSearchAt || !tab || typeof tab.id !== 'number') {
      return;
    }
    if (pendingSearchTabId !== null && tab.id !== pendingSearchTabId) {
      return;
    }
    if (Date.now() - pendingSearchAt > 5000) {
      pendingSearchAt = 0;
      pendingSearchTabId = null;
      pendingSearchGroupContext = null;
      return;
    }
    pendingSearchTabId = tab.id;
    moveTabToSourceGroupContext(tab, pendingSearchGroupContext, () => {});
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (!changeInfo || !changeInfo.url) {
      return;
    }
    if (!pendingSearchAt || (Date.now() - pendingSearchAt > 10000)) {
      pendingSearchAt = 0;
      pendingSearchTabId = null;
      pendingSearchGroupContext = null;
      return;
    }
    if (pendingSearchTabId !== null && tabId !== pendingSearchTabId) {
      return;
    }
    const updated = updateDefaultSearchEngineFromUrl(changeInfo.url);
    if (updated) {
      pendingSearchTabId = null;
      pendingSearchAt = 0;
      pendingSearchGroupContext = null;
    }
  });
}

removeLegacySiteSearchIconCaches();
warmSiteSearchProviderIcons();

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (!isPrimaryStorageAreaName(areaName)) {
    return;
  }
  if (changes[RESTRICTED_ACTION_STORAGE_KEY]) {
    const next = changes[RESTRICTED_ACTION_STORAGE_KEY].newValue;
    restrictedActionCache = next === 'none' ? 'none' : 'default';
    if (typeof next !== 'undefined' && next !== restrictedActionCache && storageArea) {
      storageArea.set({ [RESTRICTED_ACTION_STORAGE_KEY]: restrictedActionCache });
    }
  }
  if (changes[RESTRICTED_ACTION_AUTO_BROWSER_SETTING_DONE_STORAGE_KEY]) {
    const next = changes[RESTRICTED_ACTION_AUTO_BROWSER_SETTING_DONE_STORAGE_KEY].newValue;
    restrictedActionAutoBrowserSettingDoneCache = next === true;
  }
  if (changes[DOCUMENT_PIP_ENABLED_STORAGE_KEY]) {
    const next = changes[DOCUMENT_PIP_ENABLED_STORAGE_KEY].newValue;
    const normalized = next === true;
    documentPipEnabledCache = normalized;
    resolveDocumentPipEnabledReady();
    if (typeof next !== 'undefined' && next !== normalized && storageArea) {
      storageArea.set({ [DOCUMENT_PIP_ENABLED_STORAGE_KEY]: normalized });
    }
  }
  if (changes[TAB_SWITCHER_ENABLED_STORAGE_KEY]) {
    const next = changes[TAB_SWITCHER_ENABLED_STORAGE_KEY].newValue;
    const normalized = SETTINGS.normalizeTabSwitcherEnabled(next);
    applyTabSwitcherEnabledSetting(normalized);
    if (typeof next !== 'undefined' && next !== normalized && storageArea) {
      storageArea.set({ [TAB_SWITCHER_ENABLED_STORAGE_KEY]: normalized });
    }
  }
  if (changes[PINNED_TAB_RECOVERY_ENABLED_STORAGE_KEY]) {
    const next = changes[PINNED_TAB_RECOVERY_ENABLED_STORAGE_KEY].newValue;
    const normalized = applyPinnedTabRecoverySetting(next);
    if (normalized) {
      schedulePersistPinnedTabSnapshot();
    }
  }
  if (changes[SITE_SEARCH_STORAGE_KEY] || changes[SITE_SEARCH_DISABLED_STORAGE_KEY]) {
    invalidateSiteSearchProviderCache();
    warmSiteSearchProviderIcons();
  }
  if (changes[SEARCH_BLACKLIST_STORAGE_KEY]) {
    searchBlacklistCache = null;
    searchBlacklistPromise = null;
  }
  if (changes[FAVICON_REQUEST_BLACKLIST_STORAGE_KEY]) {
    faviconRequestBlacklistCache = null;
    faviconRequestBlacklistPromise = null;
    invalidateShortcutFaviconPolicyCache();
  }
  if (changes[FAVICON_ENHANCED_FETCH_ENABLED_STORAGE_KEY]) {
    faviconEnhancedFetchEnabledCache = null;
    faviconEnhancedFetchEnabledPromise = null;
    invalidateShortcutFaviconPolicyCache();
  }
  if (changes[SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY]) {
    searchResultSourceTypesCache = null;
    searchResultSourceTypesPromise = null;
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes[SEARCH_SELECTION_STATS_STORAGE_KEY]) {
    return;
  }
  searchSelectionStatsCache = normalizeSearchSelectionStats(
    changes[SEARCH_SELECTION_STATS_STORAGE_KEY].newValue
  );
  searchSelectionStatsPromise = null;
});
