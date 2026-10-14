(function(root) {
  // Search mode menu and site-search / local-scope activation for the input.
  function createSearchModes(deps) {
    const {
      SEARCH_UTILS,
      defaultSiteSearchProviders,
      getSearchModeProviderId,
      AGGREGATE_SEARCH_STORE,
      t,
      createAggregateSearchScopeProvider,
      isAggregateSearchProvider,
      isSearchEngineSiteSearchProvider,
      isAiSiteSearchProvider,
      getSiteSearchDisplayName,
      getProviderIcon,
      getLocalSearchScopeLabel,
      getLocalSearchScopeIconClass,
      loadSiteSearchIconCache,
      getSiteSearchProviders,
      getAggregateSearches,
      formatMessage,
      defaultTheme,
      clearAutocomplete,
      clearSearchSuggestions,
      clearSiteSearchPrefix,
      setSiteSearchPrefix,
      getThemeForProvider,
      getTopSiteMatchCandidate,
      getSiteSearchTriggerCandidate,
      getLocalSearchScopeCandidate,
      getShortcutRules
    } = deps;

    // The page state object shared with newtab.js and the other modules.
    const pageState = deps.pageState;
    const SEARCH_SOURCE_ORDER = deps.searchSourceOrder ||
      (typeof globalThis !== 'undefined' ? globalThis.LumnoSearchSourceOrder : null);
    const SEARCH_SOURCE_ORDER_STORAGE_KEY = deps.searchSourceOrderStorageKey || '';
    const readStorageValue = deps.readStorageValue;
    // Kept as a closure variable rather than page state so the ordering helpers
    // survive the page-state accessor stripping the source-contract tests use.
    let searchSourceOrderValue = null;
    let searchSourceOrderReady = null;
    let searchSourceOrderRevision = 0;

    // The order record is read once per page and reused for every panel open.
    // `providers` must be the merged list from getSiteSearchProviders(), not the
    // cached built-in list: reconciliation drops keys it cannot see, so a
    // built-in-only list would discard the reader's custom searches.
    function loadSearchSourceOrder(providers) {
      if (searchSourceOrderReady) {
        return searchSourceOrderReady;
      }
      const revision = searchSourceOrderRevision;
      searchSourceOrderReady = (() => {
        if (!SEARCH_SOURCE_ORDER || !SEARCH_SOURCE_ORDER_STORAGE_KEY ||
            typeof readStorageValue !== 'function') {
          return Promise.resolve(null);
        }
        const aggregates = pageState.aggregateSearchesCache || [];
        return Promise.resolve(readStorageValue(SEARCH_SOURCE_ORDER_STORAGE_KEY))
          .then((value) => SEARCH_SOURCE_ORDER.normalizeOrder(
            value,
            Array.isArray(providers) ? providers : getSearchModeProviders(),
            {
              getGroupKey: getSearchSourceGroupKey,
              getName: getSearchSourceName,
              aggregates
            }
          ))
          .catch(() => null)
          .then((order) => {
            // A load that started before the last invalidation must not publish
            // its stale result over a newer one.
            if (revision === searchSourceOrderRevision) {
              searchSourceOrderValue = order || null;
            }
            return searchSourceOrderValue;
          });
      })();
      return searchSourceOrderReady;
    }

    function getSearchSourceOrder() {
      return searchSourceOrderValue;
    }

    function setSearchSourceOrder(value) {
      searchSourceOrderValue = value || null;
    }

    function invalidateSearchSourceOrder() {
      searchSourceOrderRevision += 1;
      searchSourceOrderReady = null;
      searchSourceOrderValue = null;
    }

    function getSearchSourceGroupKey(provider) {
      if (isSearchEngineSiteSearchProvider(provider)) {
        return 'engine';
      }
      if (isAiSiteSearchProvider(provider)) {
        return 'ai';
      }
      return 'site';
    }

    function getSearchSourceName(provider) {
      const label = getSiteSearchDisplayName(provider);
      return String(label || (provider && provider.key) || '');
    }

    function getDefaultSearchModeProvider(providers) {
      return SEARCH_UTILS.getSearchEngineSiteSearchProvider(
        pageState.defaultSearchEngineState,
        providers
      );
    }

    function getSearchModeProviders() {
      const providers = (pageState.siteSearchProvidersCache && pageState.siteSearchProvidersCache.length > 0)
        ? pageState.siteSearchProvidersCache
        : defaultSiteSearchProviders;
      const defaultProvider = getDefaultSearchModeProvider(providers);
      if (!defaultProvider || providers.some((provider) => (
        getSearchModeProviderId(provider) === getSearchModeProviderId(defaultProvider)
      ))) {
        return providers;
      }
      return [defaultProvider].concat(providers);
    }

    function isAggregateSearchDefinitionAvailable(definition, providers) {
      return AGGREGATE_SEARCH_STORE.isAggregateSearchAvailable(
        definition,
        Array.isArray(providers) ? providers : getSearchModeProviders()
      );
    }

    function getSearchTriggerProviders(providers, definitions) {
      const sourceProviders = Array.isArray(providers) ? providers : [];
      const availableDefinitions = (Array.isArray(definitions) ? definitions : [])
        .filter((definition) => isAggregateSearchDefinitionAvailable(
          definition,
          sourceProviders
        ));
      return AGGREGATE_SEARCH_STORE.mergeTriggerProviders(
        sourceProviders,
        availableDefinitions
      );
    }

    function buildSearchModeMenuItems(sourceOrder) {
      const resolvedOrder = sourceOrder === undefined ? searchSourceOrderValue : sourceOrder;
      const engineGroup = t('search_scope_group_engines', '搜索引擎');
      const localGroup = t('search_scope_group_local', '浏览器内容');
      const aiGroup = t('search_scope_group_ai', 'AI 搜索');
      const siteGroup = t('search_scope_group_sites', '站内搜索');
      const aggregateGroup = t('search_scope_group_aggregates', '聚合搜索');
      const items = [];
      const providers = getSearchModeProviders();
      (pageState.aggregateSearchesCache || []).forEach((definition) => {
        if (!isAggregateSearchDefinitionAvailable(definition, providers)) {
          return;
        }
        const provider = createAggregateSearchScopeProvider(definition);
        if (!provider) {
          return;
        }
        items.push({
          id: `aggregate:${definition.id}`,
          kind: 'aggregate',
          aggregate: definition,
          provider,
          label: definition.name,
          group: aggregateGroup,
          groupKey: 'aggregate',
          iconClass: 'ri-stack-line',
          searchTerms: [definition.name].concat(definition.sourceRefs || []),
          active: Boolean(
            isAggregateSearchProvider(pageState.siteSearchState) &&
            String(pageState.siteSearchState.aggregateId || '') === String(definition.id || '')
          )
        });
      });
      providers
        .filter((provider) => isSearchEngineSiteSearchProvider(provider))
        .concat(providers.filter((provider) => (
          !isSearchEngineSiteSearchProvider(provider) && !isAiSiteSearchProvider(provider)
        )))
        .concat(providers.filter((provider) => isAiSiteSearchProvider(provider)))
        .forEach((provider) => {
          const isAi = isAiSiteSearchProvider(provider);
          const isSearchEngine = isSearchEngineSiteSearchProvider(provider);
          items.push({
            id: getSearchModeProviderId(provider),
            kind: 'provider',
            provider,
            label: getSiteSearchDisplayName(provider),
            group: isSearchEngine ? engineGroup : (isAi ? aiGroup : siteGroup),
            groupKey: isSearchEngine ? 'engine' : (isAi ? 'ai' : 'site'),
            iconUrl: getProviderIcon(provider),
            iconClass: isAi ? 'ri-search-ai-line' : 'ri-global-line',
            isAi,
            active: Boolean(pageState.siteSearchState && getSearchModeProviderId(pageState.siteSearchState) === getSearchModeProviderId(provider))
          });
        });
      ['topSite', 'bookmark', 'history'].forEach((sourceType) => {
        if (!pageState.enabledSearchResultSourceTypes.includes(sourceType)) {
          return;
        }
        items.push({
          id: `local:${sourceType}`,
          kind: 'local',
          sourceType,
          label: getLocalSearchScopeLabel({ sourceType }),
          searchTerms: sourceType === 'topSite'
            ? ['top sites', 'frequent sites', 'favorites']
            : (sourceType === 'bookmark'
              ? ['bookmark', 'bookmarks']
              : ['history', 'browsing history']),
          group: localGroup,
          groupKey: 'local',
          iconClass: getLocalSearchScopeIconClass(sourceType),
          menuIconName: sourceType === 'topSite' ? 'star' : sourceType,
          active: Boolean(pageState.localSearchScopeState && pageState.localSearchScopeState.sourceType === sourceType)
        });
      });
      return rankSearchModeMenuItems(items, resolvedOrder);
    }

    // The reader's Search sources order decides both the group block order and
    // the order inside each block. Without it the surface keeps its own order.
    function rankSearchModeMenuItems(items, sourceOrder) {
      const order = sourceOrder === undefined ? searchSourceOrderValue : sourceOrder;
      if (!SEARCH_SOURCE_ORDER || !order || !SEARCH_SOURCE_ORDER.rankMenuItems) {
        return items;
      }
      return SEARCH_SOURCE_ORDER.rankMenuItems(items, order, {
        getGroup: (item) => item && item.groupKey
      });
    }

    function getSearchModeMenuItems() {
      return Promise.all([
        loadSiteSearchIconCache(),
        getSiteSearchProviders(),
        getAggregateSearches()
      ]).then((results) => loadSearchSourceOrder(results[1])
        .then((order) => buildSearchModeMenuItems(order)));
    }
    function openSearchModeMenuFromDoubleTab() {
      const expectedInputValue = String(pageState.inputParts.input.value || '');
      const activateDefaultProvider = (providers) => {
        if (!pageState.inputModeController || pageState.siteSearchState || pageState.localSearchScopeState ||
            String(pageState.inputParts.input.value || '') !== expectedInputValue) {
          return false;
        }
        const provider = getDefaultSearchModeProvider(providers);
        if (!provider) {
          return false;
        }
        if (expectedInputValue.trim()) {
          activateSiteSearch(provider, {
            preserveResults: shouldPreserveSearchModeResults(expectedInputValue)
          });
          restoreSearchModeQuery(expectedInputValue);
        } else {
          activateSiteSearch(provider);
        }
        pageState.inputModeController.openModeMenu('none');
        return true;
      };
      if (pageState.siteSearchProvidersCache) {
        return activateDefaultProvider(pageState.siteSearchProvidersCache);
      }
      return getSiteSearchProviders().then(
        activateDefaultProvider,
        () => activateDefaultProvider(defaultSiteSearchProviders)
      );
    }

    function restoreSearchModeQuery(rawQuery) {
      const value = String(rawQuery || '');
      pageState.inputParts.input.value = value;
      pageState.latestRawQuery = value;
      pageState.latestQuery = value.trim();
      pageState.inputParts.input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function shouldPreserveSearchModeResults(rawQuery) {
      return Boolean(String(rawQuery || '').trim());
    }

    function selectSearchModeMenuItem(item) {
      if (!item || !item.kind) {
        return;
      }
      const rawQuery = pageState.inputParts.input.value || '';
      const preserveResults = shouldPreserveSearchModeResults(rawQuery);
      if (item.kind === 'local') {
        activateLocalSearchScope(
          { sourceType: item.sourceType },
          { preserveResults }
        );
        restoreSearchModeQuery(rawQuery);
        return;
      }
      if (item.kind === 'aggregate' && item.provider) {
        activateSiteSearch(item.provider, { preserveResults });
        restoreSearchModeQuery(rawQuery);
        return;
      }
      if (item.kind === 'provider' && item.provider) {
        activateSiteSearch(item.provider, { preserveResults });
        restoreSearchModeQuery(rawQuery);
      }
    }

    function getLocalSearchScopeTabHintProvider(scope) {
      const source = getLocalSearchScopeLabel(scope);
      return {
        name: source,
        tabHintLabel: formatMessage(
          'local_search_tab_hint',
          '仅搜索{source}',
          { source }
        )
      };
    }

    function setLocalSearchScopePrefix(scope) {
      if (!pageState.inputModeController || !scope) {
        return;
      }
      pageState.inputModeController.setPrefixText(
        getLocalSearchScopeLabel(scope),
        defaultTheme,
        {
          animate: true,
          iconClass: getLocalSearchScopeIconClass(scope.sourceType),
          menuIconName: scope.sourceType === 'topSite' ? 'star' : scope.sourceType,
          modeId: `local:${scope.sourceType}`
        }
      );
    }

    function activateLocalSearchScope(scope, activationOptions) {
      if (!scope || !pageState.enabledSearchResultSourceTypes.includes(scope.sourceType)) {
        return false;
      }
      const options = activationOptions && typeof activationOptions === 'object'
        ? activationOptions
        : {};
      pageState.suggestionRequestSeq += 1;
      pageState.localSearchScopeState = scope;
      pageState.localSearchScopeTriggerState = null;
      pageState.siteSearchState = null;
      pageState.siteSearchTriggerState = null;
      pageState.inlineSearchState = null;
      pageState.inputParts.input.value = '';
      pageState.latestRawQuery = '';
      pageState.latestQuery = '';
      clearAutocomplete();
      setLocalSearchScopePrefix(scope);
      if (options.preserveResults !== true) {
        clearSearchSuggestions();
      }
      return true;
    }

    function clearLocalSearchScope() {
      if (!pageState.localSearchScopeState) {
        return false;
      }
      pageState.suggestionRequestSeq += 1;
      pageState.localSearchScopeState = null;
      pageState.localSearchScopeTriggerState = null;
      pageState.inlineSearchState = null;
      clearSiteSearchPrefix();
      clearAutocomplete();
      return true;
    }

    function activateSiteSearch(provider, activationOptions) {
      if (!provider) {
        return;
      }
      const options = activationOptions && typeof activationOptions === 'object'
        ? activationOptions
        : {};
      pageState.localSearchScopeState = null;
      pageState.localSearchScopeTriggerState = null;
      pageState.siteSearchState = provider;
      pageState.inlineSearchState = null;
      pageState.inputParts.input.value = '';
      pageState.latestRawQuery = '';
      pageState.latestQuery = '';
      clearAutocomplete();
      setSiteSearchPrefix(provider, defaultTheme, {
        animate: options.animatePrefix !== false
      });
      getThemeForProvider(provider).then((theme) => {
        if (pageState.siteSearchState === provider) {
          setSiteSearchPrefix(provider, theme);
        }
      });
      if (options.preserveResults !== true) {
        clearSearchSuggestions();
      }
    }

    function clearSiteSearch() {
      if (!pageState.siteSearchState) {
        return;
      }
      pageState.siteSearchState = null;
      pageState.inlineSearchState = null;
      clearSiteSearchPrefix();
      clearAutocomplete();
    }

    // Fills the input with the inline autocomplete's completion.
    function acceptAutocompleteCompletion() {
      const completion = pageState.autocompleteState.completion;
      pageState.inputParts.input.value = completion;
      pageState.inputParts.input.setSelectionRange(completion.length, completion.length);
      pageState.latestRawQuery = completion;
      pageState.latestQuery = completion.trim();
      pageState.autocompleteState = null;
      pageState.inputParts.input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Tab in the search box: toggles or opens the mode menu, turns a typed
    // trigger into a site search or local scope, or takes the inline
    // completion. True when it handled the key.
    function handleSearchTabKey(event) {
      if (!event || event.defaultPrevented) {
        return false;
      }
      if (pageState.inputModeController &&
          typeof pageState.inputModeController.handleModeMenuTabFocusToggle === 'function' &&
          pageState.inputModeController.handleModeMenuTabFocusToggle(event)) {
        return true;
      }
      if (pageState.inputModeController &&
          typeof pageState.inputModeController.shouldOpenModeMenuForActiveModeOnTab === 'function' &&
          pageState.inputModeController.shouldOpenModeMenuForActiveModeOnTab(event)) {
        pageState.inputModeController.openModeMenu('none');
        return true;
      }
      if (pageState.siteSearchState || pageState.localSearchScopeState) {
        return false;
      }
      const rawValue = pageState.inputParts.input.value;
      const rawTrigger = pageState.latestRawQuery || rawValue;
      const triggerInput = (rawTrigger || rawValue).trim();
      if (!triggerInput && pageState.inputModeController &&
          typeof pageState.inputModeController.shouldOpenModeMenuOnDoubleTab === 'function') {
        const shouldOpenModeMenu = pageState.inputModeController.shouldOpenModeMenuOnDoubleTab(event);
        if (shouldOpenModeMenu) {
          openSearchModeMenuFromDoubleTab();
        }
        return Boolean(event.defaultPrevented);
      }
      if (pageState.siteSearchTriggerState &&
          pageState.siteSearchTriggerState.rawInput === triggerInput &&
          pageState.siteSearchTriggerState.provider) {
        event.preventDefault();
        activateSiteSearch(pageState.siteSearchTriggerState.provider);
        return true;
      }
      if (pageState.localSearchScopeTriggerState &&
          pageState.localSearchScopeTriggerState.rawInput === triggerInput &&
          pageState.localSearchScopeTriggerState.scope) {
        event.preventDefault();
        return activateLocalSearchScope(pageState.localSearchScopeTriggerState.scope);
      }
      if (triggerInput) {
        event.preventDefault();
        const siteProviders = (pageState.siteSearchProvidersCache && pageState.siteSearchProvidersCache.length > 0)
          ? pageState.siteSearchProvidersCache
          : defaultSiteSearchProviders;
        const providers = getSearchTriggerProviders(
          siteProviders,
          pageState.aggregateSearchesCache
        );
        const topSiteMatch = getTopSiteMatchCandidate(pageState.currentSuggestions, triggerInput);
        const directProvider = getSiteSearchTriggerCandidate(triggerInput, providers, topSiteMatch);
        if (directProvider) {
          activateSiteSearch(directProvider);
          return true;
        }
        const cachedRules = window._x_extension_shortcut_rules_2024_unique_;
        const directLocalScope = getLocalSearchScopeCandidate(triggerInput, cachedRules);
        if (pageState.siteSearchProvidersCache && directLocalScope) {
          activateLocalSearchScope(directLocalScope);
          return true;
        }
        Promise.all([
          getSiteSearchProviders(),
          getAggregateSearches(),
          getShortcutRules()
        ]).then(([items, definitions, rules]) => {
          if (pageState.siteSearchState || pageState.localSearchScopeState ||
              String(pageState.inputParts.input.value || '').trim() !== triggerInput) {
            return;
          }
          const asyncTopSiteMatch = getTopSiteMatchCandidate(pageState.currentSuggestions, triggerInput);
          const asyncProvider = getSiteSearchTriggerCandidate(
            triggerInput,
            getSearchTriggerProviders(items, definitions),
            asyncTopSiteMatch
          );
          if (asyncProvider) {
            activateSiteSearch(asyncProvider);
            return;
          }
          const asyncLocalScope = getLocalSearchScopeCandidate(triggerInput, rules);
          if (asyncLocalScope) {
            activateLocalSearchScope(asyncLocalScope);
            return;
          }
          if (pageState.autocompleteState && pageState.autocompleteState.completion) {
            acceptAutocompleteCompletion();
          }
        });
        return true;
      }
      if (pageState.autocompleteState && pageState.autocompleteState.completion) {
        event.preventDefault();
        acceptAutocompleteCompletion();
        return true;
      }
      return false;
    }

    return {
      handleSearchTabKey,
      getSearchModeProviders,
      isAggregateSearchDefinitionAvailable,
      getSearchTriggerProviders,
      getSearchModeMenuItems,
      getSearchSourceOrder,
      setSearchSourceOrder,
      invalidateSearchSourceOrder,
      loadSearchSourceOrder,
      openSearchModeMenuFromDoubleTab,
      selectSearchModeMenuItem,
      getLocalSearchScopeTabHintProvider,
      setLocalSearchScopePrefix,
      activateLocalSearchScope,
      clearLocalSearchScope,
      activateSiteSearch,
      clearSiteSearch
    };
  }

  root.LumnoNewtabSearchModes = { createSearchModes };
})(globalThis);
