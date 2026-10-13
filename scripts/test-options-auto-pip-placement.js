const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { readPageSource } = require('./helpers/page-source');

const repoRoot = path.join(__dirname, '..');
const optionsHtml = readPageSource('src/options/options.html');
const optionsJs = fs.readFileSync(path.join(repoRoot, 'src/options/options.js'), 'utf8');

function getContentBlock(name) {
  const start = optionsHtml.indexOf(`data-content="${name}"`);
  assert.notStrictEqual(start, -1, `${name} settings content should exist`);
  const nextContent = optionsHtml.indexOf('class="_x_extension_settings_content_2024_unique_"', start + 1);
  const end = nextContent === -1 ? optionsHtml.length : nextContent;
  return optionsHtml.slice(start, end);
}

const generalContent = getContentBlock('general');
const accountContent = getContentBlock('account');
const labsContent = getContentBlock('labs');

const updateNoticeTitleIndex = generalContent.indexOf('data-i18n="settings_update_notice_title"');
const autoPipTitleIndex = generalContent.indexOf('data-i18n="settings_auto_pip_title"');
const tabSwitcherTitleIndex = generalContent.indexOf('data-i18n="settings_tab_switcher_title"');
const searchResultsSectionIndex = generalContent.indexOf('data-i18n="settings_search_results_section_title"');
const syncSectionTitleIndex = accountContent.indexOf('data-i18n="settings_sync_section_title"');
const syncTitleIndex = accountContent.indexOf('data-i18n="settings_sync_title"');

assert.notStrictEqual(updateNoticeTitleIndex, -1, 'update notice switch should live in general settings');
assert.notStrictEqual(autoPipTitleIndex, -1, 'auto picture-in-picture should live in general settings');
assert.notStrictEqual(tabSwitcherTitleIndex, -1, 'Alt+Q tab switcher should live in general settings');
assert.notStrictEqual(searchResultsSectionIndex, -1, 'general settings should include search results section');
assert.notStrictEqual(syncSectionTitleIndex, -1, 'account settings should label the sync method section');
assert.notStrictEqual(syncTitleIndex, -1, 'account settings should retain browser sync status');
assert.ok(syncSectionTitleIndex < syncTitleIndex, 'the sync method heading should appear above the browser sync row');
assert.match(
  optionsHtml,
  /\._x_extension_settings_content_2024_unique_\s*\{[^}]*padding-bottom:\s*0;/,
  'all settings pages should share bottom spacing without extra content padding'
);
assert.doesNotMatch(accountContent, /cloud_/,
  'account settings should not restore the paused account sync UI');
[
  ['_x_extension_sync_export_2024_unique_', 'sync_action_export'],
  ['_x_extension_sync_import_2024_unique_', 'sync_action_import'],
  ['_x_extension_sync_now_2024_unique_', 'sync_action_now']
].forEach(([id, i18nKey]) => {
  assert.match(
    accountContent,
    new RegExp(`<button[^>]+id="${id}"[\\s\\S]*?data-i18n="${i18nKey}"[\\s\\S]*?</button>`),
    `${i18nKey} should remain available on the browser sync row`
  );
});
assert.match(
  accountContent,
  /<input[^>]+id="_x_extension_sync_import_input_2024_unique_"[^>]+type="file"/,
  'browser sync import should retain its file input'
);
assert.doesNotMatch(
  generalContent,
  /data-i18n="settings_sync_title"/,
  'browser sync status should no longer appear in general settings'
);
assert.ok(
  updateNoticeTitleIndex < autoPipTitleIndex,
  'auto picture-in-picture should appear below the update notice switch'
);
assert.ok(
  autoPipTitleIndex < tabSwitcherTitleIndex && tabSwitcherTitleIndex < searchResultsSectionIndex,
  'Alt+Q tab switcher should appear directly after auto picture-in-picture and before search results settings'
);
assert.doesNotMatch(
  labsContent,
  /data-i18n="settings_auto_pip_title"/,
  'auto picture-in-picture should no longer appear in Labs'
);
assert.doesNotMatch(
  labsContent,
  /data-i18n="settings_tab_switcher_title"/,
  'Alt+Q tab switcher should no longer appear in Labs'
);

assert.match(
  optionsHtml,
  /id="_x_extension_update_notice_toggle_2026_unique_" type="checkbox" checked/,
  'update notice switch should default to checked in markup'
);

console.log('options auto PiP placement tests passed');
