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
      getThemeForProvider
    } = deps;

    // The page state object shared with newtab.js and the other modules.
    const pageState = deps.pageState;

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

    function buildSearchModeMenuItems() {
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
          iconClass: getLocalSearchScopeIconClass(sourceType),
          menuIconName: sourceType === 'topSite' ? 'star' : sourceType,
          active: Boolean(pageState.localSearchScopeState && pageState.localSearchScopeState.sourceType === sourceType)
        });
      });
      return items;
    }

    function getSearchModeMenuItems() {
      return Promise.all([
        loadSiteSearchIconCache(),
        getSiteSearchProviders(),
        getAggregateSearches()
      ]).then(buildSearchModeMenuItems);
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

    return {
      getSearchModeProviders,
      isAggregateSearchDefinitionAvailable,
      getSearchTriggerProviders,
      getSearchModeMenuItems,
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
