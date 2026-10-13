const assert = require('assert');
const fs = require('fs');

const settings = require('../src/shared/settings.js');
const aggregateStore = require('../src/shared/aggregate-search-store.js');
const { readPageSource } = require('./helpers/page-source');
const optionsHtml = readPageSource('src/options/options.html');
const backgroundSource = fs.readFileSync('src/background/background.js', 'utf8');
const aggregateRuntimeSource = fs.readFileSync('src/background/aggregate-search.js', 'utf8');
const aggregateEditorSource = fs.readFileSync(
  'react-src/options/aggregate-search-list.tsx',
  'utf8'
);

const generalStart = optionsHtml.indexOf('data-content="general"');
const accountStart = optionsHtml.indexOf('data-content="account"', generalStart);
const generalPanel = optionsHtml.slice(generalStart, accountStart);
const tabSwitcherIndex = generalPanel.indexOf('settings_tab_switcher_title');
const aggregateGroupIndex = generalPanel.indexOf(
  'settings_aggregate_search_auto_group_title'
);

assert(generalStart >= 0 && accountStart > generalStart);
assert(
  aggregateGroupIndex > tabSwitcherIndex,
  'the aggregate tab-group setting must live on the General page'
);
assert.match(
  generalPanel,
  /id="_x_extension_aggregate_search_auto_group_toggle_2026_unique_" type="checkbox" aria-label="聚合搜索自动创建标签页组" data-i18n-aria-label="settings_aggregate_search_auto_group_title" checked>/,
  'the global aggregate tab-group setting should default to on'
);

assert.strictEqual(
  settings.AGGREGATE_SEARCH_AUTO_GROUP_ENABLED_STORAGE_KEY,
  '_x_extension_aggregate_search_auto_group_enabled_2026_unique_'
);
assert(settings.CHROME_SYNC_STORAGE_KEYS.includes(
  settings.AGGREGATE_SEARCH_AUTO_GROUP_ENABLED_STORAGE_KEY
));
assert.strictEqual(settings.normalizeAggregateSearchAutoGroupEnabled(undefined), true);
assert.strictEqual(settings.normalizeAggregateSearchAutoGroupEnabled(false), false);
assert.strictEqual(settings.normalizeAggregateSearchAutoGroupEnabled(true), true);


assert.doesNotMatch(
  aggregateEditorSource,
  /autoCreateTabGroup|autoGroupLabel|autoGroupDescription|namePlaceholder/,
  'the per-aggregate editor must not retain the old switch or example placeholder'
);
assert.match(aggregateEditorSource, /defaultNameBase/);
assert.match(aggregateEditorSource, /let ordinal = Math\.max\(1, items\.length \+ 1\)/);
const aggregateNameFieldIndex = aggregateEditorSource.indexOf('data-aggregate-field="name"');
const aggregateNameInputStart = aggregateEditorSource.lastIndexOf(
  '<input',
  aggregateNameFieldIndex
);
const aggregateNameInputEnd = aggregateEditorSource.indexOf('/>', aggregateNameFieldIndex);
assert(
  aggregateNameFieldIndex >= 0
    && aggregateNameInputStart >= 0
    && aggregateNameInputEnd > aggregateNameFieldIndex,
  'the aggregate name input must exist'
);
const aggregateNameInput = aggregateEditorSource.slice(
  aggregateNameInputStart,
  aggregateNameInputEnd + 2
);
assert.doesNotMatch(
  aggregateNameInput,
  /placeholder=/,
  'the aggregate name input must not restore the old example placeholder'
);
assert.match(
  aggregateEditorSource,
  /data-aggregate-field="key"[\s\S]*?placeholder=\{model\.copy\.keyPlaceholder\}/,
  'the aggregate trigger input should retain its localized placeholder'
);

const scopeProvider = aggregateStore.createScopeProvider({
  id: 'legacy',
  name: 'Legacy',
  sourceRefs: ['builtin:a', 'builtin:b'],
  autoCreateTabGroup: true
});
assert.strictEqual(
  Object.prototype.hasOwnProperty.call(scopeProvider, 'autoCreateTabGroup'),
  false,
  'search-scope providers must not cache a global preference'
);

assert.match(
  backgroundSource,
  /loadAggregateSearchAutoGroupEnabled\(\)[\s\S]*?SETTINGS\.readStorageValue\([\s\S]*?AGGREGATE_SEARCH_AUTO_GROUP_ENABLED_STORAGE_KEY/,
  'the background must read the authoritative setting for each aggregate run'
);
assert.match(
  aggregateRuntimeSource,
  /resolveAggregateSearchAutoGroupEnabled\([\s\S]*?autoGroupSetting,[\s\S]*?definitions[\s\S]*?\)/,
  'the runner must prefer the global value and retain the legacy migration fallback'
);

const expectedCopy = {
  en: {
    defaultName: 'Aggregate search',
    title: 'Automatically group aggregate search tabs'
  },
  ja: {
    defaultName: '一括検索',
    title: '一括検索のタブグループを自動作成'
  },
  zh_CN: {
    defaultName: '聚合搜索',
    title: '聚合搜索自动创建标签页组'
  },
  zh_TW: {
    defaultName: '彙整搜尋',
    title: '彙整搜尋自動建立分頁群組'
  }
};
Object.entries(expectedCopy).forEach(([locale, expected]) => {
  const messages = JSON.parse(fs.readFileSync(`_locales/${locale}/messages.json`, 'utf8'));
  assert.strictEqual(messages.aggregate_search_default_name.message, expected.defaultName);
  assert.strictEqual(
    messages.settings_aggregate_search_auto_group_title.message,
    expected.title
  );
  assert(messages.settings_aggregate_search_auto_group_desc.message.trim());
  assert(messages.aggregate_search_source_summary.message.includes('{count}'));
  assert.strictEqual(messages.aggregate_search_name_placeholder, undefined);
  assert.strictEqual(messages.aggregate_search_auto_group_label, undefined);
  assert.strictEqual(messages.aggregate_search_auto_group_desc, undefined);
  assert.strictEqual(messages.aggregate_search_source_summary_grouped, undefined);
  assert.strictEqual(messages.aggregate_search_source_summary_ungrouped, undefined);
});

console.log('aggregate search global setting tests passed');
