const assert = require('assert');
const fs = require('fs');
const path = require('path');

const blacklistUtils = require('../src/shared/blacklist-utils.js');
const faviconUtils = require('../src/shared/favicon-utils.js');
const settings = require('../src/shared/settings.js');
const { readBackgroundSource } = require('./helpers/background-source');

const repoRoot = path.resolve(__dirname, '..');
const backgroundSource = readBackgroundSource();

function extractFunctionSource(source, name) {
  const needle = `function ${name}(`;
  const start = source.indexOf(needle);
  assert.notStrictEqual(start, -1, `missing function ${name}`);
  const openBrace = source.indexOf('{', start);
  assert.notStrictEqual(openBrace, -1, `missing opening brace for ${name}`);
  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }
  throw new Error(`unterminated function ${name}`);
}

const extractedFunctions = [
  'normalizeFaviconRequestBlacklistItems',
  'normalizeFaviconEnhancedFetchEnabled',
  'loadFaviconRequestBlacklistItems',
  'loadFaviconEnhancedFetchEnabled',
  'getFaviconRequestMatchUrl',
  'isUrlBlockedByFaviconRequestBlacklist',
  'isFaviconProxyUrl',
  'isAllowedFaviconProxyRequestUrl',
  'isFaviconRequestBlockedByBlacklist',
  'isBlockedLocalFaviconUrl',
  'getFaviconHostPolicy',
  'getFaviconTargetPolicy',
  'getBackgroundFaviconUrlResolver',
  'resolveSiteThemeColor',
  'buildFaviconFallbackCandidates',
  'dedupeAndSortFaviconCandidates',
  'resolveFaviconCandidates',
  'fetchFaviconData'
].map((name) => extractFunctionSource(backgroundSource, name)).join('\n\n');

const factory = new Function('deps', 'Buffer', `
  const BLACKLIST_UTILS = deps.BLACKLIST_UTILS;
  const SETTINGS = deps.SETTINGS;
  const FAVICON_UTILS = deps.FAVICON_UTILS;
  let faviconRequestBlacklistCache = deps.faviconRequestBlacklistCache;
  let faviconRequestBlacklistPromise = null;
  let faviconEnhancedFetchEnabledCache = deps.faviconEnhancedFetchEnabledCache;
  let faviconEnhancedFetchEnabledPromise = null;
  const FAVICON_REQUEST_BLACKLIST_STORAGE_KEY = '_x_extension_favicon_request_blacklist_2026_unique_';
  const FAVICON_ENHANCED_FETCH_ENABLED_STORAGE_KEY = '_x_extension_favicon_enhanced_fetch_enabled_2026_unique_';
  const storageArea = deps.storageArea;
  const chrome = { runtime: {
    id: 'test',
    getURL(path) { return 'chrome-extension://test' + (path.startsWith('/') ? path : '/' + path); }
  } };
  let backgroundFaviconUrlResolver = null;
  const FAVICON_PROXY_SIZE = 128;
  function logBackgroundFaviconDecision() {}
  const faviconDataCache = new Map();
  const faviconPending = new Map();
  const siteThemeColorCache = new Map();
  const siteThemeColorPending = new Map();
  const BACKGROUND_FAVICON_DATA_CACHE_MAX_ENTRIES = 256;
  const BACKGROUND_SITE_THEME_CACHE_MAX_ENTRIES = 512;
  const BACKGROUND_TITLE_PINYIN_CACHE_MAX_ENTRIES = 2048;

  function logBlockedLocalFavicon(url, source) {
    deps.blockedLogs.push({ url, source });
  }

  function shouldBlockFaviconForHost() {
    return false;
  }

  function shouldAvoidDirectFaviconForHost(hostname) {
    return typeof FAVICON_UTILS.shouldAvoidDirectFaviconForHost === 'function'
      ? FAVICON_UTILS.shouldAvoidDirectFaviconForHost(hostname)
      : false;
  }

  function normalizeFaviconHost(hostname) {
    return String(hostname || '').trim().toLowerCase().replace(/^www\\./i, '');
  }

  function normalizeThemePreference(theme) {
    return String(theme || '').trim().toLowerCase();
  }

  function canFetchPageForFavicon() {
    return true;
  }

  function parseHtmlThemeColorCandidates() {
    deps.themeParseCalls += 1;
    return [];
  }

  function resolveThemeColorCandidates() {
    deps.themeResolveCalls += 1;
    return Promise.resolve(null);
  }

  function persistSiteThemeColorForSwitcher() {
    deps.persistCalls += 1;
  }

  function getExtensionFaviconUrl(pageUrl) {
    return 'chrome-extension://test/_favicon/?pageUrl=' + encodeURIComponent(pageUrl);
  }

  function getGstaticFaviconUrl(pageUrl) {
    return 'https://t2.gstatic.cn/faviconV2?url=' + encodeURIComponent(pageUrl);
  }

  function arrayBufferToBase64(buffer) {
    return Buffer.from(buffer).toString('base64');
  }

  function fetch(url, options) {
    deps.fetchCalls.push({ url, options });
    return Promise.resolve({
      ok: true,
      text: () => Promise.resolve('<html></html>'),
      blob: () => Promise.resolve({
        size: 4,
        type: 'image/png',
        arrayBuffer: () => Promise.resolve(Uint8Array.from([1, 2, 3, 4]).buffer)
      })
    });
  }

  ${extractedFunctions}

  return {
    isUrlBlockedByFaviconRequestBlacklist,
    resolveSiteThemeColor,
    resolveFaviconCandidates,
    fetchFaviconData
  };
`);

