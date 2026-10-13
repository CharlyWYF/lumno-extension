// Favicons and site theme colors for every surface: candidate resolution and
// the favicon-request blacklist, fetched favicon data, high-resolution
// shortcut and site-search provider icons (with their cache and warmup), site
// theme colors, and the "favicon may have changed" marks recorded on visits.
//
// Loaded by background.js through its first importScripts block (the Firefox
// build lists that block as background.scripts). Like background.js this is a
// classic script sharing the worker's global scope. Its functions use
// background.js bindings (FAVICON_UTILS, SHORTCUT_FAVICON, storageArea, the
// site-search icon cache options, ...) only when they run, never while this
// file loads, because background.js has not initialized its own top-level
// bindings yet at that point.
//
// The caches below are rebuildable; the pending visit marks only delay a
// favicon refresh if a suspension drops them.

const FAVICON_VISIT_DIRTY_TTL_MS = 1000 * 60 * 60 * 24;

const FAVICON_VISIT_DIRTY_MAX_ENTRIES = 600;

const faviconVisitDirtyWriteDebounceMs = 400;

const faviconVisitDirtyMarkThrottleMs = 2 * 60 * 1000;

// Pending dirty marks; losing them only delays a favicon refresh.
const faviconVisitDirtyMarkCache = new Map();

let faviconVisitDirtyPersistTimer = null;

function normalizeFaviconVisitDirtyHost(hostname) {
  if (!hostname) {
    return '';
  }
  return normalizeHost(String(hostname).trim());
}

function getFaviconVisitDirtyStorageArea() {
  if (!chrome || !chrome.storage || !chrome.storage.local) {
    return null;
  }
  return chrome.storage.local;
}

function getValidFaviconVisitDirtyEntries(rawEntries) {
  const now = Date.now();
  const input = rawEntries && typeof rawEntries === 'object' ? rawEntries : {};
  const valid = [];
  Object.keys(input).forEach((key) => {
    const updatedAt = Number(input[key] || 0);
    if (!key || !Number.isFinite(updatedAt)) {
      return;
    }
    if (now - updatedAt > FAVICON_VISIT_DIRTY_TTL_MS) {
      return;
    }
    valid.push({ key, updatedAt });
  });
  valid.sort((a, b) => b.updatedAt - a.updatedAt);
  return valid.slice(0, FAVICON_VISIT_DIRTY_MAX_ENTRIES);
}

function schedulePersistFaviconVisitDirtyHost(hostname) {
  const host = normalizeFaviconVisitDirtyHost(hostname);
  const storageArea = getFaviconVisitDirtyStorageArea();
  if (!host || !storageArea) {
    return;
  }
  const now = Date.now();
  const lastMarkedAt = Number(faviconVisitDirtyMarkCache.get(host) || 0);
  if (lastMarkedAt && (now - lastMarkedAt) < faviconVisitDirtyMarkThrottleMs) {
    return;
  }
  faviconVisitDirtyMarkCache.set(host, now);
  if (faviconVisitDirtyPersistTimer !== null) {
    clearTimeout(faviconVisitDirtyPersistTimer);
  }
  faviconVisitDirtyPersistTimer = setTimeout(() => {
    faviconVisitDirtyPersistTimer = null;
    storageArea.get([FAVICON_VISIT_DIRTY_STORAGE_KEY], (result) => {
      const payload = result && result[FAVICON_VISIT_DIRTY_STORAGE_KEY];
      const existing = getValidFaviconVisitDirtyEntries(payload && payload.entries ? payload.entries : null);
      const merged = new Map(existing.map((item) => [item.key, item.updatedAt]));
      faviconVisitDirtyMarkCache.forEach((updatedAt, key) => {
        merged.set(key, updatedAt);
      });
      const serializedEntries = Array.from(merged.entries())
        .map(([key, updatedAt]) => ({
          key: String(key || ''),
          updatedAt: Number(updatedAt || 0)
        }))
        .filter((item) => item.key && Number.isFinite(item.updatedAt))
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, FAVICON_VISIT_DIRTY_MAX_ENTRIES);
      const serialized = {};
      serializedEntries.forEach((item) => {
        serialized[item.key] = item.updatedAt;
      });
      storageArea.set({
        [FAVICON_VISIT_DIRTY_STORAGE_KEY]: {
          version: 1,
          entries: serialized,
          updatedAt: Date.now()
        }
      }, () => {
        faviconVisitDirtyMarkCache.clear();
      });
    });
  }, faviconVisitDirtyWriteDebounceMs);
}

function markFaviconDirtyForUrl(url) {
  if (!url) {
    return;
  }
  let parsed = null;
  try {
    parsed = new URL(url);
  } catch (e) {
    return;
  }
  if (!/^https?:$/i.test(parsed.protocol)) {
    return;
  }
  const host = normalizeFaviconVisitDirtyHost(parsed.hostname);
  if (!host || shouldBlockFaviconForHost(host)) {
    return;
  }
  schedulePersistFaviconVisitDirtyHost(host);
}

let faviconRequestBlacklistCache = null;

let faviconRequestBlacklistPromise = null;

let faviconEnhancedFetchEnabledCache = null;

let faviconEnhancedFetchEnabledPromise = null;

const FAVICON_PROXY_SIZE = 128;

let backgroundFaviconUrlResolver = null;

const faviconDataCache = new Map();

const faviconPending = new Map();

const shortcutFaviconDataCache = new Map();

const shortcutFaviconPending = new Map();

let shortcutFaviconPolicyRevision = 0;

const siteThemeColorCache = new Map();

const siteThemeColorPending = new Map();

