const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { readBackgroundSource } = require('./helpers/background-source');
const { extractFunction: extractFunctionSource } = require('./helpers/extract-function');

const backgroundSource = readBackgroundSource();

const extractedFunctions = [
  'invalidateShortcutFaviconPolicyCache',
  'fetchShortcutFaviconData'
].map((name) => extractFunctionSource(backgroundSource, name)).join('\n\n');

const createPolicyCache = new Function('deps', `
  const SHORTCUT_FAVICON = {
    normalizePageUrl(value) {
      return new URL(String(value || '')).href;
    }
  };
  const shortcutFaviconDataCache = new Map();
  const shortcutFaviconPending = new Map();
  let shortcutFaviconPolicyRevision = 0;
  const BACKGROUND_SHORTCUT_FAVICON_CACHE_MAX_ENTRIES = 64;
  const SHORTCUT_FAVICON_FETCH_TIMEOUT_MS = 1000;
  let enhancedFetchEnabled = deps.enhancedFetchEnabled;
  const FAVICON_UTILS = {
    setBoundedCacheEntry(cache, key, value, maxEntries) {
      if (cache.has(key)) {
        cache.delete(key);
      }
      cache.set(key, value);
      while (cache.size > maxEntries) {
        cache.delete(cache.keys().next().value);
      }
      return value;
    }
  };

  function getShortcutFaviconPreferredTheme(value) {
    return String(value || 'light');
  }
  function loadFaviconRequestBlacklistItems() {
    return Promise.resolve([]);
  }
  function loadFaviconEnhancedFetchEnabled() {
    return Promise.resolve(enhancedFetchEnabled);
  }
  function getFaviconTargetPolicy() {
    return { ok: true, directFetchBlocked: false };
  }
  function canFetchPageForFavicon() {
    return true;
  }
  function resolveShortcutFaviconData(...args) {
    return deps.resolve(...args);
  }
  ${extractedFunctions}

  return {
    fetchShortcutFaviconData,
    invalidateShortcutFaviconPolicyCache,
    setEnhancedFetchEnabled(value) {
      enhancedFetchEnabled = value;
    }
  };
`);

async function run() {
  let resolveCalls = 0;
  const fetchedResult = {
    data: 'data:image/png;base64,aWNvbg==',
    sourceUrl: 'https://example.com/icon.png'
  };
  const deps = {
    enhancedFetchEnabled: false,
    resolve() {
      resolveCalls += 1;
      return Promise.resolve(null);
    }
  };
  const cache = createPolicyCache(deps);
  const pageUrl = 'https://example.com/';

  assert.strictEqual(await cache.fetchShortcutFaviconData(pageUrl), null);
  assert.strictEqual(resolveCalls, 1, 'strict mode should still attempt safe cache snapshot resolution');
  deps.resolve = () => {
    resolveCalls += 1;
    return Promise.resolve(fetchedResult);
  };
  cache.setEnhancedFetchEnabled(true);
  cache.invalidateShortcutFaviconPolicyCache();
  assert.deepStrictEqual(await cache.fetchShortcutFaviconData(pageUrl), fetchedResult);
  assert.strictEqual(resolveCalls, 2, 'enabling enhanced fetching should retry a previously cached miss');

  deps.resolve = () => Promise.resolve(null);
  assert.strictEqual(await cache.fetchShortcutFaviconData('https://temporary-miss.example/'), null);
  deps.resolve = () => Promise.resolve(fetchedResult);
  assert.deepStrictEqual(await cache.fetchShortcutFaviconData('https://temporary-miss.example/'), fetchedResult,
    'a temporary cache/network miss must be retried without waiting for policy invalidation');

  let resolveOldRequest = null;
  deps.resolve = () => new Promise((resolve) => {
    resolveOldRequest = resolve;
  });
  cache.invalidateShortcutFaviconPolicyCache();
  const staleRequest = cache.fetchShortcutFaviconData('https://stale.example/');
  await new Promise((resolve) => setImmediate(resolve));
  assert(resolveOldRequest, 'the stale request should reach the resolver');

  cache.invalidateShortcutFaviconPolicyCache();
  const freshResult = {
    data: 'data:image/png;base64,ZmFzdA==',
    sourceUrl: 'https://stale.example/fresh.png'
  };
  deps.resolve = () => Promise.resolve(freshResult);
  assert.deepStrictEqual(
    await cache.fetchShortcutFaviconData('https://stale.example/'),
    freshResult
  );
  resolveOldRequest({
    data: 'data:image/png;base64,c3RhbGU=',
    sourceUrl: 'https://stale.example/old.png'
  });
  await staleRequest;
  assert.deepStrictEqual(
    await cache.fetchShortcutFaviconData('https://stale.example/'),
    freshResult,
    'an old in-flight request should not repopulate the cache after policy invalidation'
  );

  let resolveBeforeRefresh;
  deps.resolve = () => new Promise((resolve) => { resolveBeforeRefresh = resolve; });
  const refreshPage = 'https://refresh.example/';
  const beforeRefresh = cache.fetchShortcutFaviconData(refreshPage);
  await new Promise((resolve) => setImmediate(resolve));
  deps.resolve = (...args) => {
    assert.strictEqual(args[4], true, 'refresh must reach the actual acquisition resolver');
    return Promise.resolve(freshResult);
  };
  assert.deepStrictEqual(await cache.fetchShortcutFaviconData(refreshPage, '', '', true), freshResult,
    'an explicit refresh must not join an older automatic request');
  resolveBeforeRefresh(fetchedResult);
  await beforeRefresh;
  assert.deepStrictEqual(await cache.fetchShortcutFaviconData(refreshPage), freshResult,
    'a late automatic response must not overwrite the refreshed result');

  assert(
    /if \(changes\[FAVICON_REQUEST_BLACKLIST_STORAGE_KEY\]\)[\s\S]{0,300}invalidateShortcutFaviconPolicyCache\(\)/
      .test(backgroundSource),
    'favicon blacklist changes should invalidate shortcut favicon results'
  );
  assert(
    /if \(changes\[FAVICON_ENHANCED_FETCH_ENABLED_STORAGE_KEY\]\)[\s\S]{0,300}invalidateShortcutFaviconPolicyCache\(\)/
      .test(backgroundSource),
    'enhanced-fetch setting changes should invalidate shortcut favicon results'
  );

  console.log('shortcut favicon policy cache tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
