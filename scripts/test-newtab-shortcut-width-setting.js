const assert = require('assert');
const { readStylesheet } = require('./helpers/css-tokens');
const fs = require('fs');

const settings = require('../src/shared/settings.js');
const { readPageSource } = require('./helpers/page-source');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');
const optionsHtml = readPageSource('src/options/options.html');
const optionsSource = fs.readFileSync('src/options/options.js', 'utf8');
const newtabHtml = readPageSource('newtab.html');
const newtabSource = readNewtabRuntimeSource();
const shortcutDialogCss = readStylesheet('src/newtab/shortcut-dialog.css');
const rangeSliderSource = fs.readFileSync(
  'react-src/shared/range-slider.tsx',
  'utf8'
);
const settingsControlsSource = fs.readFileSync(
  'react-src/options/settings-controls.tsx',
  'utf8'
);
const rangeSliderCss = readStylesheet('src/shared/range-slider.css');
const locales = ['en', 'ja', 'zh_CN', 'zh_TW'];

// Keep the old width key readable and exportable so existing sync/import data
// can seed the new discrete column setting once.
assert.strictEqual(
  settings.NEWTAB_SHORTCUT_WIDTH_STORAGE_KEY,
  '_x_extension_newtab_shortcut_width_2026_unique_'
);
assert(settings.CHROME_SYNC_STORAGE_KEYS.includes(settings.NEWTAB_SHORTCUT_WIDTH_STORAGE_KEY));
assert.strictEqual(settings.normalizeNewtabShortcutWidth(undefined), 920);

assert.strictEqual(
  settings.NEWTAB_SHORTCUT_COLUMNS_STORAGE_KEY,
  '_x_extension_newtab_shortcut_columns_2026_unique_'
);
assert(settings.CHROME_SYNC_STORAGE_KEYS.includes(settings.NEWTAB_SHORTCUT_COLUMNS_STORAGE_KEY));
assert.strictEqual(settings.NEWTAB_SHORTCUT_COLUMNS_MIN, 4);
assert.strictEqual(settings.NEWTAB_SHORTCUT_COLUMNS_MAX, 16);
assert.strictEqual(settings.NEWTAB_SHORTCUT_COLUMNS_DEFAULT, 10);
assert.strictEqual(settings.normalizeNewtabShortcutColumns(undefined), 10);
assert.strictEqual(settings.normalizeNewtabShortcutColumns(3), 4);
assert.strictEqual(settings.normalizeNewtabShortcutColumns(10.6), 11);
assert.strictEqual(settings.normalizeNewtabShortcutColumns(17), 16);
assert.strictEqual(settings.inferNewtabShortcutColumnsFromWidth(360), 4);
assert.strictEqual(settings.inferNewtabShortcutColumnsFromWidth(920), 10);
assert.strictEqual(settings.inferNewtabShortcutColumnsFromWidth(1440), 16);
assert.strictEqual(settings.NEWTAB_SHORTCUT_SIZE_MIN, 48);
assert.strictEqual(settings.NEWTAB_SHORTCUT_SIZE_MAX, 80);
assert.strictEqual(settings.NEWTAB_SHORTCUT_SIZE_DEFAULT, 64);
assert.strictEqual(settings.NEWTAB_SHORTCUT_GAP_MIN, 0);
assert.strictEqual(settings.NEWTAB_SHORTCUT_GAP_MAX, 24);
assert.strictEqual(settings.NEWTAB_SHORTCUT_GAP_DEFAULT, 4);

