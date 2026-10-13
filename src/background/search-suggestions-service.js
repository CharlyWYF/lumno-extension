// Search suggestions for the overlay and New Tab: local sources (open tabs,
// history, top sites, bookmarks) with their short-lived caches, title pinyin
// matching, remote search-engine suggestions, the default search engine, site
// search providers, the search blacklist and selection stats.
//
// Loaded by background.js through its first importScripts block (the Firefox
// build lists that block as background.scripts). Like background.js this is a
// classic script sharing the worker's global scope. Its functions use
// background.js bindings (storageArea, SETTINGS, SEARCH_UTILS, favicon policy,
// ...) only when they run, never while this file loads, because background.js
// has not initialized its own top-level bindings yet at that point.
//
// Every cache and promise below is a rebuildable in-memory cache; nothing here
// must survive a service-worker suspension.

function getSearchEngineSuggestionRequestKey(request, sender) {
  const senderTabId = sender && sender.tab && typeof sender.tab.id === 'number'
    ? sender.tab.id
    : 'extension';
  const senderFrameId = sender && typeof sender.frameId === 'number' ? sender.frameId : 0;
  const context = request && request.context ? String(request.context) : 'unknown';
  return `${senderTabId}:${senderFrameId}:${context}`;
}

function deleteHistoryUrlFromSearch(targetUrl, sendResponse) {
  if (!targetUrl) {
    sendResponse({ ok: false, reason: 'invalid-url' });
    return;
  }
  if (!chrome.history || typeof chrome.history.deleteUrl !== 'function') {
    sendResponse({ ok: false, reason: 'history-api-unavailable' });
    return;
  }
  chrome.history.deleteUrl({ url: targetUrl }, () => {
    if (chrome.runtime && chrome.runtime.lastError) {
      sendResponse({ ok: false, reason: chrome.runtime.lastError.message || 'delete-history-failed' });
      return;
    }
    invalidateLocalSearchSourceCaches();
    sendResponse({ ok: true, url: targetUrl });
  });
  return true;
}

let siteSearchCache = null;

let siteSearchPromise = null;

let siteSearchLoadGeneration = 0;

let searchBlacklistCache = null;

let searchBlacklistPromise = null;

let searchResultSourceTypesCache = null;

let searchResultSourceTypesPromise = null;

let searchSelectionStatsCache = null;

let searchSelectionStatsPromise = null;

const SEARCH_ENGINE_SUGGEST_TIMEOUT_MS = 900;

const SEARCH_ENGINE_SUGGEST_PREFETCH_DELAY_MS = 120;

const SEARCH_ENGINE_SUGGEST_PREFETCH_RETENTION_MS = 1500;

const LOCAL_SUGGEST_SOURCE_TIMEOUT_MS = 800;

const LOCAL_SEARCH_INDEX_WARMUP_TIMEOUT_MS = 80;

const HISTORY_FALLBACK_CACHE_TTL_MS = 45 * 1000;

const TOP_SITES_CACHE_TTL_MS = 30 * 1000;

const BOOKMARK_TREE_CACHE_TTL_MS = 2 * 60 * 1000;

let historyFallbackCache = {
  expiresAt: 0,
  items: []
};

let topSitesCache = {
  expiresAt: 0,
  items: []
};

let localSearchSourceCacheListenersBound = false;

let bookmarkTreeIndexCache = {
  expiresAt: 0,
  map: null
};

let bookmarkItemsCache = {
  expiresAt: 0,
  items: []
};

let bookmarkItemsPromise = null;

let bookmarkTreeCacheListenersBound = false;

const searchEngineSuggestionRequests = new Map();

const titlePinyinCache = new Map();

const BACKGROUND_TITLE_PINYIN_CACHE_MAX_ENTRIES = 2048;

const SEARCH_ENGINE_DEFS = [
  {
    id: 'google',
    name: 'Google',
    hostMatches: ['google.'],
    searchTemplate: 'https://www.google.com/search?q={query}',
    searchUrl: (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}`
  },
  {
    id: 'kagi',
    name: 'Kagi',
    hostMatches: ['kagi.com'],
    searchTemplate: 'https://kagi.com/search?q={query}',
    searchUrl: (query) => `https://kagi.com/search?q=${encodeURIComponent(query)}`
  },
  {
    id: 'bing',
    name: 'Bing',
    hostMatches: ['bing.com'],
    searchTemplate: 'https://www.bing.com/search?q={query}',
    searchUrl: (query) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`
  },
  {
    id: 'baidu',
    name: 'Baidu',
    hostMatches: ['baidu.com'],
    searchTemplate: 'https://www.baidu.com/s?wd={query}',
    searchUrl: (query) => `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`
  },
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    hostMatches: ['duckduckgo.com'],
    searchTemplate: 'https://duckduckgo.com/?q={query}',
    searchUrl: (query) => `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
  },
  {
    id: 'yahoo',
    name: 'Yahoo',
    hostMatches: ['search.yahoo.com'],
    searchTemplate: 'https://search.yahoo.com/search?p={query}',
    searchUrl: (query) => `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`
  },
  {
    id: 'yandex',
    name: 'Yandex',
    hostMatches: ['yandex.com'],
    searchTemplate: 'https://yandex.com/search/?text={query}',
    searchUrl: (query) => `https://yandex.com/search/?text=${encodeURIComponent(query)}`
  },
  {
    id: 'sogou',
    name: '搜狗',
    hostMatches: ['sogou.com'],
    searchTemplate: 'https://www.sogou.com/web?query={query}',
    searchUrl: (query) => `https://www.sogou.com/web?query=${encodeURIComponent(query)}`
  },
  {
    id: 'shenma',
    name: '神马',
    hostMatches: ['sm.cn'],
    searchTemplate: 'https://m.sm.cn/s?q={query}',
    searchUrl: (query) => `https://m.sm.cn/s?q=${encodeURIComponent(query)}`
  }
];

let defaultSearchEngineState = {
  id: 'google',
  name: 'Google',
  host: 'www.google.com',
  searchTemplate: 'https://www.google.com/search?q={query}',
  updatedAt: 0
};

let defaultSearchEngineStateReady = Promise.resolve(defaultSearchEngineState);

let pendingSearchAt = 0;

let pendingSearchTabId = null;

let pendingSearchGroupContext = null;

function getSearchEngineByHostname(hostname) {
  const normalized = normalizeHost(hostname);
  if (!normalized) {
    return null;
  }
  return SEARCH_ENGINE_DEFS.find((engine) =>
    engine.hostMatches.some((match) => normalized.includes(match))
  ) || null;
}

function getSearchEngineById(id) {
  if (!id) {
    return null;
  }
  return SEARCH_ENGINE_DEFS.find((engine) => engine.id === id) || null;
}

function setDefaultSearchEngineState(nextState, shouldPersist) {
  if (!nextState || !nextState.id) {
    return;
  }
  const engine = getSearchEngineById(nextState.id);
  const updated = {
    id: nextState.id,
    name: nextState.name || '',
    host: nextState.host || '',
    searchTemplate: nextState.searchTemplate || (engine ? engine.searchTemplate : ''),
    updatedAt: nextState.updatedAt || Date.now()
  };
  defaultSearchEngineState = updated;
  if (shouldPersist && storageArea) {
    storageArea.set({ [DEFAULT_SEARCH_ENGINE_STORAGE_KEY]: updated });
  }
}

function loadDefaultSearchEngineState() {
  if (!storageArea) {
    return Promise.resolve(defaultSearchEngineState);
  }
  return new Promise((resolve) => {
    storageArea.get([DEFAULT_SEARCH_ENGINE_STORAGE_KEY], (result) => {
      const stored = result ? result[DEFAULT_SEARCH_ENGINE_STORAGE_KEY] : null;
      if (stored && stored.id) {
        if (SEARCH_UTILS.isRetiredSearchEngineState(stored)) {
          setDefaultSearchEngineState({
            id: 'google',
            name: 'Google',
            host: 'www.google.com',
            searchTemplate: 'https://www.google.com/search?q={query}',
            updatedAt: Date.now()
          }, true);
        } else {
          setDefaultSearchEngineState(stored, false);
        }
      }
      resolve(defaultSearchEngineState);
    });
  });
}

