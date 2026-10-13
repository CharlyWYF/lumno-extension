const assert = require('assert');
const fs = require('fs');
const settings = require('../src/shared/settings.js');
const { readPageSource } = require('./helpers/page-source');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');

const optionsHtml = readPageSource('src/options/options.html');
const optionsSource = fs.readFileSync('src/options/options.js', 'utf8');
const newtabSource = readNewtabRuntimeSource();
const wallpaperViewSource = fs.readFileSync('react-src/newtab/wallpaper-view.tsx', 'utf8');
const wallpaperSource = fs.readFileSync('src/newtab/wallpaper.js', 'utf8');

const topContentIndex = optionsHtml.indexOf('data-i18n="settings_newtab_wordmark_title"');
const inputAutoFocusIndex = optionsHtml.indexOf('data-i18n="newtab_input_auto_focus_title"', topContentIndex);

assert(topContentIndex >= 0, 'options should keep the New Tab top-content setting');
assert(
  inputAutoFocusIndex > topContentIndex,
  'options should keep input auto-focus below the New Tab top-content setting'
);
assert.match(
  optionsHtml,
  /id="_x_extension_newtab_input_auto_focus_toggle_2026_unique_" type="checkbox" aria-label="输入框自动聚焦" data-i18n-aria-label="newtab_input_auto_focus_title"/,
  'options should expose an accessible input auto-focus switch that defaults to off'
);

assert.strictEqual(
  settings.NEWTAB_INPUT_AUTO_FOCUS_ENABLED_STORAGE_KEY,
  '_x_extension_newtab_input_auto_focus_enabled_2026_unique_'
);
assert(settings.CHROME_SYNC_STORAGE_KEYS.includes(settings.NEWTAB_INPUT_AUTO_FOCUS_ENABLED_STORAGE_KEY));
assert.match(
  newtabSource,
  /NEWTAB_INPUT_AUTO_FOCUS_ENABLED_STORAGE_KEY = SETTINGS\.NEWTAB_INPUT_AUTO_FOCUS_ENABLED_STORAGE_KEY/,
  'New Tab should continue to read the same shared preference key'
);
assert(
  wallpaperViewSource.indexOf("name=\"inputAutoFocusToggle\"") <
    wallpaperViewSource.indexOf("ref('shortcutsAccordion')"),
  'New Tab appearance should place shortcuts below input auto-focus'
);
assert.match(
  wallpaperViewSource,
  /<SectionTrigger(?:(?!\/>)[\s\S])*?expanded=\{false\}(?:(?!\/>)[\s\S])*?triggerRef="shortcutsAccordionTrigger"/,
  'New Tab appearance should render the shortcuts accordion collapsed by default'
);
assert.match(
  wallpaperSource,
  /wallpaperShortcutsAccordionTrigger\.disabled = !enabled/,
  'shortcut accordion should become unavailable when the main switch is off'
);
assert.match(
  optionsHtml,
  /_x_extension_newtab_shortcuts_toggle_2026_unique_/,
  'Options should keep a second entry for the shared New Tab shortcuts switch'
);

console.log('newtab input auto-focus setting tests passed');
