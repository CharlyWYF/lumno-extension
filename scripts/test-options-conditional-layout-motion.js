const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { readPageSource } = require('./helpers/page-source');

const repoRoot = path.resolve(__dirname, '..');
const optionsHtml = readPageSource('src/options/options.html');
const optionsJs = fs.readFileSync(
  path.join(repoRoot, 'src', 'options', 'options.js'),
  'utf8'
);

assert.match(
  optionsHtml,
  /#_x_extension_settings_panel_2024_unique_\[data-height-animating="true"\]\s*\{[\s\S]*?overflow:\s*clip;[\s\S]*?overflow-anchor:\s*none;[\s\S]*?will-change:\s*height;/,
  'the outer settings panel should clip and own the height animation'
);
assert.match(
  optionsHtml,
  /#_x_extension_settings_panel_2024_unique_\[data-height-animating="true"\]\s*>\s*\*\s*\{\s*flex-shrink:\s*0;/,
  'panel children should keep their natural height while the background stretches'
);
assert.match(
  optionsHtml,
  /#_x_extension_options_root_2024_unique_\s*\{[\s\S]*?--settings-focus-anchor-reserve:\s*0px;[\s\S]*?margin-bottom:\s*var\(--settings-focus-anchor-reserve\);/,
  'the page should expose transparent scroll reserve outside the white panel'
);
assert.match(
  optionsHtml,
  /\._x_extension_setting_row_2024_unique_\[hidden\][\s\S]*?display:\s*none\s*!important;/,
  'conditional settings should hide the complete row instead of only its control'
);


assert.match(
  optionsJs,
  /function updateBookmarkColumnsSettingVisibility\(countValue\)[\s\S]*?animateOptionsPanelHeight\([\s\S]*?bookmarkColumnsSettingRow/,
  'zero bookmark rows should hide the whole bookmarks-per-row setting through the panel animator'
);
assert.match(
  optionsJs,
  /function syncNewtabTimeSecondsVisibility\(\)[\s\S]*?animateOptionsPanelHeight\([\s\S]*?newtabTimeFontWeightRow,\s*newtabTimeFontSizeRow,\s*newtabTimeOpacityRow,\s*newtabTimeSecondsRow/,
  'time-only subsettings should share the panel height animator'
);
assert.match(
  optionsJs,
  /function updateRecentModeTabsVisibility\(countValue\)[\s\S]*?animateOptionsPanelHeight\([\s\S]*?recentModeTabsWrap/,
  'recent-site dependent controls should share the panel height animator'
);
assert.match(
  optionsJs,
  /function updateOverlayPageThemeAdaptationVisibility\(mode\)[\s\S]*?animateOptionsPanelHeight\([\s\S]*?overlayPageThemeAdaptationRow/,
  'system-theme dependent settings should share the panel height animator'
);

console.log('Options conditional layout motion tests passed.');