function isSearchEngineResultUrl(url) {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return false;
    }
    const hostname = parsedUrl.hostname.toLowerCase();
    const engine = SEARCH_ENGINE_DEFS.find((candidate) =>
      candidate.hostMatches.some((match) => {
        if (match === 'google.') {
          return /(^|\.)google\.(?:com|[a-z]{2}|(?:co|com)\.[a-z]{2})$/.test(hostname);
        }
        return hostname === match || hostname.endsWith(`.${match}`);
      })
    );
    if (!engine) {
      return false;
    }
    const queryMarker = '__lumno_search_query__';
    const searchUrl = new URL(engine.searchTemplate.replace('{query}', queryMarker));
    const normalizePath = (value) => value.toLowerCase().replace(/\/+$/, '') || '/';
    // A prefix such as /web also matches ordinary pages like /webstore.
    if (normalizePath(parsedUrl.pathname) !== normalizePath(searchUrl.pathname)) {
      return false;
    }
    const queryParam = Array.from(searchUrl.searchParams.entries())
      .find(([, value]) => value === queryMarker);
    return Boolean(queryParam && String(parsedUrl.searchParams.get(queryParam[0]) || '').trim());
  } catch (e) {
    return false;
  }
}

function updateDefaultSearchEngineFromUrl(url) {
  if (!url || !isSearchEngineResultUrl(url)) {
    return false;
  }
  try {
    const parsedUrl = new URL(url);
    const engine = getSearchEngineByHostname(parsedUrl.hostname);
    if (!engine) {
      return false;
    }
    setDefaultSearchEngineState({
      id: engine.id,
      name: engine.name,
      host: normalizeHost(parsedUrl.hostname),
      searchTemplate: engine.searchTemplate,
      updatedAt: Date.now()
    }, true);
    return true;
  } catch (e) {
    return false;
  }
}

function buildDefaultSearchUrl(query) {
  const engine = getSearchEngineById(defaultSearchEngineState.id);
  if (engine && typeof engine.searchUrl === 'function') {
    return engine.searchUrl(query);
  }
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function getDirectNavigationUrl(input) {
  return SEARCH_UTILS.getDirectNavigationUrl(input);
}

function getDefaultSearchEngineThemeUrl() {
  const engine = getSearchEngineById(defaultSearchEngineState.id);
  if (engine && typeof engine.searchUrl === 'function') {
    return engine.searchUrl('test');
  }
  return 'https://www.google.com';
}

function getDefaultSearchEngineFaviconUrl() {
  if (defaultSearchEngineState.id === 'google') {
    return 'https://www.gstatic.com/images/branding/googleg/1x/googleg_standard_color_128dp.png';
  }
  if (defaultSearchEngineState.host) {
    return `https://${defaultSearchEngineState.host}/favicon.ico`;
  }
  const engine = getSearchEngineById(defaultSearchEngineState.id);
  if (engine) {
    try {
      const host = new URL(engine.searchUrl('test')).hostname;
      return `https://${host}/favicon.ico`;
    } catch (e) {
      return '';
    }
  }
  return 'https://www.gstatic.com/images/branding/googleg/1x/googleg_standard_color_128dp.png';
}

function parseJsonpPayload(text) {
  if (!text) {
    return null;
  }
  const start = text.indexOf('(');
  const end = text.lastIndexOf(')');
  if (start < 0 || end <= start) {
    return null;
  }
  const payload = text.slice(start + 1, end);
  try {
    return JSON.parse(payload);
  } catch (e) {
    return null;
  }
}

function extractJsonArray(text) {
  if (!text) {
    return null;
  }
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start < 0 || end <= start) {
    return null;
  }
  const payload = text.slice(start, end + 1);
  try {
    return JSON.parse(payload);
  } catch (e) {
    return null;
  }
}

async function fetchJson(url, options) {
  if (!url) {
    return null;
  }
  const settings = options && typeof options === 'object' ? options : {};
  const response = await fetch(url, settings.signal ? { signal: settings.signal } : undefined);
  if (!response || !response.ok) {
    return null;
  }
  return response.json();
}

async function fetchText(url, options) {
  if (!url) {
    return '';
  }
  const settings = options && typeof options === 'object' ? options : {};
  const response = await fetch(url, settings.signal ? { signal: settings.signal } : undefined);
  if (!response || !response.ok) {
    return '';
  }
  return response.text();
}

async function fetchSearchSuggestionsForEngine(query, options) {
  const engineId = defaultSearchEngineState.id;
  const settings = options && typeof options === 'object' ? options : {};
  if (!query || !engineId) {
    return [];
  }
  try {
    if (engineId === 'google') {
      const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`;
      const data = await fetchJson(url, settings);
      if (Array.isArray(data) && Array.isArray(data[1])) {
        return data[1];
      }
      return [];
    }
    if (engineId === 'bing') {
      const url = `https://api.bing.com/osjson.aspx?query=${encodeURIComponent(query)}`;
      const data = await fetchJson(url, settings);
      if (Array.isArray(data) && Array.isArray(data[1])) {
        return data[1];
      }
      return [];
    }
    if (engineId === 'baidu') {
      const url = `https://www.baidu.com/sugrec?ie=utf-8&json=1&prod=pc&wd=${encodeURIComponent(query)}`;
      const data = await fetchJson(url, settings);
      if (data && Array.isArray(data.g)) {
        return data.g.map((item) => item && item.q).filter(Boolean);
      }
      return [];
    }
    if (engineId === 'sogou') {
      const url = `https://sor.html5.qq.com/api/getsug?m=searxng&key=${encodeURIComponent(query)}`;
      const text = await fetchText(url, settings);
      const data = extractJsonArray(text);
      if (Array.isArray(data) && Array.isArray(data[1])) {
        return data[1];
      }
      return [];
    }
    if (engineId === 'duckduckgo') {
      const url = `https://duckduckgo.com/ac/?type=list&q=${encodeURIComponent(query)}`;
      const data = await fetchJson(url, settings);
      if (Array.isArray(data)) {
        if (Array.isArray(data[1])) {
          return data[1];
        }
        return data.map((item) => item && item.phrase).filter(Boolean);
      }
      return [];
    }
    if (engineId === 'yandex') {
      const url = `https://suggest.yandex.com/suggest-ff.cgi?part=${encodeURIComponent(query)}`;
      const data = await fetchJson(url, settings);
      if (Array.isArray(data) && Array.isArray(data[1])) {
        return data[1];
      }
      return [];
    }
    if (engineId === 'quark') {
      const url = `https://sugs.m.sm.cn/web?q=${encodeURIComponent(query)}`;
      const data = await fetchJson(url, settings);
      if (data && Array.isArray(data.r)) {
        return data.r.map((item) => item && item.w).filter(Boolean);
      }
      return [];
    }
    if (engineId === 'shenma') {
      const url = `https://sugs.m.sm.cn/web?q=${encodeURIComponent(query)}`;
      const data = await fetchJson(url, settings);
      if (data && Array.isArray(data.r)) {
        return data.r.map((item) => item && item.w).filter(Boolean);
      }
      return [];
    }
    if (engineId === 'yahoo') {
      const url = `https://search.yahoo.com/sugg/gossip/gossip-us-ura/?output=sd1&command=${encodeURIComponent(query)}`;
      const text = await fetchText(url, settings);
      const data = parseJsonpPayload(text) || extractJsonArray(text);
      if (Array.isArray(data)) {
        if (Array.isArray(data[1])) {
          return data[1];
        }
        if (data[0] && Array.isArray(data[0])) {
          return data[0];
        }
      }
      if (data && Array.isArray(data.gossip && data.gossip.results)) {
        return data.gossip.results.map((item) => item && item.key).filter(Boolean);
      }
      return [];
    }
    return [];
  } catch (e) {
    return [];
  }
}

function markPendingSearchTab(tabId, sourceTab) {
  pendingSearchAt = Date.now();
  pendingSearchTabId = typeof tabId === 'number' ? tabId : null;
  pendingSearchGroupContext = getSourceTabGroupContext(sourceTab);
}

