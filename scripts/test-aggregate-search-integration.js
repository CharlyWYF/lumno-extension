const assert = require('assert');
const fs = require('fs');
const { readPageSource } = require('./helpers/page-source');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');

const read = (file) => fs.readFileSync(file, 'utf8');
const settings = require('../src/shared/settings.js');
const aggregateStore = require('../src/shared/aggregate-search-store.js');
const manifest = JSON.parse(read('manifest.json'));
const newtabHtml = readPageSource('newtab.html');
const newtabSource = readNewtabRuntimeSource();
const optionsHtml = readPageSource('src/options/options.html');
const optionsSource = read('src/options/options.js');
const overlayRuntimeSource = read('src/overlay/runtime.js');
const overlaySource = read('src/overlay/search-panel.js');
const backgroundSource = read('src/background/background.js');
const inputModeSource = read('src/shared/search-input-mode.js');
const surfaceSource = read('src/shared/aggregate-search-surface.js');

assert.ok(
  manifest.permissions.includes('tabs') && manifest.permissions.includes('tabGroups'),
  'aggregate searches require the existing tabs and tabGroups permissions'
);
assert.strictEqual(settings.AGGREGATE_SEARCH_STORAGE_KEY, aggregateStore.STORAGE_KEY);
assert.ok(
  settings.CHROME_SYNC_STORAGE_KEYS.includes(aggregateStore.STORAGE_KEY),
  'aggregate definitions must participate in the Chrome Sync contract'
);

