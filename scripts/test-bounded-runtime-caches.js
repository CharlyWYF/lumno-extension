const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const faviconUtils = require('../src/shared/favicon-utils.js');
const faviconViewCoreApi = require('../src/shared/favicon-view-core.js');
const { readBackgroundSource } = require('./helpers/background-source');

function testBoundedCacheUtility() {
  const cache = new Map();
  faviconUtils.setBoundedCacheEntry(cache, 'a', 1, 2);
  faviconUtils.setBoundedCacheEntry(cache, 'b', 2, 2);
  faviconUtils.setBoundedCacheEntry(cache, 'a', 3, 2);
  faviconUtils.setBoundedCacheEntry(cache, 'c', 4, 2);

  assert.deepStrictEqual(Array.from(cache.keys()), ['a', 'c']);
  assert.strictEqual(cache.get('a'), 3);
  assert.strictEqual(cache.get('c'), 4);
}

function testFaviconViewCoreCacheLimits() {
  const faviconDataCache = new Map();
  const iconPreloadCache = new Map();
  class FakeImage {
    constructor() {
      this.decoding = '';
      this.referrerPolicy = '';
      this.src = '';
    }
  }
  const core = faviconViewCoreApi.createFaviconViewCore({
    windowObj: {
      Image: FakeImage,
      requestAnimationFrame(callback) {
        callback();
      },
      setTimeout
    },
    chromeApi: {
      runtime: {
        sendMessage(_message, callback) {
          callback({});
        }
      }
    },
    faviconDataCache,
    iconPreloadCache,
    faviconDataCacheMaxEntries: 2,
    iconPreloadCacheMaxEntries: 2,
    getHostFromUrl: () => '',
    shouldBlockFaviconForHost: () => false,
    isBlockedLocalFaviconUrl: () => false
  });

  core.cacheFaviconData('https://one.example/favicon.ico', 'data:image/png;base64,one');
  core.cacheFaviconData('https://two.example/favicon.ico', 'data:image/png;base64,two');
  core.cacheFaviconData('https://three.example/favicon.ico', 'data:image/png;base64,three');
  assert.strictEqual(faviconDataCache.size, 2);
  assert.strictEqual(faviconDataCache.has('https://one.example/favicon.ico'), false);

  core.preloadIcon('https://one.example/favicon.ico');
  core.preloadIcon('https://two.example/favicon.ico');
  core.preloadIcon('https://three.example/favicon.ico');
  assert.strictEqual(iconPreloadCache.size, 2);
  assert.strictEqual(iconPreloadCache.has('https://one.example/favicon.ico'), false);
}

function testRuntimeCachesUseBoundedWrites() {
  const background = readBackgroundSource();
  const overlay = fs.readFileSync(path.join(repoRoot, 'src/overlay/search-panel.js'), 'utf8');
  const overlayFavicon = fs.readFileSync(path.join(repoRoot, 'src/overlay/favicon-view.js'), 'utf8');
  const faviconCore = fs.readFileSync(path.join(repoRoot, 'src/shared/favicon-view-core.js'), 'utf8');

  assert.ok(
    background.includes('BACKGROUND_FAVICON_DATA_CACHE_MAX_ENTRIES = 256') &&
      background.includes('BACKGROUND_SITE_THEME_CACHE_MAX_ENTRIES = 512') &&
      background.includes('BACKGROUND_TITLE_PINYIN_CACHE_MAX_ENTRIES = 2048'),
    'background runtime caches should declare explicit memory bounds'
  );
  assert.strictEqual(
    (background.match(/(?:faviconDataCache|siteThemeColorCache|titlePinyinCache)\.set\(/g) || []).length,
    0,
    'background runtime cache writes should use the bounded helper'
  );
  assert.strictEqual(
    (overlay.match(/(?:themeColorCache|themeHostCache)\.set\(/g) || []).length,
    0,
    'overlay theme cache writes should use bounded helpers'
  );
  assert.strictEqual(
    (faviconCore.match(/(?:faviconDataCache|iconPreloadCache|extensionFaviconPlaceholderProbeCache)\.set\(/g) || []).length,
    0,
    'shared favicon view cache writes should use the bounded helper'
  );
  assert.doesNotMatch(
    background,
    /function setBoundedBackgroundCacheEntry\(/,
    'background should call the shared bounded cache helper directly'
  );
  assert.doesNotMatch(
    overlay,
    /function setBoundedOverlayCacheEntry\(/,
    'overlay should call the shared bounded cache helper directly'
  );
  assert.doesNotMatch(
    faviconCore,
    /function setBoundedCacheEntry\(/,
    'favicon view core should call the shared bounded cache helper directly'
  );
  assert.ok(
    overlayFavicon.includes('faviconViewCore.cacheFaviconData(sourceUrl, value)'),
    'overlay favicon bypass path should cache through the bounded favicon view core'
  );
}

testBoundedCacheUtility();
testFaviconViewCoreCacheLimits();
testRuntimeCachesUseBoundedWrites();
console.log('bounded runtime cache tests passed');