function isInteractiveSiteSearchProvider(provider) {
  return SEARCH_UTILS.isInteractiveSiteSearchProvider(provider);
}

function sanitizeSiteSearchProviders(items) {
  return SEARCH_UTILS.sanitizeSiteSearchProviders(items);
}

function loadCustomSiteSearchProviders() {
  return SETTINGS.readStorageValue(
    storageArea,
    chrome,
    SITE_SEARCH_STORAGE_KEY
  ).then(sanitizeSiteSearchProviders);
}

function loadDisabledSiteSearchKeys() {
  return SETTINGS.readStorageValue(
    storageArea,
    chrome,
    SITE_SEARCH_DISABLED_STORAGE_KEY
  ).then((value) => {
    const items = Array.isArray(value) ? value : [];
    return items.map((item) => String(item).toLowerCase()).filter(Boolean);
  });
}

function normalizeSearchBlacklistMatchModes(value) {
  if (BLACKLIST_UTILS.normalizeMatchModes) {
    return BLACKLIST_UTILS.normalizeMatchModes(value, 'prefix');
  }
  return ['prefix'];
}

function normalizeSearchBlacklistItems(items) {
  if (BLACKLIST_UTILS.normalizeItems) {
    return BLACKLIST_UTILS.normalizeItems(items, 'prefix');
  }
  return [];
}

function areStringArraysEqual(a, b) {
  const left = Array.isArray(a) ? a : [];
  const right = Array.isArray(b) ? b : [];
  if (left.length !== right.length) {
    return false;
  }
  for (let i = 0; i < left.length; i += 1) {
    if (String(left[i]) !== String(right[i])) {
      return false;
    }
  }
  return true;
}

function loadSearchResultSourceTypes() {
  if (searchResultSourceTypesCache) {
    return Promise.resolve(searchResultSourceTypesCache);
  }
  if (searchResultSourceTypesPromise) {
    return searchResultSourceTypesPromise;
  }
  searchResultSourceTypesPromise = new Promise((resolve) => {
    if (!storageArea) {
      const defaults = SETTINGS.normalizeSearchResultSourceTypes(null);
      searchResultSourceTypesCache = defaults;
      resolve(defaults);
      return;
    }
    storageArea.get([SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY], (result) => {
      const raw = result && result[SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY];
      const normalized = SETTINGS.normalizeSearchResultSourceTypes(raw);
      searchResultSourceTypesCache = normalized;
      if (!areStringArraysEqual(raw, normalized)) {
        storageArea.set({ [SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY]: normalized });
      }
      resolve(normalized);
    });
  }).finally(() => {
    searchResultSourceTypesPromise = null;
  });
  return searchResultSourceTypesPromise;
}

function loadSearchBlacklistItems() {
  if (searchBlacklistCache) {
    return Promise.resolve(searchBlacklistCache);
  }
  if (searchBlacklistPromise) {
    return searchBlacklistPromise;
  }
  searchBlacklistPromise = new Promise((resolve) => {
    if (!storageArea) {
      resolve([]);
      return;
    }
    storageArea.get([SEARCH_BLACKLIST_STORAGE_KEY], (result) => {
      const items = normalizeSearchBlacklistItems(result && result[SEARCH_BLACKLIST_STORAGE_KEY]);
      searchBlacklistCache = items;
      resolve(items);
    });
  }).finally(() => {
    searchBlacklistPromise = null;
  });
  return searchBlacklistPromise;
}

function normalizeSearchSelectionStats(rawStats) {
  return SEARCH_UTILS.normalizeSearchSelectionStats(rawStats);
}

function loadSearchSelectionStats() {
  if (searchSelectionStatsCache) {
    return Promise.resolve(searchSelectionStatsCache);
  }
  if (searchSelectionStatsPromise) {
    return searchSelectionStatsPromise;
  }
  searchSelectionStatsPromise = new Promise((resolve) => {
    if (!localStorageArea) {
      const emptyStats = normalizeSearchSelectionStats(null);
      searchSelectionStatsCache = emptyStats;
      resolve(emptyStats);
      return;
    }
    localStorageArea.get([SEARCH_SELECTION_STATS_STORAGE_KEY], (result) => {
      const stats = normalizeSearchSelectionStats(result && result[SEARCH_SELECTION_STATS_STORAGE_KEY]);
      searchSelectionStatsCache = stats;
      resolve(stats);
    });
  }).finally(() => {
    searchSelectionStatsPromise = null;
  });
  return searchSelectionStatsPromise;
}

function saveSearchSelectionStats(stats) {
  const normalizedStats = normalizeSearchSelectionStats(stats);
  searchSelectionStatsCache = normalizedStats;
  return new Promise((resolve) => {
    if (!localStorageArea) {
      resolve(false);
      return;
    }
    localStorageArea.set({ [SEARCH_SELECTION_STATS_STORAGE_KEY]: normalizedStats }, () => {
      resolve(!(chrome.runtime && chrome.runtime.lastError));
    });
  });
}

function shouldRecordSearchSuggestionSelectionPayload(selection) {
  if (!selection || typeof selection !== 'object') {
    return false;
  }
  const query = String(selection.query || '').trim();
  const url = String(selection.url || '').trim();
  if (!query || !url) {
    return false;
  }
  const type = String(selection.type || '').trim();
  if (type === 'newtab' ||
      type === 'googleSuggest' ||
      type === 'siteSearch' ||
      type === 'inlineSiteSearch' ||
      type === 'siteSearchPrompt' ||
      type === 'modeSwitch' ||
      type === 'commandNewTab' ||
      type === 'commandSettings') {
    return false;
  }
  return true;
}

function recordSearchSuggestionSelection(selection) {
  if (!shouldRecordSearchSuggestionSelectionPayload(selection)) {
    return Promise.resolve({ ok: false, reason: 'invalid-selection' });
  }
  return loadSearchSelectionStats()
    .then((stats) => {
      const updatedStats = SEARCH_UTILS.recordSearchSelectionInStats(stats, selection);
      return saveSearchSelectionStats(updatedStats);
    })
    .then((ok) => ({ ok: ok === true }));
}

function recordSearchSuggestionSelectionFromSuggestion(suggestion, query, source) {
  if (!suggestion || suggestion.forceSearch || suggestion.provider || !suggestion.url) {
    return;
  }
  recordSearchSuggestionSelection({
    query,
    url: suggestion.url,
    title: suggestion.title || '',
    type: suggestion.type || 'history',
    source: source || 'overlay'
  }).catch(warnBackgroundFailure('Failed to record a search suggestion selection.'));
}

function getSearchSelectionBoost(item, context, stats, options) {
  return SEARCH_UTILS.getSearchSelectionBoost(item, context, stats, options);
}

function isUrlBlockedBySearchBlacklist(url, items) {
  if (BLACKLIST_UTILS.isUrlBlocked) {
    return BLACKLIST_UTILS.isUrlBlocked(url, items);
  }
  return false;
}

function isSuggestionBlockedBySearchBlacklist(suggestion, items, queryForProvider) {
  if (!suggestion) {
    return false;
  }
  if (
    suggestion.type === 'newtab' ||
    suggestion.type === 'siteSearch' ||
    suggestion.type === 'inlineSiteSearch' ||
    suggestion.type === 'siteSearchPrompt'
  ) {
    return false;
  }
  if (suggestion.url && isUrlBlockedBySearchBlacklist(suggestion.url, items)) {
    return true;
  }
  return false;
}

function filterBlacklistedSuggestions(list, items, queryForProvider) {
  if (!Array.isArray(list) || list.length === 0) {
    return [];
  }
  return list.filter((suggestion) => !isSuggestionBlockedBySearchBlacklist(suggestion, items, queryForProvider));
}

function mergeCustomProviders(baseItems, customItems) {
  return SEARCH_UTILS.mergeCustomProviders(baseItems, customItems);
}

function getSiteSearchProviderEntryUrl(provider, query) {
  if (!provider || !provider.template) {
    return '';
  }
  return SEARCH_UTILS.buildSearchUrlFromTemplate(provider.template, query || '');
}