assert.ok(
  newtabHtml.indexOf('../shared/aggregate-search-store.js') > -1 &&
    newtabHtml.indexOf('../shared/aggregate-search-store.js') <
      newtabHtml.indexOf('../shared/aggregate-search-surface.js') &&
    newtabHtml.indexOf('../shared/aggregate-search-surface.js') <
      newtabHtml.indexOf('data-page-entry="../newtab/newtab.js"'),
  'newtab must load the aggregate store and request controller before its page entry'
);
assert.ok(
  optionsHtml.includes('id="_x_extension_aggregate_search_list_2026_unique_"') &&
    optionsHtml.indexOf('../shared/aggregate-search-store.js') <
      optionsHtml.indexOf('data-page-entry="../options/options.js"'),
  'options must mount the aggregate editor and load its store first'
);
const customListIndex = optionsHtml.indexOf(
  'id="_x_extension_site_search_custom_list_2024_unique_"'
);
const customFormIndex = optionsHtml.indexOf(
  'class="_x_extension_shortcut_form_2024_unique_"',
  customListIndex
);
const aggregateGroupIndex = optionsHtml.indexOf(
  'id="_x_extension_aggregate_search_group_2026_unique_"'
);
const builtinSiteListIndex = optionsHtml.indexOf(
  'id="_x_extension_site_search_builtin_list_2024_unique_"'
);
assert.ok(
  customListIndex >= 0 &&
    customListIndex < customFormIndex &&
    customFormIndex < aggregateGroupIndex &&
    aggregateGroupIndex < builtinSiteListIndex,
  'options must place custom search above aggregate search and built-in search scopes'
);
assert.doesNotMatch(
  optionsHtml,
  /aggregate_search_group_desc/,
  'aggregate search must not render an extra description below its heading'
);
assert.match(
  optionsHtml,
  /id="_x_extension_aggregate_search_group_2026_unique_"[\s\S]*?id="_x_extension_aggregate_search_clear_2026_unique_"[^>]*_x_extension_shortcut_group_action_2024_unique_[\s\S]*?ri-delete-bin-4-line/,
  'aggregate search must expose the same header clear action as custom search'
);
assert.match(
  optionsSource,
  /createAggregateSearchListController\(aggregateSearchList,[\s\S]*?onRemove: handleAggregateSearchRemove,[\s\S]*?onSave: handleAggregateSearchSave/
);
assert.match(
  optionsSource,
  /apply\(prepared\) \{[\s\S]*?customSiteSearchProviders = prepared\.custom;[\s\S]*?customSiteSearchProviderIdsReady = true/,
  'aggregate references must only become available after the confirmed provider snapshot is applied'
);
const customProviderLoaderStart = optionsSource.indexOf('function loadCustomSiteSearchProviders(');
const customProviderLoaderEnd = optionsSource.indexOf(
  '\n  function loadDisabledSiteSearchKeys(',
  customProviderLoaderStart
);
const customProviderLoaderSource = optionsSource.slice(
  customProviderLoaderStart,
  customProviderLoaderEnd
);
assert.match(
  customProviderLoaderSource,
  /SETTINGS\.readStorageValue\([\s\S]*?\.then\(\(value\) => \{[\s\S]*?return items\.map\(/,
  'custom provider loading must return the normalized provider list from the storage promise'
);
assert.doesNotMatch(
  customProviderLoaderSource,
  /(^|\n)\s*resolve\(/,
  'custom provider loading must not call an out-of-scope Promise resolver'
);
assert.match(
  optionsSource,
  /function writeSiteSearchProviderState\(items, keys\)[\s\S]*?SETTINGS\.writeStorageValues\(rawStorageArea, chrome, payload\)/,
  'custom providers and their disabled built-in keys must be saved in one storage operation'
);
assert.doesNotMatch(
  optionsSource,
  /Promise\.all\(\[\s*saveCustomSiteSearchProviders\([\s\S]*?saveDisabledSiteSearchKeys\(/,
  'related custom-provider state must not be split across independent writes'
);
assert.match(
  optionsSource,
  /aggregate_search_source_summary_unavailable/,
  'options must identify aggregate definitions that require unavailable sources'
);
assert.match(
  optionsSource,
  /function handleAggregateSearchSave[\s\S]*?if \(!aggregateSearchesReady\)[\s\S]*?aggregate_search_storage_unavailable_error/,
  'options must block aggregate writes until the stored list has loaded successfully'
);
assert.match(
  optionsSource,
  /function handleAggregateSearchClear\(\)[\s\S]*?enqueueMutation\(\(\) => \(\{[\s\S]*?items: \[\][\s\S]*?toast_cleared/,
  'clearing aggregate searches must persist an empty schema and refresh the list'
);
assert.match(
  optionsSource,
  /function saveAggregateSearches\(items\)[\s\S]*?getSerializedStorageByteLength\([\s\S]*?SYNC_ITEM_BYTE_BUDGET[\s\S]*?aggregate-search-sync-item-quota-exceeded/,
  'aggregate definitions must be rejected before exceeding the Chrome Sync per-item budget'
);
assert.match(
  optionsSource,
  /attachPopconfirm\(\s*aggregateSearchClearButton,\s*'confirm_clear_aggregate_search',[\s\S]*?handleAggregateSearchClear/,
  'the aggregate clear action must use the shared confirmation interaction'
);

assert.match(overlayRuntimeSource, /aggregateSearches:\s*'_x_extension_aggregate_searches_2026_unique_'/);
assert.ok(
  backgroundSource.indexOf("'src/shared/aggregate-search-store.js'") > -1 &&
    backgroundSource.indexOf("'src/shared/aggregate-search-store.js'") <
      backgroundSource.indexOf("'src/shared/aggregate-search-surface.js'") &&
    backgroundSource.indexOf("'src/shared/aggregate-search-surface.js'") <
      backgroundSource.indexOf("'src/overlay/search-panel.js'"),
  'overlay injection must load the aggregate store and request controller before the search panel'
);

assert.match(surfaceSource, /action:\s*'runAggregateSearchQuery'/);
assert.match(surfaceSource, /const pending = new Set\(\)/);
assert.match(surfaceSource, /chromeApi\.runtime\s*&&\s*chromeApi\.runtime\.lastError/);
assert.match(surfaceSource, /aggregate_search_sources_unavailable_error/);
assert.match(surfaceSource, /aggregate_search_partial_failure/);
const sharedMessageStart = surfaceSource.indexOf('chromeApi.runtime.sendMessage({');
const sharedMessageEnd = surfaceSource.indexOf('}, finish);', sharedMessageStart);
const sharedMessageSource = surfaceSource.slice(sharedMessageStart, sharedMessageEnd);
assert.match(sharedMessageSource, /aggregateId,/);
assert.match(sharedMessageSource, /query,/);
assert.match(sharedMessageSource, /disposition/);
assert.doesNotMatch(sharedMessageSource, /provider:/);
assert.doesNotMatch(sharedMessageSource, /providers:/);
assert.doesNotMatch(sharedMessageSource, /urls:/);

[
  ['newtab', newtabSource, 'runSiteSearchProviderQuery'],
  ['overlay', overlaySource, 'openSiteSearchProviderQuery']
].forEach(([surface, source, functionName]) => {
  assert.match(
    source,
    /kind:\s*'aggregate'[\s\S]*?group:\s*aggregateGroup[\s\S]*?iconClass:\s*'ri-stack-line'/,
    `${surface} must expose aggregate definitions in the search scope menu`
  );
  const start = source.indexOf(`function ${functionName}(`);
  assert.ok(start >= 0, `${surface} aggregate execution function must exist`);
  const lineStart = source.lastIndexOf('\n', start) + 1;
  const indent = source.slice(lineStart, start);
  const nextFunction = source.indexOf(`\n${indent}function `, start + 1);
  const functionSource = source.slice(start, nextFunction >= 0 ? nextFunction : source.length);
  assert.match(functionSource, /getAggregateSearchRequestController\(\)/);
  assert.match(functionSource, /controller\.run\(\{/);
  assert.match(functionSource, /aggregateId:\s*String\(provider\.aggregateId\)/);
  assert.match(functionSource, /query:\s*trimmedQuery/);
  if (surface === 'overlay') {
    assert.match(
      functionSource,
      /getSuccessFeedbackDelayMs\(response\)[\s\S]*?setTimeout\(\(\) => \{[\s\S]*?finishOverlayResultActivation/
    );
  }
  assert.match(
    source,
    /const aggregateSearch = isAggregateSearchProvider\(siteSearchState\);[\s\S]*?if \(!aggregateSearch && !siteUrl\)/,
    `${surface} must keep an executable suggestion for aggregate scopes without a single URL`
  );
  assert.match(
    source,
    /isAggregateSearchDefinitionAvailable\(definition, providers\)/,
    `${surface} must hide aggregate scopes whose sources no longer resolve`
  );
  assert.match(
    source,
    /if \(!isAggregateSearchDefinitionAvailable\(activeDefinition, siteSearchProvidersCache\)\)[\s\S]*?clearSiteSearch\(\)/,
    `${surface} must clear an active aggregate scope when one of its sources is removed or disabled`
  );
  assert.match(
    source,
    /getSiteSearchProviders\(\),[\s\S]*?getAggregateSearches\(\)/,
    `${surface} must load custom providers before filtering aggregate scopes`
  );
  assert.match(
    source,
    /function getSearchTriggerProviders\(providers, definitions\)[\s\S]*?mergeTriggerProviders/,
    `${surface} must include valid aggregate triggers in the normal Tab trigger provider set`
  );
  assert.match(
    source,
    /if \(aggregateSearchesLoadPromise\) \{\s*return aggregateSearchesLoadPromise;/,
    `${surface} must reuse an in-flight aggregate storage read`
  );
  assert.match(
    source,
    /changes\[AGGREGATE_SEARCH_STORAGE_KEY\][\s\S]*?aggregateSearchesLoadVersion \+= 1;[\s\S]*?aggregateSearchesLoadPromise = null;/,
    `${surface} must invalidate an in-flight aggregate read when storage changes`
  );
});

assert.match(
  overlaySource,
  /const activeAggregateSearch = isAggregateSearchProvider\(siteSearchState\);[\s\S]*?if \(activeAggregateSearch\) \{\s*return;/,
  'overlay Enter handling must not fall through to a normal search while an aggregate request is pending'
);

assert.match(
  inputModeSource,
  /isAggregate[\s\S]*?iconClass: isAggregate \? 'ri-stack-line'/,
  'the active aggregate scope tag must use the aggregate icon'
);

['en', 'ja', 'zh_CN', 'zh_TW'].forEach((locale) => {
  const messages = JSON.parse(read(`_locales/${locale}/messages.json`));
  assert.ok(
    messages.aggregate_search_clear && messages.confirm_clear_aggregate_search,
    `${locale} must localize the aggregate clear action and confirmation`
  );
  assert.ok(
    messages.aggregate_search_key_placeholder &&
      messages.aggregate_search_source_summary_unavailable &&
      messages.aggregate_search_sources_unavailable_error &&
      messages.aggregate_search_in_progress &&
      messages.aggregate_search_partial_failure &&
      messages.aggregate_search_degraded_success &&
      messages.aggregate_search_storage_unavailable_error &&
      messages.aggregate_search_source_selection_unavailable_error,
    `${locale} must localize unavailable, in-progress, and partial-failure feedback`
  );
  assert.strictEqual(messages.aggregate_search_group_desc, undefined);
  assert.strictEqual(messages.aggregate_search_empty, undefined);
});

console.log('aggregate search integration tests passed');