const BACKGROUND_FAVICON_DATA_CACHE_MAX_ENTRIES = 256;

const BACKGROUND_SHORTCUT_FAVICON_CACHE_MAX_ENTRIES = 64;

const SHORTCUT_FAVICON_FETCH_TIMEOUT_MS = 6500;

const SHORTCUT_FAVICON_PAGE_MAX_LENGTH = 768 * 1024;

const SHORTCUT_FAVICON_MANIFEST_MAX_BYTES = 512 * 1024;

const SHORTCUT_FAVICON_RESOURCE_MAX_BYTES = 256 * 1024;

function invalidateShortcutFaviconPolicyCache() {
  shortcutFaviconPolicyRevision += 1;
  shortcutFaviconDataCache.clear();
  shortcutFaviconPending.clear();
}

const SITE_SEARCH_ICON_WARM_CONCURRENCY = 2;

const BACKGROUND_SITE_THEME_CACHE_MAX_ENTRIES = 512;

let backgroundFaviconCacheRuntime = null;

let siteSearchIconStore = null;

let siteSearchIconCache = null;

let siteSearchIconCacheLoadPromise = null;

let siteSearchIconCacheWriteTimer = null;

let siteSearchIconCacheRevision = 0;

let siteSearchIconWarmActiveCount = 0;

const siteSearchIconWarmQueue = [];

const siteSearchIconWarmPending = new Set();

function logBlockedLocalFavicon(url, candidateKind, reason, pageUrl) {
  return logBackgroundFaviconDecision(url, reason || 'local-rule', {
    pageUrl: pageUrl || url,
    candidateKind: candidateKind || 'unknown'
  });
}

function getBackgroundFaviconCacheRuntime() {
  if (!backgroundFaviconCacheRuntime) {
    backgroundFaviconCacheRuntime = FAVICON_CACHE.createFaviconCache({
      storageArea: (chrome && chrome.storage && chrome.storage.local) ? chrome.storage.local : null,
      windowObj: globalThis,
      normalizeFaviconHost,
      isBlockedLocalFaviconUrl,
      isChromeMonogramFaviconUrl: FAVICON_UTILS.isChromeMonogramFaviconUrl
    });
    if (backgroundFaviconCacheRuntime &&
        typeof backgroundFaviconCacheRuntime.ensureCachesReady === 'function') {
      backgroundFaviconCacheRuntime.ensureCachesReady()
        .catch(warnBackgroundFailure('Failed to load the favicon caches.'));
    }
  }
  return backgroundFaviconCacheRuntime;
}

