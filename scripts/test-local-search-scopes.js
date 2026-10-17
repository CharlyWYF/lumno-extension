const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { readPageSource } = require('./helpers/page-source');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');
const { readBackgroundSource } = require('./helpers/background-source');

const repoRoot = path.resolve(__dirname, '..');
const readSource = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const newtabSource = readNewtabRuntimeSource();
const overlaySource = readSource('src/overlay/search-panel.js');
const backgroundSource = readBackgroundSource();
const inputModeSource = readSource('src/shared/search-input-mode.js');
const inputModeCss = readSource('src/shared/search-input.css');
const newtabHtml = readPageSource('newtab.html');
const manifestSource = readSource('manifest.json');
const overlaySuggestionsCss = readSource('src/overlay/suggestions-view.css');

function getFunctionSection(source, functionName, nextFunctionName) {
  const start = source.indexOf(`function ${functionName}(`);
  const end = source.indexOf(`function ${nextFunctionName}(`, start + 1);
  assert.ok(start >= 0 && end > start, `${functionName} should have a readable source section`);
  return source.slice(start, end);
}

assert.match(
  inputModeSource,
  /function createModeMenuIcon\(item, menuItem\)[\s\S]*?attachProviderIcon\(image,[\s\S]*?onIconUnavailable: showFallback/,
  'scope menu provider icons should use the shared favicon fallback and persistence runtime'
);
assert.match(
  inputModeSource,
  /siteSearchPrefixIconFrame[\s\S]*?\['width', '20px'\][\s\S]*?\['height', '20px'\][\s\S]*?\['border-radius', '6px'\][\s\S]*?\['clip-path', 'inset\(0 round 6px\)'\][\s\S]*?\['isolation', 'isolate'\]/,
  'the active scope tag favicon frame should use the larger proportional geometry shared by both surfaces'
);
assert.match(
  inputModeSource,
  /\['height', '32px'\],[\s\S]*?\['padding', '0 6px'\]/,
  'the active scope tag should keep six-pixel inline padding equal to the icon vertical inset'
);
assert.match(
  inputModeCss,
  /\.x-lumno-search-input-mode__prefix-icon-frame::after\s*\{[\s\S]*?border:\s*0\.5px solid currentColor !important;[\s\S]*?border-radius:\s*6px !important;[\s\S]*?opacity:\s*0\.18 !important;/,
  'the tag favicon hairline should reuse the title color at low opacity with a radius-matched edge'
);
assert.match(
  inputModeSource,
  /function removeProviderIconRuntimeFallbacks\(parent\)[\s\S]*?_x_extension_favicon_fallback_2024_unique_[\s\S]*?_x_extension_overlay_favicon_fallback_2026_unique_/,
  'provider icon fallback should remove runtime-owned fallback siblings on both search surfaces'
);
assert.match(
  inputModeCss,
  /\.x-lumno-search-input-mode__menu-icon\s*\{[\s\S]*?width:\s*52px !important;[\s\S]*?border-radius:\s*12px !important;[\s\S]*?background:\s*transparent !important/,
  'scope menu icons should retain their layout footprint without a middle background tile'
);
assert.match(
  inputModeCss,
  /\.x-lumno-search-input-mode__menu-icon\s*\{[\s\S]*?--x-nt-shortcut-smooth-mask-outer[\s\S]*?mask-image:\s*var\(--x-lumno-search-mode-smooth-mask-outer\)/,
  'scope menu icon containers should reuse the shortcut outer squircle mask'
);
assert.match(
  inputModeCss,
  /\.x-lumno-search-input-mode__menu-favicon-mask\s*\{[\s\S]*?width:\s*36px !important;[\s\S]*?--x-lumno-search-mode-smooth-mask-inner/,
  'scope menu favicons should keep shortcut-like padding inside an inner crop mask'
);
assert.match(
  inputModeSource,
  /function applyModeMenuIconTheme\(wrap, menuItem, theme\)[\s\S]*?getAccessibleThemeFocusRingRgb\([\s\S]*?--x-lumno-search-mode-icon-color[\s\S]*?--x-lumno-search-mode-selected-bg[\s\S]*?--x-lumno-search-mode-item-focus-ring/,
  'selected scope cards and contrast-safe focus rings should reuse one resolved provider theme'
);
assert.match(
  inputModeSource,
  /function scrollModeMenuButtonIntoView\(button, scrollOptions\)[\s\S]*?DEFAULT_MODE_MENU_SCROLL_TOP_CONTEXT[\s\S]*?DEFAULT_MODE_MENU_SCROLL_BOTTOM_CONTEXT[\s\S]*?buttonRect\.top < topBoundary[\s\S]*?buttonRect\.bottom > bottomBoundary/,
  'keyboard scrolling should preserve group-title context above and panel padding below'
);
assert.match(
  inputModeSource,
  /prefers-reduced-motion: reduce[\s\S]*?scrollOptions\.smooth === true[\s\S]*?modeMenuContent\.scrollTo\(\{[\s\S]*?behavior: 'smooth'/,
  'arrow-key scope navigation should scroll smoothly unless reduced motion is requested'
);
assert.match(
  inputModeCss,
  /\.x-lumno-search-input-mode__menu-item:focus-visible\s*\{[\s\S]*?border-color:\s*var\([\s\S]*?--x-lumno-search-mode-item-focus-ring[\s\S]*?box-shadow:\s*none !important;/,
  'keyboard-focused scope cards should use a single contrast-safe two-pixel theme border'
);
assert.doesNotMatch(
  inputModeCss,
  /\.x-lumno-search-input-mode__menu-item:focus-visible\s*\{[^}]*box-shadow:\s*inset/,
  'keyboard focus should not add a second inset ring'
);
assert.match(
  inputModeCss,
  /\.x-lumno-search-input-mode__menu-item:hover:not\(\[aria-checked="true"\]\)[\s\S]*?background:\s*transparent !important/,
  'scope menu hover should not add an outer card surface'
);
assert.match(
  inputModeCss,
  /\.x-lumno-search-input-mode__menu-item:hover:not\(\[aria-checked="true"\]\):not\(:focus-visible\)\s*\{[\s\S]*?border-color:\s*transparent !important;/,
  'scope menu hover should keep its border transparent without overriding keyboard focus'
);
assert.doesNotMatch(
  inputModeCss,
  /\.x-lumno-search-input-mode__menu-item:hover:not\(\[aria-checked="true"\]\)\s*\{[\s\S]*?border-color:\s*transparent !important;/,
  'a hovered keyboard-focus target should retain its focus border'
);
assert.doesNotMatch(
  inputModeCss,
  /\.x-lumno-search-input-mode__menu-item:focus-visible:not\(\[aria-checked="true"\]\)\s*\{[^}]*border-color:\s*transparent !important;/,
  'keyboard focus should not be suppressed by the transparent hover border rule'
);
assert.match(
  inputModeCss,
  /\.x-lumno-search-input-mode__menu-icon\s*\{[\s\S]*?background:\s*transparent !important/,
  'scope icons should remain background-free in default, hover, focus, and selected states'
);
assert.doesNotMatch(
  inputModeCss,
  /x-lumno-search-mode-icon-hover-outline/,
  'scope menu hover should not retain an icon outline'
);
assert.match(
  inputModeCss,
  /\.x-lumno-search-input-mode__menu-item\s*\{[\s\S]*?border:\s*2px solid transparent !important;/,
  'scope cards should reserve a two-pixel border without shifting their contents between states'
);
assert.match(
  inputModeCss,
  /\.x-lumno-search-input-mode__menu-item\[aria-checked="true"\]\s*\{[\s\S]*?--x-lumno-search-mode-selected-bg[\s\S]*?border-color:\s*color-mix\([\s\S]*?--x-lumno-search-mode-item-focus-ring[\s\S]*?32%[\s\S]*?transparent[\s\S]*?\) !important;/,
  'the active search scope should use a thicker theme-tinted outer selection border'
);
assert.doesNotMatch(
  inputModeCss,
  /--x-lumno-search-mode-icon-active-bg/,
  'scope icons should not retain a stateful middle-square background token'
);
assert.match(
  inputModeCss,
  /\.x-lumno-search-input-mode__menu-label\s*\{[\s\S]*?height:\s*16px !important;[\s\S]*?min-height:\s*16px !important;[\s\S]*?flex:\s*0 0 16px !important;[\s\S]*?color:\s*inherit !important;[\s\S]*?opacity:\s*1 !important;[\s\S]*?visibility:\s*visible !important;/,
  'scope labels should keep a visible non-shrinking text row beside themed hover states'
);
assert.match(
  inputModeSource,
  /function buildModeMenuSearchIndex\(item\)[\s\S]*?getModeMenuPinyinSyllable\(character\)[\s\S]*?function applyModeMenuFilter\(query, filterOptions\)[\s\S]*?entry\.button\.hidden = !match\.matched/,
  'the shared scope panel should filter its rendered cards with direct and pinyin indexes'
);
assert.match(
  inputModeSource,
  /function focusFirstModeMenuFilterResult\(\)[\s\S]*?focusModeMenuButton\(0\)[\s\S]*?function handleMenuKeydown\(event\)[\s\S]*?applyModeMenuFilter\(modeMenuFilterQuery \+ event\.key\);[\s\S]*?focusFirstModeMenuFilterResult\(\)/,
  'panel filtering should focus the first match and hand subsequent arrow keys to menu navigation'
);
assert.match(
  inputModeSource,
  /function getAllModeMenuButtons\(\)[\s\S]*?function getModeMenuButtons\(\)[\s\S]*?getAllModeMenuButtons\(\)\.filter[\s\S]*?function syncModeMenuSelection\(modeId\)[\s\S]*?getAllModeMenuButtons\(\)\.forEach/,
  'filtered keyboard selection should clear checked state from hidden menu items too'
);
assert.match(
  inputModeSource,
  /function renderModeMenuLabelMatch\(label, labelText, ranges\)[\s\S]*?x-lumno-search-input-mode__menu-match/,
  'the shared scope panel should render matched title ranges without replacing the accessible label'
);
assert.match(
  inputModeSource,
  /function getModeActivePlaceholder\(\)[\s\S]*?search_scope_active_placeholder[\s\S]*?function syncInputPlaceholder\(\)[\s\S]*?getModeMenuPlaceholder\(\)[\s\S]*?hasVisibleModePrefix\(\)[\s\S]*?getModeActivePlaceholder\(\)/,
  'active scopes should use distinct localized placeholders for closed and open panel states'
);
assert.match(
  inputModeSource,
  /function handleModeInputFocus\(\)[\s\S]*?setModeMenuSearchActive\(false\)[\s\S]*?function handleModeMenuPointerDown\(event\)[\s\S]*?focusModeMenuSearch\(\)/,
  'clicking the main input or the scope panel should transfer keyboard ownership explicitly'
);
assert.match(
  inputModeSource,
  /button\.addEventListener\('click',[\s\S]*?selectModeMenuItem\(item, \{ focusAfterSelect: 'input' \}\)[\s\S]*?function handleMenuKeydown\(event\)[\s\S]*?selectModeMenuItem\(entry\.item, \{[\s\S]*?focusAfterSelect: 'panel'[\s\S]*?event\.key === 'Tab'[\s\S]*?handleModeMenuTabFocusToggle\(event\)/,
  'pointer selection, keyboard selection, and Tab should use the shared focus rules'
);
assert.match(
  inputModeCss,
  /\.x-lumno-search-input-mode__menu-match\s*\{[\s\S]*?background:\s*var\(--x-ext-mark-bg,\s*#CFE8FF\) !important;[\s\S]*?color:\s*var\(--x-ext-mark-text,\s*#1E3A8A\) !important;[\s\S]*?padding:\s*0 1px !important;[\s\S]*?border-radius:\s*2px !important;/,
  'matched scope title text should mirror the shared search-result highlight style'
);
assert.match(
  inputModeCss,
  /\.x-lumno-search-input-mode__menu-item\s*\{[\s\S]*?min-height:\s*86px !important;[\s\S]*?padding:\s*6px 4px !important;[\s\S]*?gap:\s*4px !important;/,
  'scope cards should preserve the original vertical padding around the icon and title stack'
);
assert.match(
  inputModeSource,
  /setStyle\(container, '--x-lumno-search-mode-selected-bg', visual\.background, useImportantStyles\)/,
  'the search scope menu should receive the current provider theme background'
);
assert.match(
  inputModeCss,
  /\.x-lumno-search-input-mode__menu-favicon-mask\s*>\s*\[hidden\]\s*\{\s*display: none !important;/,
  'resolved provider favicons should visually suppress their hidden fallback glyph'
);
assert.match(
  inputModeCss,
  /@supports \(corner-shape:\s*superellipse\(1\.25\)\)[\s\S]*?\.x-lumno-search-input-mode__menu[\s\S]*?corner-shape:\s*superellipse\(1\.25\);/,
  'the scope menu should use the same continuous superellipse corner curve as the search input'
);
assert.match(
  inputModeCss,
  /\.x-lumno-search-input-mode__menu\[data-surface="newtab"\]\s*\{\s*backdrop-filter: none !important;[\s\S]*?-webkit-backdrop-filter: none !important;/,
  'the newtab scope menu should use an opaque surface without wallpaper blur'
);
assert.match(
  inputModeCss,
  /\.x-lumno-search-input-mode__menu\[data-surface="newtab"\][\s\S]*?\.x-lumno-search-input-mode__menu-content,\s*\.x-lumno-search-input-mode__menu\[data-surface="overlay"\][\s\S]*?\.x-lumno-search-input-mode__menu-content\s*\{[\s\S]*?overflow-y:\s*scroll !important;[\s\S]*?scrollbar-gutter:\s*stable;[\s\S]*?padding-inline-end:\s*16px !important;/,
  'newtab and overlay scope content grids should keep equal 16px inline padding around the scrollbar'
);
assert.match(
  inputModeCss,
  /:root:not\(\[data-lumno-scrollbars="overlay"\]\) \.x-lumno-search-input-mode__menu\[data-surface="newtab"\]\s*\.x-lumno-search-input-mode__menu-content,\s*:root:not\(\[data-lumno-scrollbars="overlay"\]\) \.x-lumno-search-input-mode__menu\[data-surface="overlay"\]\s*\.x-lumno-search-input-mode__menu-content\s*\{\s*scrollbar-width:\s*thin;\s*scrollbar-color:[^;]+ transparent;/,
  'scope content scrollbars should use compositor-drawn scrollbar-color thumbs that keep pace with scrolling'
);
assert.doesNotMatch(
  inputModeCss,
  /\.x-lumno-search-input-mode__menu-content::-webkit-scrollbar/,
  'a ::-webkit-scrollbar thumb is painted on the main thread and stutters behind the scrolling tiles'
);
assert.match(
  inputModeCss,
  /\.x-lumno-search-input-mode__menu-footer\s*\{[\s\S]*?display:\s*flex !important;[\s\S]*?justify-content:\s*space-between !important;[\s\S]*?flex:\s*0 0 auto !important;[\s\S]*?font:\s*400 12px\/18px[\s\S]*?text-align:\s*left !important;[\s\S]*?overflow:\s*hidden !important;[\s\S]*?\.x-lumno-search-input-mode__menu-footer-actions\s*\{[\s\S]*?margin-inline-start:\s*0 !important;[\s\S]*?gap:\s*18px !important;[\s\S]*?\.x-lumno-search-input-mode__menu-footer-hint\s*\{[\s\S]*?gap:\s*4px !important;[\s\S]*?\.x-lumno-search-input-mode__menu-footer-key\s*\{[\s\S]*?font:\s*500 11px\/16px[\s\S]*?\.x-lumno-search-input-mode__menu-footer-filter-text\s*\{[\s\S]*?flex:\s*1 1 0 !important;[\s\S]*?text-align:\s*left !important;[\s\S]*?text-overflow:\s*ellipsis !important;/,
  'keyboard hints should use tight key-label spacing and wider separation between actions'
);
assert.match(
  inputModeSource,
  /modeMenuFooterSelectHint\.appendChild\(modeMenuFooterSelectKey\);[\s\S]*?modeMenuFooterSelectHint\.appendChild\(modeMenuFooterSelectText\);[\s\S]*?modeMenuFooterActions\.appendChild\(modeMenuFooterNavigationHint\);[\s\S]*?modeMenuFooterActions\.appendChild\(modeMenuFooterSelectHint\);[\s\S]*?modeMenuFooterActions\.appendChild\(modeMenuFooterInputHint\);[\s\S]*?modeMenuFooterActions\.appendChild\(modeMenuFooterShortcutHint\);/,
  'each keyboard action should have its own semantic spacing group'
);
assert.doesNotMatch(
  inputModeCss,
  /\.x-lumno-search-input-mode__menu-footer-divider/,
  'the fixed scope footer should not retain divider styling'
);
assert.match(
  inputModeCss,
  /\.x-lumno-search-input-mode__menu\[data-surface="overlay"\]\s*\{\s*backdrop-filter: none !important;[\s\S]*?-webkit-backdrop-filter: none !important;/,
  'the overlay scope menu should use an opaque surface without page blur'
);
assert.match(
  newtabHtml,
  /--x-nt-mode-menu-bg:\s*#ffffff;[\s\S]*?body\[data-theme="dark"\][\s\S]*?--x-nt-mode-menu-bg:\s*#141414;/,
  'newtab scope menu materials should stay opaque in light and dark themes'
);
assert.match(
  overlaySource,
  /light:\s*\{[\s\S]*?modeMenuBg:\s*'#FFFFFF'[\s\S]*?dark:\s*\{[\s\S]*?modeMenuBg:\s*'#141414'/,
  'overlay scope menu materials should stay opaque in light and dark themes'
);

[newtabSource, overlaySource].forEach((source, index) => {
  const surface = index === 0 ? 'newtab' : 'overlay';
  const menuBuilderName = source.includes('function buildSearchModeMenuItems')
    ? 'buildSearchModeMenuItems'
    : 'getSearchModeMenuItems';
  const menuBuilderEnd = menuBuilderName === 'buildSearchModeMenuItems'
    ? 'getSearchModeMenuItems'
    : 'restoreSearchModeQuery';
  const menuSource = getFunctionSection(
    source,
    menuBuilderName,
    menuBuilderEnd
  );
  const providerChainIndex = menuSource.indexOf('providers');
  const engineProviderIndex = menuSource.indexOf(
    '.filter((provider) => isSearchEngineSiteSearchProvider(provider))',
    providerChainIndex
  );
  const siteProviderIndex = menuSource.indexOf(
    '.concat(providers.filter((provider) => (',
    engineProviderIndex
  );
  const aiProviderIndex = menuSource.indexOf(
    '.concat(providers.filter((provider) => isAiSiteSearchProvider(provider)))'
  );
  const browserContentIndex = menuSource.indexOf("['topSite', 'bookmark', 'history']");
  assert.doesNotMatch(
    menuSource,
    /id:\s*['"]all['"]/,
    `${surface} scope switcher should not offer an all-search item`
  );
  assert.doesNotMatch(
    source,
    /item\.kind === ['"]all['"]/,
    `${surface} should not retain an unreachable all-search selection branch`
  );
  assert.ok(
    engineProviderIndex >= 0 &&
      siteProviderIndex > engineProviderIndex &&
      aiProviderIndex > siteProviderIndex &&
      browserContentIndex > aiProviderIndex,
    `${surface} scope switcher should group all providers by search engine, site search, AI, then browser content`
  );
  assert.match(
    menuSource,
    /const isAi = isAiSiteSearchProvider\(provider\);[\s\S]*?const isSearchEngine = isSearchEngineSiteSearchProvider\(provider\);[\s\S]*?group: isSearchEngine \? engineGroup : \(isAi \? aiGroup : siteGroup\)/,
    `${surface} scope switcher should place custom providers according to their selected category`
  );
  assert.match(
    menuSource,
    /menuIconName:\s*sourceType === 'topSite' \? 'star' : sourceType/,
    `${surface} browser-content cards should use the lighter menu-only icon set`
  );
  assert.match(
    menuSource,
    /searchTerms:\s*sourceType === 'topSite'[\s\S]*?\['bookmark', 'bookmarks'\][\s\S]*?\['history', 'browsing history'\]/,
    `${surface} localized browser-content scopes should remain searchable by English names`
  );
  assert.match(
    source,
    /localSearchScopeTriggerState[\s\S]*?activateLocalSearchScope/,
    `${surface} should expose local-scope activation through its Tab trigger state`
  );
  assert.match(
    source,
    /function setLocalSearchScopePrefix\(scope\)[\s\S]*?menuIconName:\s*scope\.sourceType === 'topSite' \? 'star' : scope\.sourceType/,
    `${surface} active local-scope tag should reuse its built-in SVG icon`
  );
  assert.match(
    source,
    /sourceTypes:\s*requestLocalSearchScope\s*\?\s*\[requestLocalSearchScope\.sourceType\]\s*:\s*undefined/,
    `${surface} should request only the active local source`
  );
  assert.match(
    source,
    /includeOpenTabs:\s*requestLocalSearchScope\s*\?\s*false\s*:\s*undefined/,
    `${surface} should exclude open tabs from category-only search`
  );
  assert.match(
    source,
    /if \(requestLocalSearchScope\) \{[\s\S]*?return;/,
    `${surface} should skip remote search-engine suggestions in local scope mode`
  );
  assert.match(
    source,
    /if \(localSearchScopeState\) \{\s*return;\s*\}/,
    `${surface} should not fall through to a web search when a scoped query has no result`
  );
});

assert.match(
  overlaySource,
  /id:\s*'openTabs'[\s\S]*?searchTerms:\s*\['open tabs', 'tabs', 'browser'\][\s\S]*?menuIconName:\s*'browser'/,
  'overlay open-tabs card should use the lighter browser menu icon'
);
assert.match(
  newtabSource,
  /function handleGlobalTypingFocus\(event\)[\s\S]*?shouldHandleModeMenuKeyEvent\(event\)[\s\S]*?const activeElement = document\.activeElement/,
  'newtab global typing should not steal text while the scope panel owns focus'
);
assert.match(
  newtabHtml,
  /assets\/vendor\/pinyin-pro\.js[\s\S]*?shared\/search-input-mode\.js/,
  'newtab should load the local pinyin runtime before the shared scope controller'
);
assert.doesNotMatch(
  backgroundSource,
  /const overlayInjectionFiles = \[[\s\S]*?assets\/vendor\/pinyin-pro\.js[\s\S]*?\];/,
  'overlay injection should not parse the pinyin runtime on the critical open path'
);
assert.match(
  inputModeSource,
  /import\(chromeApi\.runtime\.getURL\('assets\/vendor\/pinyin-pro\.js'\)\)/,
  'overlay scope search should lazy-load the pinyin runtime when needed'
);
assert.match(
  manifestSource,
  /"resources":\s*\[[^\]]*"assets\/vendor\/pinyin-pro\.js"/,
  'the lazy pinyin runtime should remain web-accessible to the injected scope controller'
);
assert.match(
  overlaySource,
  /function setOpenTabsSearchPrefix\(theme, options\)[\s\S]*?menuIconName:\s*'browser'/,
  'overlay open-tabs tag should reuse the browser SVG icon'
);
assert.match(
  inputModeCss,
  /\.x-lumno-search-input-mode__menu-line-icon\s*\{[\s\S]*?width:\s*26px !important;[\s\S]*?height:\s*26px !important;/,
  'browser-content menu icons should keep their footprint while using lighter vectors'
);
assert.match(
  inputModeSource,
  /function applyModeMenuBuiltInIconTheme\(wrap, menuItem\)[\s\S]*?--x-lumno-search-mode-icon-color[\s\S]*?--x-lumno-search-mode-selected-bg/,
  'built-in browser-content selections should use the active surface theme instead of the default blue brand fallback'
);

assert.match(
  newtabSource,
  /localSearchQueryModeActive[\s\S]*?t\('overlay_empty_result', '无匹配结果'\)[\s\S]*?suggestionsView\.render\(\{[\s\S]*?emptyMessage/,
  'newtab local search should pass a visible empty message to the suggestions view'
);
assert.match(
  overlaySource,
  /localSearchQueryModeActive && allSuggestions\.length === 0[\s\S]*?t\('overlay_empty_result', '无匹配结果'\)[\s\S]*?reactView\.render\(\{[\s\S]*?emptyMessage/,
  'overlay local search should pass a visible empty message to the React suggestions view'
);
assert.match(
  inputModeSource,
  /function setModeMenuResultOffset\(offset\)[\s\S]*?--x-lumno-search-mode-menu-result-offset/,
  'the shared search scope menu should expose a result-height offset instead of covering result guidance'
);
assert.match(
  inputModeSource,
  /function fitModeMenuWithinViewport\(options\)[\s\S]*?--x-lumno-search-mode-menu-viewport-max-height[\s\S]*?visualViewport[\s\S]*?availableLayoutHeight - menuLayoutHeight/,
  'the shared scope menu should reserve stable viewport room before returning room for results'
);
assert.match(
  inputModeSource,
  /DEFAULT_MODE_MENU_VIEWPORT_BOTTOM_INSET\s*=\s*24/,
  'the shared scope menu should keep a visible 24px bottom safe area'
);
assert.match(
  inputModeSource,
  /'height', 'min\(360px, 62vh, var\(--x-lumno-search-mode-menu-viewport-max-height, 360px\)\)'/,
  'the scope menu should keep a stable height while filtering reduces its visible items'
);
assert.match(
  inputModeSource,
  /max-height', 'min\(360px, 62vh, var\(--x-lumno-search-mode-menu-viewport-max-height, 360px\)\)'/,
  'the scope menu should remain internally scrollable when the viewport itself is short'
);
assert.match(
  newtabSource,
  /function getSearchModeMenuResultOffset\(\)[\s\S]*?data-visible[\s\S]*?suggestionsContainer\.offsetHeight[\s\S]*?function syncSearchModeMenuResultOffset\(\)[\s\S]*?--x-nt-suggestions-menu-fit-max-height[\s\S]*?fitModeMenuWithinViewport[\s\S]*?setModeMenuResultOffset[\s\S]*?ResizeObserver[\s\S]*?observe\(suggestionsContainer\)/,
  'newtab should use stable layout height and shrink visible results enough to keep the scope menu inside the viewport'
);
assert.match(
  overlaySource,
  /function getSearchModeMenuResultOffset\(\)[\s\S]*?data-collapsed[\s\S]*?suggestionsContainer\.offsetHeight[\s\S]*?function syncSearchModeMenuResultOffset\(\)[\s\S]*?--x-ov-suggestions-menu-fit-max-height[\s\S]*?fitModeMenuWithinViewport[\s\S]*?setModeMenuResultOffset[\s\S]*?ResizeObserver[\s\S]*?observe\(suggestionsContainer\)/,
  'overlay should use unscaled layout height before positioning the scope menu below results'
);
assert.match(
  overlaySuggestionsCss,
  /max-height:\s*min\([\s\S]*?--x-ov-suggestions-max-height[\s\S]*?--x-ov-suggestions-menu-fit-max-height/,
  'overlay result scrolling should honor the live scope-menu fit limit'
);
assert.match(
  newtabHtml,
  /max-height:\s*min\([\s\S]*?100vh - 220px[\s\S]*?--x-nt-suggestions-max-height[\s\S]*?--x-nt-suggestions-menu-fit-max-height/,
  'newtab result scrolling should honor the same live scope-menu fit limit'
);

assert.match(
  backgroundSource,
  /configuredSourceTypes\.filter\(\(sourceType\) => requestedSourceTypes\.includes\(sourceType\)\)/,
  'request-scoped sources should remain constrained by the user-enabled source settings'
);
assert.match(
  backgroundSource,
  /const allowOpenTabs = requestOptions\.includeOpenTabs !== false;/,
  'background search should allow local scopes to explicitly disable open-tab mixing'
);

assert.match(
  inputModeSource,
  /const explicitLabel = provider && provider\.tabHintLabel[\s\S]*?const label = explicitLabel \|\|[\s\S]*?site_search_tab_hint/,
  'shared Tab hint rendering should allow local scopes to override the site-search sentence'
);

const overlayTabKeySource = getFunctionSection(
  overlaySource,
  'handleTabKey',
  'handleSearchInputKeydown'
);
assert.match(
  overlayTabKeySource,
  /shouldOpenModeMenuOnDoubleTab\(e\)[\s\S]*?openSearchModeMenuFromDoubleTab\(\)/,
  'overlay empty-input Tab should use the shared two-press scope-menu trigger'
);
assert.match(
  overlayTabKeySource,
  /shouldOpenModeMenuOnDoubleTab\(e\)[\s\S]*?activateOpenTabsSearchMode\(\{[\s\S]*?preserveModeMenuDoubleTab: true[\s\S]*?\}\)/,
  'overlay first empty-input Tab should keep its established open-tabs search behavior'
);

[newtabSource, overlaySource].forEach((source, index) => {
  const surface = index === 0 ? 'newtab' : 'overlay';
  assert.match(
    source,
    /function getLocalSearchScopeTabHintProvider\(scope\)[\s\S]*?'local_search_tab_hint'[\s\S]*?'仅搜索\{source\}'/,
    `${surface} should use the dedicated local-search Tab hint copy`
  );
});

[
  ['en', 'Only search {source}'],
  ['zh_CN', '仅搜索{source}'],
  ['zh_TW', '僅搜尋{source}'],
  ['ja', '{source}のみ検索']
].forEach(([locale, expected]) => {
  const messages = JSON.parse(readSource(`_locales/${locale}/messages.json`));
  assert.strictEqual(
    messages.local_search_tab_hint && messages.local_search_tab_hint.message,
    expected,
    `${locale} should localize the category-only Tab hint`
  );
});

console.log('local search scope tests passed');