function invalidateSiteSearchProviderCache() {
  siteSearchLoadGeneration += 1;
  siteSearchCache = null;
  siteSearchPromise = null;
}

function loadSiteSearchProviders() {
  if (siteSearchCache) {
    return Promise.resolve(siteSearchCache);
  }
  if (siteSearchPromise) {
    return siteSearchPromise;
  }
  const localUrl = chrome.runtime.getURL('assets/data/site-search.json');
  const fallbackDefaults = SEARCH_UTILS.getDefaultSiteSearchProviders();
  const loadGeneration = siteSearchLoadGeneration;
  const loadTask = fetch(localUrl)
    .then((response) => response.json())
    .then((data) => {
      const items = data && Array.isArray(data.items) ? data.items : [];
      const source = items.length > 0 ? items : fallbackDefaults;
      return sanitizeSiteSearchProviders(source);
    })
    .catch(() => sanitizeSiteSearchProviders(fallbackDefaults))
    .then((items) => Promise.all([loadCustomSiteSearchProviders(), loadDisabledSiteSearchKeys()])
    .then(([customItems, disabledKeys]) => {
      const baseMap = new Map(items.map((item) => [
        String(item && item.key ? item.key : '').toLowerCase(),
        item
      ]));
      const hydratedCustom = customItems.map((item) => {
        const key = String(item && item.key ? item.key : '').toLowerCase();
        const builtinKey = String(item && item.builtinKey ? item.builtinKey : '').toLowerCase();
        const baseProvider = baseMap.get(builtinKey || key);
        return {
          ...item,
          action: String(item.action || (baseProvider && baseProvider.action) || '').trim(),
          submitStrategy: String(
            item.submitStrategy || (baseProvider && baseProvider.submitStrategy) || ''
          ).trim()
        };
      });
      const filteredBase = items.filter((item) => {
        const key = String(item && item.key ? item.key : '').toLowerCase();
        return key && !disabledKeys.includes(key);
      });
      const merged = mergeCustomProviders(filteredBase, hydratedCustom);
      if (loadGeneration === siteSearchLoadGeneration &&
          siteSearchPromise === loadTask) {
        siteSearchCache = merged;
        return merged;
      }
      return siteSearchCache || [];
    })).catch((error) => {
      if (loadGeneration === siteSearchLoadGeneration &&
          siteSearchPromise === loadTask) {
        siteSearchPromise = null;
      }
      throw error;
    });
  siteSearchPromise = loadTask;
  return loadTask;
}

function warmSiteSearchProviderIcons() {
  return loadSiteSearchProviders().then((providers) => {
    scheduleSiteSearchProviderIconWarmup(providers, '');
    return providers;
  }).catch(() => []);
}

function withTimeout(promise, timeoutMs, fallbackValue) {
  const safePromise = promise
    .then((value) => value)
    .catch(() => fallbackValue);
  if (!timeoutMs || timeoutMs <= 0) {
    return safePromise;
  }
  return Promise.race([
    safePromise,
    new Promise((resolve) => {
      setTimeout(() => resolve(fallbackValue), timeoutMs);
    })
  ]);
}

async function fetchSearchEngineSuggestionsWithTimeout(query, externalSignal) {
  if (externalSignal && externalSignal.aborted) {
    return [];
  }
  const requestController = new AbortController();
  const forwardExternalAbort = () => requestController.abort();
  if (externalSignal) {
    externalSignal.addEventListener('abort', forwardExternalAbort, { once: true });
  }
  let timeoutId = null;
  try {
    const timeoutPromise = new Promise((resolve) => {
      timeoutId = setTimeout(() => {
        requestController.abort();
        resolve([]);
      }, SEARCH_ENGINE_SUGGEST_TIMEOUT_MS);
    });
    return await Promise.race([
      fetchSearchSuggestionsForEngine(query, { signal: requestController.signal }).catch(() => []),
      timeoutPromise
    ]);
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    if (externalSignal) {
      externalSignal.removeEventListener('abort', forwardExternalAbort);
    }
  }
}

function shouldPrefetchSearchEngineSuggestions(request, query) {
  const context = request && request.context ? String(request.context) : '';
  const normalizedQuery = String(query || '').trim();
  const isScopedLocalSearch = Array.isArray(request && request.sourceTypes) &&
    request.sourceTypes.length > 0;
  return (context === 'newtab' || context === 'overlay') &&
    Boolean(normalizedQuery) &&
    !normalizedQuery.startsWith('/') &&
    !isScopedLocalSearch;
}

function clearSearchEngineSuggestionRequestTimers(record) {
  if (!record) {
    return;
  }
  if (record.startTimer !== null) {
    clearTimeout(record.startTimer);
    record.startTimer = null;
  }
  if (record.releaseTimer !== null) {
    clearTimeout(record.releaseTimer);
    record.releaseTimer = null;
  }
}

function releaseSearchEngineSuggestionRequest(requestKey, record) {
  if (!record || searchEngineSuggestionRequests.get(requestKey) !== record) {
    return;
  }
  clearSearchEngineSuggestionRequestTimers(record);
  searchEngineSuggestionRequests.delete(requestKey);
}

function abortSearchEngineSuggestionRequest(requestKey) {
  const record = searchEngineSuggestionRequests.get(requestKey);
  if (!record) {
    return;
  }
  clearSearchEngineSuggestionRequestTimers(record);
  if (record.controller && !record.controller.signal.aborted) {
    record.controller.abort();
  }
  if (searchEngineSuggestionRequests.get(requestKey) === record) {
    searchEngineSuggestionRequests.delete(requestKey);
  }
}

function startSearchEngineSuggestionRequest(record) {
  if (!record) {
    return Promise.resolve([]);
  }
  if (record.promise) {
    return record.promise;
  }
  if (record.startTimer !== null) {
    clearTimeout(record.startTimer);
    record.startTimer = null;
  }
  record.promise = Promise.resolve(defaultSearchEngineStateReady)
    .then(() => {
      if (record.controller.signal.aborted) {
        return [];
      }
      return fetchSearchEngineSuggestionsWithTimeout(record.query, record.controller.signal);
    })
    .catch(() => []);
  record.promise.then(() => {
    if (record.consumed ||
        searchEngineSuggestionRequests.get(record.requestKey) !== record ||
        record.releaseTimer !== null) {
      return;
    }
    record.releaseTimer = setTimeout(() => {
      releaseSearchEngineSuggestionRequest(record.requestKey, record);
    }, SEARCH_ENGINE_SUGGEST_PREFETCH_RETENTION_MS);
  });
  return record.promise;
}

function getOrCreateSearchEngineSuggestionRequest(requestKey, query, options) {
  const normalizedQuery = String(query || '').trim();
  if (!normalizedQuery) {
    abortSearchEngineSuggestionRequest(requestKey);
    return null;
  }
  const settings = options && typeof options === 'object' ? options : {};
  const existing = searchEngineSuggestionRequests.get(requestKey);
  if (existing && existing.query === normalizedQuery && !existing.controller.signal.aborted) {
    if (settings.consume === true) {
      existing.consumed = true;
      if (existing.releaseTimer !== null) {
        clearTimeout(existing.releaseTimer);
        existing.releaseTimer = null;
      }
    }
    if (settings.startImmediately === true) {
      startSearchEngineSuggestionRequest(existing);
    }
    return existing;
  }
  if (existing) {
    abortSearchEngineSuggestionRequest(requestKey);
  }
  const record = {
    requestKey,
    query: normalizedQuery,
    controller: new AbortController(),
    startTimer: null,
    releaseTimer: null,
    promise: null,
    consumed: settings.consume === true
  };
  searchEngineSuggestionRequests.set(requestKey, record);
  const delayMs = Math.max(0, Number(settings.delayMs) || 0);
  if (delayMs > 0 && settings.startImmediately !== true) {
    record.startTimer = setTimeout(() => {
      record.startTimer = null;
      startSearchEngineSuggestionRequest(record);
    }, delayMs);
  } else {
    startSearchEngineSuggestionRequest(record);
  }
  return record;
}