// The appearance panel is a React view driven by the wallpaper runtime; its controls are
// tested by behavior in react-src/newtab/wallpaper-view.test.tsx and
// scripts/test-newtab-wallpaper-panel.js rather than by matching source text here.
assert.match(
  newtabSource,
  /shortcutColumnsConfig:\s*\{[\s\S]*?min:\s*NEWTAB_SHORTCUT_COLUMNS_MIN,[\s\S]*?max:\s*NEWTAB_SHORTCUT_COLUMNS_MAX,[\s\S]*?fallback:\s*NEWTAB_SHORTCUT_COLUMNS_DEFAULT/
);
assert.match(newtabSource, /setShortcutColumns:\s*setNewtabShortcutColumns/);
assert.match(
  newtabSource,
  /rawColumns === undefined[\s\S]*?inferNewtabShortcutColumnsFromWidth\(rawWidth\)[\s\S]*?normalizeNewtabShortcutColumns\(rawColumns\)/,
  'New Tab should migrate legacy pixel width only when the new column setting is absent'
);

assert.match(
  optionsHtml,
  /id="_x_extension_newtab_shortcut_columns_setting_row_2026_unique_"[\s\S]*?data-i18n="settings_newtab_shortcut_columns_title"[\s\S]*?id="_x_extension_newtab_shortcut_columns_control_2026_unique_"/,
  'Options should expose the same per-row shortcut slider host'
);
assert.match(
  optionsHtml,
  /settings_newtab_shortcut_columns_title[\s\S]*?settings_newtab_shortcut_size_title[\s\S]*?settings_newtab_shortcut_gap_title/,
  'Options should place size and spacing directly below shortcuts-per-row'
);
assert.match(
  optionsSource,
  /kind:\s*'newtab-shortcut-columns'[\s\S]*?label:\s*'4',[\s\S]*?label:\s*'8',[\s\S]*?label:\s*'12',[\s\S]*?label:\s*'16'/,
  'Options should render an editable slider with 4-step ticks'
);
assert.doesNotMatch(optionsSource, /snapPoints|snapThreshold/);
assert.match(
  rangeSliderSource,
  /RANGE_SLIDER_VALUE_INPUT_CLASS_NAMES[\s\S]*?_x_extension_shortcut_input_2024_unique_[\s\S]*?_x_extension_range_slider_value_input_2026_unique_/,
  'The shared slider component should reuse the existing input component appearance'
);
assert.match(
  rangeSliderSource,
  /RangeSliderResetButton[\s\S]*?ri-reset-left-line[\s\S]*?resetButtonProps/,
  'The shared slider field should own the reset IconButton contract'
);
assert.match(
  rangeSliderSource,
  /RangeSliderResetButton[\s\S]*?_x_extension_shortcut_group_action_2024_unique_[\s\S]*?'ri-size-14'[\s\S]*?'ri-reset-left-line'/,
  'The reset control should reuse the existing compact shortcut IconButton appearance'
);
assert.match(
  rangeSliderSource,
  /\{label === undefined \? resetButton : null\}[\s\S]*?\{label\}\s*\{resetButton\}/,
  'The shared reset IconButton should trail a field label, or hang beside the track when unlabelled'
);
assert.match(
  rangeSliderCss,
  /\.x-range-slider-reset:disabled\s*\{[\s\S]*?visibility:\s*hidden;/,
  'A reset with nothing to reset should disappear instead of showing a disabled control'
);
assert.match(
  rangeSliderCss,
  /_x_extension_range_slider_reset_button_2026_unique_[\s\S]*?padding:\s*4px;[\s\S]*?border-radius:\s*8px;/,
  'New Tab should provide the compact IconButton fallback appearance'
);
assert.doesNotMatch(
  optionsHtml,
  /_x_extension_range_slider_value_input_2026_unique_:(?:hover|focus|focus-visible|disabled)/,
  'The slider value input should not define a second Options interaction appearance'
);
assert.doesNotMatch(
  newtabHtml,
  /\.x-nt-range-slider-value-input/,
  'New Tab should not define a second slider value-input appearance'
);
assert.match(
  shortcutDialogCss,
  /\._x_extension_shortcut_input_2024_unique_\s*\{[\s\S]*?border:\s*1px solid var\(--tab-border\);[\s\S]*?background:\s*var\(--control-bg\);/,
  'New Tab slider values should use the existing input component appearance'
);
assert.doesNotMatch(settingsControlsSource, /snapPoints|snapThreshold|pointerActiveRef/);
assert.match(
  rangeSliderSource,
  /RANGE_SLIDER_VALUE_INPUT_STYLE[\s\S]*?height:\s*'var\(--x-range-slider-value-height, 30px\)',[\s\S]*?width:\s*'var\(--x-range-slider-value-width, 52px\)'/,
  'The shared slider value-input component should own a fixed, page-themeable size'
);
assert.match(
  rangeSliderSource,
  /RangeSliderFieldProps[\s\S]*?max:[\s\S]*?<RangeSlider[\s\S]*?max=\{max\}[\s\S]*?<RangeSliderValueInput[\s\S]*?sliderMax=\{max\}/,
  'The shared slider value-input component should own the slider maximum contract'
);
assert.match(
  settingsControlsSource,
  /<RangeSliderField[\s\S]*?max=\{model\.max\}[\s\S]*?valueInputProps=/,
  'Every Options slider should render its value input from the shared field component'
);
assert.match(
  optionsSource,
  /onInput\(value\)[\s\S]*?normalizeNewtabShortcutColumns\(value\)[\s\S]*?NEWTAB_SHORTCUT_COLUMNS_STORAGE_KEY/,
  'Options should persist slider and typed column changes'
);

const shortcutSectionStart = newtabHtml.indexOf('.x-nt-shortcuts-section {');
const shortcutSectionEnd = newtabHtml.indexOf('\n      }', shortcutSectionStart);
const shortcutSectionCss = newtabHtml.slice(shortcutSectionStart, shortcutSectionEnd);
assert.match(newtabHtml, /--x-nt-shortcut-columns:\s*10;/);
assert.match(
  shortcutSectionCss,
  /width:\s*min\(90vw,\s*var\(--x-nt-shortcuts-target-width,\s*692px\)\);/
);
assert.doesNotMatch(shortcutSectionCss, /--x-nt-shortcut-width/);
assert.match(
  newtabHtml,
  /\.x-nt-shortcuts-grid\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-wrap:\s*wrap;[\s\S]*?justify-content:\s*center;/,
  'Shortcut rows should center partial rows inside the configured per-row width'
);
assert.match(
  rangeSliderCss,
  /\.x-range-slider-field\s*\{[\s\S]*?align-items:\s*center;/,
  'Slider labels, tracks and value inputs should share one centered row'
);
assert.match(
  rangeSliderCss,
  /\.x-range-slider-input::-webkit-slider-thumb\s*\{[\s\S]*?margin-top:\s*calc\(\(var\(--x-range-slider-track-height\) - var\(--x-range-slider-thumb-size\)\) \/ 2\);/,
  'The shared slider thumb should stay centered on the track'
);
assert.doesNotMatch(
  newtabHtml,
  /\.x-nt-overlay-slider::-webkit-slider-(?:thumb|runnable-track)|\.x-nt-overlay-tick/,
  'New Tab should theme the shared slider instead of redrawing its track, thumb or ticks'
);
assert.match(
  newtabSource,
  /function applyNewtabShortcutColumns\(\)[\s\S]*?--x-nt-shortcut-columns[\s\S]*?String\(newtabShortcutColumns\)[\s\S]*?--x-nt-shortcuts-target-width/
);
assert.match(
  newtabSource,
  /function applyNewtabShortcutLayoutPreferences\(\)[\s\S]*?--x-nt-shortcut-user-tile-size[\s\S]*?--x-nt-shortcut-user-column-gap[\s\S]*?--x-nt-shortcut-user-row-gap[\s\S]*?applyNewtabShortcutColumns\(\)/,
  'Size and spacing should update the shared responsive shortcut tokens'
);
assert.match(
  newtabHtml,
  /--x-nt-shortcut-tile-size:\s*var\(--x-nt-shortcut-user-tile-size\);[\s\S]*?--x-nt-shortcuts-grid-row-gap:\s*var\(--x-nt-shortcut-user-row-gap\);/,
  'Default shortcut geometry should flow through user-controlled variables'
);
for (const density of ['compact', 'tiny']) {
  const densityRule = newtabHtml.match(
    new RegExp(`body\\[data-nt-bottom-dock-density="${density}"\\]\\s*\\{([^}]*)\\}`)
  );
  assert.ok(densityRule, `${density} dock density rule should exist`);
  assert.doesNotMatch(
    densityRule[1],
    /--x-nt-shortcut-(tile|icon|favicon)-size|--x-nt-shortcut-tile-padding|--x-nt-shortcuts-grid-(row|column)-gap/,
    `${density} dock density should keep the size and spacing chosen in Settings on short windows`
  );
  assert.match(
    densityRule[1],
    /--x-nt-shortcuts-grid-padding:\s*\d+px 8px \d+px;/,
    `${density} dock density should keep the horizontal padding the per-row width is computed from`
  );
}
assert.doesNotMatch(
  newtabHtml,
  /@media \(max-height:[^{]*\)\s*\{[^@]*?--x-nt-shortcut-tile-size:\s*min\(/,
  'Short viewports should not cap the shortcut size chosen in Settings'
);
assert.match(
  newtabSource,
  /function handleNewtabResize\(\)[\s\S]*?applyNewtabShortcutColumns\(\)/,
  'Responsive tile tokens should recompute the selected shortcut width after viewport changes'
);
assert.match(
  newtabSource,
  /NEWTAB_SHORTCUT_COLUMNS_STORAGE_KEY\][\s\S]*?normalizeNewtabShortcutColumns\(raw\)/
);

locales.forEach((locale) => {
  const messages = JSON.parse(fs.readFileSync(`_locales/${locale}/messages.json`, 'utf8'));
  assert(
    messages.settings_newtab_shortcut_columns_title &&
      String(messages.settings_newtab_shortcut_columns_title.message || '').trim(),
    `${locale} should localize the shortcuts-per-row setting`
  );
  [
    'settings_newtab_shortcut_size_title',
    'settings_newtab_shortcut_gap_title',
    'settings_newtab_shortcut_size_reset',
    'settings_newtab_shortcut_gap_reset'
  ].forEach((key) => {
    assert(
      messages[key] && String(messages[key].message || '').trim(),
      `${locale} should localize ${key}`
    );
  });
});

// Fractional or odd-margin icon sizes snap unevenly on 1x screens and push the
// favicon off center inside its rounded square while the size slider moves.
const roundToParityMatch = newtabSource.match(/function roundToParityOf\(value, reference\) \{[\s\S]*?\n  \}/);
assert.ok(roundToParityMatch, 'New Tab should round shortcut icon sizes to a matching parity');
const roundToParityOf = new Function(`${roundToParityMatch[0]}; return roundToParityOf;`)();
for (let size = settings.NEWTAB_SHORTCUT_SIZE_MIN; size <= settings.NEWTAB_SHORTCUT_SIZE_MAX; size++) {
  const iconSize = roundToParityOf(size * 0.75, size);
  const faviconSize = roundToParityOf(size * 0.4375, iconSize);
  assert.ok(Number.isInteger(iconSize) && Number.isInteger(faviconSize), `size ${size} should use whole pixels`);
  assert.strictEqual((size - iconSize) % 2, 0, `size ${size} should leave an even margin around the icon`);
  assert.strictEqual((iconSize - faviconSize) % 2, 0, `size ${size} should leave an even margin around the favicon`);
  assert.ok(Math.abs(iconSize - size * 0.75) <= 1, `size ${size} icon should stay within 1px of its ratio`);
  assert.ok(Math.abs(faviconSize - size * 0.4375) <= 1, `size ${size} favicon should stay within 1px of its ratio`);
}
assert.strictEqual(roundToParityOf(48, 64), 48, 'The default 64px tile should keep its 48px icon');
assert.strictEqual(roundToParityOf(28, 48), 28, 'The default 48px icon should keep its 28px favicon');
assert.match(
  newtabSource,
  /--x-nt-shortcut-user-icon-size', `\$\{iconSize\}px`[\s\S]*?--x-nt-shortcut-user-favicon-size', `\$\{faviconSize\}px`/,
  'Size changes should apply the rounded icon and favicon sizes'
);

console.log('New Tab shortcut column setting tests passed.');
