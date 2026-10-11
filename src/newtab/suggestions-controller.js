(function(root) {
  // Requesting, rendering and activating search suggestions.
  function createSuggestionsController(deps) {
    const {
      SUGGESTION_ACTION_MODEL,
      activateSiteSearch,
      focusSearchInputPreservingScroll,
      setVisibleThemeMode,
      setZenModeEnabled,
      shouldSwitchMatchedTabSuggestion,
      openMatchedTabSuggestion,
      runSiteSearchProviderQuery,
      shouldOpenSearchResultInBackgroundTab,
      getSearchResultDisposition,
      openSearchResultUrl,
      navigateToQuery,
      suggestionsContainer,
      suggestionItems,
      SUGGESTION_NAVIGATION,
      refreshTabsForSearchContext,
      clearSiteSearchTabHint,
      restoreUserAuthoredSearchInput,
      isSlashCommandInput,
      getShortcutRules,
      isModeCommand,
      isZenCommand,
      storageArea,
      THEME_STORAGE_KEY,
      NEWTAB_THEME_MODE_STORAGE_KEY,
      NEWTAB_THEME_SCOPE_STORAGE_KEY,
      normalizeThemeMode,
      normalizeNewtabThemeMode,
      normalizeNewtabThemeScope,
      getScopedThemeMode,
      applyThemeMode,
      getCommandMatches,
      buildModeSuggestion,
      buildZenSuggestion,
      buildCommandSuggestion,
      getDirectUrlSuggestion,
      buildKeywordSuggestions,
      defaultSiteSearchProviders,
      getSearchTriggerProviders,
      getSiteSearchProviders,
      getInlineSiteSearchCandidate,
      buildSearchUrl,
      getSiteSearchActionTitle,
      getProviderIcon,
      formatMessage,
      buildDefaultSearchUrl,
      getDefaultSearchEngineFaviconUrl,
      isAggregateSearchProvider,
      SEARCH_UTILS,
      getMatchedOpenTabIdForSuggestion,
      filterBlacklistedSuggestions,
      getKeywordSearchSuggestionState,
      promoteStrongNavigationMatch,
      promoteTopSiteMatch,
      getSiteSearchTriggerCandidate,
      getAutocompleteCandidate,
      getUrlDisplay,
      getDirectNavigationUrl,
      findProviderForSuggestionMatch,
      clearAutocomplete,
      applyAutocomplete,
      getLocalSearchScopeCandidate,
      setSiteSearchTabHint,
      getLocalSearchScopeTabHintProvider,
      limitSuggestionsForDisplay,
      t,
      warmIconCache,
      setSuggestionsVisible,
      NEWTAB_DIRECT_NAVIGATION_SETTLE,
      sendRuntimeMessage,
      HELP_CENTER_SEARCH,
      COMMUNITY_LINKS,
      getHelpCenterLocale
    } = deps;

    // Page state still owned by newtab.js; read and written through accessors.
    const pageState = deps.pageState;

    let lastRenderedQuery = '';
    let lastRenderedActionContextKey = '';
    let helpCenterFeedbackLinksRequested = false;

    // Where to ask when the help center has nothing; community links are fetched fresh once.
    function getHelpCenterFeedback(query) {
      if (!COMMUNITY_LINKS) {
        return null;
      }
      if (!helpCenterFeedbackLinksRequested) {
        helpCenterFeedbackLinksRequested = true;
        COMMUNITY_LINKS.load().then(() => {
          if (query === pageState.latestQuery) {
            renderSuggestions(pageState.lastSuggestionResponse, query);
          }
        });
      }
      const links = COMMUNITY_LINKS.getLinks();
      return {
        links,
        channel: COMMUNITY_LINKS.getCommunityChannel(links, getHelpCenterLocale()),
        t
      };
    }

    // Lumno Help Center search lists the matching help pages under its search row.
    const helpCenterSuggestionSource = HELP_CENTER_SEARCH
      ? HELP_CENTER_SEARCH.createSuggestionSource({
        sendMessage: (message, callback) => sendRuntimeMessage(message, (response) => {
          callback(chrome.runtime && chrome.runtime.lastError ? null : response);
        }),
        onUpdate: (query) => {
          if (query === pageState.latestQuery) {
            renderSuggestions(pageState.lastSuggestionResponse, query);
          }
        }
      })
      : null;
    let pendingProviderReload = false;
    let openInCurrentTabModifierActive = false;
    let openSwitchInNewTabModifierActive = false;
    let openInBackgroundTabModifierActive = false;

    function setSuggestionActionModifiersActive(openInCurrentTabActive, openSwitchInNewTabActive, openInBackgroundTabActive) {
      const nextOpenInCurrentTabActive = Boolean(openInCurrentTabActive);
      const nextOpenSwitchInNewTabActive = Boolean(openSwitchInNewTabActive);
      const nextOpenInBackgroundTabActive = Boolean(openInBackgroundTabActive);
      if (openInCurrentTabModifierActive === nextOpenInCurrentTabActive &&
          openSwitchInNewTabModifierActive === nextOpenSwitchInNewTabActive &&
          openInBackgroundTabModifierActive === nextOpenInBackgroundTabActive) {
        return;
      }
      openInCurrentTabModifierActive = nextOpenInCurrentTabActive;
      openSwitchInNewTabModifierActive = nextOpenSwitchInNewTabActive;
      openInBackgroundTabModifierActive = nextOpenInBackgroundTabActive;
      if (pageState.suggestionsView && typeof pageState.suggestionsView.setOpenInCurrentTabModifierActive === 'function') {
        pageState.suggestionsView.setOpenInCurrentTabModifierActive(nextOpenInCurrentTabActive);
      }
      if (pageState.suggestionsView && typeof pageState.suggestionsView.setOpenSwitchInNewTabModifierActive === 'function') {
        pageState.suggestionsView.setOpenSwitchInNewTabModifierActive(nextOpenSwitchInNewTabActive);
      }
      if (pageState.suggestionsView && typeof pageState.suggestionsView.setOpenInBackgroundTabModifierActive === 'function') {
        pageState.suggestionsView.setOpenInBackgroundTabModifierActive(nextOpenInBackgroundTabActive);
      }
    }

    function syncSuggestionActionModifiersFromEvent(event) {
      setSuggestionActionModifiersActive(
        Boolean(event && event.altKey),
        Boolean(event && event.shiftKey),
        Boolean(event && (event.metaKey || event.ctrlKey) && !pageState.numberShortcutInstantEnabled)
      );
    }

    function getAutoHighlightIndex() {
      return pageState.suggestionsView.getAutoHighlightIndex();
    }

    function getSuggestionUpdateKind(options) {
      return SUGGESTION_ACTION_MODEL.getSuggestionUpdateKind({
        ...(options || {}),
        includeDebugReasons: Boolean(pageState.tabRankScoreDebugEnabled)
      });
    }

    function getSuggestionActionContextKey(options) {
      return SUGGESTION_ACTION_MODEL.getActionContextKey(options);
    }

    function updateSelection() {
      if (!pageState.suggestionsView) {
        return;
      }
      pageState.suggestionsView.updateSelection(pageState.selectedIndex);
    }

    function activateRenderedSuggestion(suggestion, query, event, index, item) {
      if (suggestion.type === 'commandNewTab') {
        chrome.runtime.sendMessage({ action: 'openNewTab' });
        return;
      }
      if (suggestion.type === 'commandSettings') {
        chrome.runtime.sendMessage({ action: 'openOptionsPage' });
        return;
      }
      if (suggestion.type === 'siteSearchPrompt' && suggestion.provider) {
        activateSiteSearch(suggestion.provider);
        focusSearchInputPreservingScroll();
        return;
      }
      if (suggestion.type === 'modeSwitch') {
        setVisibleThemeMode(suggestion.nextMode);
        focusSearchInputPreservingScroll();
        return;
      }
      if (suggestion.type === 'zenSwitch') {
        setZenModeEnabled(suggestion.nextEnabled);
        focusSearchInputPreservingScroll();
        return;
      }
      if (Number.isInteger(index) && shouldSwitchMatchedTabSuggestion(suggestion, index)) {
        openMatchedTabSuggestion(suggestion, event, item, query);
        return;
      }
      if (suggestion.provider && suggestion.searchQuery) {
        runSiteSearchProviderQuery(
          suggestion.provider,
          suggestion.searchQuery,
          getSearchResultDisposition(event)
        );
        return;
      }
      if (shouldOpenSearchResultInBackgroundTab(event) && suggestion.url) {
        openSearchResultUrl(suggestion, query, event);
        return;
      }
      if (suggestion.forceSearch && suggestion.searchQuery) {
        navigateToQuery(suggestion.searchQuery, true, getSearchResultDisposition(event));
        return;
      }
      openSearchResultUrl(suggestion, query, event);
    }

    function deleteRenderedHistorySuggestion(suggestion) {
      chrome.runtime.sendMessage({
        action: 'deleteHistoryUrl',
        url: suggestion.url
      }, function(response) {
        if (chrome.runtime && chrome.runtime.lastError) {
          return;
        }
        if (!response || response.ok !== true) {
          return;
        }
        const refreshQuery = pageState.latestQuery || (pageState.inputParts && pageState.inputParts.input ? String(pageState.inputParts.input.value || '').trim() : '');
        if (!refreshQuery) {
          clearSearchSuggestions();
          return;
        }
        requestSuggestions(refreshQuery, { immediate: true });
      });
    }

    function scrollSelectedSuggestionIntoView(direction, didWrap) {
      if (!suggestionsContainer || pageState.selectedIndex < 0) {
        return;
      }
      const item = suggestionItems[pageState.selectedIndex];
      SUGGESTION_NAVIGATION.scrollItemIntoView(suggestionsContainer, item, {
        direction,
        didWrap,
        inset: 8
      });
    }

    function renderTabSuggestions(tabList) {
      pageState.currentSuggestions = [];
      lastRenderedQuery = '';
      lastRenderedActionContextKey = '';
      pageState.suggestionsView.renderTabs(tabList);
    }

    function requestTabsAndRender() {
      pageState.tabs = [];
      clearSearchSuggestions();
    }

    function refreshTabsIfIdle() {
      if (!pageState.latestQuery || !pageState.latestQuery.trim()) {
        refreshTabsForSearchContext(() => {});
        clearSearchSuggestions();
      }
    }

    function clearSearchSuggestions() {
      directNavigationSettleController.cancel();
      pageState.inlineSearchState = null;
      pageState.siteSearchTriggerState = null;
      pageState.localSearchScopeTriggerState = null;
      clearSiteSearchTabHint();
      pageState.suggestionsView.clear();
      pageState.currentSuggestions = [];
      pageState.lastSuggestionResponse = [];
      pageState.selectedIndex = -1;
      lastRenderedQuery = '';
      lastRenderedActionContextKey = '';
    }

    function dismissSearchSuggestionsFromBackground() {
      restoreUserAuthoredSearchInput();
      pageState.searchSuggestionsDismissed = true;
      pageState.suggestionRequestSeq += 1;
      if (pageState.remoteSuggestionDebounceTimer) {
        clearTimeout(pageState.remoteSuggestionDebounceTimer);
        pageState.remoteSuggestionDebounceTimer = null;
      }
      if (pageState.suggestionRequestWatchdogTimer) {
        clearTimeout(pageState.suggestionRequestWatchdogTimer);
        pageState.suggestionRequestWatchdogTimer = null;
      }
      clearSearchSuggestions();
    }

    function restoreDismissedSearchSuggestions() {
      if (!pageState.searchSuggestionsDismissed || !pageState.inputParts || !pageState.inputParts.input) {
        return false;
      }
      const rawValue = String(pageState.inputParts.input.value || '');
      const query = rawValue.trim();
      pageState.searchSuggestionsDismissed = false;
      if (!query) {
        return false;
      }
      pageState.latestRawQuery = rawValue;
      pageState.latestQuery = query;
      if (!pageState.localSearchScopeState && isSlashCommandInput(query)) {
        renderSuggestions([], query);
        return true;
      }
      requestSuggestions(query, { immediate: true });
      return true;
    }

    function renderSuggestions(suggestions, query) {
      if (pageState.searchSuggestionsDismissed) {
        return;
      }
      if (!query) {
        clearSearchSuggestions();
        return;
      }
      pageState.lastSuggestionResponse = Array.isArray(suggestions) ? suggestions : [];

      getShortcutRules().then((rules) => {
        if (pageState.searchSuggestionsDismissed || query !== pageState.latestQuery) {
          return;
        }
        const rawTagInput = (pageState.latestRawQuery || pageState.inputParts.input.value || '').trim();
        const localSearchQueryModeActive = Boolean(pageState.localSearchScopeState && String(query || '').trim());
        const slashCommandModeActive = !localSearchQueryModeActive && isSlashCommandInput(rawTagInput);
        const siteSearchQueryModeActive = !localSearchQueryModeActive &&
          !slashCommandModeActive &&
          Boolean(pageState.siteSearchState && String(query || '').trim());
        const modeCommandActive = slashCommandModeActive && !siteSearchQueryModeActive && isModeCommand(rawTagInput);
        const zenCommandActive = slashCommandModeActive && !siteSearchQueryModeActive && isZenCommand(rawTagInput);
        const toggleCommandActive = modeCommandActive || zenCommandActive;
        if (modeCommandActive) {
          if (storageArea) {
            storageArea.get([
              THEME_STORAGE_KEY,
              NEWTAB_THEME_MODE_STORAGE_KEY,
              NEWTAB_THEME_SCOPE_STORAGE_KEY
            ], (result) => {
              pageState.globalThemeMode = normalizeThemeMode(result ? result[THEME_STORAGE_KEY] : 'system');
              pageState.newtabThemeMode = normalizeNewtabThemeMode(result ? result[NEWTAB_THEME_MODE_STORAGE_KEY] : 'global');
              pageState.newtabThemeScope = normalizeNewtabThemeScope(result ? result[NEWTAB_THEME_SCOPE_STORAGE_KEY] : 'global');
              const storedMode = getScopedThemeMode();
              if (storedMode !== pageState.currentThemeMode && query === pageState.latestQuery) {
                applyThemeMode(storedMode);
                renderSuggestions([], query);
              }
            });
          }
        }
        const commandMatches = (slashCommandModeActive && !toggleCommandActive && !siteSearchQueryModeActive)
          ? getCommandMatches(rawTagInput)
          : [];
        const hasCommand = commandMatches.length > 0;
        const preSuggestions = [];
        if (modeCommandActive) {
          preSuggestions.push(buildModeSuggestion());
        } else if (zenCommandActive) {
          preSuggestions.push(buildZenSuggestion());
        } else if (slashCommandModeActive && !siteSearchQueryModeActive) {
          commandMatches.forEach((command) => {
            preSuggestions.push(buildCommandSuggestion(command));
          });
        } else if (!siteSearchQueryModeActive && !localSearchQueryModeActive) {
          const directUrlSuggestion = getDirectUrlSuggestion(query);
          if (directUrlSuggestion) {
            preSuggestions.push(directUrlSuggestion);
          }
          const keywordSuggestions = buildKeywordSuggestions(query, rules);
          preSuggestions.push(...keywordSuggestions);
        }

        const siteProvidersForTags = (pageState.siteSearchProvidersCache && pageState.siteSearchProvidersCache.length > 0)
          ? pageState.siteSearchProvidersCache
          : defaultSiteSearchProviders;
        const providersForTags = getSearchTriggerProviders(
          siteProvidersForTags,
          pageState.aggregateSearchesCache
        );
        if (!pageState.siteSearchProvidersCache && !pendingProviderReload) {
          pendingProviderReload = true;
          getSiteSearchProviders().then((items) => {
            pendingProviderReload = false;
            if (query !== pageState.latestQuery) {
              return;
            }
            renderSuggestions(pageState.lastSuggestionResponse, query);
          });
        }
        const inlineCandidate = (!localSearchQueryModeActive && !slashCommandModeActive &&
            !siteSearchQueryModeActive && !toggleCommandActive && !hasCommand)
          ? getInlineSiteSearchCandidate(rawTagInput, providersForTags)
          : null;
        let inlineSuggestion = null;
        if (inlineCandidate) {
          const inlineUrl = buildSearchUrl(inlineCandidate.provider.template, inlineCandidate.query);
          if (inlineUrl) {
            inlineSuggestion = {
              type: 'inlineSiteSearch',
              title: getSiteSearchActionTitle(inlineCandidate.provider),
              url: inlineUrl,
              favicon: getProviderIcon(inlineCandidate.provider),
              provider: inlineCandidate.provider,
              searchQuery: inlineCandidate.query
            };
          }
        }

        const newTabSuggestion = (localSearchQueryModeActive || slashCommandModeActive ||
            toggleCommandActive || siteSearchQueryModeActive)
          ? null
          : {
            type: 'newtab',
            title: pageState.simpleModeEnabled
              ? query
              : formatMessage('search_query', '搜索 "{query}"', {
                  query: query
                }),
            url: buildDefaultSearchUrl(query),
            favicon: getDefaultSearchEngineFaviconUrl(),
            searchQuery: query,
            forceSearch: true
          };
        const siteSearchSuggestion = siteSearchQueryModeActive
          ? (() => {
              const aggregateSearch = isAggregateSearchProvider(pageState.siteSearchState);
              const siteUrl = aggregateSearch
                ? ''
                : buildSearchUrl(pageState.siteSearchState.template, query);
              if (!aggregateSearch && !siteUrl) {
                return null;
              }
              return {
                type: 'siteSearch',
                title: getSiteSearchActionTitle(pageState.siteSearchState, query),
                url: siteUrl,
                favicon: aggregateSearch ? '' : getProviderIcon(pageState.siteSearchState),
                provider: pageState.siteSearchState,
                searchQuery: query
              };
            })()
          : null;

        const helpCenterSuggestions = siteSearchQueryModeActive && helpCenterSuggestionSource &&
            SEARCH_UTILS.isHelpCenterSiteSearchProvider(pageState.siteSearchState)
          ? helpCenterSuggestionSource.getSuggestions(
            query,
            getHelpCenterLocale(),
            getProviderIcon(pageState.siteSearchState),
            getHelpCenterFeedback(query)
          )
          : [];

        const defaultSuggestions = [
          ...preSuggestions,
          newTabSuggestion,
          ...suggestions
        ].filter(Boolean);
        let groupedDefaultSuggestions = defaultSuggestions;
        if (pageState.searchResultPriorityMode !== 'search') {
          groupedDefaultSuggestions = SEARCH_UTILS.groupSearchSuggestionsByKind(defaultSuggestions, {
            searchFirst: false
          });
        }

        let allSuggestions = localSearchQueryModeActive
          ? suggestions.filter((item) => (
            item &&
            pageState.localSearchScopeState &&
            item.type === pageState.localSearchScopeState.sourceType
          ))
          : (slashCommandModeActive ? [...preSuggestions] : (siteSearchQueryModeActive
            ? (siteSearchSuggestion ? [siteSearchSuggestion, ...helpCenterSuggestions] : [])
            : (toggleCommandActive ? [...preSuggestions] : groupedDefaultSuggestions)));
        allSuggestions.forEach((item) => {
          if (!item || !item.url) {
            return;
          }
          const matchedTabId = getMatchedOpenTabIdForSuggestion(item);
          if (typeof matchedTabId === 'number') {
            item._xMatchedTabId = matchedTabId;
            return;
          }
          if (Object.prototype.hasOwnProperty.call(item, '_xMatchedTabId')) {
            delete item._xMatchedTabId;
          }
        });
        allSuggestions = filterBlacklistedSuggestions(allSuggestions, query);
        const hasDirectUrlSuggestion = preSuggestions.some((suggestion) => (
          suggestion && suggestion.type === 'directUrl'
        ));
        if (pageState.searchResultPriorityMode === 'search' &&
            !localSearchQueryModeActive &&
            !slashCommandModeActive &&
            !toggleCommandActive &&
            !siteSearchQueryModeActive &&
            !hasDirectUrlSuggestion) {
          allSuggestions = SEARCH_UTILS.composeSearchFirstSuggestionSlate(allSuggestions, {
            limit: pageState.searchResultDisplayLimit
          });
        }

        const keywordSuggestionState = getKeywordSearchSuggestionState(allSuggestions);
        const onlyKeywordSuggestions = keywordSuggestionState.onlyKeywordSuggestions;

        let autocompleteCandidate = null;
        let primaryHighlightIndex = -1;
        let primaryHighlightReason = 'none';
        let strongNavigationMatch = null;
        let topSiteMatch = null;
        let mergedProvider = null;
        let primarySuggestion = null;
        const inlineEnabled = Boolean(inlineSuggestion);
        let siteSearchTrigger = null;
        const preferAutocompleteFirst = pageState.searchResultPriorityMode !== 'search';
        if (!localSearchQueryModeActive && !slashCommandModeActive && !toggleCommandActive && !hasCommand) {
          if (!pageState.siteSearchState && !inlineEnabled && preferAutocompleteFirst) {
            strongNavigationMatch = promoteStrongNavigationMatch(allSuggestions, pageState.latestRawQuery.trim());
            if (strongNavigationMatch) {
              primaryHighlightIndex = 0;
              primaryHighlightReason = 'navigation';
            }
            topSiteMatch = promoteTopSiteMatch(allSuggestions, pageState.latestRawQuery.trim());
          }
          siteSearchTrigger = (!pageState.siteSearchState && !inlineEnabled)
            ? getSiteSearchTriggerCandidate(rawTagInput, providersForTags, topSiteMatch)
            : null;
          if (!pageState.siteSearchState && !inlineEnabled && !strongNavigationMatch && preferAutocompleteFirst && !onlyKeywordSuggestions) {
            autocompleteCandidate = getAutocompleteCandidate(keywordSuggestionState.autocompleteSuggestions, pageState.latestRawQuery);
            if (autocompleteCandidate) {
              const candidateIndex = allSuggestions.findIndex((suggestion) => {
                if (!suggestion || suggestion.type === 'newtab') {
                  return false;
                }
                if (autocompleteCandidate.url && suggestion.url === autocompleteCandidate.url) {
                  return true;
                }
                const suggestionUrlText = getUrlDisplay(suggestion.url);
                if (suggestionUrlText && suggestionUrlText.toLowerCase() === autocompleteCandidate.completion.toLowerCase()) {
                  return true;
                }
                if (suggestion.title && suggestion.title.toLowerCase().startsWith(autocompleteCandidate.completion.toLowerCase())) {
                  return true;
                }
                return false;
              });
              if (candidateIndex >= 0 && candidateIndex !== 0) {
                const [candidateSuggestion] = allSuggestions.splice(candidateIndex, 1);
                allSuggestions.unshift(candidateSuggestion);
              }
              primaryHighlightIndex = 0;
              primaryHighlightReason = 'autocomplete';
            }
          }
          if (inlineSuggestion) {
            allSuggestions.unshift(inlineSuggestion);
            allSuggestions = filterBlacklistedSuggestions(allSuggestions, query);
            primaryHighlightIndex = 0;
            primaryHighlightReason = 'inline';
          } else if (!strongNavigationMatch && topSiteMatch && preferAutocompleteFirst) {
            primaryHighlightIndex = 0;
            primaryHighlightReason = 'topSite';
          }
          if (preferAutocompleteFirst &&
              !pageState.siteSearchState && query && !onlyKeywordSuggestions && pageState.openTabQuickSwitchEnabled) {
            const openTabMatch = SEARCH_UTILS.findSearchOpenTabMatchIndex(allSuggestions, {
              rawQuery: pageState.latestRawQuery.trim(),
              primaryHighlightIndex,
              currentTabId: pageState.currentNewtabTabId,
              openTabQuickSwitchEnabled: pageState.openTabQuickSwitchEnabled,
              getDirectNavigationUrl
            });
            if (openTabMatch.index >= 0) {
              if (openTabMatch.index > 0) {
                const [openTabMatchSuggestion] = allSuggestions.splice(openTabMatch.index, 1);
                allSuggestions.unshift(openTabMatchSuggestion);
              }
              primaryHighlightIndex = 0;
              primaryHighlightReason = openTabMatch.reason || 'openTab';
            }
          }
          if (preferAutocompleteFirst) {
            allSuggestions = SEARCH_UTILS.pinExactSearchActionSecond(allSuggestions);
          }
          if (query && primaryHighlightIndex < 0 && allSuggestions.length > 0) {
            primaryHighlightIndex = 0;
            primaryHighlightReason = 'default';
          }
          if (primaryHighlightIndex >= 0) {
            primarySuggestion = allSuggestions[primaryHighlightIndex] || null;
            mergedProvider = findProviderForSuggestionMatch(primarySuggestion, providersForTags);
          }
          if (onlyKeywordSuggestions) {
            clearAutocomplete();
          } else {
            applyAutocomplete(allSuggestions, primarySuggestion, primaryHighlightReason);
          }
          const inlineAutoHighlight = Boolean(inlineSuggestion && primaryHighlightIndex === 0);
          pageState.inlineSearchState = inlineSuggestion
            ? {
                url: inlineSuggestion.url,
                provider: inlineSuggestion.provider,
                query: inlineSuggestion.searchQuery || '',
                rawInput: rawTagInput,
                isAuto: inlineAutoHighlight
              }
            : null;
          const resolvedProvider = siteSearchTrigger;
          const resolvedLocalScope = !resolvedProvider
            ? getLocalSearchScopeCandidate(rawTagInput, rules)
            : null;
          pageState.siteSearchTriggerState = resolvedProvider
            ? { provider: resolvedProvider, rawInput: rawTagInput }
            : null;
          pageState.localSearchScopeTriggerState = resolvedLocalScope
            ? { scope: resolvedLocalScope, rawInput: rawTagInput }
            : null;
          if (pageState.siteSearchTriggerState) {
            setSiteSearchTabHint(resolvedProvider);
          } else if (pageState.localSearchScopeTriggerState) {
            setSiteSearchTabHint(getLocalSearchScopeTabHintProvider(resolvedLocalScope));
          } else {
            clearSiteSearchTabHint();
          }
        } else if (localSearchQueryModeActive) {
          clearAutocomplete();
          pageState.inlineSearchState = null;
          pageState.siteSearchTriggerState = null;
          pageState.localSearchScopeTriggerState = null;
          clearSiteSearchTabHint();
          if (allSuggestions.length > 0) {
            primaryHighlightIndex = 0;
            primaryHighlightReason = 'localScope';
            primarySuggestion = allSuggestions[0];
          }
        } else if (modeCommandActive) {
          clearAutocomplete();
          pageState.inlineSearchState = null;
          pageState.siteSearchTriggerState = null;
          pageState.localSearchScopeTriggerState = null;
          clearSiteSearchTabHint();
          primaryHighlightIndex = 0;
          primaryHighlightReason = 'modeSwitch';
        } else if (zenCommandActive) {
          clearAutocomplete();
          pageState.inlineSearchState = null;
          pageState.siteSearchTriggerState = null;
          pageState.localSearchScopeTriggerState = null;
          clearSiteSearchTabHint();
          primaryHighlightIndex = 0;
          primaryHighlightReason = 'zenSwitch';
        } else if (slashCommandModeActive) {
          clearAutocomplete();
          pageState.inlineSearchState = null;
          pageState.siteSearchTriggerState = null;
          pageState.localSearchScopeTriggerState = null;
          clearSiteSearchTabHint();
          primaryHighlightIndex = 0;
          primaryHighlightReason = 'command';
        }
        if (hasCommand) {
          applyAutocomplete(allSuggestions, primarySuggestion, primaryHighlightReason);
        }
        allSuggestions = limitSuggestionsForDisplay(allSuggestions, {
          uncapped: slashCommandModeActive
        });
        const emptyMessage = slashCommandModeActive && allSuggestions.length === 0
          ? t('slash_command_empty', '无匹配命令')
          : (localSearchQueryModeActive && allSuggestions.length === 0
            ? t('overlay_empty_result', '无匹配结果')
            : '');

        const actionContextKey = getSuggestionActionContextKey({
          primaryHighlightIndex,
          primaryHighlightReason,
          onlyKeywordSuggestions,
          primarySuggestion,
          mergedProvider,
          emptyMessage
        });
        const updateKind = getSuggestionUpdateKind({
          query,
          lastRenderedQuery,
          actionContextKey,
          lastRenderedActionContextKey,
          currentSuggestions: pageState.currentSuggestions,
          allSuggestions
        });
        const canAppend = updateKind === 'append';
        const startIndex = canAppend ? pageState.currentSuggestions.length : 0;

        pageState.currentSuggestions = allSuggestions;
        lastRenderedQuery = query;
        lastRenderedActionContextKey = actionContextKey;
        if (updateKind !== 'highlight') {
          warmIconCache(allSuggestions.filter((item) => (
            item && item.type !== 'directUrl'
          )));
        }
        pageState.suggestionsView.render({
          suggestions: allSuggestions,
          query,
          updateKind,
          canAppend,
          startIndex,
          primaryHighlightIndex,
          primarySuggestion,
          primaryHighlightReason,
          onlyKeywordSuggestions,
          mergedProvider,
          emptyMessage
        });
        if (updateKind !== 'highlight') {
          updateSelection();
          setSuggestionsVisible(true);
        }
      });
    }

    function renderPendingSuggestions(query, options) {
      renderSuggestions(pageState.lastSuggestionResponse, query, options);
    }

    const DIRECT_NAVIGATION_SETTLE_DELAY_MS = 120;
    const directNavigationSettleController =
      NEWTAB_DIRECT_NAVIGATION_SETTLE.createDirectNavigationSettleController({
        delayMs: DIRECT_NAVIGATION_SETTLE_DELAY_MS,
        onSettle: ({ query, requestSeq }) => {
          if (requestSeq !== pageState.suggestionRequestSeq || query !== pageState.latestQuery) {
            return;
          }
          renderPendingSuggestions(query);
        }
      });

    function requestSuggestions(query, options) {
      pageState.latestQuery = query;
      const requestLocalSearchScope = pageState.localSearchScopeState;
      if (!requestLocalSearchScope && isSlashCommandInput(query)) {
        renderSuggestions([], query);
        return;
      }
      const immediate = options && options.immediate;
      const deferInitialDirectNavigationRender = Boolean(
        options && options.deferInitialDirectNavigationRender
      );
      const retryCount = options && Number(options.retryCount) > 0 ? Number(options.retryCount) : 0;
      const requestStartedAt = Date.now();
      const requestQuery = pageState.latestQuery;
      const requestSeq = ++pageState.suggestionRequestSeq;
      const requestSearchFirst = pageState.searchResultPriorityMode === 'search';
      const showExactSearchPendingState = requestSearchFirst &&
        !requestLocalSearchScope &&
        !pageState.siteSearchState &&
        !getDirectUrlSuggestion(requestQuery);
      directNavigationSettleController.cancel();
      if (deferInitialDirectNavigationRender) {
        directNavigationSettleController.schedule({
          query: requestQuery,
          requestSeq
        });
      }
      if (pageState.remoteSuggestionDebounceTimer) {
        clearTimeout(pageState.remoteSuggestionDebounceTimer);
        pageState.remoteSuggestionDebounceTimer = null;
      }
      if (pageState.suggestionRequestWatchdogTimer) {
        clearTimeout(pageState.suggestionRequestWatchdogTimer);
        pageState.suggestionRequestWatchdogTimer = null;
      }
      if (showExactSearchPendingState) {
        renderSuggestions([], requestQuery);
      }
      pageState.suggestionRequestWatchdogTimer = setTimeout(function() {
        if (requestSeq !== pageState.suggestionRequestSeq || requestQuery !== pageState.latestQuery) {
          return;
        }
        if (retryCount < 1) {
          requestSuggestions(requestQuery, { immediate: true, retryCount: retryCount + 1 });
          return;
        }
        renderPendingSuggestions(requestQuery);
      }, immediate ? 1200 : 1300);
      const localRequestSent = sendRuntimeMessage({
        action: 'getSearchSuggestions',
        query: requestQuery,
        context: 'newtab',
        sourceTypes: requestLocalSearchScope ? [requestLocalSearchScope.sourceType] : undefined,
        includeOpenTabs: requestLocalSearchScope ? false : undefined
      }, function(response) {
        if (pageState.suggestionRequestWatchdogTimer) {
          clearTimeout(pageState.suggestionRequestWatchdogTimer);
          pageState.suggestionRequestWatchdogTimer = null;
        }
        if (requestSeq !== pageState.suggestionRequestSeq || requestQuery !== pageState.latestQuery) {
          return;
        }
        directNavigationSettleController.cancel();
        if (chrome.runtime && chrome.runtime.lastError) {
          renderPendingSuggestions(requestQuery);
          return;
        }
        const localSuggestions = response && Array.isArray(response.suggestions) ? response.suggestions : [];
        if (requestLocalSearchScope) {
          renderSuggestions(localSuggestions, requestQuery);
          return;
        }
        if (!showExactSearchPendingState) {
          renderSuggestions(localSuggestions, requestQuery);
        }
        refreshTabsForSearchContext(() => {});
        const remoteDelay = (requestSearchFirst || immediate)
          ? 0
          : Math.max(0, 120 - (Date.now() - requestStartedAt));
        pageState.remoteSuggestionDebounceTimer = setTimeout(function() {
          pageState.remoteSuggestionDebounceTimer = null;
          if (requestSeq !== pageState.suggestionRequestSeq || requestQuery !== pageState.latestQuery) {
            return;
          }
          const remoteRequestSent = sendRuntimeMessage({
            action: 'getSearchEngineSuggestions',
            query: requestQuery,
            context: 'newtab',
            localSuggestions: localSuggestions,
            searchFirst: requestSearchFirst
          }, function(remoteResponse) {
            if (requestSeq !== pageState.suggestionRequestSeq || requestQuery !== pageState.latestQuery) {
              return;
            }
            if (chrome.runtime && chrome.runtime.lastError) {
              renderSuggestions(localSuggestions, requestQuery);
              return;
            }
            if (!remoteResponse ||
                remoteResponse.aborted === true ||
                remoteResponse.hasRemoteSuggestions !== true ||
                !Array.isArray(remoteResponse.suggestions)) {
              renderSuggestions(localSuggestions, requestQuery);
              return;
            }
            renderSuggestions(remoteResponse.suggestions, requestQuery);
          });
          if (!remoteRequestSent) {
            renderSuggestions(localSuggestions, requestQuery);
          }
        }, remoteDelay);
      });
      if (!localRequestSent) {
        if (pageState.suggestionRequestWatchdogTimer) {
          clearTimeout(pageState.suggestionRequestWatchdogTimer);
          pageState.suggestionRequestWatchdogTimer = null;
        }
        if (requestSeq === pageState.suggestionRequestSeq && requestQuery === pageState.latestQuery) {
          directNavigationSettleController.cancel();
          renderPendingSuggestions(requestQuery);
        }
      }
    }

    return {
      setSuggestionActionModifiersActive,
      syncSuggestionActionModifiersFromEvent,
      getAutoHighlightIndex,
      updateSelection,
      activateRenderedSuggestion,
      deleteRenderedHistorySuggestion,
      scrollSelectedSuggestionIntoView,
      requestTabsAndRender,
      refreshTabsIfIdle,
      clearSearchSuggestions,
      dismissSearchSuggestionsFromBackground,
      restoreDismissedSearchSuggestions,
      renderSuggestions,
      renderPendingSuggestions,
      directNavigationSettleController,
      requestSuggestions
    };
  }

  root.LumnoNewtabSuggestionsController = { createSuggestionsController };
})(globalThis);