function scheduleSearchEngineSuggestionPrefetch(requestKey, query) {
  return getOrCreateSearchEngineSuggestionRequest(requestKey, query, {
    delayMs: SEARCH_ENGINE_SUGGEST_PREFETCH_DELAY_MS
  });
}

function consumeSearchEngineSuggestionRequest(requestKey, query) {
  return getOrCreateSearchEngineSuggestionRequest(requestKey, query, {
    consume: true,
    startImmediately: true
  });
}

function callChromeApiWithTimeout(invoke, fallbackValue, timeoutMs) {
  return withTimeout(new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(value);
    };
    try {
      invoke(finish);
    } catch (e) {
      finish(fallbackValue);
    }
  }), timeoutMs, fallbackValue);
}

function invalidateBookmarkTreeCache() {
  bookmarkTreeIndexCache = {
    expiresAt: 0,
    map: null
  };
  bookmarkItemsCache = {
    expiresAt: 0,
    items: []
  };
  bookmarkItemsPromise = null;
}

function invalidateLocalSearchSourceCaches() {
  historyFallbackCache = {
    expiresAt: 0,
    items: []
  };
  topSitesCache = {
    expiresAt: 0,
    items: []
  };
}

function ensureLocalSearchSourceCacheListeners() {
  if (localSearchSourceCacheListenersBound || !chrome || !chrome.history) {
    return;
  }
  [
    chrome.history.onVisited,
    chrome.history.onVisitRemoved
  ].forEach((eventTarget) => {
    if (eventTarget && typeof eventTarget.addListener === 'function') {
      eventTarget.addListener(invalidateLocalSearchSourceCaches);
    }
  });
  localSearchSourceCacheListenersBound = true;
}

function ensureBookmarkTreeCacheListeners() {
  if (bookmarkTreeCacheListenersBound || !chrome || !chrome.bookmarks) {
    return;
  }
  const events = [
    chrome.bookmarks.onCreated,
    chrome.bookmarks.onRemoved,
    chrome.bookmarks.onChanged,
    chrome.bookmarks.onMoved,
    chrome.bookmarks.onChildrenReordered,
    chrome.bookmarks.onImportEnded
  ];
  events.forEach((eventTarget) => {
    if (eventTarget && typeof eventTarget.addListener === 'function') {
      eventTarget.addListener(invalidateBookmarkTreeCache);
    }
  });
  bookmarkTreeCacheListenersBound = true;
}

function buildBookmarkNodeMap(tree) {
  const bookmarkNodeMap = new Map();
  function indexBookmarkNodes(node, parentId) {
    if (!node || !node.id) {
      return;
    }
    bookmarkNodeMap.set(node.id, {
      title: node.title || '',
      parentId: parentId || null,
      hasUrl: Boolean(node.url)
    });
    if (Array.isArray(node.children)) {
      node.children.forEach((child) => indexBookmarkNodes(child, node.id));
    }
  }
  if (Array.isArray(tree)) {
    tree.forEach((node) => indexBookmarkNodes(node, null));
  }
  return bookmarkNodeMap;
}

function buildBookmarkItems(tree) {
  const items = [];
  function collectBookmarkNodes(node) {
    if (!node || !node.id) {
      return;
    }
    if (node.url) {
      items.push({
        id: node.id,
        parentId: node.parentId || null,
        title: node.title || '',
        url: node.url
      });
    }
    if (Array.isArray(node.children)) {
      node.children.forEach((child) => collectBookmarkNodes(child));
    }
  }
  if (Array.isArray(tree)) {
    tree.forEach((node) => collectBookmarkNodes(node));
  }
  return items;
}

function getAllBookmarksCached() {
  const now = Date.now();
  if (Array.isArray(bookmarkItemsCache.items) && bookmarkItemsCache.expiresAt > now) {
    return Promise.resolve(bookmarkItemsCache.items);
  }
  if (bookmarkItemsPromise) {
    return bookmarkItemsPromise;
  }
  if (!chrome || !chrome.bookmarks || typeof chrome.bookmarks.getTree !== 'function') {
    return Promise.resolve([]);
  }
  ensureBookmarkTreeCacheListeners();
  bookmarkItemsPromise = callChromeApiWithTimeout((done) => {
    chrome.bookmarks.getTree((tree) => {
      const items = buildBookmarkItems(tree);
      const nodeMap = buildBookmarkNodeMap(tree);
      const expiresAt = Date.now() + BOOKMARK_TREE_CACHE_TTL_MS;
      bookmarkItemsCache = {
        items: items,
        expiresAt
      };
      bookmarkTreeIndexCache = {
        map: nodeMap,
        expiresAt
      };
      bookmarkItemsPromise = null;
      done(items);
    });
  }, [], LOCAL_SUGGEST_SOURCE_TIMEOUT_MS).catch(() => {
    bookmarkItemsPromise = null;
    return [];
  });
  return bookmarkItemsPromise;
}

function getTopSitesCached() {
  const now = Date.now();
  if (topSitesCache.expiresAt > now && Array.isArray(topSitesCache.items)) {
    return Promise.resolve(topSitesCache.items);
  }
  if (!chrome || !chrome.topSites || typeof chrome.topSites.get !== 'function') {
    return Promise.resolve([]);
  }
  return callChromeApiWithTimeout((done) => {
    chrome.topSites.get((items) => {
      const list = Array.isArray(items) ? items : [];
      topSitesCache = {
        items: list,
        expiresAt: Date.now() + TOP_SITES_CACHE_TTL_MS
      };
      done(list);
    });
  }, [], LOCAL_SUGGEST_SOURCE_TIMEOUT_MS).catch(() => []);
}

function getFallbackHistoryItemsCached(policy) {
  const now = Date.now();
  if (historyFallbackCache.expiresAt > now && Array.isArray(historyFallbackCache.items)) {
    return Promise.resolve(historyFallbackCache.items);
  }
  if (!chrome || !chrome.history || typeof chrome.history.search !== 'function') {
    return Promise.resolve([]);
  }
  const settings = policy && typeof policy === 'object' ? policy : {};
  const fallbackMaxResults = Number(settings.fallbackHistoryMaxResults) > 0
    ? Math.floor(Number(settings.fallbackHistoryMaxResults))
    : 600;
  const fallbackWindowDays = Number(settings.fallbackHistoryWindowDays) > 0
    ? Number(settings.fallbackHistoryWindowDays)
    : 365;
  return callChromeApiWithTimeout((done) => {
    chrome.history.search({
      text: '',
      maxResults: fallbackMaxResults,
      startTime: Date.now() - (fallbackWindowDays * 24 * 60 * 60 * 1000)
    }, (items) => {
      const list = Array.isArray(items) ? items : [];
      historyFallbackCache = {
        items: list,
        expiresAt: Date.now() + HISTORY_FALLBACK_CACHE_TTL_MS
      };
      done(list);
    });
  }, [], LOCAL_SUGGEST_SOURCE_TIMEOUT_MS).catch(() => []);
}

function getCachedFallbackHistoryItemsOrWarm(policy) {
  const now = Date.now();
  if (historyFallbackCache.expiresAt > now && Array.isArray(historyFallbackCache.items)) {
    return Promise.resolve(historyFallbackCache.items);
  }
  return withTimeout(
    getFallbackHistoryItemsCached(policy),
    LOCAL_SEARCH_INDEX_WARMUP_TIMEOUT_MS,
    []
  );
}

function getCachedBookmarkItemsOrWarm() {
  const now = Date.now();
  if (Array.isArray(bookmarkItemsCache.items) && bookmarkItemsCache.expiresAt > now) {
    return Promise.resolve(bookmarkItemsCache.items);
  }
  return withTimeout(
    getAllBookmarksCached(),
    LOCAL_SEARCH_INDEX_WARMUP_TIMEOUT_MS,
    []
  );
}

function getCachedBookmarkNodeMap() {
  const now = Date.now();
  if (bookmarkTreeIndexCache.map && bookmarkTreeIndexCache.expiresAt > now) {
    return bookmarkTreeIndexCache.map;
  }
  return new Map();
}

