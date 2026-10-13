const assert = require('assert');
const fs = require('fs');

const settings = require('../src/shared/settings.js');
const pageTheme = require('../src/overlay/page-theme.js');
const { readPageSource } = require('./helpers/page-source');
const optionsHtml = readPageSource('src/options/options.html');
const optionsSource = fs.readFileSync('src/options/options.js', 'utf8');
const overlayRuntimeSource = fs.readFileSync('src/overlay/runtime.js', 'utf8');
const overlaySource = fs.readFileSync('src/overlay/search-panel.js', 'utf8');

const overlaySectionStart = optionsHtml.indexOf(
  'data-i18n="settings_webpage_focus_overlay_section_title"'
);
const newtabSectionStart = optionsHtml.indexOf(
  'data-i18n="settings_newtab_section_title"',
  overlaySectionStart
);
const overlaySection = optionsHtml.slice(overlaySectionStart, newtabSectionStart);
const sizeIndex = overlaySection.indexOf('data-i18n="settings_overlay_size_title"');
const animationIndex = overlaySection.indexOf(
  'data-i18n="settings_overlay_enter_animation_title"'
);
const adaptationIndex = overlaySection.indexOf(
  'data-i18n="settings_overlay_page_theme_adaptation_title"'
);

assert(
  overlaySectionStart >= 0 && newtabSectionStart > overlaySectionStart,
  'webpage focus overlay settings should appear above New Tab settings'
);
assert(sizeIndex >= 0 && animationIndex > sizeIndex, 'overlay appearance controls should exist');
assert(
  adaptationIndex > animationIndex,
  'webpage theme adaptation should be the final overlay appearance setting'
);
assert.match(
  overlaySection,
  /id="_x_extension_overlay_page_theme_adaptation_toggle_2026_unique_" type="checkbox" checked/,
  'webpage theme adaptation should default to enabled'
);
assert.match(
  overlaySection,
  /id="_x_extension_overlay_page_theme_adaptation_row_2026_unique_"/,
  'webpage theme adaptation should expose a dedicated visibility row'
);
assert.match(
  optionsHtml,
  /html\[data-options-theme-mode="light"\] #_x_extension_overlay_page_theme_adaptation_row_2026_unique_,[\s\S]*?html\[data-options-theme-mode="dark"\] #_x_extension_overlay_page_theme_adaptation_row_2026_unique_[\s\S]*?display: none !important;/,
  'explicit light and dark modes should hide webpage adaptation before the main options runtime starts'
);
assert.match(
  overlaySection,
  /id="_x_extension_overlay_page_theme_adaptation_info_2026_unique_"/,
  'the setting should expose a shared InfoButton host'
);
assert.match(
  optionsSource,
  /overlayPageThemeAdaptationInfoController\.render\([\s\S]*?settings_overlay_page_theme_adaptation_tooltip/,
  'the shared InfoButton should receive the localized disabled-behavior tooltip'
);
assert(
  !overlaySection.includes('title="'),
  'the setting should not leave a native title tooltip fallback'
);

assert.strictEqual(
  settings.OVERLAY_PAGE_THEME_ADAPTATION_ENABLED_STORAGE_KEY,
  '_x_extension_overlay_page_theme_adaptation_enabled_2026_unique_'
);
assert(settings.CHROME_SYNC_STORAGE_KEYS.includes(
  settings.OVERLAY_PAGE_THEME_ADAPTATION_ENABLED_STORAGE_KEY
));
assert.strictEqual(settings.normalizeOverlayPageThemeAdaptationEnabled(undefined), true);
assert.strictEqual(settings.normalizeOverlayPageThemeAdaptationEnabled(false), false);

assert.match(
  optionsSource,
  /function updateOverlayPageThemeAdaptationVisibility\(mode\)[\s\S]*?const visible = nextMode === 'system';[\s\S]*?animateOptionsPanelHeight\([\s\S]*?setConditionalSettingsElementVisibility\(overlayPageThemeAdaptationRow, visible\)/,
  'options should hide webpage adaptation outside follow-system-and-website mode'
);
assert.match(
  optionsSource,
  /function updateThemeButtons\(mode\)[\s\S]*?updateOverlayPageThemeAdaptationVisibility\(nextMode\);/,
  'theme initialization, clicks, and synchronized updates should all refresh adaptation visibility'
);
assert.match(
  overlayRuntimeSource,
  /overlayPageThemeAdaptationEnabled: '_x_extension_overlay_page_theme_adaptation_enabled_2026_unique_'/,
  'overlay runtime should expose the synchronized adaptation key'
);
assert.match(
  overlaySource,
  /pageThemeAdaptationEnabled: overlayPageThemeAdaptationEnabled/,
  'overlay theme resolution should receive the live adaptation preference'
);
assert.match(
  overlaySource,
  /return overlayPageTheme\.getCssColorThemeSignal\(color, weight\);/,
  'page background signals should preserve CSS alpha instead of treating transparent black as opaque black'
);
assert.match(
  overlaySource,
  /!changes\[THEME_STORAGE_KEY\][\s\S]*?!changes\[OVERLAY_PAGE_THEME_ADAPTATION_ENABLED_STORAGE_KEY\][\s\S]*?applyOverlayTheme\(nextMode\)/,
  'an open overlay should update immediately when either theme preference changes'
);

const cases = [
  [{ mode: 'system', pageTheme: 'light', systemTheme: 'dark' }, 'light'],
  [{ mode: 'system', pageTheme: 'light', systemTheme: 'dark', pageThemeAdaptationEnabled: false }, 'dark'],
  [{ mode: 'system', pageTheme: 'dark', systemTheme: 'light', pageThemeAdaptationEnabled: false }, 'light'],
  [{ mode: 'light', pageTheme: 'dark', systemTheme: 'dark', pageThemeAdaptationEnabled: false }, 'light'],
  [{ mode: 'dark', pageTheme: 'light', systemTheme: 'light', pageThemeAdaptationEnabled: false }, 'dark']
];
cases.forEach(([input, expected]) => {
  assert.strictEqual(pageTheme.resolveOverlayTheme(input), expected);
});

const backgroundCases = [
  [{ resolvedTheme: 'dark', pageTheme: 'light' }, true],
  [{ resolvedTheme: 'dark', pageTheme: 'dark' }, false],
  [{ resolvedTheme: 'dark', pageTheme: null }, false],
  [{ resolvedTheme: 'light', pageTheme: 'dark' }, false]
];
backgroundCases.forEach(([input, expected]) => {
  assert.strictEqual(pageTheme.shouldStrengthenDarkOverlayBackground(input), expected);
});
assert.match(
  overlaySource,
  /dark:\s*\{[\s\S]*?bg: 'rgba\(20, 20, 20, 0\.62\)'[\s\S]*?lightPageBg: 'rgba\(20, 20, 20, 0\.82\)'/,
  'dark mode should expose a stronger background only for light webpages'
);
assert.match(
  overlaySource,
  /const pageTheme = detectPageTheme\(\);[\s\S]*?resolveOverlayTheme\(mode, pageTheme\)[\s\S]*?shouldStrengthenDarkOverlayBackground\([\s\S]*?resolvedTheme: resolved,[\s\S]*?pageTheme/,
  'overlay rendering should keep detecting the webpage theme even when the user forces dark mode'
);
assert.match(
  overlaySource,
  /const applyOverlayTheme = \(mode\) => \{[\s\S]*?syncOverlayPageThemeObservation\(\);/,
  'theme application should synchronize page-theme observation through the shared policy'
);
const applyOverlayThemeSource = overlaySource.slice(
  overlaySource.indexOf('const applyOverlayTheme = (mode) => {'),
  overlaySource.indexOf('// 使用系统字体')
);
assert.doesNotMatch(
  applyOverlayThemeSource,
  /stopOverlayPageThemeObserver\(\)/,
  'explicit themes should not unconditionally tear down observation after policy synchronization'
);

const observationCases = [
  [{ mode: 'dark', pageThemeAdaptationEnabled: false, systemTheme: 'light' }, true],
  [{ mode: 'light', pageThemeAdaptationEnabled: true, systemTheme: 'dark' }, false],
  [{ mode: 'system', pageThemeAdaptationEnabled: true, systemTheme: 'light' }, true],
  [{ mode: 'system', pageThemeAdaptationEnabled: false, systemTheme: 'dark' }, true],
  [{ mode: 'system', pageThemeAdaptationEnabled: false, systemTheme: 'light' }, false]
];
observationCases.forEach(([input, expected]) => {
  const events = [];
  const actual = pageTheme.syncPageThemeObservation({
    ...input,
    start: () => events.push('start'),
    stop: () => events.push('stop')
  });
  assert.strictEqual(actual, expected);
  assert.deepStrictEqual(events, [expected ? 'start' : 'stop']);
});

const expectedCopy = {
  en: {
    title: 'Adapt theme colors to each webpage',
    tooltip: 'Shown only when Theme mode is set to Follow system. When turned off, light/dark mode will no longer adapt to the webpage theme color.',
    systemLabel: 'Follow system'
  },
  ja: {
    title: 'Web ページの色に合わせてテーマを自動変更',
    tooltip: '「テーマ」が「システムに従う」の場合にのみ表示されます。オフにすると、Web ページのテーマカラーに応じたライト／ダークモードの切り替えを行いません。',
    systemLabel: 'システムに従う'
  },
  zh_CN: {
    title: '基于网页色彩自动变更主题色',
    tooltip: '仅在“深浅色模式”=“跟随系统”时显示，关闭后将不再基于网页主题色变更深浅模式。',
    systemLabel: '跟随系统'
  },
  zh_TW: {
    title: '依網頁色彩自動變更主題色',
    tooltip: '僅在「深淺色模式」=「跟隨系統」時顯示，關閉後將不再依網頁主題色變更深淺模式。',
    systemLabel: '跟隨系統'
  }
};
Object.entries(expectedCopy).forEach(([locale, expected]) => {
  const messages = JSON.parse(fs.readFileSync(`_locales/${locale}/messages.json`, 'utf8'));
  const title = messages.settings_overlay_page_theme_adaptation_title.message;
  const tooltip = messages.settings_overlay_page_theme_adaptation_tooltip.message;
  const systemLabel = messages.settings_theme_system.message;
  assert.strictEqual(title, expected.title);
  assert.strictEqual(tooltip, expected.tooltip);
  assert.strictEqual(systemLabel, expected.systemLabel);
});

console.log('overlay page theme adaptation setting tests passed');
