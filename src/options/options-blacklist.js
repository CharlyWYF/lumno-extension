(function(root) {
  'use strict';

  // Rules for the search and favicon blacklists on the Options page. Rule
  // parsing itself lives in LumnoBlacklistUtils; this adds the editor's
  // presentation and how a saved rule joins the list. Results name a locale
  // message key in `error`.
  const DEFAULT_MATCH_MODE = 'prefix';

  function createBlacklistModel(deps) {
    const utils = deps.blacklistUtils;

    function normalizeMatchModes(value, fallbackMode) {
      return utils.normalizeMatchModes(value, fallbackMode === undefined ? DEFAULT_MATCH_MODE : fallbackMode);
    }

    function normalizeItems(items) {
      return utils.normalizeItems(items, DEFAULT_MATCH_MODE);
    }

    function buildItemKey(item) {
      return utils.buildRuleKey(item, DEFAULT_MATCH_MODE);
    }

    // 'exact' (this page), 'suffix' (the whole site) or 'prefix' (this path).
    function getMatchTone(modes) {
      const normalized = normalizeMatchModes(modes);
      if (normalized.includes('exact')) {
        return 'exact';
      }
      return normalized.includes('suffix') ? 'suffix' : 'prefix';
    }

    function formatPatternForDisplay(item) {
      if (!item || !item.pattern) {
        return '';
      }
      return normalizeMatchModes(item.matchModes).includes('suffix')
        ? item.pattern
        : `http(s)://${item.pattern}`;
    }

    // Label, placeholder and the fixed prefix shown before the input.
    function getInputConfig(modes) {
      const tone = getMatchTone(modes);
      return {
        labelKey: 'blacklist_label_url',
        labelFallback: 'URL rule',
        placeholderKey: tone === 'exact'
          ? 'blacklist_placeholder_exact'
          : (tone === 'suffix' ? 'blacklist_placeholder_domain' : 'blacklist_placeholder_prefix'),
        placeholderFallback: tone === 'exact'
          ? 'example.com/path'
          : (tone === 'suffix' ? 'baidu.com' : 'baidu.com or baidu.com/search'),
        prefixText: tone === 'suffix' ? '' : 'http(s)://'
      };
    }

    function buildRuleDraft(inputValue, matchModes) {
      if (!Array.isArray(matchModes) || matchModes.length === 0) {
        return { error: 'blacklist_error_match_mode' };
      }
      const pattern = utils.normalizePattern(inputValue, matchModes, null);
      if (!pattern) {
        return { error: matchModes.includes('suffix') ? 'blacklist_error_domain' : 'blacklist_error_url' };
      }
      return { item: { pattern, matchModes } };
    }

    // The saved rule goes first; it replaces the rule being edited and any
    // rule that already matches the same way.
    function upsertItems(items, nextItem, replacedRuleKey) {
      const nextKey = buildItemKey(nextItem);
      return [{ pattern: nextItem.pattern, matchModes: nextItem.matchModes }].concat(
        (items || []).filter((entry) => {
          const entryKey = buildItemKey(entry);
          return entryKey !== replacedRuleKey && entryKey !== nextKey;
        })
      );
    }

    return Object.freeze({
      buildItemKey,
      buildRuleDraft,
      formatPatternForDisplay,
      getInputConfig,
      getMatchTone,
      getPatternInputValue: (item) => utils.getPatternInputValue(item),
      normalizeItems,
      normalizeMatchModes,
      upsertItems
    });
  }

  const api = Object.freeze({ createBlacklistModel });
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.LumnoOptionsBlacklist = api;
})(globalThis);