function getOpenTabSearchItems() {
  if (!chrome || !chrome.tabs || typeof chrome.tabs.query !== 'function') {
    return Promise.resolve([]);
  }
  return callChromeApiWithTimeout((done) => {
    chrome.tabs.query({}, (tabs) => {
      const items = (Array.isArray(tabs) ? tabs : [])
        .map((tab) => {
          const url = getResolvedTabUrl(tab);
          if (!url || typeof tab.id !== 'number') {
            return null;
          }
          return {
            title: String(tab.title || '').replace(/\s+/g, ' ').trim() || url,
            url,
            _xMatchedTabId: tab.id
          };
        })
        .filter(Boolean);
      done(items);
    });
  }, [], LOCAL_SUGGEST_SOURCE_TIMEOUT_MS).catch(() => []);
}

function normalizeAsciiQueryForPinyin(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .trim();
}

function shouldUseTitlePinyinMatch(value) {
  const normalized = normalizeAsciiQueryForPinyin(value);
  return Boolean(normalized) && /^[a-z]+$/.test(normalized);
}

function getChineseCharacters(text) {
  const matches = String(text || '').match(/[\u4e00-\u9fff]/g);
  return Array.isArray(matches) ? matches : [];
}

let pinyinProImportAttempted = false;

function getPinyinPro() {
  if (!globalThis.pinyinPro && !pinyinProImportAttempted && typeof importScripts === 'function') {
    pinyinProImportAttempted = true;
    try {
      importScripts(chrome.runtime.getURL(PINYIN_PRO_SCRIPT_PATH));
    } catch (error) {
      // Without pinyin-pro, titles still match by their own text.
    }
  }
  const api = globalThis.pinyinPro;
  return api && typeof api.pinyin === 'function' ? api : null;
}

function buildTitlePinyinIndex(title) {
  const rawTitle = String(title || '').trim();
  if (!rawTitle) {
    return {
      full: '',
      initials: '',
      chineseLength: 0
    };
  }
  if (titlePinyinCache.has(rawTitle)) {
    return titlePinyinCache.get(rawTitle);
  }
  let full = '';
  let initials = '';
  const chineseChars = getChineseCharacters(rawTitle);
  try {
    // Pure-ASCII titles have no Han characters to convert, so they never load pinyin-pro.
    const pinyinApi = /[^\x00-\x7f]/.test(rawTitle) ? getPinyinPro() : null;
    if (pinyinApi) {
      const converted = pinyinApi.pinyin(rawTitle, {
        toneType: 'none',
        type: 'array',
        nonZh: 'removed',
        v: false
      });
      const syllables = (Array.isArray(converted) ? converted : [])
        .map((item) => String(item || '').toLowerCase().replace(/[^a-z]+/g, ''))
        .filter(Boolean);
      full = syllables.join('');
      initials = syllables.map((item) => item.charAt(0)).join('');
    }
  } catch (error) {
    full = '';
    initials = '';
  }
  const result = {
    full: full,
    initials: initials,
    chineseLength: chineseChars.length
  };
  FAVICON_UTILS.setBoundedCacheEntry(
    titlePinyinCache,
    rawTitle,
    result,
    BACKGROUND_TITLE_PINYIN_CACHE_MAX_ENTRIES
  );
  return result;
}

function getTitlePinyinMatchScore(title, normalizedQuery) {
  if (!normalizedQuery || normalizedQuery.length < 2) {
    return {
      score: 0,
      reason: ''
    };
  }
  const index = buildTitlePinyinIndex(title);
  if (!index || (!index.full && !index.initials)) {
    return {
      score: 0,
      reason: ''
    };
  }
  if (index.full === normalizedQuery) {
    return {
      score: 42,
      reason: 'full-exact'
    };
  }
  if (index.full.startsWith(normalizedQuery)) {
    return {
      score: 28,
      reason: 'full-prefix'
    };
  }
  if (index.full.includes(normalizedQuery)) {
    return {
      score: 14,
      reason: 'full-contains'
    };
  }
  const canUseInitials = index.chineseLength >= 2 && normalizedQuery.length >= 2;
  if (canUseInitials && index.initials === normalizedQuery) {
    return {
      score: 18,
      reason: 'initials-exact'
    };
  }
  if (canUseInitials && index.initials.startsWith(normalizedQuery)) {
    return {
      score: 12,
      reason: 'initials-prefix'
    };
  }
  return {
    score: 0,
    reason: ''
  };
}

function getBackgroundSearchPolicy(searchUtils) {
  return (searchUtils && searchUtils.SEARCH_POLICY) || {
    lookupWindowDays: 180,
    lookupMaxResults: 120,
    maxEngineSuggestions: 5,
    maxEngineSuggestionsWithLocalResults: 3,
    candidatePoolLimit: 20,
    finalSuggestionLimit: 12,
    fallbackTopSiteLimit: 5
  };
}

function buildBackgroundSearchQueryContext(query, searchUtils) {
  const normalizedPinyinQuery = shouldUseTitlePinyinMatch(query)
    ? normalizeAsciiQueryForPinyin(query)
    : '';
  if (searchUtils && typeof searchUtils.buildSearchQueryContext === 'function') {
    return searchUtils.buildSearchQueryContext(query, { normalizedPinyinQuery });
  }
  const queryLower = String(query || '').trim().toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter(Boolean);
  return {
    lookupQuery: String(query || ''),
    queryLower,
    normalizedPinyinQuery,
    useTitlePinyinMatch: Boolean(normalizedPinyinQuery),
    queryTerms,
    coreQueryTerms: queryTerms.slice(),
    intentType: 'object',
    hasSettingsIntent: false,
    hasInformationalIntent: false
  };
}

