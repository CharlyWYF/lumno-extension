const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');
const search = require('../src/shared/search-utils.js');

const repoRoot = path.resolve(__dirname, '..');

function readSource(relativePath) {
  if (relativePath === 'src/newtab/newtab.js') {
    return readNewtabRuntimeSource();
  }
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function assertDirectNavigationDelegatesToShared(relativePath) {
  const source = readSource(relativePath);
  assert.ok(
    /function getDirectNavigationUrl\(input\)\s*\{[\s\S]*?(?:SEARCH_UTILS|searchUtils)\.getDirectNavigationUrl\(input\)/.test(source),
    `${relativePath} should delegate direct URL parsing to shared search utils`
  );
  assert.doesNotMatch(
    source,
    /function isNumericHostLike\(hostname\)|function isDevHostLike\(hostname\)|DIRECT_NAVIGATION_FALLBACK_SINGLE_COLON_PROTOCOLS|getDirectNavigationFallbackProtocol|isExplicitDirectNavigationFallbackUrl/,
    `${relativePath} should not keep a second direct URL parser`
  );
}

function assertTabMatchUrlDelegatesToShared(relativePath, options = {}) {
  const source = readSource(relativePath);
  const includeSearch = options.includeSearch !== false;
  const expectedCall = includeSearch
    ? /SEARCH_UTILS\.buildTabMatchUrl\(url\)/
    : /SEARCH_UTILS\.buildTabMatchUrl\(url,\s*\{\s*includeSearch:\s*false\s*\}\)/;
  const normalizerName = includeSearch
    ? 'normalizeTabMatchUrl'
    : 'normalizeTabMatchUrlWithoutSearch';
  const normalizerStart = new RegExp(`function ${normalizerName}\\(url\\)\\s*\\{`);
  const startIndex = source.search(normalizerStart);
  assert.ok(startIndex >= 0, `${relativePath} should define ${normalizerName}`);
  const normalizerSource = source.slice(startIndex, startIndex + 900);
  assert.match(
    normalizerSource,
    expectedCall,
    `${relativePath} should delegate ${normalizerName} to the shared port-aware URL matcher`
  );
}

function assertKeywordOnlySuggestionsKeepSearchActionFirst(relativePath) {
  const source = readSource(relativePath);
  assert.match(
    source,
    /function getKeywordSearchSuggestionState\(list\)\s*\{[\s\S]*?SEARCH_UTILS\.getKeywordSearchSuggestionState\(list\)/,
    `${relativePath} should delegate keyword-search suggestion state to shared search utils`
  );
  assert.match(
    source,
    /const keywordSuggestionState = getKeywordSearchSuggestionState\(allSuggestions\);\s*const onlyKeywordSuggestions = keywordSuggestionState\.onlyKeywordSuggestions;/,
    `${relativePath} should use the shared keyword-only suggestion state`
  );
  assert.match(
    source,
    /if \(onlyKeywordSuggestions\) \{\s*clearAutocomplete\(\);\s*\} else \{\s*applyAutocomplete\(allSuggestions,\s*primarySuggestion,\s*primaryHighlightReason\);\s*\}/,
    `${relativePath} should disable autocomplete when the only available results are keyword search suggestions`
  );
  assert.match(
    source,
    /const autocompleteSuggestions = getKeywordSearchSuggestionState\(allSuggestions\)\.autocompleteSuggestions;[\s\S]*?getDomainPrefixCandidate\(autocompleteSuggestions,/,
    `${relativePath} should use shared autocomplete filtering for inline autocomplete`
  );
}

function score(item, query, sourceType = 'history') {
  const context = search.buildSearchQueryContext(query);
  return search.calculateSearchRelevanceScore(item, sourceType, context, {
    getTitlePinyinMatchScore: () => ({ score: 0, reason: '' }),
    isLocalNetworkHost: () => false,
    isOwnExtensionUrl: () => false
  });
}

const shortAsciiContext = search.buildSearchQueryContext('x');
assert.strictEqual(
  search.matchesSearchQueryText({ title: 'Example Docs', url: 'https://example.com/docs' }, shortAsciiContext),
  false,
  'short ASCII terms should not match by loose contains'
);
assert.strictEqual(
  search.matchesSearchQueryText({ title: 'X Home', url: 'https://example.com/' }, shortAsciiContext),
  true,
  'short ASCII terms should still match title tokens'
);
assert.strictEqual(
  search.matchesSearchQueryText(
    { title: 'Final Cut Camera', url: 'https://apps.apple.com/final-cut-camera' },
    search.buildSearchQueryContext('fcc')
  ),
  true,
  'short ASCII terms should match multi-word title initials'
);
assert.strictEqual(
  search.matchesSearchQueryText(
    { title: 'SwitchBot', url: 'https://switchbot.example.com/' },
    search.buildSearchQueryContext('sb')
  ),
  true,
  'short ASCII terms should match camel-case title initials'
);
assert.strictEqual(
  search.matchesSearchQueryText(
    { title: 'Final Cut Camera', url: 'https://apps.apple.com/final-cut-camera' },
    search.buildSearchQueryContext('fcx')
  ),
  false,
  'title initials should not match unrelated letter combinations'
);

const multiTermContext = search.buildSearchQueryContext('codex 最爱');
assert.strictEqual(
  search.matchesSearchQueryText(
    { title: 'Codex workspace', url: 'https://example.com/tools' },
    multiTermContext
  ),
  false,
  'multi-term queries should not match when only one term is present'
);
assert.strictEqual(
  search.matchesSearchQueryText(
    { title: 'Codex workspace', url: 'https://example.com/最爱' },
    multiTermContext
  ),
  true,
  'multi-term queries should allow their terms to match across title and URL'
);

const releaseContext = search.buildSearchQueryContext('lumno release');
const releaseCoverage = search.getSearchTermCoverageStats(releaseContext, {
  titleLower: 'lumno',
  hostname: 'lumno.kubai.design',
  urlLower: 'https://lumno.kubai.design/release/',
  titleTokens: ['lumno'],
  hostLabels: ['lumno', 'kubai', 'design'],
  pathTokens: ['release']
});
assert.strictEqual(releaseCoverage.allMatched, true, 'title + path tokens should cover multi-term queries');

const rootScore = score({ title: 'Lumno', url: 'https://lumno.kubai.design/' }, 'lumno release', 'topSite');
const releaseScore = score({ title: 'Release | Lumno', url: 'https://lumno.kubai.design/release/' }, 'lumno release', 'history');
assert.ok(releaseScore > rootScore, 'specific release page should outrank root for path-intent queries');

const xiaohongshuContext = search.buildSearchQueryContext('小红书');
assert.strictEqual(
  search.getSearchSuggestionFamilyKey('https://mall.xiaohongshu.com/finance/cashier/web'),
  'xiaohongshu.com',
  'brand-family grouping should collapse sibling subdomains under one registrable domain'
);
assert.strictEqual(
  search.getSearchSuggestionFamilyKey('https://lumno.github.io/docs'),
  'lumno.github.io',
  'brand-family grouping should keep separate tenants on common hosted suffixes'
);
assert.strictEqual(
  search.getSearchSuggestionClusterInfo('https://mall.xiaohongshu.com/finance/cashier/web').category,
  'utility',
  'transactional utility segments should be recognized below the first path segment'
);
const xiaohongshuCashierScore = score({
  title: '小红书',
  url: 'https://mall.xiaohongshu.com/finance/cashier/web'
}, '小红书');
const xiaohongshuCreatorScore = score({
  title: '小红书创作服务平台',
  url: 'https://creator.xiaohongshu.com/'
}, '小红书');
assert.ok(
  xiaohongshuCreatorScore > xiaohongshuCashierScore,
  'a generic brand title on a deep utility page should not outrank a descriptive product root'
);
const xiaohongshuCandidates = [
  {
    type: 'history',
    title: '小红书',
    url: 'https://mall.xiaohongshu.com/finance/cashier/web',
    score: xiaohongshuCashierScore
  },
  {
    type: 'history',
    title: '小红书创作服务平台',
    url: 'https://creator.xiaohongshu.com/',
    score: xiaohongshuCreatorScore
  },
  {
    type: 'history',
    title: '小红书 - 你的生活兴趣社区',
    url: 'https://www.xiaohongshu.com/explore',
    score: 240
  },
  {
    type: 'history',
    title: '小红书 - 你的生活兴趣社区',
    url: 'https://www.xiaohongshu.com/explore/6a4dcb39000000001',
    score: 180
  }
];
const xiaohongshuOpenTab = {
  ...xiaohongshuCandidates[3],
  _xMatchedTabId: 26,
  score: 40
};
const xiaohongshuDirect = search.buildSearchBrandDirectSuggestion(
  xiaohongshuCandidates,
  xiaohongshuContext
);
assert.ok(
  xiaohongshuDirect &&
    xiaohongshuDirect.url === 'https://www.xiaohongshu.com/' &&
    xiaohongshuDirect.isBrandRepresentative === true,
  'an exact configured brand alias should synthesize its stable site representative when history lacks one'
);
const xiaohongshuDiverse = search.applySearchSuggestionHostDiversity(
  [
    xiaohongshuDirect,
    ...xiaohongshuCandidates.slice(0, 3),
    xiaohongshuOpenTab
  ].filter(Boolean),
  { context: xiaohongshuContext }
);
assert.ok(
  xiaohongshuDiverse.length <= 3 &&
    xiaohongshuDiverse.every((item) => search.getSearchSuggestionFamilyKey(item.url) === 'xiaohongshu.com'),
  'a pure brand query should cap one brand family at three local results'
);
assert.ok(
  xiaohongshuDiverse.some((item) => item && item._xMatchedTabId === 26),
  'a brand-family cap should reserve one slot for an already-open matching tab'
);
const xiaohongshuSlate = search.composeSearchSuggestionSlate([
  ...xiaohongshuDiverse,
  {
    type: 'googleSuggest',
    title: '小红书薯币购买',
    url: 'https://www.google.com/search?q=%E5%B0%8F%E7%BA%A2%E4%B9%A6%E8%96%AF%E5%B8%81%E8%B4%AD%E4%B9%B0'
  }
], xiaohongshuContext);
assert.strictEqual(
  xiaohongshuSlate[1]._xMatchedTabId,
  26,
  'an already-open brand page should stay ahead of supplemental search suggestions'
);
assert.strictEqual(
  xiaohongshuSlate[xiaohongshuSlate.length - 1].type,
  'googleSuggest',
  'brand result composition should keep search suggestions after the contiguous navigation group'
);
assert.ok(
  xiaohongshuSlate.slice(0, -1).every((item) => item.type !== 'googleSuggest'),
  'brand result composition should not interleave webpages and search suggestions'
);
assert.deepStrictEqual(
  search.groupSearchSuggestionsByKind([
    { type: 'history', title: 'Page A' },
    { type: 'googleSuggest', title: 'Search A' },
    { type: 'topSite', title: 'Page B' },
    { type: 'newtab', title: 'Search query' },
    { type: 'googleSuggest', title: 'Search B' }
  ]).map((item) => item.title),
  ['Page A', 'Page B', 'Search A', 'Search query', 'Search B'],
  'navigation-first mode should keep webpage and keyword-search blocks contiguous'
);
assert.deepStrictEqual(
  search.groupSearchSuggestionsByKind([
    { type: 'history', title: 'Page A' },
    { type: 'googleSuggest', title: 'Search A' },
    { type: 'newtab', title: 'Search query' }
  ], { searchFirst: true }).map((item) => item.title),
  ['Search A', 'Search query', 'Page A'],
  'search-first mode should move the whole search block instead of interleaving individual rows'
);
const searchFirstQuotaInput = [
  { type: 'history', title: 'History 1' },
  { type: 'history', title: 'History 2' },
  { type: 'history', title: 'History 3' },
  { type: 'bookmark', title: 'Bookmark 1' },
  { type: 'bookmark', title: 'Bookmark 2' },
  { type: 'topSite', title: 'Frequent 1' },
  { type: 'googleSuggest', title: 'Suggestion 1' },
  { type: 'googleSuggest', title: 'Suggestion 2' },
  { type: 'googleSuggest', title: 'Suggestion 3' },
  { type: 'googleSuggest', title: 'Suggestion 4' },
  { type: 'googleSuggest', title: 'Suggestion 5' },
  { type: 'newtab', title: 'Search query' }
];
const defaultSearchFirstSlate = search.composeSearchFirstSuggestionSlate(
  searchFirstQuotaInput,
  { limit: 10 }
).slice(0, 10);
assert.deepStrictEqual(
  defaultSearchFirstSlate.map((item) => item.type),
  [
    'newtab',
    'googleSuggest',
    'googleSuggest',
    'googleSuggest',
    'googleSuggest',
    'googleSuggest',
    'history',
    'history',
    'bookmark',
    'bookmark'
  ],
  'a ten-row search-first slate should reserve six search rows and cap history/bookmark to two initial local rows each'
);
assert.deepStrictEqual(
  search.composeSearchFirstSuggestionSlate(searchFirstQuotaInput, { limit: 5 })
    .slice(0, 5)
    .map((item) => item.type),
  ['newtab', 'googleSuggest', 'googleSuggest', 'history', 'bookmark'],
  'a five-row search-first slate should keep the same sixty-percent search allocation'
);
assert.deepStrictEqual(
  search.composeSearchFirstSuggestionSlate([
    { type: 'history', title: 'History 1' },
    { type: 'history', title: 'History 2' },
    { type: 'history', title: 'History 3' },
    { type: 'googleSuggest', title: 'Suggestion 1' },
    { type: 'googleSuggest', title: 'Suggestion 2' },
    { type: 'newtab', title: 'Search query' }
  ], { limit: 5 }).slice(0, 5).map((item) => item.type),
  ['newtab', 'googleSuggest', 'googleSuggest', 'history', 'history'],
  'unused local-source quota should backfill instead of leaving the result list empty'
);
const pinnedExactSearchActionSuggestions = search.pinExactSearchActionSecond([
  { type: 'history', title: 'Local A' },
  { type: 'history', title: 'Local B' },
  { type: 'googleSuggest', title: 'query suggestion' },
  { type: 'newtab', title: 'query', searchQuery: 'query', forceSearch: true }
]);
assert.deepStrictEqual(
  pinnedExactSearchActionSuggestions.map((item) => item.type),
  ['history', 'newtab', 'history', 'googleSuggest'],
  'autocomplete-first results should reserve the second row for the exact-query search action'
);
assert.deepStrictEqual(
  {
    title: pinnedExactSearchActionSuggestions[1].title,
    searchQuery: pinnedExactSearchActionSuggestions[1].searchQuery,
    forceSearch: pinnedExactSearchActionSuggestions[1].forceSearch
  },
  { title: 'query', searchQuery: 'query', forceSearch: true },
  'the pinned row should search exactly what the user entered instead of an autocomplete rewrite'
);
assert.deepStrictEqual(
  search.pinExactSearchActionSecond([
    { type: 'newtab', title: 'query', searchQuery: 'query', forceSearch: true },
    { type: 'googleSuggest', title: 'query suggestion' }
  ]).map((item) => item.type),
  ['newtab', 'googleSuggest'],
  'keyword-only results should keep the exact-query search action first'
);
assert.deepStrictEqual(
  search.pinExactSearchActionSecond([
    { type: 'googleSuggest', title: 'query suggestion' },
    { type: 'newtab', title: 'query', searchQuery: 'query', forceSearch: true },
    { type: 'bookmark', title: 'Local Bookmark' }
  ]).map((item) => item.type),
  ['bookmark', 'newtab', 'googleSuggest'],
  'the exact-query row should not be displaced by a search-engine autocomplete item'
);

const selectionNow = 1_800_000_000_000;
let selectionStats = search.normalizeSearchSelectionStats(null, { now: selectionNow });
for (let i = 0; i < 12; i += 1) {
  selectionStats = search.recordSearchSelectionInStats(selectionStats, {
    query: 'ProjectX',
    title: 'ProjectX | Selected Project',
    url: 'https://selected.example.com/',
    type: 'history'
  }, { now: selectionNow + i });
}
const selectionContext = search.buildSearchQueryContext('ProjectX');
const selectedCandidate = {
  title: 'ProjectX | Selected Project',
  url: 'https://selected.example.com/',
  visitCount: 5,
  lastVisitTime: selectionNow
};
const topSiteCandidate = {
  title: 'ProjectX',
  url: 'https://projectx.example.com/',
  visitCount: 40,
  lastVisitTime: selectionNow
};
const selectionOptions = {
  now: selectionNow + 12,
  getTitlePinyinMatchScore: () => ({ score: 0, reason: '' }),
  isLocalNetworkHost: () => false,
  isOwnExtensionUrl: () => false
};
const selectedScore = search.calculateSearchRelevanceScore(selectedCandidate, 'history', selectionContext, selectionOptions) +
  search.getSearchSelectionBoost(selectedCandidate, selectionContext, selectionStats, selectionOptions);
const topSiteScore = search.calculateSearchRelevanceScore(topSiteCandidate, 'topSite', selectionContext, selectionOptions);
assert.ok(
  selectedScore > topSiteScore,
  'query-specific selection history should be strong enough to outrank a generic top-site match'
);
const selectedSelectionBoost = search.getSearchSelectionBoost(
  selectedCandidate,
  selectionContext,
  selectionStats,
  selectionOptions
);
let brandDeepSelectionStats = search.normalizeSearchSelectionStats(null, { now: selectionNow });
brandDeepSelectionStats = search.recordSearchSelectionInStats(brandDeepSelectionStats, {
  query: '小红书',
  title: '小红书',
  url: 'https://mall.xiaohongshu.com/finance/cashier/web',
  type: 'history'
}, { now: selectionNow });
assert.strictEqual(
  search.getSearchSelectionBoost(
    {
      title: '小红书',
      url: 'https://mall.xiaohongshu.com/finance/cashier/web'
    },
    xiaohongshuContext,
    brandDeepSelectionStats,
    { now: selectionNow + 1 }
  ),
  search.SEARCH_POLICY.brandDeepSelectionBoostLimit,
  'one recent click should not give a deep page enough learned weight to take over a pure brand query'
);
const learnedNavigationList = [
  {
    type: 'topSite',
    title: topSiteCandidate.title,
    url: topSiteCandidate.url,
    isTopSite: true
  },
  {
    type: 'history',
    title: selectedCandidate.title,
    url: selectedCandidate.url,
    selectionBoost: selectedSelectionBoost
  }
];
const learnedNavigationMatch = search.promoteStrongNavigationMatch(learnedNavigationList, 'ProjectX');
assert.strictEqual(
  learnedNavigationMatch.url,
  selectedCandidate.url,
  'strong navigation promotion should respect query-specific selection boost'
);

const displaySuggestionItems = Array.from({ length: 12 }, (_, index) => ({
  type: 'history',
  title: `Result ${index + 1}`,
  url: `https://example.com/${index + 1}`
}));
assert.strictEqual(
  search.limitSearchSuggestionsForDisplay(displaySuggestionItems).length,
  10,
  'display suggestions should default to the shared visible-result cap'
);
assert.deepStrictEqual(
  search.limitSearchSuggestionsForDisplay(displaySuggestionItems, { limit: 5 }).map((item) => item.title),
  ['Result 1', 'Result 2', 'Result 3', 'Result 4', 'Result 5'],
  'display suggestion limiting should preserve ranking order'
);
assert.strictEqual(
  search.limitSearchSuggestionsForDisplay(displaySuggestionItems, { limit: 10 }).length,
  10,
  'display suggestions should accept the maximum configurable visible-result cap'
);
assert.strictEqual(
  search.limitSearchSuggestionsForDisplay(displaySuggestionItems, { limit: 11 }).length,
  10,
  'display suggestions should fall back to the shared cap for out-of-range values'
);
assert.deepStrictEqual(
  search.filterSearchSuggestionsBySourceTypes([
    { type: 'topSite', title: 'Frequent', url: 'https://frequent.example.com/' },
    { type: 'bookmark', title: 'Bookmark', url: 'https://bookmark.example.com/' },
    { type: 'history', title: 'History', url: 'https://history.example.com/' },
    { type: 'googleSuggest', title: 'Search Suggestion', url: 'https://google.example.com/' },
    { type: 'newtab', title: 'Search', url: 'https://search.example.com/' },
    { type: 'directUrl', title: 'Direct', url: 'https://direct.example.com/' }
  ], ['bookmark']).map((item) => item.type),
  ['bookmark', 'googleSuggest', 'newtab', 'directUrl'],
  'source filtering should only remove disabled local result types'
);
assert.deepStrictEqual(
  search.normalizeSearchEngineSuggestions([
    'foo',
    'foo bar',
    'Foo Bar',
    'foo baz',
    'foo qux'
  ], 'foo', { limit: 2 }),
  ['foo bar', 'foo baz'],
  'search engine suggestions should drop exact-query and duplicate items before applying the cap'
);
const keywordOnlySuggestionState = search.getKeywordSearchSuggestionState([
  { type: 'newtab', title: 'Search', url: 'https://www.google.com/search?q=foo' },
  { type: 'googleSuggest', title: 'foo bar', url: 'https://www.google.com/search?q=foo%20bar' }
]);
assert.strictEqual(
  keywordOnlySuggestionState.onlyKeywordSuggestions,
  true,
  'keyword-only state should cover the explicit search action plus engine suggestions'
);
assert.deepStrictEqual(
  keywordOnlySuggestionState.autocompleteSuggestions.map((item) => item.type),
  ['newtab', 'googleSuggest'],
  'keyword-only autocomplete pool can keep engine suggestions because there are no local results to outrank'
);
const mixedKeywordSuggestionState = search.getKeywordSearchSuggestionState([
  { type: 'newtab', title: 'Search', url: 'https://www.google.com/search?q=foo' },
  { type: 'googleSuggest', title: 'foo bar', url: 'https://www.google.com/search?q=foo%20bar' },
  { type: 'history', title: 'Foo Local', url: 'https://foo.example.com/' }
]);
assert.strictEqual(
  mixedKeywordSuggestionState.onlyKeywordSuggestions,
  false,
  'mixed local result state should not be treated as keyword-only'
);
assert.deepStrictEqual(
  mixedKeywordSuggestionState.autocompleteSuggestions.map((item) => item.type),
  ['newtab', 'history'],
  'engine suggestions should be removed from autocomplete candidates when local results exist'
);
const enginePolicyWithLocalResults = search.getSearchEngineSuggestionPolicy(
  search.buildSearchQueryContext('github'),
  [{ type: 'history', title: 'GitHub', url: 'https://github.com/' }],
  { maxEngineSuggestions: 5 }
);
assert.strictEqual(
  enginePolicyWithLocalResults.limit,
  3,
  'engine suggestion policy should allow up to three supplemental items when local results exist'
);
assert.ok(
  enginePolicyWithLocalResults.score <= 1,
  'engine suggestion policy should keep supplemental items below local result scores'
);
assert.strictEqual(
  search.getSearchEngineSuggestionPolicy(
    search.buildSearchQueryContext('github'),
    [{ type: 'history', title: 'GitHub', url: 'https://github.com/' }],
    { maxEngineSuggestions: 5, searchFirst: true }
  ).limit,
  5,
  'search-first mode should request the full engine-suggestion cap even when local results exist'
);
assert.strictEqual(
  search.getSearchEngineSuggestionPolicy(
    search.buildSearchQueryContext('什么东西'),
    [],
    { maxEngineSuggestions: 5 }
  ).limit,
  5,
  'engine suggestion policy should allow the full cap when no local results exist'
);
const engineSuggestionItems = [
  '什么东西补血',
  '什么东西解酒',
  '什么东西补钙',
  '什么东西补铁',
  '什么东西化痰'
].map((query) => ({
  type: 'googleSuggest',
  title: query,
  url: `https://www.google.com/search?q=${encodeURIComponent(query)}`
}));
assert.deepStrictEqual(
  search.applySearchSuggestionHostDiversity(engineSuggestionItems).map((item) => item.title),
  engineSuggestionItems.map((item) => item.title),
  'search engine keyword suggestions should not be collapsed by same-host diversity limits'
);

const navList = [
  { type: 'history', title: 'Example Blog Detail', url: 'https://example.com/blog/detail' },
  { type: 'history', title: 'Example Home', url: 'https://example.com/' }
];
const promoted = search.promoteStrongNavigationMatch(navList, 'example');
assert.strictEqual(promoted.title, 'Example Home', 'strong navigation promotion should choose representative pages');
assert.strictEqual(navList[0].title, 'Example Home', 'strong navigation promotion should mutate the list consistently');

const blobUrl = 'blob:https://example.com/6b44b52f-04bb-4dc9-8df3-5d979bd66d5f';
assert.strictEqual(
  search.getDirectNavigationUrl(blobUrl),
  blobUrl,
  'blob protocol URLs should be preserved as direct navigation targets'
);
[
  'file:///Users/kevinxu/Downloads/report.pdf',
  'view-source:https://example.com/',
  'mailto:hello@example.com',
  'magnet:?xt=urn:btih:0123456789abcdef',
  'vscode://file/Users/kevinxu/github/Lumno',
  'about:blank'
].forEach((directUrl) => {
  assert.strictEqual(
    search.getDirectNavigationUrl(directUrl),
    directUrl,
    `${directUrl} should be preserved as a direct navigation target`
  );
});
[
  'data:text/html,<script>alert(1)</script>',
  'data:text/plain,hello',
  'javascript:alert(1)',
  'JavaScript:alert(document.cookie)'
].forEach((input) => {
  assert.strictEqual(
    search.getDirectNavigationUrl(input),
    '',
    `${input} should be searched for instead of opened as a top-level page`
  );
});
[
  'https://wiki.corp.example/page?token=secret',
  'https://wiki.corp.example/page?token=secret more',
  'file:///Users/someone/contract.pdf',
  'C:\\Users\\someone\\contract.pdf',
  'example.com',
  'jira.internal/browse/SEC-1',
  '10.0.0.8:8080',
  'localhost:3000',
  'data:text/plain,hello',
  'mailto:someone@example.com'
].forEach((input) => {
  assert.strictEqual(search.isUrlLikeSearchQuery(input), true, `${input} should count as a URL-like query`);
});
['weather tomorrow', 'vue.js tutorial', 'c++ templates', 'site:example.com', ''].forEach((input) => {
  assert.strictEqual(search.isUrlLikeSearchQuery(input), false, `${input} should count as words to search`);
});
assert.strictEqual(
  search.getDirectNavigationUrl('example.com/docs'),
  'https://example.com/docs',
  'shared direct navigation should keep existing host-like input behavior'
);
assert.strictEqual(
  search.getDirectNavigationUrl('localhost:3000'),
  'https://localhost:3000',
  'host:port development inputs should keep direct navigation behavior'
);
assert.strictEqual(
  search.getDirectNavigationUrl('example.com:8080/docs'),
  'https://example.com:8080/docs',
  'host:port web inputs should keep direct navigation behavior'
);
assert.strictEqual(
  search.buildTabMatchUrl('http://127.0.0.1:8765/'),
  '127.0.0.1:8765/',
  'open-tab matching should preserve an explicit numeric-IP port'
);
assert.notStrictEqual(
  search.buildTabMatchUrl('http://127.0.0.1:8765/'),
  search.buildTabMatchUrl('https://127.0.0.1:5173/'),
  'numeric-IP URLs on different ports should not match the same open tab'
);
assert.strictEqual(
  search.buildTabMatchUrl('http://127.0.0.1:8765/path?mode=one', { includeSearch: false }),
  '127.0.0.1:8765/path',
  'current-page matching may ignore the query while still preserving the port'
);
assert.strictEqual(
  search.getDirectNavigationUrl('site:example.com'),
  '',
  'search operators should not be treated as direct custom protocol navigation'
);
assertDirectNavigationDelegatesToShared('src/newtab/newtab.js');
assertDirectNavigationDelegatesToShared('src/overlay/search-panel.js');
assertDirectNavigationDelegatesToShared('src/background/search-suggestions-service.js');
assertTabMatchUrlDelegatesToShared('src/newtab/newtab.js');
assertTabMatchUrlDelegatesToShared('src/overlay/search-panel.js');
assertTabMatchUrlDelegatesToShared('src/overlay/search-panel.js', { includeSearch: false });
assertKeywordOnlySuggestionsKeepSearchActionFirst('src/newtab/newtab.js');
assertKeywordOnlySuggestionsKeepSearchActionFirst('src/overlay/search-panel.js');

function testDirectNavigationUrl(input) {
  const raw = String(input || '').trim();
  if (!raw || /\s/.test(raw) || !raw.includes('.')) {
    return '';
  }
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

const complexUrlInput = 'apps.apple.com/cn/app/%E6%97%A5%E8%BF%99%E9%94%81%E5%B1%8F';
const unrelatedOpenTabSuggestion = {
  type: 'history',
  title: '(1) App Store / X',
  url: 'https://x.com/i/bookmarks/2057032873014652963',
  _xMatchedTabId: 42
};
const directComplexUrlSuggestion = {
  type: 'directUrl',
  title: `打开 https://${complexUrlInput}`,
  url: `https://${complexUrlInput}`
};
assert.strictEqual(
  search.isDirectNavigationMatch(unrelatedOpenTabSuggestion, complexUrlInput, {
    getDirectNavigationUrl: testDirectNavigationUrl
  }),
  false,
  'unrelated open tabs should not be treated as matches for a complex URL input'
);
assert.strictEqual(
  search.isDirectNavigationMatch(directComplexUrlSuggestion, complexUrlInput, {
    getDirectNavigationUrl: testDirectNavigationUrl
  }),
  true,
  'the direct open-url suggestion should be treated as the URL navigation match'
);
const complexNavigationList = [unrelatedOpenTabSuggestion, directComplexUrlSuggestion];
const complexPromoted = search.promoteStrongNavigationMatch(complexNavigationList, complexUrlInput, {
  getDirectNavigationUrl: testDirectNavigationUrl,
  getUrlDisplay: search.getDefaultNavigationUrlDisplay
});
assert.strictEqual(
  complexPromoted.url,
  directComplexUrlSuggestion.url,
  'complex URL navigation promotion should choose the direct open-url suggestion over unrelated open tabs'
);
assert.deepStrictEqual(
  search.findSearchOpenTabMatchIndex([
    directComplexUrlSuggestion,
    unrelatedOpenTabSuggestion
  ], {
    rawQuery: complexUrlInput,
    primaryHighlightIndex: 0,
    openTabQuickSwitchEnabled: true,
    getDirectNavigationUrl: testDirectNavigationUrl
  }),
  { index: -1, reason: '' },
  'open-tab promotion should not override a direct URL primary with an unrelated open tab'
);
assert.deepStrictEqual(
  search.findSearchOpenTabMatchIndex([
    { ...directComplexUrlSuggestion, _xMatchedTabId: 99 },
    unrelatedOpenTabSuggestion
  ], {
    rawQuery: complexUrlInput,
    primaryHighlightIndex: 0,
    openTabQuickSwitchEnabled: true,
    getDirectNavigationUrl: testDirectNavigationUrl
  }),
  { index: 0, reason: 'openTab' },
  'open-tab promotion should still recognize an already-open exact URL navigation match'
);
assert.deepStrictEqual(
  search.findSearchOpenTabMatchIndex([
    { type: 'newtab', title: 'Search', url: 'https://search.example.com/?q=github' },
    unrelatedOpenTabSuggestion
  ], {
    rawQuery: 'github',
    primaryHighlightIndex: -1,
    openTabQuickSwitchEnabled: true,
    getDirectNavigationUrl: testDirectNavigationUrl
  }),
  { index: 1, reason: 'openTab' },
  'open-tab promotion should continue to work for non-URL queries'
);
assert.doesNotThrow(
  () => search.findSearchOpenTabMatchIndex([
    directComplexUrlSuggestion,
    unrelatedOpenTabSuggestion
  ], {
    rawQuery: complexUrlInput,
    primaryHighlightIndex: 0,
    openTabQuickSwitchEnabled: true,
    getDirectNavigationUrl: () => {
      throw new Error('resolver unavailable');
    }
  }),
  'open-tab promotion should not break overlay rendering when direct URL resolution fails'
);

const xRootSuggestion = search.createSearchSuggestion({
  title: '(1) نوف | Nouf (@Nouf0633) / X',
  url: 'https://x.com/'
}, 'history', 100);
assert.strictEqual(xRootSuggestion.title, 'X', 'configured site roots should use stable direct titles');

const xProfileSuggestion = search.createSearchSuggestion({
  title: '(1) نوف | Nouf (@Nouf0633) / X',
  url: 'https://x.com/Nouf0633'
}, 'history', 100);
assert.strictEqual(xProfileSuggestion.title, '(1) نوف | Nouf (@Nouf0633) / X', 'configured titles should not replace profile paths');

const xBookmarkSuggestion = search.createSearchSuggestion({
  title: 'My X bookmark',
  url: 'https://x.com/'
}, 'bookmark', 100);
assert.strictEqual(xBookmarkSuggestion.title, 'My X bookmark', 'bookmark titles should remain user controlled');

const dedupUrl = search.buildSearchDedupUrlKey('https://www.example.com/docs/?utm_source=x&ref=abc&keep=1#section');
assert.strictEqual(dedupUrl, 'https://example.com/docs?keep=1', 'dedupe URL should drop tracking params and hashes');

const geminiBase = search.normalizeSiteSearchProvider({
  key: 'gm',
  aliases: ['gemini'],
  name: 'Gemini',
  template: 'https://gemini.google.com/app',
  action: 'openAndSubmit',
  submitStrategy: 'geminiPrompt'
});
assert.ok(search.isAiSiteSearchProvider(geminiBase), 'openAndSubmit provider should be AI');
assert.ok(search.isInteractiveSiteSearchProvider(geminiBase), 'Gemini provider should be interactive');

const defaultSearchEngines = search.getDefaultSiteSearchProviders()
  .filter(search.isSearchEngineSiteSearchProvider);
const currentPageProviders = search.getDefaultSiteSearchProviders();
assert.strictEqual(
  search.findSiteSearchProviderForPageUrl(
    'https://www.google.com/search?q=tail+scale+download',
    currentPageProviders
  ),
  null,
  'a Google results page should not be mistaken for Scholar or Maps'
);
assert.strictEqual(
  search.findSiteSearchProviderForPageUrl(
    'https://scholar.google.com/scholar?q=interaction+design',
    currentPageProviders
  ).key,
  'gs',
  'an exact Scholar page should still select Google Scholar'
);
assert.strictEqual(
  search.findSiteSearchProviderForPageUrl(
    'https://www.google.com/maps/place/Bangkok',
    currentPageProviders
  ).key,
  'maps',
  'a path-scoped service should match only inside its own Google Maps path'
);
assert.strictEqual(
  search.findSiteSearchProviderForPageUrl(
    'https://mail.google.com/mail/u/0/',
    currentPageProviders
  ),
  null,
  'a sibling Google service should not inherit the Maps provider'
);
assert.strictEqual(
  search.findSiteSearchProviderForPageUrl(
    'https://docs.github.com/en/get-started',
    currentPageProviders
  ).key,
  'gh',
  'a page below a provider host should still inherit that site-search provider'
);
const bundledSiteSearchProviders = JSON.parse(readSource('assets/data/site-search.json')).items;
assert.deepStrictEqual(
  search.getDefaultSiteSearchProviders(),
  bundledSiteSearchProviders,
  'the bundled provider catalog and JavaScript fallback should stay fully synchronized'
);
assert.deepStrictEqual(
  defaultSearchEngines.map((provider) => provider.key),
  ['bd', 'bi', 'gg', 'kg', 'ddg', 'br', 'eco', 'sg', 'yh', 'yx', 'sm'],
  'built-in search engines should be explicitly classified and keep their intended order'
);
assert.strictEqual(
  search.findSiteSearchProvider('so', search.getDefaultSiteSearchProviders()),
  null,
  'the retired Baidu so trigger should not match any built-in provider'
);
assert.strictEqual(
  search.findSiteSearchProvider('bd', search.getDefaultSiteSearchProviders()).name,
  'Baidu',
  'Baidu should use bd as its short trigger'
);
assert.ok(
  search.isAiSiteSearchProvider(
    search.getDefaultSiteSearchProviders().find((provider) => provider.key === 'pplx')
  ),
  'direct-query AI providers should be classified explicitly'
);
['pplx', 'metaso', 'felo'].forEach((providerKey) => {
  const provider = search.getDefaultSiteSearchProviders().find((item) => item.key === providerKey);
  assert.ok(provider, `${providerKey} should be bundled`);
  assert.strictEqual(provider.category, 'aiSearch');
  assert.strictEqual(
    search.isInteractiveSiteSearchProvider(provider),
    false,
    `${providerKey} should use its stable query URL without DOM submission`
  );
  assert.match(
    search.buildSearchUrlFromTemplate(provider.template, '中文 test'),
    /%E4%B8%AD%E6%96%87%20test/,
    `${providerKey} should URL-encode multilingual queries`
  );
});
['lm', 'lumno', '帮助中心', '說明中心', 'ヘルプセンター'].forEach((trigger) => {
  assert.strictEqual(
    (search.findSiteSearchProvider(trigger, search.getDefaultSiteSearchProviders()) || {}).key,
    'lm',
    `${trigger} should open the Lumno help center search`
  );
});
assert.strictEqual(
  search.buildSearchUrlFromTemplate(
    search.getDefaultSiteSearchProviders().find((item) => item.key === 'lm').template,
    '站内 搜索'
  ),
  'https://lumno.kubai.design/help/what-is-lumno/?entry=ext&q=%E7%AB%99%E5%86%85%20%E6%90%9C%E7%B4%A2',
  'the help center reads q and follows the reader language for extension entries'
);
assert.strictEqual(
  search.findSiteSearchProvider('help', search.getDefaultSiteSearchProviders()),
  null,
  'a generic word like help should not switch into Lumno help center search'
);
assert.strictEqual(
  search.isSearchEngineSiteSearchProvider({
    key: 'gg',
    category: 'site',
    _xIsCustom: true
  }),
  false,
  'a custom provider explicitly placed under site search should not inherit a built-in key category'
);
assert.strictEqual(
  search.normalizeSiteSearchProvider(
    { key: 'gg', category: 'site', template: 'https://example.com?q={query}' },
    { key: 'gg', category: 'searchEngine', template: 'https://google.com?q={query}' }
  ).category,
  'site',
  'an explicit custom site placement should survive normalization against a built-in engine'
);
assert.strictEqual(
  search.isSearchEngineSiteSearchProvider({
    key: 'custom-engine',
    category: 'searchEngine',
    _xIsCustom: true
  }),
  true,
  'a custom provider placed under search engines should be classified by its saved category'
);
assert.strictEqual(
  defaultSearchEngines.find((provider) => provider.key === 'ddg').template,
  'https://duckduckgo.com/?q={query}',
  'DuckDuckGo should use its official query URL'
);
assert.strictEqual(
  defaultSearchEngines.find((provider) => provider.key === 'br').template,
  'https://search.brave.com/search?q={query}',
  'Brave Search should use its public result URL'
);
assert.strictEqual(
  defaultSearchEngines.find((provider) => provider.key === 'kg').template,
  'https://kagi.com/search?q={query}',
  'Kagi should use its configured query URL'
);
assert.strictEqual(
  defaultSearchEngines.find((provider) => provider.key === 'eco').template,
  'https://www.ecosia.org/search?q={query}',
  'Ecosia should use its documented default-search URL'
);

const customizedGemini = search.normalizeSiteSearchProvider({
  key: 'gm',
  aliases: ['g'],
  name: 'Gemini Custom',
  template: 'https://gemini.google.com/app'
}, geminiBase);
assert.strictEqual(customizedGemini.action, 'openAndSubmit', 'customized provider should inherit action');
assert.strictEqual(customizedGemini.submitStrategy, 'geminiPrompt', 'customized provider should inherit submit strategy');

const renamedGemini = search.normalizeSiteSearchProvider({
  key: 'gmx',
  builtinKey: 'GM',
  aliases: ['gemini'],
  name: 'Gemini Renamed',
  template: 'https://gemini.google.com/app'
}, geminiBase);
assert.strictEqual(
  renamedGemini.builtinKey,
  'gm',
  'renamed built-in overrides should retain a normalized origin key'
);
assert.strictEqual(
  renamedGemini.action,
  'openAndSubmit',
  'renamed built-in overrides should inherit their origin behavior'
);
assert.strictEqual(
  search.sanitizeSiteSearchProviders([renamedGemini], [geminiBase])[0].submitStrategy,
  'geminiPrompt',
  'sanitization should resolve renamed overrides against their built-in origin'
);

const merged = search.mergeCustomProviders([geminiBase], [customizedGemini]);
assert.strictEqual(merged.length, 1, 'custom provider should replace same-key built-in provider');
assert.strictEqual(merged[0].action, 'openAndSubmit');
assert.strictEqual(merged[0]._xIsCustom, true, 'merged custom providers should retain their custom identity');

assert.deepStrictEqual(
  search.getSiteSearchProviderDisplayNameMessage({ key: 'dbai' }),
  { messageKey: 'site_search_name_doubao', fallback: 'Doubao' },
  'AI provider display names should resolve from shared mapping'
);
assert.deepStrictEqual(
  search.getSiteSearchProviderDisplayNameMessage({ key: 'jd' }),
  { messageKey: 'site_search_name_jd', fallback: 'JD.com' },
  'JD should resolve from the shared localized provider mapping'
);
assert.deepStrictEqual(
  search.getSiteSearchProviderDisplayNameMessage({ key: 'wx' }),
  { messageKey: 'site_search_name_wechat', fallback: 'WeChat Official Accounts' },
  'wechat provider display name should describe WeChat Official Accounts search'
);
assert.strictEqual(
  search.getSiteSearchProviderDisplayNameMessage({ key: 'unknown' }),
  null,
  'unknown provider display names should fall back to caller-owned name'
);
assert.strictEqual(
  search.getSiteSearchProviderDisplayNameMessage({
    key: 'db',
    name: 'Dribbble',
    _xIsCustom: true
  }),
  null,
  'custom providers should keep their user-defined names when a key matches a built-in provider'
);
const duplicateDbProvider = search.findSiteSearchProviderKeyConflict(
  'DB',
  [{ key: 'db', name: 'Douban' }],
  ''
);
assert.strictEqual(
  duplicateDbProvider && duplicateDbProvider.name,
  'Douban',
  'site-search trigger conflicts should be detected case-insensitively'
);
assert.strictEqual(
  search.findSiteSearchProviderKeyConflict(
    'db',
    [{ key: 'db', name: 'Douban' }],
    'db'
  ),
  null,
  'editing a provider should allow it to retain its current trigger'
);

const wechatProvider = search.getDefaultSiteSearchProviders().find((provider) => provider.key === 'wx');
assert.strictEqual(
  wechatProvider && wechatProvider.name,
  'WeChat Official Accounts',
  'default wechat provider name should describe WeChat Official Accounts search'
);
search.getDefaultSiteSearchProviders().forEach((provider) => {
  assert.strictEqual(
    provider.iconUrl,
    undefined,
    `${provider.key} should defer to the bundled local SVG map instead of a remote icon URL`
  );
});
assert.strictEqual(
  search.findProviderForSiteSearchSuggestion(
    {
      type: 'history',
      title: '下载',
      url: 'https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html'
    },
    [wechatProvider]
  ),
  null,
  'site-search provider inference should not treat arbitrary Weixin developer URLs as WeChat Official Accounts search'
);

assert.strictEqual(
  search.buildSearchUrlFromTemplate('https://example.com/search?q={searchTerms}', 'hello world'),
  'https://example.com/search?q=hello%20world',
  'searchTerms templates should normalize to query templates'
);

const githubProvider = {
  key: 'gh',
  aliases: ['github'],
  name: 'GitHub',
  template: 'https://github.com/search?q={query}'
};
const defaultSiteSearchProviders = search.getDefaultSiteSearchProviders();
defaultSiteSearchProviders.forEach((provider) => {
  const triggers = [provider.key].concat(provider.aliases || []);
  triggers.forEach((trigger) => {
    assert.strictEqual(
      search.getSiteSearchTriggerCandidate(trigger, defaultSiteSearchProviders, null),
      provider,
      `the configured site-search trigger "${trigger}" should expose the matching Tab hint`
    );
  });
});
assert.strictEqual(
  search.findSiteSearchProvider('github', [githubProvider]),
  githubProvider,
  'provider aliases should match site-search triggers'
);
const namedProvider = {
  key: 'forge',
  aliases: [],
  name: 'Code Forge',
  template: 'https://code.example.com/search?q={query}'
};
assert.strictEqual(
  search.findSiteSearchProvider('  Code Forge  ', [namedProvider]),
  namedProvider,
  'a trimmed exact provider title should match a site-search trigger'
);
assert.strictEqual(
  search.getSiteSearchTriggerCandidate('Code Forge', [namedProvider], null),
  namedProvider,
  'an exact multi-word provider title should expose the site-search trigger'
);
const aggregateProvider = {
  key: 'tech',
  aliases: [],
  name: 'Technology search',
  template: '',
  _xIsAggregateSearch: true
};
assert.strictEqual(
  search.findSiteSearchProvider('tech', [aggregateProvider]),
  aggregateProvider,
  'an aggregate search should match its configured trigger'
);
assert.strictEqual(
  search.findSiteSearchProvider('Technology search', [aggregateProvider]),
  null,
  'an aggregate search name must not become an implicit alias'
);
assert.strictEqual(
  search.getSiteSearchTriggerCandidate('tec', [aggregateProvider], null),
  null,
  'an aggregate trigger must require an exact match without implicit name aliases'
);
assert.strictEqual(
  search.findSiteSearchProviderByInput('docs.github.com lumno', [githubProvider]),
  githubProvider,
  'provider input parsing should match subdomains to provider hosts'
);
assert.strictEqual(
  search.getSiteSearchTriggerCandidate('github.com', [githubProvider], null),
  githubProvider,
  'an exact provider domain should expose the site-search trigger without requiring a short key'
);
assert.strictEqual(
  search.getSiteSearchTriggerCandidate('git', [githubProvider], null),
  null,
  'a partial provider title should not trigger site search without a matching local site result'
);
assert.strictEqual(
  search.getSiteSearchTriggerCandidate('github lumno', [githubProvider], null),
  null,
  'a provider followed by query text should remain an inline search candidate instead of a bare trigger'
);
assert.deepStrictEqual(
  search.getInlineSiteSearchCandidate('gh lumno extension', [githubProvider]),
  { provider: githubProvider, query: 'lumno extension' },
  'inline site-search parsing should preserve the query after the provider trigger'
);
assert.ok(
  search.suggestionMatchesSiteSearchProvider(
    { type: 'topSite', title: 'GitHub Docs', url: 'https://docs.github.com/' },
    githubProvider
  ),
  'provider host matching should accept subdomain suggestions'
);
assert.strictEqual(
  search.findProviderForSiteSearchSuggestion(
    { type: 'history', title: 'GitHub Docs', url: 'https://docs.github.com/' },
    [githubProvider]
  ),
  githubProvider,
  'provider suggestion matching should work for eligible suggestion types'
);
assert.strictEqual(
  search.getSiteSearchTriggerCandidate(
    'gh',
    [githubProvider],
    { type: 'topSite', title: 'GitLab', url: 'https://gitlab.com/' },
    { matchesTopSitePrefix: () => true }
  ),
  null,
  'short provider triggers should not hijack a mismatched top-site prefix'
);

const titledProvider = {
  key: 'apps',
  aliases: [],
  name: 'Apps Library',
  template: 'https://downloads.example.com/search?q={query}'
};
assert.strictEqual(
  search.getSiteSearchTriggerCandidate(
    'macked',
    [titledProvider],
    { type: 'topSite', title: 'MacKed - Mac Apps Library', url: 'https://downloads.example.com/' }
  ),
  titledProvider,
  'site-search triggers should allow the matched provider host to use the site title as a keyword'
);
assert.strictEqual(
  search.getSiteSearchTriggerCandidate(
    'macked',
    [titledProvider],
    { type: 'topSite', title: 'MacKed - Search Results', url: 'https://downloads.example.com/search?q=macked' }
  ),
  null,
  'site-search title matching should ignore provider search-result URLs to avoid query-title overlap'
);

assert.deepStrictEqual(
  search.applySearchSuggestionHostDiversity([
    { type: 'bookmark', title: 'Docs', url: 'https://notes.example.com/a/b', score: 400 },
    { type: 'history', title: 'React docs', url: 'https://react.dev/learn', score: 300 },
    { type: 'topSite', isTopSite: true, title: 'Google Docs', url: 'https://docs.google.com/', score: 60 }
  ], { context: search.buildSearchQueryContext('docs') }).map((item) => item.title),
  ['Docs', 'React docs', 'Google Docs'],
  'a reserved top-site slot should not jump ahead of stronger results'
);
assert.strictEqual(
  search.buildSearchDedupEntryKey({ title: 'GitHub', url: 'https://github.com/' }),
  search.buildSearchDedupEntryKey({ title: 'GH home', url: 'https://github.com/#top' }),
  'the same page under different titles should share one dedup key'
);
assert.strictEqual(
  search.isSearchLikelyBrandProductQuery(search.buildSearchQueryContext('notion calendar')),
  true,
  'a two-word query should be recognized as a brand-product query'
);
assert.strictEqual(
  search.isSearchLikelyBrandProductQuery(search.buildSearchQueryContext('notion calendar sync')),
  false,
  'a three-word query should not be treated as a brand-product query'
);

const shortcutRules = require('../assets/data/shortcut-rules.json').items;
assert.deepStrictEqual(
  search.findLocalSearchScope('  BOOKMARKS  ', shortcutRules),
  { sourceType: 'bookmark', trigger: 'bookmarks', key: 'bookmarks' },
  'bookmark scope should reuse the exact bundled English shortcut keyword'
);
assert.deepStrictEqual(
  search.findLocalSearchScope('历史', shortcutRules),
  { sourceType: 'history', trigger: '历史', key: '历史' },
  'history scope should reuse the exact bundled Chinese shortcut keyword'
);
assert.deepStrictEqual(
  search.findLocalSearchScope('常用', shortcutRules),
  { sourceType: 'topSite', trigger: '常用', key: '常用' },
  'frequent-site scope should expose a Chinese keyword'
);
assert.deepStrictEqual(
  search.findLocalSearchScope('top sites', shortcutRules),
  { sourceType: 'topSite', trigger: 'top sites', key: 'top sites' },
  'frequent-site scope should expose an English keyword'
);
assert.strictEqual(
  search.findLocalSearchScope('history today', shortcutRules),
  null,
  'local scopes should require an exact keyword so normal searches are not hijacked'
);

assert.strictEqual(search.normalizeHost('WWW.Example.COM'), 'example.com');
assert.strictEqual(search.normalizeHostIdentity('my.feishu.cn'), 'feishu.cn',
  'the Feishu account portal should share feishu.cn host identity for icons and site search');
assert.strictEqual(search.normalizeHostIdentity('www.my.feishu.cn'), 'feishu.cn');
assert.strictEqual(search.normalizeHostIdentity('docs.feishu.cn'), 'docs.feishu.cn');
assert.strictEqual(search.normalizeHost('my.feishu.cn'), 'my.feishu.cn',
  'search ranking, dedup and saved selection stats keep the plain host');
assert.strictEqual(search.normalizeHost(''), '');
assert.strictEqual(search.normalizeHost(null), '');
assert.strictEqual(
  search.sanitizeDisplayText('A\u0000B\u200BC\uFEFF\uE000D\uD800 \uD83D\uDE00'),
  'AB\u200BCD \uD83D\uDE00',
  'display text should drop control, BOM, private-use and lone-surrogate code points'
);
assert.strictEqual(search.sanitizeDisplayText(undefined), '');
// The provider list can arrive in the reader's Search sources order, which puts
// the search engines before or after the site searches. Resolving a suggestion
// to a provider must not depend on that order, and Google Maps must stay
// reachable next to the Google engine that shares its host.
{
  const registry = JSON.parse(fs.readFileSync(
    path.join(repoRoot, 'assets/data/site-search.json'),
    'utf8'
  )).items;
  const pick = (key) => registry.find((item) => item.key === key);
  const providerOrder = ['gg', 'maps', 'yt', 'zh'].map(pick);
  const reversedOrder = providerOrder.slice().reverse();
  const cases = [
    ['https://maps.google.com/maps', 'maps', 'a Maps URL'],
    ['https://www.google.com/maps/place/x', 'maps', 'a Maps route'],
    ['https://www.google.com/search?q=x', 'gg', 'a Google results page'],
    ['https://www.google.com/', 'gg', 'the Google root'],
    ['https://www.youtube.com/feed', 'yt', 'a YouTube page'],
    ['https://www.zhihu.com/question/1', 'zh', 'a Zhihu page']
  ];
  cases.forEach(([url, expectedKey, label]) => {
    const suggestion = { type: 'topSite', url };
    const forward = search.findProviderForSiteSearchSuggestion(suggestion, providerOrder);
    const reversed = search.findProviderForSiteSearchSuggestion(suggestion, reversedOrder);
    assert.strictEqual(
      forward && forward.key,
      expectedKey,
      `${label} should resolve to ${expectedKey}`
    );
    assert.strictEqual(
      reversed && reversed.key,
      expectedKey,
      `${label} should resolve the same way whatever the provider order is`
    );
  });
}

console.log('search utils tests passed');