function getBackgroundFaviconUrlResolver() {
  if (!backgroundFaviconUrlResolver) {
    backgroundFaviconUrlResolver = FAVICON_UTILS.createFaviconUrlResolver({
      chromeApi: chrome,
      size: FAVICON_PROXY_SIZE,
      shouldBlockFaviconForHost,
      shouldAvoidDirectFaviconForHost,
      isEnhancedFaviconFetchEnabled: (pageUrl) => (
        faviconEnhancedFetchEnabledCache === true &&
        !isUrlBlockedByFaviconRequestBlacklist(pageUrl)
      ),
      getStrictFaviconReason: (pageUrl) => {
        if (isUrlBlockedByFaviconRequestBlacklist(pageUrl)) {
          return 'exclusion';
        }
        if (faviconEnhancedFetchEnabledCache !== true) {
          return 'global-off';
        }
        return '';
      },
      logFaviconDecision: logBackgroundFaviconDecision
    });
  }
  return backgroundFaviconUrlResolver;
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function getExtensionFaviconUrl(pageUrl) {
  const resolver = getBackgroundFaviconUrlResolver();
  return resolver ? resolver.getExtensionFaviconUrl(pageUrl) : '';
}

function isBrowserInternalPageUrl(url) {
  const resolver = getBackgroundFaviconUrlResolver();
  return resolver ? resolver.isBrowserInternalPageUrl(url) : false;
}

function getGstaticFaviconUrl(pageUrl) {
  const resolver = getBackgroundFaviconUrlResolver();
  return resolver ? resolver.getGstaticFaviconUrl(pageUrl) : '';
}

function getPageFaviconCandidateUrl(pageUrl) {
  const resolver = getBackgroundFaviconUrlResolver();
  return resolver ? resolver.getPageFaviconCandidateUrl(pageUrl) : '';
}

function getHostFaviconUrl(hostname) {
  const normalized = normalizeFaviconHost(hostname);
  if (!normalized) {
    return '';
  }
  if (normalized === 'lumno.kubai.design') {
    return (chrome && chrome.runtime && typeof chrome.runtime.getURL === 'function')
      ? chrome.runtime.getURL('assets/images/lumno.png')
      : 'https://lumno.kubai.design/favicon.png';
  }
  return getGstaticFaviconUrl(`https://${normalized}/`);
}

function isFaviconProxyUrl(url) {
  return FAVICON_UTILS.isFaviconProxyUrl(url);
}

function getFaviconFallbackHost(rawInput) {
  const withoutScheme = String(rawInput || '').replace(/^https?:\/\//i, '');
  const authority = withoutScheme.split(/[/?#]/)[0] || '';
  if (!authority) {
    return '';
  }
  if (authority.startsWith('[')) {
    const endBracket = authority.indexOf(']');
    if (endBracket > 1) {
      return authority.slice(1, endBracket).toLowerCase();
    }
    return '';
  }
  if (authority.includes('::') && !authority.includes('.')) {
    return authority.toLowerCase();
  }
  return (authority.split(':')[0] || '').toLowerCase();
}

function shouldBlockFaviconForHost(hostname) {
  return FAVICON_UTILS.shouldBlockFaviconForHost(hostname);
}

function shouldAvoidDirectFaviconForHost(hostname) {
  return FAVICON_UTILS.shouldAvoidDirectFaviconForHost(hostname);
}

function isAllowedFaviconProxyRequestUrl(url) {
  return FAVICON_UTILS.isAllowedFaviconProxyRequestUrl(url);
}

function isFaviconRequestBlockedByBlacklist(url) {
  return !isAllowedFaviconProxyRequestUrl(url) && isUrlBlockedByFaviconRequestBlacklist(url);
}

function isBlockedLocalFaviconUrl(url) {
  const blockedByLocalRules = FAVICON_UTILS.isBlockedLocalFaviconUrl(url);
  return blockedByLocalRules || isFaviconRequestBlockedByBlacklist(url);
}

function getFaviconHostPolicy(hostname) {
  return FAVICON_UTILS.getFaviconHostPolicy(hostname, {
    shouldBlockFaviconForHost,
    shouldAvoidDirectFaviconForHost
  });
}

function getFaviconTargetPolicy(targetUrl, hostOverride) {
  const inputUrl = String(targetUrl || '').trim();
  if (!inputUrl) {
    return { ok: false, inputUrl: '', parsed: null };
  }
  let parsed = null;
  try {
    parsed = new URL(inputUrl);
  } catch (e) {
    return { ok: false, inputUrl, parsed: null };
  }
  if (!/^https?:$/i.test(parsed.protocol)) {
    return { ok: false, inputUrl, parsed };
  }
  const hosts = [parsed.hostname, hostOverride].filter(Boolean);
  const policies = hosts.map((host) => getFaviconHostPolicy(host));
  const hardBlocked = policies.some((policy) => policy.hardBlocked);
  const avoidDirect = policies.some((policy) => policy.avoidDirect);
  const requestBlacklisted = isUrlBlockedByFaviconRequestBlacklist(inputUrl);
  return {
    ok: true,
    inputUrl,
    parsed,
    normalizedHost: normalizeFaviconHost(hostOverride || parsed.hostname),
    hardBlocked,
    avoidDirect,
    requestBlacklisted,
    directFetchBlocked: requestBlacklisted || hardBlocked || avoidDirect
  };
}

function normalizeFaviconHost(hostname) {
  return FAVICON_UTILS.normalizeFaviconHost(hostname);
}

function normalizeThemePreference(theme) {
  return SETTINGS.normalizeThemePreference(theme);
}

function parseHtmlThemeColorCandidates(html, pageUrl, preferredTheme) {
  return FAVICON_UTILS.parseHtmlThemeColorCandidates(html, pageUrl, normalizeThemePreference(preferredTheme));
}

function normalizeThemeAccentRgb(value) {
  if (!Array.isArray(value) || value.length !== 3) {
    return null;
  }
  const rgb = value.map((channel) => Math.round(Number(channel)));
  return rgb.every((channel) => Number.isFinite(channel) && channel >= 0 && channel <= 255)
    ? rgb
    : null;
}

function buildSiteThemeColorResult(accentRgb, source, options) {
  const rgb = normalizeThemeAccentRgb(accentRgb);
  if (!rgb) {
    return null;
  }
  const confidence = options && options.confidence
    ? String(options.confidence)
    : FAVICON_UTILS.getThemeColorConfidence(rgb);
  const neutral = options && typeof options.neutral === 'boolean'
    ? options.neutral
    : confidence === 'neutral';
  return {
    accentRgb: rgb,
    source: source || 'meta',
    neutral,
    confidence
  };
}

function fetchManifestThemeColor(manifestUrl) {
  // Arbitrary manifest URLs are untrusted network targets. Theme extraction
  // intentionally stays browser-cache-only instead of making a privileged GET.
  return Promise.resolve(null);
}

function resolveThemeColorCandidates(candidates) {
  const sorted = (Array.isArray(candidates) ? candidates : [])
    .filter((item) => item && (item.accentRgb || item.manifestUrl))
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  let index = 0;
  const next = () => {
    const candidate = sorted[index];
    index += 1;
    if (!candidate) {
      return Promise.resolve(null);
    }
    if (candidate.accentRgb) {
      return Promise.resolve(buildSiteThemeColorResult(candidate.accentRgb, candidate.source || 'meta', {
        neutral: candidate.neutral,
        confidence: candidate.confidence
      }));
    }
    if (candidate.manifestUrl) {
      return fetchManifestThemeColor(candidate.manifestUrl).then((result) => result || next());
    }
    return next();
  };
  return next();
}

function resolveSiteThemeColor(targetUrl, hostOverride, preferredTheme) {
  const inputUrl = String(targetUrl || '').trim();
  if (!inputUrl) {
    return Promise.resolve(null);
  }
  return Promise.all([
    loadFaviconRequestBlacklistItems(),
    loadFaviconEnhancedFetchEnabled()
  ]).then(([, enhancedFetchEnabled]) => {
    const targetPolicy = getFaviconTargetPolicy(inputUrl, hostOverride);
    if (!targetPolicy.ok) {
      return null;
    }
    logBlockedLocalFavicon(
      inputUrl,
      'theme-page',
      !enhancedFetchEnabled
        ? 'global-off'
        : (targetPolicy.requestBlacklisted ? 'exclusion' : 'direct-network-disabled'),
      inputUrl
    );
    return null;
  });
}

function buildFaviconFallbackCandidates(pageUrl, hostOverride, fallbackUrl, options) {
  const candidates = [];
  const inputUrl = String(pageUrl || '').trim();
  const fallback = String(fallbackUrl || '').trim();
  const settings = options && typeof options === 'object' ? options : {};
  const targetPolicy = settings.targetPolicy || getFaviconTargetPolicy(inputUrl, hostOverride);
  if (targetPolicy.hardBlocked) {
    return [];
  }
  if (inputUrl) {
    candidates.push({ url: getExtensionFaviconUrl(inputUrl), score: 30 });
    if (settings.allowThirdPartyFetch === true) {
      candidates.push({ url: getGstaticFaviconUrl(inputUrl), score: 20 });
    }
  }
  return candidates.filter((item) => item && item.url);
}

function dedupeAndSortFaviconCandidates(candidates) {
  const byUrl = new Map();
  (candidates || []).forEach((item) => {
    if (!item || !item.url) {
      return;
    }
    const key = String(item.url);
    const current = byUrl.get(key);
    if (!current || Number(item.score || 0) > Number(current.score || 0)) {
      byUrl.set(key, { url: key, score: Number(item.score || 0) });
    }
  });
  return Array.from(byUrl.values())
    .sort((a, b) => b.score - a.score)
    .map((item) => item.url);
}

function resolveFaviconCandidates(targetUrl, hostOverride, fallbackUrl) {
  const inputUrl = String(targetUrl || '').trim();
  if (!inputUrl) {
    return Promise.resolve([]);
  }
  return Promise.all([
    loadFaviconRequestBlacklistItems(),
    loadFaviconEnhancedFetchEnabled()
  ]).then(([, enhancedFetchEnabled]) => {
    const targetPolicy = getFaviconTargetPolicy(inputUrl, hostOverride);
    if (!targetPolicy.ok) {
      return [];
    }
    if (targetPolicy.hardBlocked) {
      logBlockedLocalFavicon(targetUrl || hostOverride || '', 'resolveFaviconCandidates');
      return [];
    }
    const strictReason = targetPolicy.requestBlacklisted
      ? 'exclusion'
      : (!enhancedFetchEnabled ? 'global-off' : '');
    if (strictReason) {
      if (fallbackUrl) {
        logBlockedLocalFavicon(fallbackUrl, 'direct', strictReason, inputUrl);
      }
      if (targetPolicy.requestBlacklisted) {
        logBlockedLocalFavicon(getGstaticFaviconUrl(inputUrl), 'third-party-proxy', strictReason, inputUrl);
      }
    }
    return dedupeAndSortFaviconCandidates(buildFaviconFallbackCandidates(inputUrl, hostOverride, fallbackUrl, {
      allowThirdPartyFetch: !targetPolicy.requestBlacklisted,
      skipDirectFallback: !enhancedFetchEnabled || targetPolicy.requestBlacklisted || targetPolicy.avoidDirect,
      targetPolicy
    }));
  });
}

function getShortcutFaviconPreferredTheme(value) {
  const theme = String(value || '').trim().toLowerCase();
  return theme === 'dark' || theme === 'light' ? theme : '';
}

function readShortcutFaviconResponsePrefix(response, maxLength) {
  const limit = Math.max(1, Number(maxLength) || SHORTCUT_FAVICON_PAGE_MAX_LENGTH);
  if (!response || !response.body || typeof response.body.getReader !== 'function' ||
      typeof TextDecoder !== 'function') {
    return response.text().then((text) => String(text || '').slice(0, limit));
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  const readNext = () => reader.read().then((result) => {
    if (!result || result.done) {
      text += decoder.decode();
      return text.slice(0, limit);
    }
    text += decoder.decode(result.value, { stream: true });
    if (text.length >= limit) {
      // A failed cancel only means the stream already ended or errored.
      return Promise.resolve(reader.cancel()).catch(() => {}).then(() => text.slice(0, limit));
    }
    return readNext();
  });
  return readNext().catch(() => text.slice(0, limit));
}

function canFetchShortcutFaviconUrl(url) {
  const policy = getFaviconTargetPolicy(url, '');
  return Boolean(
    policy.ok &&
    !policy.directFetchBlocked &&
    canFetchPageForFavicon(url)
  );
}

function fetchShortcutFaviconDocument(pageUrl, signal) {
  return Promise.resolve(null);
}

function fetchShortcutFaviconManifest(manifestUrl, signal) {
  return Promise.resolve([]);
}

function fetchShortcutFaviconResource(candidate, pageUrl, signal) {
  const sourceUrl = candidate && candidate.url ? String(candidate.url) : '';
  const resolver = getBackgroundFaviconUrlResolver();
  if (!sourceUrl || !isAllowedFaviconProxyRequestUrl(sourceUrl) || !resolver ||
      !resolver.getSafeFaviconCandidateUrl(sourceUrl, pageUrl, 'shortcut-snapshot', {
        allowDomainProxy: candidate.kind === 'favicon-is'
      })) {
    return Promise.resolve(null);
  }
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const abort = () => controller && controller.abort();
  if (signal && signal.aborted) {
    return Promise.resolve(null);
  }
  if (signal && controller) {
    signal.addEventListener('abort', abort, { once: true });
  }
  // Leave time for the local Chrome snapshot if the proxy is unreachable.
  const timeoutId = controller ? setTimeout(abort,
    candidate.kind === 'favicon-is' ? 5000 : candidate.kind === 'proxy' ? 2500 : 1500) : null;
  return fetch(sourceUrl, {
    cache: candidate.refresh === true ? 'reload' : 'force-cache',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    redirect: 'error',
    signal: controller ? controller.signal : signal
  }).then((response) => {
    if (!response || !response.ok) {
      return null;
    }
    const resolvedSourceUrl = typeof response.url === 'string' && response.url
      ? response.url
      : sourceUrl;
    if (!isAllowedFaviconProxyRequestUrl(resolvedSourceUrl) ||
        !resolver.getSafeFaviconCandidateUrl(resolvedSourceUrl, pageUrl, 'shortcut-response', {
          allowDomainProxy: candidate.kind === 'favicon-is'
        })) {
      return null;
    }
    const contentLength = Number(response.headers && response.headers.get
      ? response.headers.get('content-length') || 0
      : 0);
    if (Number.isFinite(contentLength) && contentLength > SHORTCUT_FAVICON_RESOURCE_MAX_BYTES) {
      return null;
    }
    return response.blob().then((blob) => ({
      blob,
      sourceUrl: resolvedSourceUrl
    }));
  }).then((result) => {
    const blob = result && result.blob;
    if (!blob || blob.size <= 0 || blob.size > SHORTCUT_FAVICON_RESOURCE_MAX_BYTES) {
      return null;
    }
    return blob.arrayBuffer().then((buffer) => {
      const inspection = SHORTCUT_FAVICON.inspectIconResource(buffer, blob.type, result.sourceUrl, candidate, { minDimension: 16 });
      if (inspection.usable !== true) {
        return null;
      }
      return {
        data: `data:${inspection.mimeType || blob.type || 'image/png'};base64,${arrayBufferToBase64(buffer)}`,
        sourceUrl: result.sourceUrl,
        width: Number(inspection.width || 0),
        height: Number(inspection.height || 0),
        vector: inspection.vector === true,
        pageUrl
      };
    });
  }).catch(() => null).finally(() => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    if (signal && controller) {
      signal.removeEventListener('abort', abort);
    }
  });
}

// Firefox has no _favicon endpoint. Its own icon cache is reachable through
// open tabs and top sites; like Chrome's cache it never contacts the site.
async function getFirefoxBrowserFaviconUrl(pageUrl) {
  const browserIcons = FAVICON_UTILS.createBrowserIconIndex();
  await browserIcons.load(chrome);
  return browserIcons.get(pageUrl);
}

async function fetchFirefoxBrowserCacheFavicon(candidate, pageUrl, signal) {
  const iconUrl = await getFirefoxBrowserFaviconUrl(pageUrl);
  if (!iconUrl || (signal && signal.aborted)) {
    return null;
  }
  try {
    // A data: URL from Firefox's icon cache; decoding it is local.
    const response = await fetch(iconUrl, { signal });
    if (!response || !response.ok) {
      return null;
    }
    const blob = await response.blob();
    if (!blob || blob.size <= 0 || blob.size > SHORTCUT_FAVICON_RESOURCE_MAX_BYTES) {
      return null;
    }
    const buffer = await blob.arrayBuffer();
    const inspection = SHORTCUT_FAVICON.inspectIconResource(buffer, blob.type, iconUrl, candidate, { minDimension: 16 });
    if (inspection.usable !== true) {
      return null;
    }
    // Keep the browser-cache request URL as the source so the snapshot reads
    // as a cache icon for this page, exactly like a Chrome snapshot.
    return {
      data: `data:${inspection.mimeType || blob.type || 'image/png'};base64,${arrayBufferToBase64(buffer)}`,
      sourceUrl: candidate.url,
      width: Number(inspection.width || 0),
      height: Number(inspection.height || 0),
      vector: inspection.vector === true,
      pageUrl
    };
  } catch (error) {
    return null;
  }
}

async function resolveShortcutFaviconData(pageUrl, preferredTheme, signal, explicitIconUrl, refresh, iconSource) {
  const resolver = getBackgroundFaviconUrlResolver();
  const candidates = resolver ? resolver.getShortcutFaviconFetchCandidates(pageUrl, iconSource) : [];
  const firefoxRuntime = BROWSER_PROFILE.isFirefoxExtensionRuntime();
  for (const candidate of candidates) {
    if (signal && signal.aborted) {
      break;
    }
    if (firefoxRuntime && candidate.kind === 'browser-cache') {
      const firefoxResult = await fetchFirefoxBrowserCacheFavicon({
        ...candidate,
        refresh: refresh === true
      }, pageUrl, signal);
      if (firefoxResult) {
        return firefoxResult;
      }
      continue;
    }
    const result = await fetchShortcutFaviconResource({
      ...candidate,
      refresh: refresh === true,
      declaredSize: 128,
      vector: false
    }, pageUrl, signal);
    if (!result) {
      continue;
    }
    // Save Chrome's cached artwork once rather than keeping a live cache URL.
    // Its generic globe must not become a permanent shortcut snapshot.
    if (candidate.placeholderUrl && (candidate.kind === 'browser-cache' || candidate.kind === 'favicon-is' ||
        (result.width <= 16 && result.height <= 16))) {
      let placeholderData = faviconDataCache.get(candidate.placeholderUrl);
      if (!placeholderData) {
        const placeholder = await fetchShortcutFaviconResource({
          url: candidate.placeholderUrl,
          kind: candidate.kind,
          declaredSize: 128
        }, FAVICON_UTILS.getPageUrlFromFaviconProxyUrl(candidate.placeholderUrl), signal);
        placeholderData = placeholder && placeholder.data;
        if (placeholderData) {
          FAVICON_UTILS.setBoundedCacheEntry(faviconDataCache, candidate.placeholderUrl,
            placeholderData, BACKGROUND_FAVICON_DATA_CACHE_MAX_ENTRIES);
        }
      }
      if (placeholderData && placeholderData === result.data) {
        continue;
      }
    }
    return result;
  }
  return null;
}

function fetchShortcutFaviconData(pageUrl, preferredTheme, explicitIconUrl, refresh, iconSource) {
  const normalizedPageUrl = SHORTCUT_FAVICON.normalizePageUrl(pageUrl);
  const theme = getShortcutFaviconPreferredTheme(preferredTheme);
  if (!normalizedPageUrl) {
    return Promise.resolve(null);
  }
  const explicitIcon = String(explicitIconUrl || '').trim();
  const selectedSource = ['service', 'favicon-is', 'cache'].includes(iconSource) ? iconSource : '';
  const cacheKey = `${normalizedPageUrl}::${theme || 'auto'}::${explicitIcon}${selectedSource ? `::${selectedSource}` : ''}`;
  const pendingKey = refresh === true ? `${cacheKey}::refresh` : cacheKey;
  if (refresh !== true && shortcutFaviconDataCache.has(cacheKey)) {
    return Promise.resolve(shortcutFaviconDataCache.get(cacheKey));
  }
  if (shortcutFaviconPending.has(pendingKey)) {
    return shortcutFaviconPending.get(pendingKey);
  }
  const cachedResultAtStart = shortcutFaviconDataCache.get(cacheKey);
  const policyRevision = shortcutFaviconPolicyRevision;
  let promise = null;
  promise = Promise.all([
    loadFaviconRequestBlacklistItems(),
    loadFaviconEnhancedFetchEnabled()
  ]).then(() => {
    const targetPolicy = getFaviconTargetPolicy(normalizedPageUrl, '');
    if (!targetPolicy.ok || targetPolicy.hardBlocked) {
      return null;
    }
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeoutId = setTimeout(() => {
      if (controller) {
        controller.abort();
      }
    }, SHORTCUT_FAVICON_FETCH_TIMEOUT_MS);
    return resolveShortcutFaviconData(
      normalizedPageUrl,
      theme,
      controller ? controller.signal : undefined,
      explicitIcon,
      refresh === true,
      selectedSource
    ).finally(() => clearTimeout(timeoutId));
  }).then((result) => {
    if (result && policyRevision === shortcutFaviconPolicyRevision &&
        (refresh === true || shortcutFaviconDataCache.get(cacheKey) === cachedResultAtStart)) {
      FAVICON_UTILS.setBoundedCacheEntry(
        shortcutFaviconDataCache,
        cacheKey,
        result,
        BACKGROUND_SHORTCUT_FAVICON_CACHE_MAX_ENTRIES
      );
    }
    if (shortcutFaviconPending.get(pendingKey) === promise) {
      shortcutFaviconPending.delete(pendingKey);
    }
    return result || null;
  }).catch(() => {
    if (shortcutFaviconPending.get(pendingKey) === promise) {
      shortcutFaviconPending.delete(pendingKey);
    }
    return null;
  });
  shortcutFaviconPending.set(pendingKey, promise);
  return promise;
}

function getSiteSearchIconStore() {
  if (siteSearchIconStore) {
    return siteSearchIconStore;
  }
  siteSearchIconStore = SHORTCUT_FAVICON.createShortcutFaviconStore({
    chromeApi: chrome,
    storageArea: (chrome && chrome.storage && chrome.storage.local) ? chrome.storage.local : null,
    storageKey: SITE_SEARCH_ICON_STORAGE_KEY,
    ...SITE_SEARCH_ICON_CACHE_OPTIONS
  });
  return siteSearchIconStore;
}

function removeLegacySiteSearchIconCaches() {
  const legacyKeys = Array.isArray(SHORTCUT_FAVICON.SITE_SEARCH_LEGACY_STORAGE_KEYS)
    ? SHORTCUT_FAVICON.SITE_SEARCH_LEGACY_STORAGE_KEYS
    : [];
  const localArea = chrome && chrome.storage ? chrome.storage.local : null;
  if (legacyKeys.length === 0 || !localArea || typeof localArea.remove !== 'function') {
    return;
  }
  localArea.remove(legacyKeys, ignoreExpectedChromeError);
}

function loadSiteSearchIconCache() {
  if (siteSearchIconCache) {
    return Promise.resolve(siteSearchIconCache);
  }
  if (siteSearchIconCacheLoadPromise) {
    return siteSearchIconCacheLoadPromise;
  }
  const store = getSiteSearchIconStore();
  if (!store || typeof store.readAll !== 'function') {
    siteSearchIconCache = {};
    return Promise.resolve(siteSearchIconCache);
  }
  siteSearchIconCacheLoadPromise = store.readAll()
    .then((cache) => {
      siteSearchIconCache = cache && typeof cache === 'object' ? cache : {};
      return siteSearchIconCache;
    })
    .catch(() => {
      siteSearchIconCache = {};
      return siteSearchIconCache;
    });
  return siteSearchIconCacheLoadPromise;
}

function hasUsableCachedSiteSearchProviderIcon(provider) {
  const icon = SHORTCUT_FAVICON.getSiteSearchProviderIcon(
    siteSearchIconCache || {},
    provider,
    Date.now(),
    SITE_SEARCH_ICON_CACHE_OPTIONS
  );
  return String(icon || '').startsWith('data:');
}

function scheduleSiteSearchIconCacheWrite() {
  if (siteSearchIconCacheWriteTimer !== null) {
    return;
  }
  siteSearchIconCacheWriteTimer = setTimeout(() => {
    siteSearchIconCacheWriteTimer = null;
    const store = getSiteSearchIconStore();
    if (!store || typeof store.writeAll !== 'function' || !siteSearchIconCache) {
      return;
    }
    const writeRevision = siteSearchIconCacheRevision;
    const writeSnapshot = siteSearchIconCache;
    store.writeAll(writeSnapshot).then((savedCache) => {
      if (siteSearchIconCacheRevision === writeRevision) {
        siteSearchIconCache = savedCache;
        return;
      }
      scheduleSiteSearchIconCacheWrite();
    }).catch(warnBackgroundFailure('Failed to save the site search icon cache.'));
  }, 700);
}

function pruneSiteSearchProviderIconCache(providers) {
  if (!siteSearchIconCache) {
    return false;
  }
  const pageUrls = (Array.isArray(providers) ? providers : []).flatMap((provider) => {
    const providerKey = String(provider && provider.key || '').trim().toLowerCase();
    if (SITE_SEARCH_PINNED_ICON_KEYS.has(providerKey)) {
      return [];
    }
    const pageUrl = SHORTCUT_FAVICON.getSiteSearchProviderPageUrl(provider);
    return pageUrl ? [pageUrl] : [];
  });
  const nextCache = SHORTCUT_FAVICON.retainCachedIcons(
    siteSearchIconCache,
    pageUrls,
    Date.now(),
    SITE_SEARCH_ICON_CACHE_OPTIONS
  );
  if (JSON.stringify(nextCache) === JSON.stringify(siteSearchIconCache)) {
    return false;
  }
  siteSearchIconCache = nextCache;
  siteSearchIconCacheRevision += 1;
  scheduleSiteSearchIconCacheWrite();
  return true;
}

function cacheSiteSearchProviderIcon(pageUrl, result) {
  if (!result || !result.data) {
    return false;
  }
  const nextCache = SHORTCUT_FAVICON.setCachedIcon(
    siteSearchIconCache || {},
    pageUrl,
    result.data,
    result.sourceUrl,
    Date.now(),
    SITE_SEARCH_ICON_CACHE_OPTIONS
  );
  const cacheKey = SHORTCUT_FAVICON.getCacheKey(pageUrl);
  const nextEntry = cacheKey && nextCache ? nextCache[cacheKey] : null;
  if (!nextEntry || nextEntry.dataUrl !== result.data) {
    return false;
  }
  siteSearchIconCache = nextCache;
  siteSearchIconCacheRevision += 1;
  scheduleSiteSearchIconCacheWrite();
  return true;
}

function drainSiteSearchIconWarmQueue() {
  while (siteSearchIconWarmActiveCount < SITE_SEARCH_ICON_WARM_CONCURRENCY &&
      siteSearchIconWarmQueue.length > 0) {
    const item = siteSearchIconWarmQueue.shift();
    if (!item || !item.pageUrl) {
      continue;
    }
    if (hasUsableCachedSiteSearchProviderIcon(item.provider)) {
      siteSearchIconWarmPending.delete(item.pageUrl);
      continue;
    }
    siteSearchIconWarmActiveCount += 1;
    fetchShortcutFaviconData(item.pageUrl, item.preferredTheme, item.explicitIcon)
      .then((result) => {
        cacheSiteSearchProviderIcon(item.pageUrl, result);
      })
      .catch(() => {}) // Unreachable sites keep their bundled icon.
      .finally(() => {
        siteSearchIconWarmActiveCount = Math.max(0, siteSearchIconWarmActiveCount - 1);
        siteSearchIconWarmPending.delete(item.pageUrl);
        drainSiteSearchIconWarmQueue();
      });
  }
}

function scheduleSiteSearchProviderIconWarmup(providers, preferredTheme) {
  const items = Array.isArray(providers) ? providers : [];
  if (items.length === 0) {
    return;
  }
  loadSiteSearchIconCache().then(() => {
    pruneSiteSearchProviderIconCache(items);
    items.forEach((provider) => {
      const explicitIcon = SHORTCUT_FAVICON.getSiteSearchProviderExplicitIcon(provider);
      const pageUrl = SHORTCUT_FAVICON.getSiteSearchProviderPageUrl(provider);
      const providerKey = String(provider && provider.key || '').trim().toLowerCase();
      if (SITE_SEARCH_PINNED_ICON_KEYS.has(providerKey)) {
        return;
      }
      if (!pageUrl || hasUsableCachedSiteSearchProviderIcon(provider) || siteSearchIconWarmPending.has(pageUrl)) {
        return;
      }
      siteSearchIconWarmPending.add(pageUrl);
      siteSearchIconWarmQueue.push({
        provider,
        pageUrl,
        explicitIcon,
        preferredTheme: String(preferredTheme || '')
      });
    });
    drainSiteSearchIconWarmQueue();
  }).catch(warnBackgroundFailure('Failed to warm site search icons.'));
}

function fetchFaviconData(url, pageUrl) {
  if (!url) {
    return Promise.resolve(null);
  }
  return Promise.all([
    loadFaviconRequestBlacklistItems(),
    loadFaviconEnhancedFetchEnabled()
  ]).then(([, enhancedFetchEnabled]) => {
    const canonicalPageUrl = getFaviconRequestMatchUrl(pageUrl || url);
    const requestExcluded = isUrlBlockedByFaviconRequestBlacklist(canonicalPageUrl);
    const effectiveEnhancedFetchEnabled = enhancedFetchEnabled && !requestExcluded;
    const sourceAllowedByMode = FAVICON_UTILS.isFaviconSourceAllowedByEnhancedFetchPolicy(url, effectiveEnhancedFetchEnabled, {
      chromeApi: chrome,
      allowThirdPartyFetch: !requestExcluded
    });
    const sourceAllowed = sourceAllowedByMode && isAllowedFaviconProxyRequestUrl(url);
    if (!sourceAllowed) {
      logBlockedLocalFavicon(
        url,
        isFaviconProxyUrl(url) ? 'third-party-proxy' : 'direct',
        requestExcluded ? 'exclusion' : 'global-off',
        canonicalPageUrl
      );
      return null;
    }
    const resolver = getBackgroundFaviconUrlResolver();
    const matchedSourceUrl = resolver && resolver.getSafeFaviconCandidateUrl(url, canonicalPageUrl, 'background-data');
    if (!matchedSourceUrl) {
      return null;
    }
    url = matchedSourceUrl;
    if (isBlockedLocalFaviconUrl(url) || isFaviconRequestBlockedByBlacklist(url)) {
      logBlockedLocalFavicon(url, 'fetchFaviconData');
      return null;
    }
    try {
      const parsed = new URL(url);
      if (getFaviconHostPolicy(parsed.hostname).hardBlocked) {
        return null;
      }
    } catch (e) {
      // Keep existing behavior for non-standard URL formats.
    }
    if (faviconDataCache.has(url)) {
      return faviconDataCache.get(url);
    }
    if (faviconPending.has(url)) {
      return faviconPending.get(url);
    }
    const promise = fetch(url, {
      cache: 'force-cache',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      redirect: 'error'
    })
      .then((response) => {
        if (!response || !response.ok) {
          return null;
        }
        const responseUrl = String(response.url || url);
        if (!isAllowedFaviconProxyRequestUrl(responseUrl)) {
          return null;
        }
        return response.blob();
      })
      .then((blob) => {
        if (!blob || blob.size > 256 * 1024) {
          return null;
        }
        return blob.arrayBuffer().then((buffer) => {
          const base64 = arrayBufferToBase64(buffer);
          return `data:${blob.type || 'image/png'};base64,${base64}`;
        });
      })
      .then((dataUrl) => {
        if (dataUrl) {
          FAVICON_UTILS.setBoundedCacheEntry(
            faviconDataCache,
            url,
            dataUrl,
            BACKGROUND_FAVICON_DATA_CACHE_MAX_ENTRIES
          );
        }
        faviconPending.delete(url);
        return dataUrl;
      })
      .catch(() => {
        faviconPending.delete(url);
        return null;
      });
    faviconPending.set(url, promise);
    return promise;
  });
}

function normalizeFaviconRequestBlacklistItems(items) {
  if (BLACKLIST_UTILS.normalizeItems) {
    return BLACKLIST_UTILS.normalizeItems(items, 'prefix');
  }
  return [];
}

function normalizeFaviconEnhancedFetchEnabled(value) {
  return SETTINGS.normalizeFaviconEnhancedFetchEnabled(value);
}

function loadFaviconRequestBlacklistItems() {
  if (faviconRequestBlacklistCache) {
    return Promise.resolve(faviconRequestBlacklistCache);
  }
  if (faviconRequestBlacklistPromise) {
    return faviconRequestBlacklistPromise;
  }
  faviconRequestBlacklistPromise = new Promise((resolve) => {
    if (!storageArea) {
      resolve([]);
      return;
    }
    storageArea.get([FAVICON_REQUEST_BLACKLIST_STORAGE_KEY], (result) => {
      const items = normalizeFaviconRequestBlacklistItems(result && result[FAVICON_REQUEST_BLACKLIST_STORAGE_KEY]);
      faviconRequestBlacklistCache = items;
      resolve(items);
    });
  }).finally(() => {
    faviconRequestBlacklistPromise = null;
  });
  return faviconRequestBlacklistPromise;
}

function loadFaviconEnhancedFetchEnabled() {
  if (typeof faviconEnhancedFetchEnabledCache === 'boolean') {
    return Promise.resolve(faviconEnhancedFetchEnabledCache);
  }
  if (faviconEnhancedFetchEnabledPromise) {
    return faviconEnhancedFetchEnabledPromise;
  }
  faviconEnhancedFetchEnabledPromise = new Promise((resolve) => {
    if (!storageArea) {
      faviconEnhancedFetchEnabledCache = true;
      resolve(true);
      return;
    }
    storageArea.get([FAVICON_ENHANCED_FETCH_ENABLED_STORAGE_KEY], (result) => {
      const rawValue = result && result[FAVICON_ENHANCED_FETCH_ENABLED_STORAGE_KEY];
      const enabled = normalizeFaviconEnhancedFetchEnabled(rawValue);
      faviconEnhancedFetchEnabledCache = enabled;
      if (rawValue !== enabled) {
        storageArea.set({ [FAVICON_ENHANCED_FETCH_ENABLED_STORAGE_KEY]: enabled });
      }
      resolve(enabled);
    });
  }).finally(() => {
    faviconEnhancedFetchEnabledPromise = null;
  });
  return faviconEnhancedFetchEnabledPromise;
}

function getFaviconRequestMatchUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) {
    return '';
  }
  return String(FAVICON_UTILS.getCanonicalPageUrlForFavicon(raw) || raw).trim();
}

function isUrlBlockedByFaviconRequestBlacklist(url) {
  const target = getFaviconRequestMatchUrl(url);
  return Boolean(
    target &&
    faviconRequestBlacklistCache &&
    BLACKLIST_UTILS.isUrlBlocked &&
    BLACKLIST_UTILS.isUrlBlocked(target, faviconRequestBlacklistCache)
  );
}