// Function to get search suggestions from history and top sites
async function getSearchSuggestions(query, options) {
  const suggestions = [];
  const requestOptions = options && typeof options === 'object' ? options : {};
  ensureLocalSearchSourceCacheListeners();
  const searchUtils = SEARCH_UTILS;
  const searchPolicy = getBackgroundSearchPolicy(searchUtils);
  const context = buildBackgroundSearchQueryContext(query, searchUtils);
  if (!context.queryLower) {
    return [];
  }
  const lookupStartTime = Date.now() - (searchPolicy.lookupWindowDays * 24 * 60 * 60 * 1000);
  const lookupEndTime = Date.now();
  const lookupMaxResults = searchPolicy.lookupMaxResults || 120;
  const searchScoreOptions = {
    getTitlePinyinMatchScore,
    isLocalNetworkHost: FAVICON_UTILS.isLocalNetworkHost,
    isOwnExtensionUrl
  };
  const configuredSourceTypes = await loadSearchResultSourceTypes();
  const requestedSourceTypes = Array.isArray(requestOptions.sourceTypes)
    ? requestOptions.sourceTypes
      .map((item) => String(item || '').trim())
      .filter((item, index, items) => (
        (item === 'topSite' || item === 'bookmark' || item === 'history') &&
        items.indexOf(item) === index
      ))
    : [];
  const sourceTypes = requestedSourceTypes.length > 0
    ? configuredSourceTypes.filter((sourceType) => requestedSourceTypes.includes(sourceType))
    : configuredSourceTypes;
  const sourceTypeSet = new Set(sourceTypes);
  const allowTopSites = sourceTypeSet.has('topSite');
  const allowBookmarks = sourceTypeSet.has('bookmark');
  const allowHistory = sourceTypeSet.has('history');
  const allowOpenTabs = requestOptions.includeOpenTabs !== false;

  try {
    const openTabsPromise = allowOpenTabs ? getOpenTabSearchItems() : Promise.resolve([]);
    const [
      historyItemsRaw,
      topSites,
      bookmarksRaw,
      fallbackHistoryItems,
      allBookmarks,
      searchBlacklistItems,
      faviconRequestBlacklistItems,
      _faviconEnhancedFetchEnabled,
      searchSelectionStats
    ] = await Promise.all([
      allowHistory
        ? callChromeApiWithTimeout((done) => {
          chrome.history.search({
            text: context.lookupQuery,
            maxResults: lookupMaxResults,
            startTime: lookupStartTime,
            endTime: lookupEndTime
          }, done);
        }, [], LOCAL_SUGGEST_SOURCE_TIMEOUT_MS)
        : Promise.resolve([]),
      allowTopSites ? getTopSitesCached() : Promise.resolve([]),
      allowBookmarks
        ? callChromeApiWithTimeout((done) => {
          chrome.bookmarks.search({ query: context.lookupQuery }, done);
        }, [], LOCAL_SUGGEST_SOURCE_TIMEOUT_MS)
        : Promise.resolve([]),
      allowHistory ? getCachedFallbackHistoryItemsOrWarm(searchPolicy) : Promise.resolve([]),
      allowBookmarks ? getCachedBookmarkItemsOrWarm() : Promise.resolve([]),
      loadSearchBlacklistItems(),
      loadFaviconRequestBlacklistItems(),
      loadFaviconEnhancedFetchEnabled(),
      loadSearchSelectionStats()
    ]);
    const collectSearchMatches = (items) => {
      return searchUtils.collectSearchMatches(items, context, searchBlacklistItems, {
        getTitlePinyinMatchScore,
        isUrlBlockedBySearchBlacklist
      });
    };
    const mergeSearchItems = searchUtils.mergeItemsByUrl;
    const fallbackHistoryMatches = collectSearchMatches(fallbackHistoryItems);
    const historyItems = collectSearchMatches(mergeSearchItems([
      Array.isArray(historyItemsRaw) ? historyItemsRaw : [],
      fallbackHistoryMatches
    ]));
    const bookmarkTextMatches = collectSearchMatches(allBookmarks);
    const bookmarks = collectSearchMatches(mergeSearchItems([
      Array.isArray(bookmarksRaw) ? bookmarksRaw : [],
      bookmarkTextMatches
    ]));

    const bookmarkNodeMap = (Array.isArray(bookmarks) && bookmarks.length > 0)
      ? getCachedBookmarkNodeMap()
      : new Map();

    const rootFolderTitles = new Set([
      'Bookmarks bar',
      'Other bookmarks',
      'Mobile bookmarks',
      '书签栏',
      '其他书签',
      '移动设备书签'
    ]);

    function buildSuggestionReasons(item, sourceType) {
      const reasons = [];
      if (sourceType === 'bookmark') {
        reasons.push('来源：书签');
      } else if (sourceType === 'topSite') {
        reasons.push('来源：常用站点');
      } else if (sourceType === 'openTab') {
        reasons.push('来源：打开的标签页');
      } else if (sourceType === 'history') {
        reasons.push('来源：浏览历史');
      }
      const pinyinMatch = getTitlePinyinMatchScore(item && item.title, context.normalizedPinyinQuery);
      if (pinyinMatch.reason === 'initials-exact' || pinyinMatch.reason === 'initials-prefix') {
        reasons.push('标题首字母匹配');
      } else if (pinyinMatch.score > 0) {
        reasons.push('标题拼音匹配');
      }
      if (item && item.lastVisitTime) {
        const hoursSinceVisit = (Date.now() - item.lastVisitTime) / (1000 * 60 * 60);
        if (hoursSinceVisit < 24) {
          reasons.push('最近 24 小时访问');
        } else if (hoursSinceVisit < 72) {
          reasons.push('最近 3 天访问');
        }
      }
      const visitCount = Number(item && item.visitCount) || 0;
      if (visitCount > 1) {
        reasons.push(`访问 ${visitCount} 次`);
      }
      return reasons.slice(0, 3);
    }

    function buildSearchSuggestionFavicon(url) {
      if (isOwnExtensionUrl(url)) {
        return getOwnExtensionFaviconUrl();
      }
      if (isBrowserInternalPageUrl(url)) {
        return getPageFaviconCandidateUrl(url);
      }
      try {
        const urlObj = new URL(url);
        const host = normalizeHost(urlObj.hostname);
        return shouldBlockFaviconForHost(host)
          ? ''
          : getPageFaviconCandidateUrl(urlObj.href);
      } catch (e) {
        const fallbackHost = getFaviconFallbackHost(url);
        return shouldBlockFaviconForHost(fallbackHost) ? '' : getHostFaviconUrl(fallbackHost);
      }
    }

    function createSearchSuggestion(item, sourceType, score, extras) {
      return searchUtils.createSearchSuggestion(item, sourceType, score, extras);
    }

    function calculateSearchRelevanceScore(item, sourceType) {
      return searchUtils.calculateSearchRelevanceScore(item, sourceType, context, searchScoreOptions);
    }

    function buildBookmarkPath(bookmark) {
      const pathParts = [];
      let parentId = bookmark && bookmark.parentId ? bookmark.parentId : bookmark && bookmark.id;
      while (parentId) {
        const node = bookmarkNodeMap.get(parentId);
        if (!node) {
          break;
        }
        const isRootFolder = !node.parentId && rootFolderTitles.has(node.title);
        if (!node.hasUrl && node.title && !isRootFolder) {
          pathParts.unshift(node.title);
        }
        parentId = node.parentId;
      }
      return pathParts.join('/');
    }

    const suggestionIndexByKey = new Map();

    function getSuggestionKey(item) {
      return searchUtils.buildSearchDedupEntryKey(item);
    }

    function upsertSuggestion(rawItem, sourceType, extras) {
      if (!rawItem || !rawItem.url) {
        return null;
      }
      const itemKey = getSuggestionKey(rawItem);
      const existingIndex = suggestionIndexByKey.get(itemKey);
      const existing = typeof existingIndex === 'number' ? suggestions[existingIndex] : null;
      // Bookmarks and top sites carry no visit data. When the same page was
      // already seen in history, keep its behavior signals so adding a
      // bookmark never makes a frequently used page rank lower.
      const item = existing
        ? {
          ...rawItem,
          lastVisitTime: Math.max(Number(rawItem.lastVisitTime) || 0, Number(existing.lastVisitTime) || 0),
          visitCount: Math.max(Number(rawItem.visitCount) || 0, Number(existing.visitCount) || 0),
          typedCount: Math.max(Number(rawItem.typedCount) || 0, Number(existing.typedCount) || 0),
          isTopSite: Boolean(rawItem.isTopSite || existing.isTopSite)
        }
        : rawItem;
      const baseScore = calculateSearchRelevanceScore(item, sourceType);
      if (baseScore <= 0 && sourceType !== 'openTab') {
        return null;
      }
      const normalizedExtras = extras && typeof extras === 'object' ? { ...extras } : {};
      const scoreAdjustment = Number(normalizedExtras.scoreAdjustment) || 0;
      delete normalizedExtras.scoreAdjustment;
      const selectionBoost = getSearchSelectionBoost(item, context, searchSelectionStats, searchScoreOptions);
      if (selectionBoost > 0) {
        normalizedExtras.selectionBoost = selectionBoost;
      }
      const rankedScore = baseScore + scoreAdjustment + selectionBoost;
      // Open tabs have already passed query matching. Ranking penalties must
      // not make a matching live page disappear from search.
      const sourceScore = sourceType === 'openTab' ? Math.max(1, rankedScore) : rankedScore;
      // The page keeps its strongest evidence: a bookmark title that matches
      // the query less well must not demote a page history already ranked.
      const score = existing ? Math.max(sourceScore, Number(existing.score) || 0) : sourceScore;
      const suggestion = createSearchSuggestion(item, sourceType, score, {
        favicon: buildSearchSuggestionFavicon(item.url),
        reasons: buildSuggestionReasons(item, sourceType),
        ...(item.isTopSite ? { isTopSite: true } : {}),
        ...normalizedExtras
      });
      if (typeof existingIndex === 'number') {
        suggestions[existingIndex] = suggestion;
      } else {
        suggestionIndexByKey.set(itemKey, suggestions.length);
        suggestions.push(suggestion);
      }
      return suggestion;
    }

    function upsertOpenTabSuggestion(item) {
      if (!item || !item.url || typeof item._xMatchedTabId !== 'number') {
        return null;
      }
      const itemKey = getSuggestionKey(item);
      const existingIndex = suggestionIndexByKey.get(itemKey);
      if (typeof existingIndex === 'number') {
        suggestions[existingIndex] = {
          ...suggestions[existingIndex],
          _xMatchedTabId: item._xMatchedTabId
        };
        return suggestions[existingIndex];
      }
      return upsertSuggestion(item, 'openTab', {
        _xMatchedTabId: item._xMatchedTabId,
        scoreAdjustment: 12
      });
    }

    historyItems.forEach((item) => {
      if (!item || !item.title || isSearchEngineResultUrl(item.url)) {
        return;
      }
      upsertSuggestion(item, 'history');
    });

    const topSiteMatches = collectSearchMatches(topSites);
    topSiteMatches.forEach((site) => {
      if (!site || !site.url || isUrlBlockedBySearchBlacklist(site.url, searchBlacklistItems)) {
        return;
      }
      const itemKey = getSuggestionKey(site);
      const existingIndex = suggestionIndexByKey.get(itemKey);
      if (typeof existingIndex === 'number') {
        const existing = suggestions[existingIndex];
        suggestions[existingIndex] = {
          ...existing,
          isTopSite: true,
          score: (existing.score || 0) + 6
        };
        return;
      }

      const titleLower = site.title ? site.title.toLowerCase() : '';
      let scoreAdjustment = 4;
      try {
        const hostname = normalizeHost(new URL(site.url).hostname);
        if (hostname.startsWith(context.queryLower)) {
          scoreAdjustment += 8;
        }
      } catch (e) {
        // Ignore invalid URLs.
      }
      if (titleLower.startsWith(context.queryLower)) {
        scoreAdjustment += 6;
      }
      upsertSuggestion(site, 'topSite', { isTopSite: true, scoreAdjustment });
    });

    bookmarks.forEach((bookmark) => {
      if (!bookmark || !bookmark.url) {
        return;
      }
      upsertSuggestion(bookmark, 'bookmark', {
        path: buildBookmarkPath(bookmark),
        scoreAdjustment: 4
      });
    });

    const openTabMatches = collectSearchMatches(await openTabsPromise);
    openTabMatches.forEach((item) => {
      upsertOpenTabSuggestion(item);
    });

    const brandDirectSuggestion = searchUtils.buildSearchBrandDirectSuggestion(suggestions, context, {
      ...searchScoreOptions,
      buildFavicon: buildSearchSuggestionFavicon,
      buildReasons: buildSuggestionReasons
    });
    if (brandDirectSuggestion) {
      const directKey = getSuggestionKey(brandDirectSuggestion);
      const existingIndex = suggestionIndexByKey.get(directKey);
      if (typeof existingIndex === 'number') {
        suggestions[existingIndex] = brandDirectSuggestion;
      } else {
        suggestionIndexByKey.set(directKey, suggestions.length);
        suggestions.push(brandDirectSuggestion);
      }
    }

    suggestions.sort((a, b) => {
      return searchUtils.compareSearchSuggestions(a, b);
    });

    const uniqueSuggestions = [];
    const seenSuggestionKeys = new Set();
    for (let i = 0; i < suggestions.length && uniqueSuggestions.length < (searchPolicy.candidatePoolLimit || 20); i += 1) {
      const suggestion = suggestions[i];
      const suggestionKey = getSuggestionKey(suggestion);
      if (!suggestionKey || seenSuggestionKeys.has(suggestionKey)) {
        continue;
      }
      seenSuggestionKeys.add(suggestionKey);
      uniqueSuggestions.push(suggestion);
    }

    let finalSuggestions = filterBlacklistedSuggestions(uniqueSuggestions, searchBlacklistItems, context.lookupQuery);
    finalSuggestions = searchUtils.filterSearchSuggestionsBySourceTypes(finalSuggestions, sourceTypes);
    finalSuggestions = searchUtils.applySearchSuggestionHostDiversity(finalSuggestions, { context });

    return finalSuggestions;

  } catch (error) {
    console.error('Error getting search suggestions:', error);
    return [];
  }
}

