const assert = require('assert');
const fs = require('fs');
const shortcutFavicon = require('../src/shared/shortcut-favicon.js');
const searchUtils = require('../src/shared/search-utils.js');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');
const { readBackgroundSource } = require('./helpers/background-source');

const backgroundSource = readBackgroundSource();
const newtabSource = readNewtabRuntimeSource();
const overlaySource = fs.readFileSync('src/overlay/search-panel.js', 'utf8');
const overlayRuntimeSource = fs.readFileSync('src/overlay/runtime.js', 'utf8');
const inputModeSource = fs.readFileSync('src/shared/search-input-mode.js', 'utf8');
const inputModeCss = fs.readFileSync('src/shared/search-input.css', 'utf8');
const searchUtilsSource = fs.readFileSync('src/shared/search-utils.js', 'utf8');
const siteSearchSource = fs.readFileSync('assets/data/site-search.json', 'utf8');
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));

assert.match(
  backgroundSource,
  /'src\/shared\/shortcut-favicon\.js',[\s\S]*?'src\/overlay\/search-panel\.js'/,
  'the injected overlay should load the shared high-resolution shortcut favicon runtime first'
);

assert.match(
  overlayRuntimeSource,
  /siteSearchIconCache:\s*'_x_extension_site_search_icon_cache_canonical_2026_unique_'/,
  'the overlay runtime should expose a fresh Retina provider icon cache key'
);

assert.doesNotMatch(
  `${siteSearchSource}\n${searchUtilsSource}`,
  /["']?iconUrl["']?\s*:\s*["']https?:/,
  'built-in provider catalogs should not retain remote icon fallbacks'
);

const webAccessibleResources = (manifest.web_accessible_resources || [])
  .flatMap((entry) => entry && Array.isArray(entry.resources) ? entry.resources : []);
const bundledProviderIconResourcePatterns = [
  'assets/images/site-search/*.png'
];
assert.ok(
  bundledProviderIconResourcePatterns.every((pattern) => webAccessibleResources.includes(pattern)),
  'all bundled provider artwork should remain web-accessible without per-icon manifest maintenance'
);
const siteSearchProviders = JSON.parse(siteSearchSource).items;
const expectedBundledProviderIcons = Object.freeze(Object.fromEntries(
  siteSearchProviders.map((provider) => [
    provider.key,
    `assets/images/site-search/tile-${provider.key}.png`
  ])
));
assert.deepStrictEqual(
  shortcutFavicon.SITE_SEARCH_PINNED_ICON_ASSETS,
  expectedBundledProviderIcons,
  'every built-in provider should resolve to its self-contained local tile'
);
assert.deepStrictEqual(
  siteSearchProviders.map((provider) => provider.key),
  Object.keys(expectedBundledProviderIcons),
  'the bundled provider icon map should cover the complete built-in catalog in order'
);
siteSearchProviders.forEach((provider) => {
  assert.ok(!provider.icon && !provider.iconUrl,
    `${provider.key} should not retain a remote icon fallback`);
});
searchUtils.getDefaultSiteSearchProviders().forEach((provider) => {
  assert.ok(!provider.icon && !provider.iconUrl,
    `${provider.key} fallback should not retain a remote icon URL`);
});
new Set(Object.values(expectedBundledProviderIcons)).forEach((resourcePath) => {
  assert.ok(fs.existsSync(resourcePath), `${resourcePath} should be bundled`);
  assert.match(
    resourcePath,
    /^assets\/images\/site-search\/tile-[a-z0-9]+\.png$/,
    `${resourcePath} should be a generated local PNG tile`
  );
  assert.ok(
    webAccessibleResources.includes(resourcePath) ||
      bundledProviderIconResourcePatterns.some((pattern) => webAccessibleResources.includes(pattern)),
    `${resourcePath} should be web-accessible`
  );
  const pngHeader = fs.readFileSync(resourcePath).subarray(0, 33);
  assert.deepStrictEqual(
    [...pngHeader.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10],
    `${resourcePath} should be a valid PNG asset`
  );
  assert.strictEqual(pngHeader.readUInt32BE(16), 144, `${resourcePath} should be 144px wide`);
  assert.strictEqual(pngHeader.readUInt32BE(20), 144, `${resourcePath} should be 144px high`);
  assert.strictEqual(pngHeader[25], 6, `${resourcePath} should preserve RGBA rounded corners`);
});

assert.match(
  backgroundSource,
  /const SITE_SEARCH_PINNED_ICON_KEYS = new Set\(Object\.keys\(\s*SHORTCUT_FAVICON\.SITE_SEARCH_PINNED_ICON_ASSETS \|\| \{\}\s*\)\);/,
  'bundled providers should skip unnecessary background discovery'
);

