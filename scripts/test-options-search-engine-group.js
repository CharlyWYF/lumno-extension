const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { readPageSource } = require('./helpers/page-source');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');

const repoRoot = path.resolve(__dirname, '..');
const readSource = (relativePath) => fs.readFileSync(
  path.join(repoRoot, relativePath),
  'utf8'
);

const optionsHtml = readPageSource('src/options/options.html');
const optionsJs = readSource('src/options/options.js');
const newtabJs = readNewtabRuntimeSource();
const overlaySearchPanelJs = readSource('src/overlay/search-panel.js');
const engineGroupIndex = optionsHtml.indexOf('id="_x_extension_search_engine_group_2026_unique_"');
const customGroupIndex = optionsHtml.indexOf('data-i18n="shortcuts_group_custom"');
const siteGroupIndex = optionsHtml.indexOf('data-i18n="search_scope_group_sites"', customGroupIndex);
const aiGroupIndex = optionsHtml.indexOf('id="_x_extension_site_search_ai_group_2026_unique_"');

assert.ok(engineGroupIndex >= 0, 'Options should render a dedicated search-engine group');
assert.ok(
  customGroupIndex < siteGroupIndex && siteGroupIndex < aiGroupIndex && aiGroupIndex < engineGroupIndex,
  'Options should place the unified custom entry first and built-in search engines last'
);
assert.match(
  optionsHtml,
  /id="_x_extension_search_engine_builtin_list_2026_unique_"[^>]*_x_extension_shortcut_list_2024_unique_/,
  'Options should expose a dedicated React list host for built-in search engines'
);
assert.match(
  optionsJs,
  /const displayEngineDefaults = displayDefaults\.filter\(isSearchEngineSiteSearchProvider\);/,
  'Options should classify engines with the shared provider helper'
);
assert.match(
  optionsJs,
  /renderSiteSearchListController\(\s*siteSearchEngineBuiltinListController,\s*engineItems,/,
  'Options should render engines independently from site-search and AI providers'
);
assert.match(
  optionsJs,
  /secondaryBadgeText:[\s\S]*?isSearchEngine[\s\S]*?getMessage\('shortcuts_badge_builtin', '内置'\)/,
  'Built-in search-engine cards should include the built-in badge'
);
assert.match(
  optionsHtml,
  /<script src="\.\.\/shared\/shortcut-favicon\.js"><\/script>/,
  'Options should load the shared provider icon catalog'
);
assert.match(
  optionsJs,
  /SHORTCUT_FAVICON\.getSiteSearchPinnedIconAssetPath\(item\)/,
  'Options should reuse the exact same bundled provider tiles as the search-scope panel'
);
assert.match(
  optionsHtml,
  /data-site-search-category="site"[\s\S]*data-site-search-category="searchEngine"/,
  'The unified custom form should let users choose its search panel group'
);
assert.match(
  optionsHtml,
  /_x_extension_site_search_category_tabs_2026_unique_" role="group"[\s\S]*aria-pressed="true"[\s\S]*aria-pressed="false"/,
  'The custom provider group selector should expose button-group semantics'
);
[newtabJs, overlaySearchPanelJs].forEach((source, index) => {
  assert.doesNotMatch(
    source,
    /const isSearchEngine = !isCustom && isSearchEngineSiteSearchProvider\(provider\)/,
    `${index === 0 ? 'New tab' : 'Overlay'} should classify custom engines by category`
  );
  assert.match(
    source,
    /providers\s*\.filter\(\(provider\) => isSearchEngineSiteSearchProvider\(provider\)\)/,
    `${index === 0 ? 'New tab' : 'Overlay'} should group all search engines together`
  );
});

['en', 'ja', 'zh_CN', 'zh_TW'].forEach((locale) => {
  const messages = JSON.parse(readSource(`_locales/${locale}/messages.json`));
  assert.ok(
    messages.search_scope_group_engines && messages.search_scope_group_engines.message,
    `${locale} should localize the search-engine group`
  );
  assert.ok(
    messages.shortcuts_empty_engines && messages.shortcuts_empty_engines.message,
    `${locale} should localize the empty search-engine group`
  );
  assert.ok(
    messages.shortcuts_label_display_group && messages.shortcuts_label_display_group.message,
    `${locale} should localize the custom search group selector`
  );
});

console.log('options search-engine group tests passed');
