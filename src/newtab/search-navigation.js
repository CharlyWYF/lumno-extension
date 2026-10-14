(function(root) {
  // Keyword and direct-URL suggestions, open-tab matching and quick navigation.
  function createSearchNavigation(deps) {
    const {
      formatMessage,
      getExtensionResourceUrl,
      BROWSER_PROFILE,
      getPageFaviconCandidateUrl,
      SEARCH_UTILS,
      SUGGESTION_ACTION_MODEL,
      isBackgroundOpenEvent,
      getSurfaceOpenDisposition,
      recordSearchSuggestionSelection,
      navigateToUrl,
      suggestionItems,
      getAutoHighlightIndex,
      renderSuggestions,
      isSlashCommandInput,
      getCommandMatch,
      isModeCommand,
      isZenCommand,
      getNextThemeMode,
      setVisibleThemeMode,
      setZenModeEnabled,
      activateSiteSearch,
      focusSearchInputPreservingScroll,
      openCommunityQrDialog,
      runSiteSearchProviderQuery,
      navigateToQuery
    } = deps;

    // The page state object shared with newtab.js and the other modules.
    const pageState = deps.pageState;

    function getBrowserPageSuggestionTitle(browserProfile, targetUrl) {
      const browserName = browserProfile && browserProfile.name ? browserProfile.name : '';
      if (browserName) {
        return formatMessage('open_browser_url', '打开 {browser}：{url}', {
          browser: browserName,
          url: targetUrl
        });
      }
      return formatMessage('open_url', '打开 {url}', { url: targetUrl });
    }

    function getShortcutRules() {
      if (window._x_extension_shortcut_rules_2024_unique_) {
        return Promise.resolve(window._x_extension_shortcut_rules_2024_unique_);
      }
      if (window._x_extension_shortcut_rules_promise_2024_unique_) {
        return window._x_extension_shortcut_rules_promise_2024_unique_;
      }
      const rulesUrl = getExtensionResourceUrl('assets/data/shortcut-rules.json');
      const rulesPromise = fetch(rulesUrl)
        .then((response) => response.json())
        .then((data) => {
          const items = data && Array.isArray(data.items) ? data.items : [];
          window._x_extension_shortcut_rules_2024_unique_ = items;
          return items;
        })
        .catch(() => new Promise((resolve) => {
          if (!chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
            window._x_extension_shortcut_rules_2024_unique_ = [];
            resolve([]);
            return;
          }
          chrome.runtime.sendMessage({ action: 'getShortcutRules' }, (response) => {
            const items = response && Array.isArray(response.items) ? response.items : [];
            window._x_extension_shortcut_rules_2024_unique_ = items;
            resolve(items);
          });
        }));
      window._x_extension_shortcut_rules_promise_2024_unique_ = rulesPromise;
      return rulesPromise;
    }

    function buildKeywordSuggestions(input, rules) {
      const queryLower = input.toLowerCase();
      const browserProfile = BROWSER_PROFILE.getBrowserInternalProfile(navigator);
      const scheme = browserProfile.scheme;
      const matches = [];
      rules.forEach((rule) => {
        if (!rule || !Array.isArray(rule.keys)) {
          return;
        }
        const isMatch = rule.keys.some((key) => queryLower.startsWith(key));
        if (!isMatch) {
          return;
        }
        if (rule.type === 'browserPage' && rule.path) {
          if (!BROWSER_PROFILE.canOpenBrowserPages(scheme)) {
            return;
          }
          const targetUrl = `${scheme}${rule.path}`;
          matches.push({
            type: 'browserPage',
            title: getBrowserPageSuggestionTitle(browserProfile, targetUrl),
            url: targetUrl,
            favicon: getPageFaviconCandidateUrl(targetUrl) ||
              'https://img.icons8.com/?size=100&id=1LqgD1Q7n2fy&format=png&color=000000'
          });
        } else if (rule.type === 'url' && rule.url) {
          matches.push({
            type: 'browserPage',
            title: formatMessage('open_url', '打开 {url}', { url: rule.url }),
            url: rule.url,
            favicon: getPageFaviconCandidateUrl(rule.url) ||
              'https://img.icons8.com/?size=100&id=1LqgD1Q7n2fy&format=png&color=000000'
          });
        }
      });
      return matches;
    }

    function getDirectUrlSuggestion(input) {
      const targetUrl = getDirectNavigationUrl(input);
      if (!targetUrl) {
        return null;
      }
      const suggestion = {
        type: 'directUrl',
        title: formatMessage('open_url', '打开 {url}', { url: targetUrl }),
        url: targetUrl,
        favicon: getPageFaviconCandidateUrl(targetUrl)
      };
      const matchedTab = getMatchedOpenTabForSuggestion(suggestion);
      if (!matchedTab) {
        return suggestion;
      }
      return {
        ...suggestion,
        title: String(matchedTab.title || '').trim() || suggestion.title,
        favicon: String(matchedTab.favIconUrl || '').trim() || suggestion.favicon,
        _xMatchedTabId: matchedTab.id
      };
    }

    function getDirectNavigationUrl(input) {
      return SEARCH_UTILS.getDirectNavigationUrl(input);
    }

    function normalizeTabMatchUrl(url) {
      return SEARCH_UTILS.buildTabMatchUrl(url);
    }

    function getMatchedOpenTabForSuggestion(suggestion) {
      if (!suggestion || !suggestion.url || !Array.isArray(pageState.tabs) || pageState.tabs.length === 0) {
        return null;
      }
      const target = normalizeTabMatchUrl(suggestion.url);
      if (!target) {
        return null;
      }
      for (let i = 0; i < pageState.tabs.length; i += 1) {
        const tab = pageState.tabs[i];
        if (!tab || typeof tab.id !== 'number' || !tab.url) {
          continue;
        }
        const current = normalizeTabMatchUrl(tab.url);
        if (current && current === target) {
          return tab;
        }
      }
      return null;
    }

    function getMatchedOpenTabIdForSuggestion(suggestion) {
      const matchedTab = getMatchedOpenTabForSuggestion(suggestion);
      return matchedTab ? matchedTab.id : null;
    }

    function shouldSwitchMatchedTabSuggestion(suggestion) {
      if (!suggestion || typeof suggestion._xMatchedTabId !== 'number') {
        return false;
      }
      if (!pageState.openTabQuickSwitchEnabled) {
        return false;
      }
      return true;
    }

    function shouldUseNewTabForSwitchAction(suggestion, event, item) {
      if (!event || !event.shiftKey) {
        return false;
      }
      const action = item && item._xVisitButtonAction ? item._xVisitButtonAction : 'switch';
      return SUGGESTION_ACTION_MODEL.shouldOpenSwitchActionInNewTab(suggestion, {
        action,
        openSwitchInNewTab: true
      });
    }

    function shouldOpenSearchResultInBackgroundTab(event) {
      const config = {
        openInBackgroundTab: isBackgroundOpenEvent(event),
        openInCurrentTab: Boolean(event && event.altKey)
      };
      return SUGGESTION_ACTION_MODEL.getSearchResultOpenDisposition(config) === 'backgroundTab';
    }

    function getSearchResultNewTabDisposition(event) {
      return shouldOpenSearchResultInBackgroundTab(event) ? 'backgroundTab' : 'newTab';
    }

    // Option/Alt keeps a result in the current tab even when search results
    // are set to open in a new tab.
    function getSearchResultDisposition(event) {
      if (event && event.altKey) {
        return 'currentTab';
      }
      return getSurfaceOpenDisposition('search', shouldOpenSearchResultInBackgroundTab(event));
    }

    function openSearchResultUrl(suggestion, query, event) {
      if (!suggestion || !suggestion.url) {
        return false;
      }
      recordSearchSuggestionSelection(suggestion, query);
      const disposition = getSearchResultDisposition(event);
      if (disposition !== 'currentTab') {
        chrome.runtime.sendMessage({
          action: 'createTab',
          url: suggestion.url,
          disposition
        });
        return true;
      }
      navigateToUrl(suggestion.url);
      return true;
    }

    function openMatchedTabSuggestion(suggestion, event, item, query) {
      if (shouldUseNewTabForSwitchAction(suggestion, event, item) ||
          shouldOpenSearchResultInBackgroundTab(event)) {
        recordSearchSuggestionSelection(suggestion, query);
        chrome.runtime.sendMessage({
          action: 'createTab',
          url: suggestion.url,
          disposition: getSearchResultNewTabDisposition(event)
        });
        return;
      }
      chrome.runtime.sendMessage({
        action: 'switchToTab',
        tabId: suggestion._xMatchedTabId
      });
    }

    function refreshTabsForSearchContext(callback) {
      if (!chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
        if (typeof callback === 'function') {
          callback(false);
        }
        return;
      }
      const request = { action: 'getTabsForOverlay' };
      if (typeof pageState.currentNewtabTabId === 'number') {
        request.currentTabId = pageState.currentNewtabTabId;
      }
      let settled = false;
      let timeout = null;
      const finish = (ok) => {
        if (settled) {
          return;
        }
        settled = true;
        if (timeout !== null) {
          clearTimeout(timeout);
        }
        if (typeof callback === 'function') {
          callback(ok);
        }
      };
      timeout = setTimeout(() => finish(false), 240);
      chrome.runtime.sendMessage(request, (response) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          finish(false);
          return;
        }
        pageState.tabs = response && Array.isArray(response.tabs) ? response.tabs : [];
        pageState.currentNewtabTabId = response && typeof response.currentTabId === 'number'
          ? response.currentTabId
          : null;
        finish(true);
      });
    }

    // Warm the tab snapshot before the first URL input so a matched page can render
    // with its final title and switch action on the first visible frame.
    refreshTabsForSearchContext(() => {});

    function resolveQuickNavigation(query) {
      const directUrlSuggestion = getDirectUrlSuggestion(query);
      if (directUrlSuggestion) {
        return Promise.resolve(directUrlSuggestion.url);
      }
      return getShortcutRules().then((rules) => {
        const keywordSuggestions = buildKeywordSuggestions(query, rules);
        if (keywordSuggestions.length > 0) {
          return keywordSuggestions[0].url;
        }
        return null;
      });
    }

    // Enter in the search box: a typed command, the highlighted (or
    // automatically highlighted) suggestion, the active search scope, an
    // inline or autocompleted site, a quick-navigation target, and last a
    // web search.
    function submitSearchQuery(query, event) {
      const commandMatch = pageState.localSearchScopeState ? null : getCommandMatch(query);
      if (commandMatch && pageState.selectedIndex === -1) {
        if (commandMatch.command.type === 'commandNewTab') {
          chrome.runtime.sendMessage({ action: 'openNewTab' });
          return;
        }
        if (commandMatch.command.type === 'commandSettings') {
          chrome.runtime.sendMessage({ action: 'openOptionsPage' });
          return;
        }
      }
      if (!pageState.localSearchScopeState && isModeCommand(query)) {
        setVisibleThemeMode(getNextThemeMode(pageState.currentThemeMode));
        return;
      }
      if (!pageState.localSearchScopeState && isZenCommand(query)) {
        setZenModeEnabled(!pageState.zenModeEnabled);
        return;
      }
      const executeSuggestion = (selectedSuggestion, event, activeSuggestionIndex) => {
        if (!selectedSuggestion) {
          return false;
        }
        const activeItem = Number.isInteger(activeSuggestionIndex)
          ? suggestionItems[activeSuggestionIndex]
          : null;
        if (selectedSuggestion.type === 'modeSwitch') {
          setVisibleThemeMode(selectedSuggestion.nextMode);
          return true;
        }
        if (selectedSuggestion.type === 'zenSwitch') {
          setZenModeEnabled(selectedSuggestion.nextEnabled);
          return true;
        }
        if (selectedSuggestion.type === 'commandNewTab') {
          chrome.runtime.sendMessage({ action: 'openNewTab' });
          return true;
        }
        if (selectedSuggestion.type === 'commandSettings') {
          chrome.runtime.sendMessage({ action: 'openOptionsPage' });
          return true;
        }
        if (selectedSuggestion.type === 'siteSearchPrompt' && selectedSuggestion.provider) {
          activateSiteSearch(selectedSuggestion.provider);
          focusSearchInputPreservingScroll();
          return true;
        }
        if (selectedSuggestion.type === 'helpFeedback' && selectedSuggestion.feedbackKey === 'community') {
          openCommunityQrDialog(selectedSuggestion.url);
          return true;
        }
        if (selectedSuggestion.provider && selectedSuggestion.searchQuery) {
          return runSiteSearchProviderQuery(
            selectedSuggestion.provider,
            selectedSuggestion.searchQuery,
            getSearchResultDisposition(event)
          );
        }
        if (shouldSwitchMatchedTabSuggestion(selectedSuggestion, activeSuggestionIndex)) {
          openMatchedTabSuggestion(selectedSuggestion, event, activeItem, query);
          return true;
        }
        if (shouldOpenSearchResultInBackgroundTab(event) && selectedSuggestion.url) {
          return openSearchResultUrl(selectedSuggestion, query, event);
        }
        if (selectedSuggestion.forceSearch && selectedSuggestion.searchQuery) {
          navigateToQuery(selectedSuggestion.searchQuery, true, getSearchResultDisposition(event));
          return true;
        }
        if (selectedSuggestion.url) {
          return openSearchResultUrl(selectedSuggestion, query, event);
        }
        return false;
      };
      if (pageState.selectedIndex >= 0 && pageState.currentSuggestions[pageState.selectedIndex]) {
        if (executeSuggestion(pageState.currentSuggestions[pageState.selectedIndex], event, pageState.selectedIndex)) {
          return;
        }
      } else {
        const autoIndex = getAutoHighlightIndex();
        if (autoIndex >= 0 && pageState.currentSuggestions[autoIndex]) {
          if (executeSuggestion(pageState.currentSuggestions[autoIndex], event, autoIndex)) {
            return;
          }
        }
      }
      if (!pageState.localSearchScopeState && isSlashCommandInput(query)) {
        renderSuggestions([], query);
        return;
      }
      if (pageState.localSearchScopeState) {
        return;
      }
      if (pageState.siteSearchState) {
        if (runSiteSearchProviderQuery(
          pageState.siteSearchState,
          query,
          getSearchResultDisposition(event)
        )) {
          return;
        }
      }
      const currentRawInput = (pageState.latestRawQuery || pageState.inputParts.input.value || '').trim();
      if (pageState.inlineSearchState && pageState.inlineSearchState.isAuto &&
          pageState.inlineSearchState.rawInput === currentRawInput) {
        if (pageState.inlineSearchState.provider && pageState.inlineSearchState.query) {
          if (runSiteSearchProviderQuery(
            pageState.inlineSearchState.provider,
            pageState.inlineSearchState.query,
            getSearchResultDisposition(event)
          )) {
            return;
          }
        } else if (pageState.inlineSearchState.url) {
          openSearchResultUrl({
            url: pageState.inlineSearchState.url,
            title: pageState.inlineSearchState.url,
            type: 'inlineSiteSearch'
          }, query, event);
          return;
        }
      }
      if (pageState.autocompleteState && pageState.autocompleteState.url) {
        openSearchResultUrl({
          url: pageState.autocompleteState.url,
          title: pageState.autocompleteState.title || '',
          type: 'autocomplete'
        }, query, event);
        return;
      }
      resolveQuickNavigation(query).then((targetUrl) => {
        if (targetUrl) {
          openSearchResultUrl({
            url: targetUrl,
            title: query,
            type: 'quickNavigation'
          }, query, event);
          return;
        }
        navigateToQuery(query, false, getSearchResultDisposition(event));
      });
    }

    return {
      submitSearchQuery,
      getShortcutRules,
      buildKeywordSuggestions,
      getDirectUrlSuggestion,
      getDirectNavigationUrl,
      getMatchedOpenTabIdForSuggestion,
      shouldSwitchMatchedTabSuggestion,
      shouldOpenSearchResultInBackgroundTab,
      getSearchResultDisposition,
      openSearchResultUrl,
      openMatchedTabSuggestion,
      refreshTabsForSearchContext,
      resolveQuickNavigation
    };
  }

  // Arrow keys move the highlighted suggestion one step (`direction` 1 or
  // -1) and wrap around the list. With nothing selected yet, the step starts
  // from the automatically highlighted suggestion (`autoIndex`, -1 if none).
  function getNextSuggestionIndex(direction, selectedIndex, itemCount, autoIndex) {
    const count = Math.max(0, Math.floor(Number(itemCount) || 0));
    if (!count) {
      return { index: -1, didWrap: false };
    }
    const last = count - 1;
    const auto = Number.isInteger(autoIndex) ? autoIndex : -1;
    if (direction > 0) {
      if (selectedIndex === -1) {
        const index = auto >= 0 ? (auto + 1) % count : 0;
        return { index, didWrap: auto >= 0 && index === 0 };
      }
      const index = (selectedIndex + 1) % count;
      return { index, didWrap: selectedIndex === last && index === 0 };
    }
    if (selectedIndex === 0) {
      return { index: last, didWrap: true };
    }
    if (selectedIndex === -1) {
      return auto > 0 ? { index: auto - 1, didWrap: false } : { index: last, didWrap: true };
    }
    return { index: selectedIndex - 1, didWrap: false };
  }

  root.LumnoNewtabSearchNavigation = { createSearchNavigation, getNextSuggestionIndex };
  if (typeof module === 'object' && module.exports) {
    module.exports = root.LumnoNewtabSearchNavigation;
  }
})(globalThis);