assert.match(
  backgroundSource,
  /const siteSearchProviders = Array\.isArray\(siteSearchCache\) \? siteSearchCache : \[\];[\s\S]*?loadSiteSearchProviders\(\)[\s\S]*?scheduleSiteSearchProviderIconWarmup\(providers, ''\);[\s\S]*?chrome\.scripting\.executeScript/,
  'provider icon warming should run in parallel while the overlay opens from cached provider data'
);

assert.match(
  backgroundSource,
  /const SITE_SEARCH_ICON_WARM_CONCURRENCY = 2;/,
  'provider icon discovery should be rate-limited to protect overlay and browser responsiveness'
);

const googleProvider = {
  key: 'gg',
  template: 'https://www.google.com/search?q={query}',
  iconUrl: shortcutFavicon.GOOGLE_BRAND_ICON_URL
};
const googlePageUrl = shortcutFavicon.getSiteSearchProviderPageUrl(googleProvider);
const now = Date.now();
assert.strictEqual(
  shortcutFavicon.getSiteSearchProviderIcon({
    [shortcutFavicon.getCacheKey(googlePageUrl)]: {
      dataUrl: 'data:image/png;base64,AA==',
      sourceUrl: 'https://www.google.com/favicon.ico',
      updatedAt: now
    }
  }, googleProvider, now, shortcutFavicon.SITE_SEARCH_CACHE_OPTIONS),
  shortcutFavicon.GOOGLE_BRAND_ICON_URL,
  'the pinned Google brand icon should bypass stale page-discovery cache entries'
);

assert.match(
  backgroundSource,
  /function scheduleSiteSearchProviderIconWarmup\(providers, preferredTheme\)[\s\S]*?hasUsableCachedSiteSearchProviderIcon\(provider\)/,
  'background warming should validate cached provider icons before skipping discovery'
);