async function getSearchEngineSuggestions(query, localSuggestions, options) {
  await defaultSearchEngineStateReady;
  const searchUtils = SEARCH_UTILS;
  const searchPolicy = getBackgroundSearchPolicy(searchUtils);
  const context = buildBackgroundSearchQueryContext(query, searchUtils);
  const settings = options && typeof options === 'object' ? options : {};
  const signal = settings.signal || null;
  const normalizedLocalSuggestions = (Array.isArray(localSuggestions) ? localSuggestions : [])
    .filter((suggestion) => suggestion && typeof suggestion === 'object')
    .slice(0, searchPolicy.candidatePoolLimit || 20);
  if (!context.queryLower || (signal && signal.aborted)) {
    return normalizedLocalSuggestions;
  }

  const rawEngineSuggestionsPromise = settings.rawEngineSuggestionsPromise &&
    typeof settings.rawEngineSuggestionsPromise.then === 'function'
    ? settings.rawEngineSuggestionsPromise
    : fetchSearchEngineSuggestionsWithTimeout(query, signal);
  const [rawEngineSuggestions, searchBlacklistItems, sourceTypes] = await Promise.all([
    rawEngineSuggestionsPromise,
    loadSearchBlacklistItems(),
    loadSearchResultSourceTypes()
  ]);
  if (signal && signal.aborted) {
    return normalizedLocalSuggestions;
  }

  const engineSuggestions = searchUtils.normalizeSearchEngineSuggestions(
    rawEngineSuggestions,
    context.lookupQuery,
    { limit: searchPolicy.maxEngineSuggestions }
  );
  const engineSuggestionPolicy = searchUtils.getSearchEngineSuggestionPolicy(context, normalizedLocalSuggestions, {
    ...searchPolicy,
    searchFirst: settings.searchFirst === true
  });
  const mergedSuggestions = normalizedLocalSuggestions.slice();
  engineSuggestions.slice(0, engineSuggestionPolicy.limit).forEach((suggestion) => {
    const suggestionItem = {
      type: 'googleSuggest',
      title: suggestion,
      url: buildDefaultSearchUrl(suggestion),
      favicon: getDefaultSearchEngineFaviconUrl(),
      score: engineSuggestionPolicy.score,
      searchQuery: suggestion,
      forceSearch: true,
      reasons: ['来源：搜索建议']
    };
    if (!isSuggestionBlockedBySearchBlacklist(suggestionItem, searchBlacklistItems, suggestion)) {
      mergedSuggestions.push(suggestionItem);
    }
  });

  mergedSuggestions.sort((a, b) => {
    return searchUtils.compareSearchSuggestions(a, b);
  });
  const uniqueSuggestions = [];
  const seenSuggestionKeys = new Set();
  for (let i = 0; i < mergedSuggestions.length && uniqueSuggestions.length < (searchPolicy.candidatePoolLimit || 20); i += 1) {
    const suggestion = mergedSuggestions[i];
    const suggestionKey = searchUtils.buildSearchDedupEntryKey(suggestion);
    if (!suggestionKey || seenSuggestionKeys.has(suggestionKey)) {
      continue;
    }
    seenSuggestionKeys.add(suggestionKey);
    uniqueSuggestions.push(suggestion);
  }

  let finalSuggestions = filterBlacklistedSuggestions(uniqueSuggestions, searchBlacklistItems, context.lookupQuery);
  finalSuggestions = searchUtils.filterSearchSuggestionsBySourceTypes(finalSuggestions, sourceTypes);
  if (settings.searchFirst === true) {
    const engineCandidates = finalSuggestions.filter((suggestion) => (
      suggestion && suggestion.type === 'googleSuggest'
    ));
    const localCandidates = searchUtils.applySearchSuggestionHostDiversity(
      finalSuggestions.filter((suggestion) => !suggestion || suggestion.type !== 'googleSuggest'),
      { context }
    );
    finalSuggestions = [...localCandidates, ...engineCandidates];
  } else {
    finalSuggestions = searchUtils.applySearchSuggestionHostDiversity(finalSuggestions, { context });
  }
  if (settings.searchFirst === true) {
    finalSuggestions = searchUtils.composeSearchFirstSuggestionSlate(finalSuggestions, {
      limit: searchPolicy.finalSuggestionLimit || 12
    }).slice(0, searchPolicy.finalSuggestionLimit || 12);
  } else {
    finalSuggestions = searchUtils.composeSearchSuggestionSlate(finalSuggestions, context);
  }
  return finalSuggestions;
}
