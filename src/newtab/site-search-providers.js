(function(root) {
  // Site search and aggregate search providers: loading, icons, labels and
  // the trigger/scope lookups used by the search input.
  function createSiteSearchProviders(deps) {
    const {
      SEARCH_UTILS,
      AGGREGATE_SEARCH_STORE,
      AGGREGATE_SEARCH_SURFACE,
      showToast,
      t,
      navigateToUrl,
      SHORTCUT_FAVICON,
      getPageFaviconUrlResolver,
      siteSearchIconCacheOptions,
      getExtensionResourceUrl,
      getCanonicalPageUrlForFavicon,
      getHostFromUrl,
      getPageFaviconRenderCandidates,
      isFaviconProxyUrl,
      attachFaviconWithFallbacks,
      SITE_SEARCH_STORE,
      storageArea,
      SITE_SEARCH_STORAGE_KEY,
      SITE_SEARCH_DISABLED_STORAGE_KEY,
      defaultSiteSearchProviders,
      formatMessage,
      getDirectNavigationUrl,
      getUrlDisplay,
      getHelpCenterLocale,
      SETTINGS
    } = deps;

    // The page state object shared with newtab.js and the other modules.
    const pageState = deps.pageState;

    let siteSearchProvidersLoadPromise = null;
    let aggregateSearchRequestController = null;

    function buildSearchUrl(template, query, provider) {
      if (!template) {
        return '';
      }
      const url = template.replace(/\{query\}/g, encodeURIComponent(query));
      return provider && typeof getHelpCenterLocale === 'function'
        ? SEARCH_UTILS.withHelpCenterLocale(url, provider, getHelpCenterLocale())
        : url;
    }

    function isAiSiteSearchProvider(provider) {
      return SEARCH_UTILS.isAiSiteSearchProvider(provider);
    }

    function isSearchEngineSiteSearchProvider(provider) {
      return SEARCH_UTILS.isSearchEngineSiteSearchProvider(provider);
    }

    function isAggregateSearchProvider(provider) {
      return AGGREGATE_SEARCH_STORE.isAggregateSearchProvider(provider);
    }

    function isInteractiveSiteSearchProvider(provider) {
      return SEARCH_UTILS.isInteractiveSiteSearchProvider(provider);
    }

    function getAggregateSearchRequestController() {
      if (aggregateSearchRequestController) {
        return aggregateSearchRequestController;
      }
      aggregateSearchRequestController = AGGREGATE_SEARCH_SURFACE.createAggregateSearchRequestController({
        chromeApi: chrome,
        onFeedback(descriptor) {
          showToast(t(descriptor.messageKey, descriptor.fallback), descriptor.isError);
        }
      });
      return aggregateSearchRequestController;
    }

    function runSiteSearchProviderQuery(provider, query, disposition) {
      const trimmedQuery = String(query || '').trim();
      if (!provider || !trimmedQuery) {
        return false;
      }
      if (isAggregateSearchProvider(provider) && provider.aggregateId) {
        const normalizedDisposition = disposition || 'currentTab';
        const controller = getAggregateSearchRequestController();
        if (!controller) {
          showToast(t('toast_error', 'Operation failed. Please try again.'), true);
          return true;
        }
        controller.run({
          aggregateId: String(provider.aggregateId),
          disposition: normalizedDisposition,
          query: trimmedQuery
        });
        return true;
      }
      if (isInteractiveSiteSearchProvider(provider)) {
        chrome.runtime.sendMessage({
          action: 'runSiteSearchProviderQuery',
          provider: provider,
          query: trimmedQuery,
          disposition: disposition || 'currentTab'
        });
        return true;
      }
      const siteUrl = buildSearchUrl(provider.template, trimmedQuery, provider);
      if (!siteUrl) {
        return false;
      }
      if (disposition === 'backgroundTab' || disposition === 'newTab') {
        chrome.runtime.sendMessage({
          action: 'createTab',
          url: siteUrl,
          disposition
        });
        return true;
      }
      navigateToUrl(siteUrl);
      return true;
    }

    function getProviderFaviconPageUrl(provider) {
      return SHORTCUT_FAVICON.getSiteSearchProviderPageUrl(provider);
    }

    function getProviderIcon(provider) {
      const resolver = getPageFaviconUrlResolver();
      if (!resolver) {
        return '';
      }
      const iconUrl = SHORTCUT_FAVICON.getSiteSearchProviderIcon(
        pageState.siteSearchIconCacheLoaded ? pageState.siteSearchIconCache : {}, provider, Date.now(), {
          ...siteSearchIconCacheOptions,
          resolveAssetUrl: getExtensionResourceUrl
        }
      );
      return resolver.getProviderFaviconUrl(getProviderFaviconPageUrl(provider), iconUrl);
    }

    function getProviderIconAttachPageUrl(provider, iconUrl, iconHost) {
      const providerPageUrl = getProviderFaviconPageUrl(provider);
      if (providerPageUrl) {
        return providerPageUrl;
      }
      const canonicalIconPageUrl = getCanonicalPageUrlForFavicon(iconUrl);
      if (canonicalIconPageUrl && canonicalIconPageUrl !== iconUrl) {
        return canonicalIconPageUrl;
      }
      const host = String(iconHost || '').trim();
      return host ? `https://${host}/` : '';
    }

    function attachInputModeProviderIcon(icon, context) {
      const iconUrl = context && context.iconUrl ? String(context.iconUrl).trim() : '';
      if (!icon || !iconUrl || iconUrl.startsWith('data:')) {
        return false;
      }
      const iconHost = context && context.iconHost ? String(context.iconHost).trim() : '';
      const pageUrl = getProviderIconAttachPageUrl(
        context && context.provider ? context.provider : null,
        iconUrl,
        iconHost
      );
      if (!pageUrl) {
        return false;
      }
      const hostKey = iconHost || getHostFromUrl(pageUrl);
      const candidates = getPageFaviconRenderCandidates(pageUrl, iconUrl, { allowRemoteImage: true }) || {};
      const primaryUrl = isFaviconProxyUrl(iconUrl)
        ? (candidates.primaryUrl || iconUrl)
        : iconUrl;
      attachFaviconWithFallbacks(icon, pageUrl, hostKey, {
        primaryUrl,
        allowRemoteImage: true,
        browserUrl: candidates.browserUrl || '',
        onUnavailable: context && context.onIconUnavailable
      });
      return true;
    }

    function beginSiteSearchProviderLoad(loader, options) {
      const settings = options && typeof options === 'object' ? options : {};
      if (settings.invalidate === true) {
        pageState.siteSearchProvidersLoadVersion += 1;
        siteSearchProvidersLoadPromise = null;
      }
      const loadVersion = pageState.siteSearchProvidersLoadVersion;
      let loadTask = null;
      loadTask = Promise.resolve().then(() => loader()).then((items) => {
        const normalizedItems = Array.isArray(items) ? items : [];
        if (loadVersion === pageState.siteSearchProvidersLoadVersion &&
            siteSearchProvidersLoadPromise === loadTask) {
          pageState.siteSearchProvidersCache = normalizedItems;
          return normalizedItems;
        }
        return pageState.siteSearchProvidersCache || [];
      }).catch(() => {
        if (loadVersion === pageState.siteSearchProvidersLoadVersion &&
            siteSearchProvidersLoadPromise === loadTask) {
          pageState.siteSearchProvidersCache = null;
        }
        return pageState.siteSearchProvidersCache || [];
      }).finally(() => {
        if (siteSearchProvidersLoadPromise === loadTask) {
          siteSearchProvidersLoadPromise = null;
        }
      });
      siteSearchProvidersLoadPromise = loadTask;
      return {
        promise: loadTask,
        version: loadVersion
      };
    }

    function getSiteSearchProviders() {
      if (siteSearchProvidersLoadPromise) {
        return siteSearchProvidersLoadPromise;
      }
      if (pageState.siteSearchProvidersCache) {
        return Promise.resolve(pageState.siteSearchProvidersCache);
      }
      return beginSiteSearchProviderLoad(() => SITE_SEARCH_STORE.loadSiteSearchProviders({
        chromeApi: chrome,
        storageArea,
        storageKeys: {
          custom: SITE_SEARCH_STORAGE_KEY,
          disabled: SITE_SEARCH_DISABLED_STORAGE_KEY
        },
        defaultProviders: defaultSiteSearchProviders,
        mergeCustomProviders: SEARCH_UTILS.mergeCustomProviders,
        getResourceUrl: getExtensionResourceUrl
      })).promise;
    }

    function reloadSiteSearchProvidersFromStorage() {
      return beginSiteSearchProviderLoad(() => {
        const keys = [SITE_SEARCH_STORAGE_KEY, SITE_SEARCH_DISABLED_STORAGE_KEY];
        const readTask = SITE_SEARCH_STORE.getStorageValues(storageArea, keys);
        return readTask.then((result) => {
          const customItems = Array.isArray(result[SITE_SEARCH_STORAGE_KEY])
            ? result[SITE_SEARCH_STORAGE_KEY]
            : [];
          const disabledKeys = Array.isArray(result[SITE_SEARCH_DISABLED_STORAGE_KEY])
            ? result[SITE_SEARCH_DISABLED_STORAGE_KEY]
            : [];
          return SITE_SEARCH_STORE.mergeStoredProviders(
            defaultSiteSearchProviders,
            customItems,
            disabledKeys,
            SEARCH_UTILS.mergeCustomProviders
          );
        });
      }, { invalidate: true });
    }

    function getAggregateSearches() {
      if (pageState.aggregateSearchesCache) {
        return Promise.resolve(pageState.aggregateSearchesCache);
      }
      if (pageState.aggregateSearchesLoadPromise) {
        return pageState.aggregateSearchesLoadPromise;
      }
      const loadVersion = pageState.aggregateSearchesLoadVersion;
      const loadTask = AGGREGATE_SEARCH_STORE.loadAggregateSearches(
        storageArea,
        pageState.AGGREGATE_SEARCH_STORAGE_KEY,
        chrome
      ).then((items) => {
        if (loadVersion === pageState.aggregateSearchesLoadVersion) {
          pageState.aggregateSearchesCache = items;
          return items;
        }
        return pageState.aggregateSearchesCache || [];
      }).catch(() => {
        if (loadVersion === pageState.aggregateSearchesLoadVersion) {
          pageState.aggregateSearchesCache = null;
          return [];
        }
        return pageState.aggregateSearchesCache || [];
      }).finally(() => {
        if (pageState.aggregateSearchesLoadPromise === loadTask) {
          pageState.aggregateSearchesLoadPromise = null;
        }
      });
      pageState.aggregateSearchesLoadPromise = loadTask;
      return loadTask;
    }

    function createAggregateSearchScopeProvider(definition) {
      return AGGREGATE_SEARCH_STORE.createScopeProvider(definition);
    }

    function getSiteSearchDisplayName(provider) {
      if (!provider) {
        return t('site_search_default', '站内');
      }
      const mapping = SEARCH_UTILS.getSiteSearchProviderDisplayNameMessage(provider);
      if (mapping) {
        return t(mapping.messageKey, mapping.fallback);
      }
      return provider.name || provider.key || t('site_search_default', '站内');
    }

    function getSiteSearchActionTitle(provider, query) {
      const site = getSiteSearchDisplayName(provider);
      const queryText = String(query || '').trim();
      if (isAggregateSearchProvider(provider)) {
        return queryText
          ? formatMessage('aggregate_search_action_query', '使用{name}搜索“{query}”', {
              name: site,
              query: queryText
            })
          : formatMessage('aggregate_search_action', '使用{name}搜索', { name: site });
      }
      if (isAiSiteSearchProvider(provider)) {
        return queryText
          ? formatMessage('ask_ai_provider_query', '向 {site} 提问 "{query}"', { site, query: queryText })
          : formatMessage('ask_ai_provider', '向 {site} 提问', { site });
      }
      return queryText
        ? formatMessage('search_in_site_query', '在 {site} 中搜索 "{query}"', { site, query: queryText })
        : formatMessage('search_in_site', '在 {site} 中搜索', { site });
    }

    function getSiteSearchPrefixText(provider) {
      if (isAiSiteSearchProvider(provider)) {
        return getSiteSearchDisplayName(provider);
      }
      return getSiteSearchDisplayName(provider) || formatMessage('search_in_site', '在 {site} 中搜索', {
        site: provider && provider.name ? provider.name : ''
      });
    }

    function findProviderForSuggestionMatch(suggestion, providers) {
      return SEARCH_UTILS.findProviderForSiteSearchSuggestion(suggestion, providers);
    }

    function getInlineSiteSearchCandidate(input, providers) {
      return SEARCH_UTILS.getInlineSiteSearchCandidate(input, providers);
    }

    function promoteStrongNavigationMatch(list, rawQuery) {
      return SEARCH_UTILS.promoteStrongNavigationMatch(list, rawQuery, {
        getDirectNavigationUrl,
        getUrlDisplay
      });
    }

    function getKeywordSearchSuggestionState(list) {
      return SEARCH_UTILS.getKeywordSearchSuggestionState(list);
    }

    function matchesTopSitePrefix(suggestion, input) {
      if (!suggestion || !(suggestion.type === 'topSite' || suggestion.isTopSite)) {
        return false;
      }
      const query = String(input || '').trim().toLowerCase();
      if (!query) {
        return false;
      }
      const titleText = String(suggestion.title || '').toLowerCase();
      if (titleText.startsWith(query)) {
        return true;
      }
      const urlText = getUrlDisplay(suggestion.url || '');
      if (!urlText) {
        return false;
      }
      const host = urlText.split('/')[0] || '';
      return host.toLowerCase().startsWith(query);
    }

    function getTopSiteMatchCandidate(list, input) {
      if (!Array.isArray(list)) {
        return null;
      }
      const query = String(input || '').trim();
      if (!query || /\s/.test(query)) {
        return null;
      }
      let fallback = null;
      for (let i = 0; i < list.length; i += 1) {
        const suggestion = list[i];
        if (!suggestion || !(suggestion.type === 'topSite' || suggestion.isTopSite)) {
          continue;
        }
        const urlText = getUrlDisplay(suggestion.url || '');
        const host = urlText ? (urlText.split('/')[0] || '') : '';
        if (host && host.toLowerCase().startsWith(query.toLowerCase())) {
          return suggestion;
        }
        if (!fallback && matchesTopSitePrefix(suggestion, query)) {
          fallback = suggestion;
        }
      }
      return fallback;
    }

    function promoteTopSiteMatch(list, queryText) {
      const match = getTopSiteMatchCandidate(list, queryText);
      if (!match) {
        return null;
      }
      const matchIndex = list.indexOf(match);
      const firstResultIndex = Array.isArray(list)
        ? list.findIndex((item) => item && item.type !== 'newtab')
        : -1;
      if (matchIndex !== firstResultIndex) {
        return null;
      }
      if (matchIndex > 0) {
        const [picked] = list.splice(matchIndex, 1);
        list.unshift(picked);
        return picked;
      }
      if (matchIndex === 0) {
        return list[0];
      }
      return null;
    }

    function getProviderHost(provider) {
      return SEARCH_UTILS.getSiteSearchProviderHost(provider);
    }

    function getSiteSearchTriggerCandidate(input, providers, topSiteMatch) {
      return SEARCH_UTILS.getSiteSearchTriggerCandidate(input, providers, topSiteMatch, {
        matchesTopSitePrefix
      });
    }

    function normalizeEnabledSearchResultSourceTypes(value) {
      return SETTINGS.normalizeSearchResultSourceTypes(value);
    }

    function normalizeSearchResultDisplayLimit(value) {
      return SETTINGS.normalizeSearchResultDisplayLimit(value);
    }

    function getLocalSearchScopeCandidate(input, rules) {
      const scope = SEARCH_UTILS.findLocalSearchScope(input, rules);
      if (!scope || !pageState.enabledSearchResultSourceTypes.includes(scope.sourceType)) {
        return null;
      }
      return scope;
    }

    function getLocalSearchScopeLabel(scope) {
      const sourceType = scope && scope.sourceType ? scope.sourceType : '';
      if (sourceType === 'bookmark') {
        return t('search_tag_bookmark', '书签');
      }
      if (sourceType === 'history') {
        return t('search_tag_history', '历史');
      }
      if (sourceType === 'topSite') {
        return t('search_tag_top_site', '常用');
      }
      return '';
    }

    function getLocalSearchScopeIconClass(sourceType) {
      if (sourceType === 'bookmark') {
        return 'ri-bookmark-3-line';
      }
      if (sourceType === 'history') {
        return 'ri-history-line';
      }
      return 'ri-star-line';
    }

    function getSearchModeProviderId(provider) {
      return `provider:${provider && (provider.key || provider.name) ? (provider.key || provider.name) : ''}`;
    }

    return {
      buildSearchUrl,
      isAiSiteSearchProvider,
      isSearchEngineSiteSearchProvider,
      isAggregateSearchProvider,
      runSiteSearchProviderQuery,
      getProviderFaviconPageUrl,
      getProviderIcon,
      attachInputModeProviderIcon,
      getSiteSearchProviders,
      reloadSiteSearchProvidersFromStorage,
      getAggregateSearches,
      createAggregateSearchScopeProvider,
      getSiteSearchDisplayName,
      getSiteSearchActionTitle,
      getSiteSearchPrefixText,
      findProviderForSuggestionMatch,
      getInlineSiteSearchCandidate,
      promoteStrongNavigationMatch,
      getKeywordSearchSuggestionState,
      getTopSiteMatchCandidate,
      promoteTopSiteMatch,
      getProviderHost,
      getSiteSearchTriggerCandidate,
      normalizeEnabledSearchResultSourceTypes,
      normalizeSearchResultDisplayLimit,
      getLocalSearchScopeCandidate,
      getLocalSearchScopeLabel,
      getLocalSearchScopeIconClass,
      getSearchModeProviderId
    };
  }

  root.LumnoNewtabSiteSearchProviders = { createSiteSearchProviders };
})(globalThis);
