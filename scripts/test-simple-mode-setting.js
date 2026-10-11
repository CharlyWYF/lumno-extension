const assert = require('assert');
const fs = require('fs');
const settings = require('../src/shared/settings.js');
const { readPageSource } = require('./helpers/page-source');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');

const optionsHtml = readPageSource('src/options/options.html');
const optionsSource = fs.readFileSync('src/options/options.js', 'utf8');
const newtabHtml = readPageSource('newtab.html');
const newtabSource = readNewtabRuntimeSource();
const overlayRuntimeSource = fs.readFileSync('src/overlay/runtime.js', 'utf8');
const overlaySource = fs.readFileSync('src/overlay/search-panel.js', 'utf8');
const overlayCss = fs.readFileSync('src/overlay/suggestions-view.css', 'utf8');
const suggestionsSource = fs.readFileSync('react-src/search/suggestions.tsx', 'utf8');

const appearanceStart = optionsHtml.indexOf('data-content="appearance"');
const labsStart = optionsHtml.indexOf('data-content="labs"', appearanceStart);
const appearanceContent = optionsHtml.slice(appearanceStart, labsStart);
const motionIndex = appearanceContent.indexOf('data-i18n="settings_motion_effects_title"');
const simpleModeIndex = appearanceContent.indexOf('data-i18n="settings_simple_mode_title"');
const newtabSectionIndex = appearanceContent.indexOf('data-i18n="settings_newtab_section_title"');

assert(
  simpleModeIndex > motionIndex && simpleModeIndex < newtabSectionIndex,
  'simple mode should appear directly in the global Appearance group below motion effects'
);
assert.match(
  appearanceContent,
  /data-i18n="settings_simple_mode_desc">移除更多提示元素，使搜索框更简洁</,
  'the Simplified Chinese fallback should use the requested description'
);
assert.match(
  appearanceContent,
  /id="_x_extension_simple_mode_toggle_2026_unique_" type="checkbox">/,
  'simple mode should default to off in markup'
);

assert.strictEqual(
  settings.SIMPLE_MODE_ENABLED_STORAGE_KEY,
  '_x_extension_simple_mode_enabled_2026_unique_'
);
assert(settings.CHROME_SYNC_STORAGE_KEYS.includes(settings.SIMPLE_MODE_ENABLED_STORAGE_KEY));
assert.strictEqual(settings.normalizeSimpleModeEnabled(undefined), false);
assert.strictEqual(settings.normalizeSimpleModeEnabled(false), false);
assert.strictEqual(settings.normalizeSimpleModeEnabled(true), true);

assert.match(
  optionsSource,
  /simpleModeToggle\.addEventListener\('change'[\s\S]*?storageArea\.set\(\{ \[SIMPLE_MODE_ENABLED_STORAGE_KEY\]: next \}\)/,
  'options should persist simple mode immediately'
);
assert.match(
  optionsSource,
  /storageArea\.get\(\[SIMPLE_MODE_ENABLED_STORAGE_KEY\][\s\S]*?setOptionsToggleState\(simpleModeToggle, stored\)/,
  'options should restore simple mode from synchronized storage'
);

assert.match(
  newtabSource,
  /createSuggestionsView\(\{[\s\S]*?getHostFromUrl,[\s\S]*?getUrlDisplay,[\s\S]*?isSimpleModeEnabled: \(\) => simpleModeEnabled/,
  'New Tab should pass the live preference to the shared suggestions renderer'
);
assert.match(
  newtabSource,
  /title: simpleModeEnabled[\s\S]*?\? query[\s\S]*?: formatMessage\('search_query'/,
  'New Tab should remove the decorated Search label only in simple mode'
);
assert.match(
  overlayRuntimeSource,
  /simpleModeEnabled: '_x_extension_simple_mode_enabled_2026_unique_'/,
  'Overlay runtime should expose the synchronized preference key'
);
assert.match(
  overlaySource,
  /initialSimpleModeReady[\s\S]*?normalizeSimpleModeEnabled/,
  'Overlay should resolve simple mode before reveal'
);
assert.match(
  overlaySource,
  /createSuggestionsView\(\{[\s\S]*?getHostFromUrl,[\s\S]*?getUrlDisplay,[\s\S]*?isSimpleModeEnabled: \(\) => simpleModeEnabled/,
  'Overlay should pass the live preference to the shared suggestions renderer'
);

assert.match(suggestionsSource, /data-simple-mode=\{simpleMode \? 'true' : 'false'\}/);
assert.match(suggestionsSource, /if \(simpleMode\) \{\s*return options\.sanitizeDisplayText\(text\);/);
assert.match(suggestionsSource, /showSourceTags = !item\._xSimpleMode && !item\._xHasSwitchAction/);
assert.match(
  suggestionsSource,
  /function getSuggestionUrlLineText[\s\S]*?parsed\.hostname[\s\S]*?parsed\.pathname[\s\S]*?text=\{urlLineText\}/,
  'all search modes should share the compact host-and-path URL presentation'
);
assert.match(newtabHtml, /\.x-nt-suggestion-url-line \{[^}]*flex: 0 1000 auto;[^}]*min-width: 0;/);
assert.match(overlayCss, /\.x-ov-suggestion-url-line \{[^}]*flex: 0 1000 auto;[^}]*min-width: 0;/);
assert.doesNotMatch(newtabHtml, /\.x-nt-suggestion-url-line \{[^}]*max-width: 60%/, 'the URL line should use the room the title leaves');
assert.doesNotMatch(overlayCss, /\.x-ov-suggestion-url-line \{[^}]*max-width: 60%/, 'the URL line should use the room the title leaves');
assert.match(
  suggestionsSource,
  /const useTheme = visible && themed && !simpleMode;/,
  'simple mode utility actions should not inherit the site theme'
);
assert.match(
  suggestionsSource,
  /const useTheme =\s*!item\._xSimpleMode && \(/,
  'simple mode utility action hover should stay neutral'
);

const expectedCopy = {
  en: ['Minimal mode', 'Remove more decorative elements for a cleaner search box'],
  ja: ['シンプルモード', '装飾要素を減らし、検索ボックスをすっきり表示します'],
  zh_CN: ['简洁模式', '移除更多提示元素，使搜索框更简洁'],
  zh_TW: ['簡潔模式', '移除更多裝飾元素，讓搜尋框更整潔']
};
Object.entries(expectedCopy).forEach(([locale, [title, description]]) => {
  const messages = JSON.parse(fs.readFileSync(`_locales/${locale}/messages.json`, 'utf8'));
  assert.strictEqual(messages.settings_simple_mode_title.message, title);
  assert.strictEqual(messages.settings_simple_mode_desc.message, description);
});

console.log('simple mode setting tests passed');
