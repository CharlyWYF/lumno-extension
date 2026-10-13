const assert = require('assert');
const fs = require('fs');
const { readPageSource } = require('./helpers/page-source');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');

const read = (filePath) => fs.readFileSync(filePath, 'utf8');
const optionsHtml = readPageSource('src/options/options.html');
const optionsSource = read('src/options/options.js');
const newtabSource = readNewtabRuntimeSource();
const overlaySource = read('src/overlay/search-panel.js');
const readme = read('README.md');

assert.match(
  optionsHtml,
  /data-content="labs"[\s\S]*?settings_macos_ctrl_suggestion_navigation_title[\s\S]*?_x_extension_macos_ctrl_suggestion_navigation_toggle_2026_unique_/,
  'the opt-in control should live in Labs'
);
assert.ok(
  !optionsHtml.includes('_x_extension_macos_ctrl_suggestion_navigation_toggle_2026_unique_" type="checkbox" checked'),
  'the Labs experiment must render off by default'
);
assert.match(
  newtabSource,
  /MACOS_CTRL_SUGGESTION_NAVIGATION_ENABLED_STORAGE_KEY[\s\S]*?getSuggestionNavigationKey\(event/,
  'New Tab should load and use the experiment preference'
);
assert.match(
  overlaySource,
  /MACOS_CTRL_SUGGESTION_NAVIGATION_ENABLED_STORAGE_KEY[\s\S]*?getSuggestionNavigationKey\(e\)/,
  'Overlay should load and use the experiment preference'
);
assert.match(
  readme,
  /wanghanzhen[\s\S]*?pull\/38/,
  'Credits should retain the original contributor and PR attribution'
);

['en', 'ja', 'zh_CN', 'zh_TW'].forEach((locale) => {
  const messages = JSON.parse(read(`_locales/${locale}/messages.json`));
  assert.ok(messages.settings_macos_ctrl_suggestion_navigation_title?.message);
  assert.ok(messages.settings_macos_ctrl_suggestion_navigation_desc?.message);
});

console.log('macOS Ctrl suggestion navigation experiment tests passed');
