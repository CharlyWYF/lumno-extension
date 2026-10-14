const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { readPageSource } = require('./helpers/page-source');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');

const repoRoot = path.resolve(__dirname, '..');
const optionsJs = fs.readFileSync(path.join(repoRoot, 'src/options/options.js'), 'utf8');
const newtabJs = readNewtabRuntimeSource();
const newtabWallpaperJs = fs.readFileSync(
  path.join(repoRoot, 'src/newtab/wallpaper.js'),
  'utf8'
);
const newtabHtml = readPageSource('newtab.html');
const overlaySearchPanelJs = fs.readFileSync(
  path.join(repoRoot, 'src/overlay/search-panel.js'),
  'utf8'
);
const overlaySuggestionsCss = fs.readFileSync(
  path.join(repoRoot, 'src/overlay/suggestions-view.css'),
  'utf8'
);
const htmlFiles = [
  'newtab.html',
  'src/options/options.html',
  'src/onboarding/onboarding.html'
];

function assertMatches(source, pattern, message) {
  assert.ok(pattern.test(source), message);
}

const optionsResizeListeners = optionsJs.match(/window\.addEventListener\('resize'/g) || [];
assert.strictEqual(
  optionsResizeListeners.length,
  1,
  'options should use one coordinated resize listener'
);
const activePopconfirmOutsideListeners = optionsJs.match(
  /document\.addEventListener\('click', \(event\) => \{\s*if \(!activePopconfirm\)/g
) || [];
assert.strictEqual(
  activePopconfirmOutsideListeners.length,
  1,
  'options should use one outside-click listener for the active popconfirm'
);
assertMatches(
  optionsJs,
  /function scheduleOptionsViewportLayoutRefresh\(\) \{[\s\S]*?if \(optionsResizeFrame\)[\s\S]*?requestAnimationFrame/,
  'options resize work should be coalesced with requestAnimationFrame'
);
assert.doesNotMatch(
  optionsJs,
  /measureTabsIndicator|refreshAllTabsIndicators|scheduleTabsIndicatorsRefresh/,
  'segmented indicators are positioned by the shared React hook, not re-measured by the options adapter'
);
assert.strictEqual(
  (optionsJs.match(/SETTINGS\.addStorageChangeListener\(chrome, listener\)/g) || []).length,
  1,
  'options storage listeners should register through the shared guarded helper'
);
assertMatches(
  fs.readFileSync('react-src/shared/segmented-indicator.ts', 'utf8'),
  /\(buttonRect\.left - containerRect\.left\) \/ scaleX \+\s*container\.scrollLeft -\s*container\.clientLeft/,
  'indicator positioning should account for a horizontally scrolled tab strip and its border'
);

assertMatches(
  newtabJs,
  /function scheduleRecentReloadIfVisible\(\) \{[\s\S]*?clearTimeout\(recentExternalChangeTimer\)[\s\S]*?setTimeout\([\s\S]*?NEWTAB_EXTERNAL_CHANGE_DEBOUNCE_MS/,
  'recent-site external changes should be debounced'
);
assertMatches(
  newtabJs,
  /function scheduleBookmarkReloadIfVisible\(\) \{[\s\S]*?clearTimeout\(bookmarkExternalChangeTimer\)[\s\S]*?setTimeout\([\s\S]*?NEWTAB_EXTERNAL_CHANGE_DEBOUNCE_MS/,
  'bookmark external changes should be debounced'
);
assertMatches(
  newtabJs,
  /const startupStorageReadBatch = rawStorageArea[\s\S]*?settingsRuntimeApi\.createStorageReadBatch\(rawStorageArea\)[\s\S]*?const storageArea = startupStorageReadBatch[\s\S]*?startupStorageReadBatch\.area/,
  'new tab should coalesce same-task startup settings reads'
);
assertMatches(
  newtabJs,
  /startupStorageReadBatch\.ready\.then\([\s\S]*?data-lumno-newtab-bootstrap-storage-reads[\s\S]*?data-lumno-newtab-bootstrap-storage-requests/,
  'new tab should expose startup storage batching diagnostics'
);
assertMatches(
  newtabJs,
  /markNewtabStartupMilestone\('script-start'\)[\s\S]*?markNewtabStartupMilestone\('script-end'\)/,
  'development New Tab startup diagnostics should bracket synchronous page initialization'
);
[
  'core-runtimes-created',
  'appearance-bootstrap-scheduled',
  'page-structure-created',
  'shortcut-surface-created',
  'dock-runtime-created',
  'search-input-created',
  'search-controller-created',
  'auxiliary-controls-created',
  'dom-mounted',
  'ready-requested',
  'ready-visible'
].forEach((milestone) => {
  assert(
    newtabJs.includes(`markNewtabStartupMilestone('${milestone}')`),
    `development startup diagnostics should retain the ${milestone} milestone`
  );
});
[
  'appearance',
  'language',
  'section-policy',
  'shortcut-preferences',
  'visible-shortcuts',
  'recent-sites',
  'bookmarks',
  'fonts',
  'visual-ready'
].forEach((task) => {
  assert(
    newtabJs.includes(`observeNewtabStartupTask('${task}'`),
    `development startup diagnostics should measure the ${task} task`
  );
});
assertMatches(
  newtabJs,
  /function migrateStorageIfNeeded\(keys(?:, providerReady)?\) \{[\s\S]*?isPrimaryStorageAreaName\('local'\)/,
  'new tab storage migration should identify the wrapped primary area by name'
);
assertMatches(
  newtabJs,
  /function handleShortcutDockPointerMove\(event\) \{[\s\S]*?scheduleShortcutDockPointerStyles\(tile, getShortcutDockPointerX\(event\)\)/,
  'shortcut dock magnification should coalesce pointer-move layout work per frame'
);
assertMatches(
  newtabJs,
  /function handleShortcutDockPointerOver\(event\) \{[\s\S]*?scheduleShortcutDockPointerStyles\(tile, getShortcutDockPointerX\(event\)\)/,
  'shortcut dock magnification should coalesce pointer-over layout work per frame'
);
assertMatches(
  newtabJs,
  /function setShortcutDockHover\(activeTile, pointerX\) \{[\s\S]*?getShortcutDockInfluence\(pointerX, icon\)[\s\S]*?shortcutGrid\.setAttribute\('data-dock-active', 'true'\)/,
  'shortcut dock geometry reads should finish before hover state writes begin'
);
assertMatches(
  newtabJs,
  /function handleShortcutDragPointerMove\(event\) \{[\s\S]*?scheduleShortcutDragMove\(shortcutDragState, pointerX, pointerY\)/,
  'shortcut dragging should coalesce hit testing and FLIP layout work per frame'
);
const initialAppearanceBootstrapIndex = newtabJs.indexOf(
  'const initialAppearanceReadyTask = Promise.all(['
);
assert.ok(
  initialAppearanceBootstrapIndex >= 0 &&
    newtabJs.indexOf("let latestQuery = '';") < initialAppearanceBootstrapIndex &&
    newtabJs.slice(initialAppearanceBootstrapIndex).includes('bootstrapInitialThemeMode()'),
  'new tab query state should initialize before appearance bootstrapping starts'
);
assertMatches(
  newtabJs,
  /function refreshFallbackIcons\(\) \{[\s\S]*?if \(faviconViewRuntime && typeof faviconViewRuntime\.refreshFallbackIcons === 'function'\)/,
  'new tab theme bootstrap should tolerate favicon runtime initialization still being pending'
);
assert.strictEqual(
  (newtabJs.match(/SETTINGS\.addStorageChangeListener\(chrome, listener\)/g) || []).length,
  1,
  'new tab storage listeners should register through the shared guarded helper'
);
assert.strictEqual(
  (newtabJs.match(/chrome\.runtime\.getURL\(/g) || []).length,
  1,
  'new tab extension resources should resolve through the guarded URL helper'
);
assertMatches(
  newtabJs,
  /function sendRuntimeMessage\(message, callback\) \{[\s\S]*?typeof chrome === 'undefined'[\s\S]*?try \{[\s\S]*?chrome\.runtime\.sendMessage\(message, callback\);[\s\S]*?catch/,
  'new tab runtime messages should use a guarded transport helper'
);
assertMatches(
  newtabJs,
  /function requestSuggestions\(query, options\) \{[\s\S]*?const localRequestSent = sendRuntimeMessage\(\{[\s\S]*?action: 'getSearchSuggestions'[\s\S]*?const remoteRequestSent = sendRuntimeMessage\(\{[\s\S]*?action: 'getSearchEngineSuggestions'[\s\S]*?if \(!remoteRequestSent\) \{[\s\S]*?renderSuggestions\(localSuggestions, requestQuery\);[\s\S]*?if \(!localRequestSent\) \{[\s\S]*?renderPendingSuggestions\(requestQuery\);/,
  'new tab suggestions should preserve pending local results when the extension runtime is unavailable'
);
assertMatches(
  overlaySearchPanelJs,
  /openTabSuggestionLimit:\s*1000,[\s\S]*?openTabInitialRenderLimit:\s*10,[\s\S]*?getOpenTabInitialRenderLimit:\s*\(\) =>[\s\S]*?normalizeSearchResultDisplayLimit\(overlaySearchResultDisplayLimit\),[\s\S]*?openTabRenderBatchSize:\s*16,[\s\S]*?getOpenTabRenderBatchSize:\s*\(\) =>[\s\S]*?loadingSessionTrackingActive \|\| document\.readyState === 'loading'[\s\S]*?\? 8[\s\S]*?: 16,/,
  'overlay open-tab results should follow current settings and re-read page load state for every background batch'
);
assertMatches(
  overlaySearchPanelJs,
  /function renderTabSuggestions\(tabList\) \{\s*pauseOverlayAntiTranslateObserverForMutationBurst\(\);[\s\S]*?reactView\.renderTabs\(list\);/,
  'open-tab rendering should pause translation observation during owned DOM mutations'
);
assertMatches(
  overlaySearchPanelJs,
  /pauseOverlayAntiTranslateObserverForMutationBurst\(\);\s*setOpenTabsResultsViewport\(false\);[\s\S]*?reactView\.render\(\{/,
  'search-result rendering should pause translation observation during owned DOM mutations'
);
assertMatches(
  overlaySuggestionsCss,
  /\.x-ov-suggestion-item\s*\{[\s\S]*?content-visibility:\s*auto;[\s\S]*?contain-intrinsic-block-size:/,
  'off-screen overlay result rows should skip unnecessary layout and paint work'
);
assert.doesNotMatch(
  overlaySuggestionsCss,
  /data-favicon-load-state="(?:priming|loaded)"\][\s\S]*?filter:\s*blur/,
  'favicon entry motion should not animate paint-heavy blur filters'
);

htmlFiles.forEach((relativePath) => {
  const html = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
  assertMatches(
    html,
    /<meta name="theme-color"/,
    `${relativePath} should define a theme color`
  );
  const images = html.match(/<img\b[^>]*>/g) || [];
  images.forEach((image) => {
    assert.ok(/\bwidth="[^"]+"/.test(image), `${relativePath} image should define width: ${image}`);
    assert.ok(/\bheight="[^"]+"/.test(image), `${relativePath} image should define height: ${image}`);
  });
});

const optionsHtml = readPageSource('src/options/options.html');
assertMatches(
  optionsHtml,
  /\._x_extension_toggle_2024_unique_ input:focus-visible\s*\{[\s\S]*?outline:/,
  'custom settings toggles should retain a visible keyboard focus indicator'
);
assertMatches(
  optionsHtml,
  /#_x_extension_settings_tabs_2024_unique_ \{[^}]*overflow-x: auto;[\s\S]*?\._x_extension_settings_tab_button_2024_unique_ \{[^}]*white-space: nowrap;/,
  'settings tabs should scroll horizontally instead of wrapping labels at every width'
);
assertMatches(
  newtabJs,
  /document\.documentElement\.style\.colorScheme = resolved/,
  'new tab should synchronize native controls with the resolved theme'
);

const bookmarkPageMotion = newtabJs.slice(
  newtabJs.indexOf('function switchBookmarkPage(nextPage)'),
  newtabJs.indexOf('function getCurrentSearchEntryPaddingTop()')
);
assert.doesNotMatch(
  bookmarkPageMotion,
  /\bfilter\b|blur\(/,
  'bookmark paging should animate compositor-friendly transform and opacity only'
);
const appearanceScopeMotion = newtabWallpaperJs.slice(
  newtabWallpaperJs.indexOf('function animateWallpaperAppearanceScopeChange('),
  newtabWallpaperJs.indexOf('function getWallpaperButtonLabel()')
);
assert.doesNotMatch(
  appearanceScopeMotion,
  /style\.[^\n]*filter|blur\(/,
  'appearance scope changes should avoid paint-heavy blur animation'
);
const wallpaperPanelCss = newtabHtml.slice(
  newtabHtml.indexOf('.x-nt-wallpaper-panel {'),
  newtabHtml.indexOf('.x-nt-wallpaper-panel-scroll {')
);
assert.doesNotMatch(
  wallpaperPanelCss,
  /(?:^|\n)\s*filter\s*:|will-change:[^;]*filter/,
  'wallpaper panel entry should avoid animating a full-surface blur filter'
);

console.log('performance and style stability tests passed');