assert.match(
  backgroundSource,
  /async function resolveShortcutFaviconData\(pageUrl, preferredTheme, signal, explicitIconUrl, refresh, iconSource\)[\s\S]*?resolver\.getShortcutFaviconFetchCandidates\(pageUrl, iconSource\)[\s\S]*?fetchShortcutFaviconResource\(/,
  'background warming should use centralized proxy and browser snapshot candidates instead of arbitrary provider URLs'
);
assert.match(
  backgroundSource,
  /function fetchShortcutFaviconDocument\(pageUrl, signal\) \{\s*return Promise\.resolve\(null\);\s*\}/,
  'provider page HTML discovery should make no privileged network request'
);
assert.match(
  backgroundSource,
  /function fetchShortcutFaviconManifest\(manifestUrl, signal\) \{\s*return Promise\.resolve\(\[\]\);\s*\}/,
  'provider manifests should make no privileged network request'
);
assert.match(
  backgroundSource,
  /function fetchShortcutFaviconResource\([\s\S]*?!isAllowedFaviconProxyRequestUrl\(sourceUrl\)[\s\S]*?redirect: 'error'[\s\S]*?isAllowedFaviconProxyRequestUrl\(resolvedSourceUrl\)/,
  'fixed proxy icon requests should reject redirects and revalidate the response URL'
);


assert.match(
  backgroundSource,
  /function removeLegacySiteSearchIconCaches\(\)[\s\S]*?localArea\.remove\(legacyKeys/,
  'obsolete provider cache namespaces should be removed during the canonical-cache migration'
);

[newtabSource, overlaySource].forEach((source) => {
  assert.match(
    source,
    /SHORTCUT_FAVICON\.getSiteSearchProviderIcon\(/,
    'newtab and overlay should resolve provider icons through the same shared function'
  );
  assert.match(
    source,
    /preferDirectProviderIcons:\s*true/,
    'newtab and overlay should bypass host-level favicon replacement for provider artwork'
  );
  assert.match(
    source,
    /const attachInputModeFaviconData =[\s\S]*?SHORTCUT_FAVICON\.createSiteSearchProviderIconHydrator\(attachFaviconData\)/,
    'newtab and overlay should create their provider icon loaders from one shared runtime'
  );
  assert.match(
    source,
    /attachFaviconData:\s*attachInputModeFaviconData/,
    'newtab and overlay should attach the same provider icon loading adapter'
  );
});

assert.strictEqual(
  shortcutFavicon.shouldHydrateSiteSearchProviderIcon(
    'chrome-extension://lumno/assets/images/site-search/tile-bi.png'
  ),
  false,
  'the shared Bing tile should bypass asynchronous favicon hydration on both surfaces'
);

assert.match(
  newtabSource,
  /storageKey:\s*SITE_SEARCH_ICON_CACHE_STORAGE_KEY,[\s\S]*?function loadSiteSearchIconCache\(\)/,
  'newtab should hydrate the same dedicated provider cache as overlay'
);

assert.match(
  newtabSource,
  /function getSearchModeMenuItems\(\) \{[\s\S]*?Promise\.all\(\[[\s\S]*?loadSiteSearchIconCache\(\)[\s\S]*?getAggregateSearches\(\)[\s\S]*?\]\)\.then\(\(results\) => loadSearchSourceOrder\(/,
  'newtab should finish the icon cache and aggregate configuration reads before resolving the search source order and rendering its provider menu'
);

assert.match(
  overlaySource,
  /function getSearchModeMenuItems\(\) \{[\s\S]*?Promise\.all\(\[[\s\S]*?loadSiteSearchIconCache\(\)[\s\S]*?getAggregateSearches\(\)[\s\S]*?\]\)\.then\(\(results\) => loadSearchSourceOrder\(/,
  'opening the shortcut panel should wait for unfinished icon and aggregate configuration reads before resolving the search source order'
);

assert.match(
  overlaySource,
  /storageChangeListeners\.add\(\(changes,\s*areaName\) => \{[\s\S]*?changes && changes\[SITE_SEARCH_ICON_CACHE_STORAGE_KEY\][\s\S]*?setSiteSearchPrefix\(activeProvider,[\s\S]*?inputModeController\.refreshModeMenu\(\)[\s\S]*?\}\);/,
  'an open overlay tag and menu should adopt background-warmed icons immediately'
);

assert.match(
  newtabSource,
  /changes\[SITE_SEARCH_ICON_CACHE_STORAGE_KEY\][\s\S]*?setSiteSearchPrefix\(activeProvider,[\s\S]*?inputModeController\.refreshModeMenu\(\)/,
  'an open newtab tag and menu should adopt the same background-warmed icons immediately'
);

assert.match(
  inputModeSource,
  /function refreshModeMenu\([^)]*\)[\s\S]*?refreshModeMenu,/,
  'the shared input mode controller should support refreshing an already-open panel'
);

assert.match(
  inputModeCss,
  /\[data-search-input-mode-current\] \{[\s\S]*?overflow: hidden !important;/,
  'the current-mode slot should clip only its own horizontal expansion'
);

assert.match(
  inputModeSource,
  /siteSearchPrefixCurrent\.style\.cssText = cssText\(\[[\s\S]*?\['display', currentLabelVisible \? 'inline-flex' : 'none'\][\s\S]*?\['line-height', '18px'\][\s\S]*?\['overflow', 'hidden'\]/,
  'the current-mode slot should preserve its line box while constraining the reveal width'
);

assert.match(
  inputModeCss,
  /\[data-search-input-mode-current\] \{[\s\S]*?display: none !important;[\s\S]*?\[data-current-visible="true"\][\s\S]*?\[data-search-input-mode-current\] \{[\s\S]*?display: inline-flex !important;/,
  'the current-mode label should use a dedicated reveal state'
);

assert.doesNotMatch(
  inputModeCss,
  /\[data-current-overlay="true"\]|--x-lumno-search-mode-current-overlay-left/,
  'the current-mode label should never share the chevron coordinate through an overlay state'
);

assert.match(
  inputModeSource,
  /const previousCurrentState = shouldAnimate[\s\S]*?getInputModePrefixCurrentVisualState\(\)[\s\S]*?cancelInputModePrefixAnimation\(\)[\s\S]*?playInputModePrefixCurrentResizeAnimation\([\s\S]*?previousCurrentState,[\s\S]*?nextCurrentState/,
  'menu reversal should capture the rendered current-slot geometry before cancelling the active animation'
);

assert.match(
  inputModeSource,
  /function playInputModePrefixCurrentResizeAnimation\(fromState, toState\)[\s\S]*?siteSearchPrefixCurrent\.animate\(\[[\s\S]*?marginLeft: `\$\{startMarginLeft\}px`[\s\S]*?width: `\$\{startWidth\}px`[\s\S]*?marginLeft: `\$\{endMarginLeft\}px`[\s\S]*?width: `\$\{endWidth\}px`[\s\S]*?animationRevision !== inputModePrefixAnimationRevision/,
  'the current-mode slot should expand in flow, cancel the extra flex gap, and reject stale completions'
);
assert.doesNotMatch(
  inputModeCss,
  /_x_lumno_search_mode_current_mask_reveal_2026_unique_/,
  'the stylesheet should not start a second uncoordinated current-label animation'
);

(async () => {
  // Provider icons should warm as soon as the background runtime starts: the
  // warmup reads the canonical provider icon cache before fetching icons.
  const { loadBackground, wait } = require('./helpers/background-harness');
  const harness = loadBackground({
    fetch: async (url) => {
      if (String(url).endsWith('assets/data/site-search.json')) {
        return { ok: true, json: async () => JSON.parse(siteSearchSource) };
      }
      throw new Error('offline');
    }
  });
  await wait(80);
  const readKeys = harness.storage.local.reads.flatMap((keys) => (Array.isArray(keys) ? keys : [keys]));
  assert.ok(
    readKeys.includes(shortcutFavicon.SITE_SEARCH_STORAGE_KEY),
    'provider icons should warm as soon as the background runtime starts'
  );
  console.log('overlay site-search icon cache tests passed');
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
