const assert = require('assert');
const SEARCH_UTILS = require('../src/shared/search-utils.js');

// rankSearchSuggestionSlate is the highlight/ordering decision shared by the
// Overlay and the New Tab search box. These cases pin each highlight reason
// with simple surface matchers.

const searchAction = { type: 'newtab', title: 'Search "git"', url: 'https://search.test/?q=git', searchQuery: 'git' };
const history = { type: 'history', title: 'Git docs', url: 'https://git-scm.com/docs' };
const bookmark = { type: 'bookmark', title: 'GitHub', url: 'https://github.com/' };
const engine = { type: 'googleSuggest', title: 'git commit', url: 'https://search.test/?q=git+commit' };

function urlDisplay(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.replace(/^www\./, '')}${parsed.pathname === '/' ? '' : parsed.pathname}`;
  } catch (e) {
    return '';
  }
}

function moveFirst(list, suggestion) {
  const index = list.indexOf(suggestion);
  if (index > 0) {
    list.splice(index, 1);
    list.unshift(suggestion);
  }
  return suggestion;
}

function createMatchers(overrides) {
  return Object.assign({
    promoteStrongNavigationMatch: () => null,
    promoteTopSiteMatch: () => null,
    getSiteSearchTriggerCandidate: () => null,
    getAutocompleteCandidate: () => null,
    getUrlDisplay: urlDisplay,
    filterSuggestions: (list) => list
  }, overrides || {});
}

function rank(suggestions, options) {
  return SEARCH_UTILS.rankSearchSuggestionSlate(suggestions, Object.assign({
    query: 'git',
    rawQuery: 'git',
    triggerInput: 'git',
    providers: [],
    preferAutocompleteFirst: true,
    autocompleteSuggestions: suggestions.filter((item) => item.type !== 'newtab'),
    matchers: createMatchers()
  }, options || {}));
}

// Default: the first row is highlighted and the exact search action sits second.
{
  const input = [searchAction, history, bookmark];
  const result = rank(input);
  assert.deepStrictEqual(result.suggestions, [history, searchAction, bookmark],
    'the first local result leads and the search action is pinned second');
  assert.strictEqual(result.primaryHighlightIndex, 0);
  assert.strictEqual(result.primaryHighlightReason, 'default');
  assert.strictEqual(result.primarySuggestion, history);
  assert.deepStrictEqual(input, [searchAction, history, bookmark], 'the input list is not reordered');
}

// A strong navigation match wins the highlight.
{
  const result = rank([searchAction, history, bookmark], {
    matchers: createMatchers({
      promoteStrongNavigationMatch: (list) => moveFirst(list, bookmark)
    })
  });
  assert.strictEqual(result.primaryHighlightReason, 'navigation');
  assert.strictEqual(result.primarySuggestion, bookmark);
}

// The autocomplete target is moved to the front by URL, display URL or title.
{
  const result = rank([searchAction, history, bookmark], {
    matchers: createMatchers({
      getAutocompleteCandidate: (pool, rawQuery) => {
        assert.deepStrictEqual(pool, [history, bookmark],
          'autocomplete only considers the shared autocomplete pool, not the search action');
        assert.strictEqual(rawQuery, 'git', 'autocomplete sees the raw (untrimmed) query');
        return { completion: 'github.com', url: '' };
      }
    })
  });
  assert.strictEqual(result.primaryHighlightReason, 'autocomplete');
  assert.strictEqual(result.suggestions[0], bookmark);
}

// Keyword-only slates never autocomplete.
{
  const result = rank([searchAction, engine], {
    onlyKeywordSuggestions: true,
    matchers: createMatchers({
      getAutocompleteCandidate: () => assert.fail('keyword-only slates must not autocomplete')
    })
  });
  assert.strictEqual(result.primaryHighlightReason, 'default');
  assert.strictEqual(result.primarySuggestion, searchAction,
    'search-engine suggestions must not be promoted ahead of the explicit search action');
}

// Open-tab quick switch never replaces the first row of a keyword-only slate.
{
  const engineTab = Object.assign({}, engine, { _xMatchedTabId: 3 });
  const result = rank([searchAction, engineTab], {
    onlyKeywordSuggestions: true,
    openTabMatch: { openTabQuickSwitchEnabled: true }
  });
  assert.strictEqual(result.primarySuggestion, searchAction);
}

// An inline site search leads, passes through the surface filter, and
// suppresses local promotions.
{
  const inline = { type: 'inlineSiteSearch', title: 'Search GitHub', url: 'https://github.com/search?q=x' };
  const filtered = [];
  const result = rank([searchAction, history], {
    inlineSuggestion: inline,
    matchers: createMatchers({
      promoteStrongNavigationMatch: () => assert.fail('inline search skips navigation promotion'),
      filterSuggestions: (list) => {
        filtered.push(list.slice());
        return list;
      }
    })
  });
  assert.strictEqual(result.primaryHighlightReason, 'inline');
  assert.strictEqual(result.suggestions[0], inline);
  assert.strictEqual(filtered.length, 1, 'the inline row is filtered with the slate');
  assert.strictEqual(result.siteSearchTrigger, null, 'inline search has no Tab trigger');
}

// A promoted top site is highlighted and offered as the site-search trigger context.
{
  let triggerContext = null;
  const provider = { key: 'gh', name: 'GitHub' };
  const result = rank([searchAction, history, bookmark], {
    triggerInput: 'gh',
    providers: [provider],
    matchers: createMatchers({
      promoteTopSiteMatch: (list) => moveFirst(list, bookmark),
      getSiteSearchTriggerCandidate: (input, providers, topSiteMatch) => {
        triggerContext = { input, providers, topSiteMatch };
        return provider;
      }
    })
  });
  assert.strictEqual(result.primaryHighlightReason, 'topSite');
  assert.strictEqual(result.primarySuggestion, bookmark);
  assert.deepStrictEqual(triggerContext, { input: 'gh', providers: [provider], topSiteMatch: bookmark });
  assert.strictEqual(result.siteSearchTrigger, provider);
}

// A matching open tab is switched to when quick switch is enabled.
{
  const tabRow = Object.assign({}, history, { _xMatchedTabId: 7 });
  const options = {
    openTabMatch: { openTabQuickSwitchEnabled: true, currentTabId: 1 }
  };
  const result = rank([searchAction, bookmark, tabRow], options);
  assert.strictEqual(result.primaryHighlightReason, 'openTab');
  assert.strictEqual(result.suggestions[0], tabRow);

  const disabled = rank([searchAction, bookmark, tabRow], { openTabMatch: null });
  assert.strictEqual(disabled.primaryHighlightReason, 'default');

  const currentPage = rank([searchAction, bookmark, Object.assign({}, tabRow, { _xMatchedTabId: 1 })], {
    openTabMatch: { prioritizeCurrentPageMatch: true, currentTabId: 1, openTabQuickSwitchEnabled: false }
  });
  assert.strictEqual(currentPage.primaryHighlightReason, 'currentOpenTab');
}

// Search-first priority keeps the slate order and skips local promotions.
{
  const result = rank([searchAction, history, bookmark], {
    preferAutocompleteFirst: false,
    openTabMatch: { openTabQuickSwitchEnabled: true },
    matchers: createMatchers({
      promoteStrongNavigationMatch: () => assert.fail('search-first skips navigation promotion'),
      promoteTopSiteMatch: () => assert.fail('search-first skips top-site promotion'),
      getAutocompleteCandidate: () => assert.fail('search-first skips autocomplete')
    })
  });
  assert.deepStrictEqual(result.suggestions, [searchAction, history, bookmark]);
  assert.strictEqual(result.primaryHighlightReason, 'default');
  assert.strictEqual(result.primarySuggestion, searchAction);
}

// An active site-search tag keeps promotions and the Tab trigger off.
{
  const result = rank([searchAction, history], {
    siteSearchActive: true,
    matchers: createMatchers({
      getSiteSearchTriggerCandidate: () => assert.fail('an active tag has no Tab trigger')
    })
  });
  assert.strictEqual(result.siteSearchTrigger, null);
}

// Without a query nothing is highlighted by default.
{
  const result = rank([history], { query: '' });
  assert.strictEqual(result.primaryHighlightIndex, -1);
  assert.strictEqual(result.primarySuggestion, null);
  assert.strictEqual(result.mergedProvider, null);
}

console.log('search suggestion slate ranking tests passed');