async function run() {
  const deps = {
    BLACKLIST_UTILS: blacklistUtils,
    SETTINGS: settings,
    FAVICON_UTILS: Object.assign({}, faviconUtils, {
      getCanonicalPageUrlForFavicon(url) {
        return faviconUtils.getCanonicalPageUrlForFavicon(url);
      },
      isBlockedLocalFaviconUrl() {
        return false;
      },
      isSafeVirtualFaviconRequestUrl(url) {
        return /^chrome-extension:\/\/[^/]+\/_favicon\//i.test(String(url || '').trim()) ||
          /^chrome:\/\/favicon2\//i.test(String(url || '').trim());
      },
      isAllowedFaviconProxyRequestUrl(url) {
        return /^chrome-extension:\/\/[^/]+\/_favicon\//i.test(String(url || '').trim()) ||
          /^chrome:\/\/favicon2\//i.test(String(url || '').trim()) ||
          /^https:\/\/t2\.gstatic\.cn\/faviconV2/i.test(String(url || '').trim());
      },
      shouldAvoidDirectFaviconForHost(hostname) {
        const host = String(hostname || '').trim().toLowerCase();
        return host === '192.168.1.8' || host === 'service.internal';
      },
      setBoundedCacheEntry: faviconUtils.setBoundedCacheEntry,
      createFaviconUrlResolver: faviconUtils.createFaviconUrlResolver,
      isFaviconProxyUrl: faviconUtils.isFaviconProxyUrl,
      isFaviconSourceAllowedByEnhancedFetchPolicy: faviconUtils.isFaviconSourceAllowedByEnhancedFetchPolicy
    }),
    faviconRequestBlacklistCache: blacklistUtils.normalizeItems([
      { pattern: 'blocked.example.com', matchModes: ['suffix'] },
      { pattern: 'vpn.example.com/private', matchModes: ['prefix'] },
      { pattern: 'exact.example.com/only-this', matchModes: ['exact'] }
    ], 'prefix'),
    storageArea: {
      get(_keys, callback) {
        callback({
          _x_extension_favicon_request_blacklist_2026_unique_: [],
          _x_extension_favicon_enhanced_fetch_enabled_2026_unique_: typeof deps.faviconEnhancedFetchEnabledStorageValue === 'undefined'
            ? true
            : deps.faviconEnhancedFetchEnabledStorageValue
        });
      }
    },
    blockedLogs: [],
    fetchCalls: [],
    themeParseCalls: 0,
    themeResolveCalls: 0,
    persistCalls: 0
  };

  const api = factory(deps, Buffer);

  assert.strictEqual(
    api.isUrlBlockedByFaviconRequestBlacklist('https://foo.blocked.example.com/path'),
    true,
    'suffix favicon exclusion should match subdomains'
  );
  assert.strictEqual(
    api.isUrlBlockedByFaviconRequestBlacklist('https://vpn.example.com/private/doc'),
    true,
    'prefix favicon exclusion should match child paths'
  );
  assert.strictEqual(
    api.isUrlBlockedByFaviconRequestBlacklist('https://exact.example.com/only-this'),
    true,
    'exact favicon exclusion should match the exact page URL'
  );
  assert.strictEqual(
    api.isUrlBlockedByFaviconRequestBlacklist('https://public.example.com/path'),
    false,
    'non-matching URLs should remain fetchable'
  );

  let result = await api.resolveSiteThemeColor('https://foo.blocked.example.com/page', '', 'dark');
  assert.strictEqual(result, null, 'theme color resolution should stop for excluded page URLs');
  assert.strictEqual(deps.fetchCalls.length, 0, 'blocked theme color resolution should not fetch the page');

  result = await api.resolveFaviconCandidates('https://vpn.example.com/private/doc', '', '');
  assert.deepStrictEqual(
    result,
    [
      'chrome-extension://test/_favicon/?pageUrl=https%3A%2F%2Fvpn.example.com%2Fprivate%2Fdoc'
    ],
    'excluded page URLs should keep only the safe browser-cache favicon candidate'
  );
  assert.strictEqual(deps.fetchCalls.length, 0, 'blocked favicon candidate resolution should not fetch anything');

  result = await api.fetchFaviconData('https://foo.blocked.example.com/favicon.ico');
  assert.strictEqual(result, null, 'favicon data fetch should stop for excluded favicon URLs');
  assert.strictEqual(deps.fetchCalls.length, 0, 'blocked favicon data fetch should not fetch the icon');

  result = await api.fetchFaviconData('chrome-extension://test/_favicon/?pageUrl=https%3A%2F%2Ffoo.blocked.example.com%2Fpage');
  assert.ok(
    typeof result === 'string' && result.startsWith('data:image/png;base64,'),
    'excluded page URLs should still allow safe virtual favicon data for theme extraction'
  );
  assert.strictEqual(
    deps.fetchCalls[0].url,
    'chrome-extension://test/_favicon/?pageUrl=https%3A%2F%2Ffoo.blocked.example.com%2Fpage&fallbackToHost=0',
    'virtual favicon data should fetch only the extension favicon endpoint'
  );

  result = await api.fetchFaviconData('https://t2.gstatic.cn/faviconV2?url=https%3A%2F%2Ffoo.blocked.example.com%2Fpage');
  assert.strictEqual(result, null, 'excluded page URLs should block third-party favicon proxy data');
  assert.strictEqual(deps.fetchCalls.length, 1, 'excluded proxy data should not reach fetch');

  result = await api.resolveSiteThemeColor('http://192.168.1.8/dashboard', '', 'dark');
  assert.strictEqual(result, null, 'local network page theme color resolution should not fetch page HTML');
  assert.strictEqual(deps.fetchCalls.length, 1, 'local network theme resolution should not reach the page network path');

  result = await api.resolveFaviconCandidates('http://192.168.1.8/dashboard', '', 'http://192.168.1.8/favicon.ico');
  assert.deepStrictEqual(
    result,
    [
      'chrome-extension://test/_favicon/?pageUrl=http%3A%2F%2F192.168.1.8%2Fdashboard',
      'https://t2.gstatic.cn/faviconV2?url=http%3A%2F%2F192.168.1.8%2Fdashboard'
    ],
    'local network pages should use safe virtual and third-party favicon candidates without direct favicon fallback'
  );

  result = await api.resolveSiteThemeColor('https://public.example.com/page', '', 'light');
  assert.strictEqual(result, null, 'theme color resolution should remain browser-cache-only');
  assert.strictEqual(deps.fetchCalls.length, 1, 'public theme color resolution must not fetch page HTML');
  assert.strictEqual(deps.themeParseCalls, 0, 'public page HTML should not enter the privileged background');

  result = await api.fetchFaviconData('https://public.example.com/favicon.ico');
  assert.strictEqual(result, null, 'direct target-site favicon requests should be disabled for public hosts too');
  assert.strictEqual(deps.fetchCalls.length, 1, 'direct favicon requests must not reach fetch');

  result = await api.fetchFaviconData(
    'https://t2.gstatic.cn/faviconV2?url=https%3A%2F%2Fpublic.example.com%2Fpage',
    'https://public.example.com/page'
  );
  assert.ok(typeof result === 'string' && result.startsWith('data:image/png;base64,'),
    'the fixed favicon proxy remains available when enhanced fetching is enabled');
  assert.strictEqual(deps.fetchCalls.at(-1).options.redirect, 'error',
    'proxy requests must fail instead of following redirects');

  deps.faviconEnhancedFetchEnabledCache = false;
  const disabledApi = factory(deps, Buffer);
  deps.fetchCalls = [];
  deps.themeParseCalls = 0;

  result = await disabledApi.resolveSiteThemeColor('https://public.example.com/page', '', 'light');
  assert.strictEqual(result, null, 'disabled enhanced favicon fetching should skip page theme-color HTML fetches');
  assert.strictEqual(deps.fetchCalls.length, 0, 'disabled enhanced favicon fetching should not fetch page HTML');
  assert.strictEqual(deps.themeParseCalls, 0, 'disabled enhanced favicon fetching should not parse page HTML');

  result = await disabledApi.resolveFaviconCandidates(
    'https://public.example.com/page',
    '',
    'https://public.example.com/favicon.ico'
  );
  assert.deepStrictEqual(
    result,
    [
      'chrome-extension://test/_favicon/?pageUrl=https%3A%2F%2Fpublic.example.com%2Fpage',
      'https://t2.gstatic.cn/faviconV2?url=https%3A%2F%2Fpublic.example.com%2Fpage'
    ],
    'disabled enhanced favicon fetching should keep browser cache followed by the approved service'
  );

  result = await disabledApi.fetchFaviconData('https://foo.example.com/favicon.ico');
  assert.strictEqual(result, null, 'strict mode should reject direct target-site favicon data requests');
  assert.strictEqual(deps.fetchCalls.length, 0, 'direct target-site requests must not reach fetch');
  result = await disabledApi.fetchFaviconData(
    'https://t2.gstatic.cn/faviconV2?url=https%3A%2F%2Ffoo.example.com%2F'
  );
  assert.ok(result.startsWith('data:image/png;base64,'), 'disabled enhanced fetching should allow approved service bytes');
  assert.strictEqual(deps.fetchCalls.length, 1, 'only the approved service request should reach fetch');
  assert.strictEqual(deps.fetchCalls[0].options.redirect, 'error');

  result = await disabledApi.fetchFaviconData(
    'https://t2.gstatic.cn/faviconV2?url=https%3A%2F%2Ffoo.blocked.example.com%2Fpage'
  );
  assert.strictEqual(result, null, 'site exclusions must take precedence even with enhanced fetching disabled');
  assert.strictEqual(deps.fetchCalls.length, 1);

  result = await disabledApi.fetchFaviconData(
    'chrome-extension://test/_favicon/?pageUrl=https%3A%2F%2Ffoo.example.com%2F'
  );
  assert.ok(
    typeof result === 'string' && result.startsWith('data:image/png;base64,'),
    'strict mode should still allow the extension virtual favicon endpoint'
  );
  assert.strictEqual(deps.fetchCalls.length, 2, 'disabled enhanced fetching should allow browser cache and approved services');

  const privatePageUrl = 'https://foo.example.com/private';
  const publicPageUrl = 'https://foo.example.com/public';
  const rootIconUrl = 'https://foo.example.com/favicon.ico';
  const matrixDeps = {
    ...deps,
    faviconRequestBlacklistCache: blacklistUtils.normalizeItems([
      { pattern: 'foo.example.com/private', matchModes: ['prefix'] }
    ], 'prefix'),
    storageArea: {
      get(_keys, callback) {
        callback({
          _x_extension_favicon_request_blacklist_2026_unique_: [],
          _x_extension_favicon_enhanced_fetch_enabled_2026_unique_: true
        });
      }
    },
    blockedLogs: [],
    fetchCalls: [],
    themeParseCalls: 0,
    themeResolveCalls: 0,
    persistCalls: 0,
    faviconEnhancedFetchEnabledCache: true
  };
  const matrixApi = factory(matrixDeps, Buffer);

  result = await matrixApi.resolveSiteThemeColor(privatePageUrl, '', 'dark');
  assert.strictEqual(result, null, 'excluded background paths should not resolve theme colors');
  assert.deepStrictEqual(
    matrixDeps.fetchCalls,
    [],
    'excluded background paths should not fetch page HTML, manifests, or root favicon candidates'
  );
  result = await matrixApi.resolveFaviconCandidates(privatePageUrl, '', rootIconUrl);
  assert.deepStrictEqual(
    result,
    [`chrome-extension://test/_favicon/?pageUrl=${encodeURIComponent(privatePageUrl)}`],
    'excluded background paths should keep only Lumno browser-cache favicon candidates'
  );
  result = await matrixApi.fetchFaviconData(rootIconUrl, privatePageUrl);
  assert.strictEqual(result, null, 'excluded background paths should block direct root favicon data requests');
  assert.strictEqual(matrixDeps.fetchCalls.length, 0, 'excluded background favicon data requests should not reach fetch');

  result = await matrixApi.resolveFaviconCandidates(publicPageUrl, '', rootIconUrl);
  assert.strictEqual(result.includes(rootIconUrl), false,
    'same-host public pages must not regain direct favicon candidates');
  assert.ok(
    result.some((url) => url.includes('gstatic.cn/faviconV2')),
    'same-host nonexcluded background paths should retain enhanced proxy candidates'
  );
  result = await matrixApi.resolveSiteThemeColor(publicPageUrl, '', 'dark');
  assert.strictEqual(result, null, 'public theme resolution should not read page HTML');
  assert.strictEqual(
    matrixDeps.fetchCalls.some((entry) => entry.url === publicPageUrl),
    false,
    'same-host nonexcluded background paths must not fetch page HTML'
  );
  result = await matrixApi.fetchFaviconData(rootIconUrl, publicPageUrl);
  assert.strictEqual(result, null,
    'same-host nonexcluded background paths must not fetch direct favicon bytes');

  const matchingDeps = { ...deps, fetchCalls: [], faviconEnhancedFetchEnabledCache: true };
  const matchingApi = factory(matchingDeps, Buffer);
  const dashboardPage = 'https://chrome.google.com/webstore/devconsole?hl=zh-CN';
  const rootBrowserSource = `chrome-extension://test/_favicon/?pageUrl=${encodeURIComponent('https://chrome.google.com/')}`;
  assert.ok(await matchingApi.fetchFaviconData(rootBrowserSource), 'root-page icon bytes can be cached for the root page');
  const callsBeforeMismatch = matchingDeps.fetchCalls.length;
  assert.strictEqual(await matchingApi.fetchFaviconData(rootBrowserSource, dashboardPage), null,
    'the shared byte API must reject a wrong-page source before returning cached bytes');
  assert.strictEqual(matchingDeps.fetchCalls.length, callsBeforeMismatch);
  const oldDashboardSource = `chrome-extension://test/_favicon/?pageUrl=${encodeURIComponent(dashboardPage)}&fallbackToHost=1`;
  assert.ok(await matchingApi.fetchFaviconData(oldDashboardSource, dashboardPage));
  assert.strictEqual(new URL(matchingDeps.fetchCalls.at(-1).url).searchParams.get('fallbackToHost'), '0',
    'the shared byte API must normalize old host-fallback requests before fetching');
  const oldChromeFavicon2Source = `chrome://favicon2/?pageUrl=${encodeURIComponent(dashboardPage)}&fallbackToHost=0`;
  assert.ok(await matchingApi.fetchFaviconData(oldChromeFavicon2Source, dashboardPage));
  assert.strictEqual(new URL(matchingDeps.fetchCalls.at(-1).url).protocol, 'chrome-extension:',
    'the shared byte API must never fetch a web-page chrome://favicon2 source with forced host fallback');
  assert.strictEqual(new URL(matchingDeps.fetchCalls.at(-1).url).searchParams.get('pageUrl'), dashboardPage);

  console.log('background favicon blacklist tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
