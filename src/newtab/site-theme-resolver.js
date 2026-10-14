(function(root) {
  // Resolves per-site accent themes from favicons and brand colors, caches them,
  // and applies them to suggestion rows, shortcut tiles and bookmark/recent cards.
  function createSiteThemeResolver(deps) {
    const {
      NEWTAB_FAVICON_THEME,
      FAVICON_UTILS,
      getExtensionResourceUrl,
      normalizeHost,
      parseCssColor,
      defaultAccentColor,
      defaultTheme,
      getProviderHost,
      recentCards,
      applyRecentCardTheme,
      bookmarkCards,
      applyBookmarkCardTheme,
      shortcutTiles,
      applyShortcutTileTheme,
      suggestionItems,
      setSiteSearchPrefix,
      updateSelection,
      setPersistedSiteThemeEntry,
      getPersistedSiteThemeEntry,
      getPageFaviconUrlResolver,
      getBrandAccentForUrl,
      extractAverageColor,
      getProviderIcon,
      isHostFaviconVisitDirty,
      stableHashCode,
      getThemeSourceForSuggestion,
      areFaviconRenderCachesReady
    } = deps;

    // The page state object shared with newtab.js and the other modules.
    const pageState = deps.pageState;

    const THEME_ICON_LOAD_TIMEOUT_MS = 2400;
    const THEME_RESOLUTION_BATCH_SIZE = 2;
    const THEME_RESOLUTION_BATCH_DELAY_MS = 160;
    const buildTheme = NEWTAB_FAVICON_THEME.buildTheme;
    const getBrandAccentForHost = NEWTAB_FAVICON_THEME.getBrandAccentForHost;
    const getThemeFingerprint = NEWTAB_FAVICON_THEME.getThemeFingerprint;
    const normalizeFaviconHost = FAVICON_UTILS.normalizeFaviconHost || NEWTAB_FAVICON_THEME.normalizeFaviconHost;
    const hasThemeTokenInUrl = FAVICON_UTILS.hasThemeTokenInUrl || NEWTAB_FAVICON_THEME.hasThemeTokenInUrl;
    const shouldSkipThemeUpgradeCandidate = FAVICON_UTILS.shouldSkipThemeUpgradeCandidate || NEWTAB_FAVICON_THEME.shouldSkipThemeUpgradeCandidate;
    const getKnownThemedFaviconCandidates = (hostname, preferredTheme) => FAVICON_UTILS.getKnownThemedFaviconCandidateUrls(hostname, preferredTheme, {
      getRuntimeUrl: getExtensionResourceUrl
    });

    const getRootFaviconCandidates = FAVICON_UTILS.getRootFaviconCandidateUrls;
    const hostHasExplicitDarkFavicon = FAVICON_UTILS.hostHasExplicitDarkFavicon || NEWTAB_FAVICON_THEME.hostHasExplicitDarkFavicon;
    const isFaviconProxyUrl = FAVICON_UTILS.isFaviconProxyUrl || NEWTAB_FAVICON_THEME.isFaviconProxyUrl;
    const themeColorCache = window._x_extension_theme_color_cache_2024_unique_ || new Map();

    window._x_extension_theme_color_cache_2024_unique_ = themeColorCache;

    const themeHostCache = window._x_extension_theme_host_cache_2024_unique_ || new Map();

    window._x_extension_theme_host_cache_2024_unique_ = themeHostCache;

    const siteThemeRequestPending = new Map();
    const themeFaviconCandidateRequestPending = new Map();

    function getHighlightColors(theme) {
      const resolvedTheme = getThemeForMode(theme);
      if (!resolvedTheme || !resolvedTheme._xIsBrand) {
        return {
          bg: 'var(--x-nt-hover-bg, #F3F4F6)',
          border: 'transparent'
        };
      }
      return {
        bg: resolvedTheme.highlightBg,
        border: resolvedTheme.highlightBorder
      };
    }

    function getHostFromUrl(url) {
      if (!url) {
        return '';
      }
      try {
        return normalizeHost(new URL(getCanonicalPageUrlForFavicon(url) || url).hostname);
      } catch (e) {
        return '';
      }
    }

    function getCanonicalPageUrlForFavicon(url) {
      return FAVICON_UTILS.getCanonicalPageUrlForFavicon(url);
    }

    function normalizeAccentRgb(value) {
      if (!Array.isArray(value) || value.length !== 3) {
        return null;
      }
      const rgb = value.map((channel) => Math.round(Number(channel)));
      return rgb.every((channel) => Number.isFinite(channel) && channel >= 0 && channel <= 255)
        ? rgb
        : null;
    }

    function isNeutralThemeAccent(value) {
      const rgb = normalizeAccentRgb(value);
      if (!rgb) {
        return false;
      }
      return FAVICON_UTILS.isNeutralThemeColor(rgb);
    }

    function normalizeThemeConfidence(value, accentRgb) {
      const confidence = String(value || '').trim().toLowerCase();
      if (confidence === 'color' || confidence === 'neutral') {
        return confidence;
      }
      return isNeutralThemeAccent(accentRgb) ? 'neutral' : 'color';
    }

    function normalizeThemeSource(source) {
      const value = String(source || '').trim().toLowerCase();
      if (
        value === 'brand' ||
        value === 'mask-icon' ||
        value === 'meta' ||
        value === 'manifest' ||
        value === 'favicon' ||
        value === 'url'
      ) {
        return value;
      }
      return 'fallback';
    }

    function getThemeSourcePriority(source, theme) {
      const value = normalizeThemeSource(source);
      if (value === 'brand') {
        return 40;
      }
      if (value === 'mask-icon') {
        return 38;
      }
      if (value === 'meta') {
        return theme && isLowConfidenceTheme(theme) ? 20 : 34;
      }
      if (value === 'manifest') {
        return theme && isLowConfidenceTheme(theme) ? 18 : 32;
      }
      if (value === 'favicon') {
        return 24;
      }
      if (value === 'url') {
        return 18;
      }
      return 10;
    }

    function getThemeSource(theme) {
      if (!theme) {
        return 'fallback';
      }
      return normalizeThemeSource(theme._xThemeSource || (theme._xIsDefault ? 'fallback' : (theme._xIsBrand ? 'brand' : 'fallback')));
    }

    function getThemeColorFingerprint(theme) {
      const rgb = theme && normalizeAccentRgb(theme.accentRgb || parseCssColor(theme.accent));
      return (rgb || defaultAccentColor).join(',');
    }

    function buildThemeFromAccent(accentRgb, source) {
      const rgb = normalizeAccentRgb(accentRgb);
      if (!rgb) {
        return defaultTheme;
      }
      const theme = buildTheme(rgb);
      const normalizedSource = normalizeThemeSource(source);
      const confidence = normalizeThemeConfidence(null, rgb);
      theme._xThemeSource = normalizedSource;
      theme._xIsBrand = normalizedSource !== 'fallback';
      theme._xIsDefault = normalizedSource === 'fallback';
      theme._xThemeNeutral = confidence === 'neutral';
      theme._xThemeConfidence = confidence;
      return theme;
    }

    function buildThemeFromThemeResult(result, fallbackSource) {
      const accentRgb = result && normalizeAccentRgb(result.accentRgb);
      if (!accentRgb) {
        return null;
      }
      const source = normalizeThemeSource((result && result.source) || fallbackSource || 'meta');
      const confidence = normalizeThemeConfidence(result && result.confidence, accentRgb);
      const theme = buildThemeFromAccent(accentRgb, source);
      theme._xThemeNeutral = typeof (result && result.neutral) === 'boolean'
        ? result.neutral
        : confidence === 'neutral';
      theme._xThemeConfidence = confidence;
      return theme;
    }

    function isLowConfidenceTheme(theme) {
      if (!theme) {
        return false;
      }
      const source = getThemeSource(theme);
      if (source !== 'meta' && source !== 'manifest') {
        return false;
      }
      const accentRgb = normalizeAccentRgb(theme.accentRgb || parseCssColor(theme.accent));
      const confidence = normalizeThemeConfidence(theme._xThemeConfidence, accentRgb);
      return theme._xThemeNeutral === true || confidence === 'neutral';
    }

    function isPersistableTheme(theme) {
      const source = getThemeSource(theme);
      return source === 'brand' ||
        source === 'mask-icon' ||
        source === 'meta' ||
        source === 'manifest' ||
        source === 'favicon';
    }

    function getProviderThemeHost(provider) {
      return normalizeHost(getProviderHost(provider));
    }

    function getThemeHostForSuggestion(suggestion) {
      if (!suggestion) {
        return '';
      }
      if (suggestion.provider) {
        return getProviderThemeHost(suggestion.provider);
      }
      if (suggestion.url) {
        return getHostFromUrl(suggestion.url);
      }
      if (suggestion.favicon) {
        return getHostFromUrl(suggestion.favicon);
      }
      return '';
    }

    function getThemePageUrlForSuggestion(suggestion, hostKey) {
      if (suggestion && suggestion.url) {
        try {
          const parsed = new URL(getCanonicalPageUrlForFavicon(suggestion.url) || suggestion.url);
          if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            return parsed.href;
          }
        } catch (e) {
          // Ignore malformed URLs.
        }
      }
      const host = normalizeHost(hostKey || '');
      return host ? `https://${host}/` : '';
    }

    // Tiles showing a custom upload, saved snapshot or bundled glyph take their
    // tint from that artwork rather than from whichever icon set the host theme.
    function refreshShortcutTileTheme(tile, hostTheme, normalizedHost) {
      if (tile.getAttribute('data-shortcut-custom-icon') === 'true') {
        return;
      }
      const suggestion = { type: 'shortcut', url: tile.getAttribute('data-shortcut-url') || '' };
      if (!suggestion.url || !getThemeSourceForSuggestion(suggestion)) {
        tile._xTheme = hostTheme;
        applyShortcutTileTheme(tile, hostTheme, normalizedHost);
        return;
      }
      // A snapshot saved after the tile mounted is picked up here.
      getThemeForSuggestion(suggestion).then((iconTheme) => {
        if (!tile.isConnected || normalizeHost(tile._xHost || '') !== normalizedHost) {
          return;
        }
        tile._xTheme = iconTheme || defaultTheme;
        applyShortcutTileTheme(tile, tile._xTheme, normalizedHost);
      });
    }

    function refreshThemeConsumersForHost(hostKey, theme) {
      const normalizedHost = normalizeHost(hostKey);
      if (!normalizedHost || !theme) {
        return;
      }
      recentCards.forEach((card) => {
        if (card && normalizeHost(card._xHost || '') === normalizedHost) {
          card._xTheme = theme;
          applyRecentCardTheme(card, theme, normalizedHost);
        }
      });
      bookmarkCards.forEach((card) => {
        if (card && normalizeHost(card._xHost || '') === normalizedHost) {
          card._xTheme = theme;
          applyBookmarkCardTheme(card, theme, normalizedHost);
        }
      });
      shortcutTiles.forEach((tile) => {
        if (tile && normalizeHost(tile._xHost || '') === normalizedHost) {
          refreshShortcutTileTheme(tile, theme, normalizedHost);
        }
      });
      suggestionItems.forEach((item) => {
        if (item && normalizeHost(item._xThemeHost || '') === normalizedHost) {
          item._xTheme = theme;
          applyThemeVariables(item, theme);
        }
      });
      if (pageState.siteSearchState && getProviderThemeHost(pageState.siteSearchState) === normalizedHost) {
        setSiteSearchPrefix(pageState.siteSearchState, theme);
      }
      updateSelection();
    }

    function setResolvedThemeForHost(hostKey, theme, options) {
      const normalizedHost = normalizeHost(hostKey);
      const nextTheme = theme || defaultTheme;
      const iconUrl = options && options.iconUrl ? String(options.iconUrl) : '';
      if (iconUrl) {
        themeColorCache.set(iconUrl, nextTheme);
      }
      if (!normalizedHost) {
        return nextTheme;
      }
      const currentTheme = themeHostCache.get(normalizedHost);
      if (
        currentTheme &&
        getThemeSourcePriority(getThemeSource(currentTheme), currentTheme) >
          getThemeSourcePriority(getThemeSource(nextTheme), nextTheme)
      ) {
        if (iconUrl) {
          themeColorCache.set(iconUrl, currentTheme);
        }
        return currentTheme;
      }
      const previousFingerprint = currentTheme ? getThemeFingerprint(currentTheme) : '';
      const nextFingerprint = getThemeFingerprint(nextTheme);
      if (currentTheme && previousFingerprint === nextFingerprint) {
        return currentTheme;
      }
      const shouldRefreshConsumers = !currentTheme ||
        getThemeColorFingerprint(currentTheme) !== getThemeColorFingerprint(nextTheme);
      themeHostCache.set(normalizedHost, nextTheme);
      if (isPersistableTheme(nextTheme) && (!options || options.persist !== false)) {
        setPersistedSiteThemeEntry(normalizedHost, nextTheme);
      }
      if (shouldRefreshConsumers && (!options || options.refresh !== false)) {
        refreshThemeConsumersForHost(normalizedHost, nextTheme);
      }
      return nextTheme;
    }

    function getPersistedThemeForHost(hostKey) {
      const normalizedHost = normalizeHost(hostKey);
      if (!normalizedHost) {
        return null;
      }
      const entry = getPersistedSiteThemeEntry(normalizedHost);
      const accentRgb = entry ? normalizeAccentRgb(entry.accentRgb) : null;
      if (!accentRgb) {
        return null;
      }
      // Entries saved before placeholder globes were filtered out.
      if (normalizeThemeSource(entry.source) === 'favicon' && FAVICON_UTILS.isPlaceholderFaviconColor(accentRgb)) {
        return null;
      }
      const theme = buildThemeFromThemeResult(entry, entry.source);
      if (!theme) {
        return null;
      }
      if (isLowConfidenceTheme(theme)) {
        return theme;
      }
      return setResolvedThemeForHost(normalizedHost, theme, { persist: false, refresh: false });
    }

    function requestSiteThemeColor(pageUrl, hostKey) {
      const url = String(pageUrl || '').trim();
      const host = normalizeHost(hostKey);
      if (!url || !host || !chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
        return Promise.resolve(null);
      }
      const requestKey = `${host}::${url}::${getFaviconPreferredTheme()}`;
      if (siteThemeRequestPending.has(requestKey)) {
        return siteThemeRequestPending.get(requestKey);
      }
      const promise = new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'resolveSiteThemeColor',
          url,
          host,
          preferredTheme: getFaviconPreferredTheme()
        }, (response) => {
          const accentRgb = response && normalizeAccentRgb(response.accentRgb);
          resolve(accentRgb ? {
            accentRgb,
            source: response.source || 'meta',
            neutral: response.neutral === true,
            confidence: normalizeThemeConfidence(response.confidence, accentRgb)
          } : null);
        });
      }).catch(() => null).then((result) => {
        siteThemeRequestPending.delete(requestKey);
        return result;
      });
      siteThemeRequestPending.set(requestKey, promise);
      return promise;
    }

    function getThemeFaviconCandidateUrls(urls) {
      return FAVICON_UTILS.getThemeFaviconCandidateUrls(urls, { includeProxy: true });
    }

    function requestThemeFaviconCandidates(pageUrl, hostKey) {
      const url = String(pageUrl || '').trim();
      const host = normalizeHost(hostKey);
      if (!url || !host || !chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
        return Promise.resolve([]);
      }
      const requestKey = `${host}::${url}::${getFaviconPreferredTheme()}`;
      if (themeFaviconCandidateRequestPending.has(requestKey)) {
        return themeFaviconCandidateRequestPending.get(requestKey);
      }
      const promise = new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'resolveFaviconCandidates',
          url,
          host,
          fallbackUrl: '',
          preferredTheme: getFaviconPreferredTheme(),
          excludeChromeFallback: true
        }, (response) => {
          const resolved = response && Array.isArray(response.urls) ? response.urls : [];
          resolve(getThemeFaviconCandidateUrls(resolved));
        });
      }).catch(() => []).then((result) => {
        themeFaviconCandidateRequestPending.delete(requestKey);
        return Array.isArray(result) ? result : [];
      });
      themeFaviconCandidateRequestPending.set(requestKey, promise);
      return promise;
    }

    function getThemeFromUrl(url, hostOverride, options) {
      const resolver = getPageFaviconUrlResolver();
      url = resolver ? resolver.getSafeFaviconCandidateUrl(url, '', 'theme') : '';
      if (!url) {
        return Promise.resolve(defaultTheme);
      }
      const hostKey = normalizeHost(hostOverride || getHostFromUrl(url));
      const isProxy = isFaviconProxyUrl(url);
      const useHostCache = hostKey && (!isProxy || Boolean(hostOverride));
      const preferIconTheme = Boolean(options && options.preferIconTheme);
      if (useHostCache && !preferIconTheme && themeHostCache.has(hostKey)) {
        const cachedTheme = themeHostCache.get(hostKey);
        if (
          cachedTheme &&
          !cachedTheme._xIsDefault &&
          getThemeSourcePriority(getThemeSource(cachedTheme), cachedTheme) >= getThemeSourcePriority('favicon')
        ) {
          return Promise.resolve(cachedTheme);
        }
      }
      if (themeColorCache.has(url)) {
        const cachedTheme = themeColorCache.get(url);
        if (cachedTheme && !isLowConfidenceTheme(cachedTheme)) {
          return Promise.resolve(cachedTheme);
        }
      }
      const brandAccent = (isProxy && hostOverride) ? null : getBrandAccentForUrl(url);
      if (brandAccent) {
        const brandTheme = buildThemeFromAccent(brandAccent, 'brand');
        themeColorCache.set(url, brandTheme);
        if (useHostCache) {
          setResolvedThemeForHost(hostKey, brandTheme, { iconUrl: url });
        }
        return Promise.resolve(brandTheme);
      }
      const cachedFaviconData = pageState.faviconDataCache.get(url);
      if (cachedFaviconData) {
        return loadThemeFromImageSource(url, cachedFaviconData, hostKey, useHostCache, { preferIconTheme });
      }
      return withThemeTimeout(pageState.requestFaviconData(url), THEME_ICON_LOAD_TIMEOUT_MS, null).then((dataUrl) => {
        if (dataUrl) {
          return loadThemeFromImageSource(url, dataUrl, hostKey, useHostCache, { preferIconTheme });
        }
        if (isProxy) {
          themeColorCache.set(url, defaultTheme);
          return defaultTheme;
        }
        return loadThemeFromImageSource(url, url, hostKey, useHostCache, { crossOrigin: true, preferIconTheme });
      });
    }

    function withThemeTimeout(promise, timeoutMs, fallbackValue) {
      return new Promise((resolve) => {
        let settled = false;
        const timer = Number.isFinite(timeoutMs) && timeoutMs > 0
          ? window.setTimeout(() => finish(fallbackValue), timeoutMs)
          : null;
        function finish(value) {
          if (settled) {
            return;
          }
          settled = true;
          if (timer !== null) {
            window.clearTimeout(timer);
          }
          resolve(value);
        }
        Promise.resolve(promise).then(finish).catch(() => finish(fallbackValue));
      });
    }

    function loadThemeFromImageSource(url, imageSource, hostKey, useHostCache, options) {
      return new Promise((resolve) => {
        let settled = false;
        const timer = window.setTimeout(() => {
          themeColorCache.set(url, defaultTheme);
          finish(defaultTheme);
        }, THEME_ICON_LOAD_TIMEOUT_MS);
        function finish(theme) {
          if (settled) {
            return;
          }
          settled = true;
          if (timer !== null) {
            window.clearTimeout(timer);
          }
          resolve(theme || defaultTheme);
        }
        const image = new Image();
        if (options && options.crossOrigin) {
          image.crossOrigin = 'anonymous';
        }
        image.onload = function() {
          const avg = extractAverageColor(image);
          // A generic globe says nothing about the site; treat it as unresolved so
          // it neither tints this consumer nor leaks into the host cache.
          if (!avg || FAVICON_UTILS.isPlaceholderFaviconColor(avg)) {
            themeColorCache.set(url, defaultTheme);
            finish(defaultTheme);
            return;
          }
          const theme = buildThemeFromAccent(avg, 'favicon');
          themeColorCache.set(url, theme);
          if (useHostCache) {
            // A higher-priority host theme would otherwise replace this icon's
            // own cache entry; icon-first consumers keep what they measured.
            setResolvedThemeForHost(hostKey, theme, {
              iconUrl: options && options.preferIconTheme ? '' : url
            });
          }
          finish(theme);
        };
        image.onerror = function() {
          themeColorCache.set(url, defaultTheme);
          finish(defaultTheme);
        };
        image.src = imageSource;
      });
    }

    function buildAndCacheBrandThemeForHost(hostKey, iconUrl) {
      const normalizedHost = normalizeHost(hostKey);
      if (!normalizedHost) {
        return null;
      }
      const brandAccent = getBrandAccentForHost(normalizedHost);
      if (!brandAccent) {
        return null;
      }
      const brandTheme = buildThemeFromAccent(brandAccent, 'brand');
      setResolvedThemeForHost(normalizedHost, brandTheme, {
        iconUrl,
        refresh: false
      });
      if (iconUrl) {
        themeColorCache.set(iconUrl, brandTheme);
      }
      return brandTheme;
    }

    function getThemeFromResolvedFaviconCandidates(pageUrl, hostKey, iconUrl) {
      return requestThemeFaviconCandidates(pageUrl, hostKey).then((candidateUrls) => {
        const candidates = getThemeFaviconCandidateUrls([
          ...candidateUrls,
          iconUrl
        ]);
        let index = 0;
        const next = () => {
          const candidate = candidates[index];
          index += 1;
          if (!candidate) {
            return Promise.resolve(defaultTheme);
          }
          return getThemeFromUrl(candidate, hostKey).then((theme) => {
            if (theme && !theme._xIsDefault) {
              return theme;
            }
            return next();
          });
        };
        return next();
      });
    }

    function resolveThemeWithFaviconFallback(hostKey, iconUrl, persistedTheme, siteTheme, pageUrl) {
      const siteThemeValue = siteTheme ? buildThemeFromThemeResult(siteTheme, siteTheme.source || 'meta') : null;
      if (siteThemeValue && !isLowConfidenceTheme(siteThemeValue)) {
        return Promise.resolve(setResolvedThemeForHost(hostKey, siteThemeValue, { iconUrl }));
      }
      return getThemeFromUrl(iconUrl, hostKey).then((theme) => {
        if (theme && !theme._xIsDefault) {
          return theme;
        }
        return getThemeFromResolvedFaviconCandidates(pageUrl, hostKey, iconUrl).then((candidateTheme) => {
          if (candidateTheme && !candidateTheme._xIsDefault) {
            return candidateTheme;
          }
          if (siteThemeValue) {
            return setResolvedThemeForHost(hostKey, siteThemeValue, { iconUrl });
          }
          if (persistedTheme) {
            return setResolvedThemeForHost(hostKey, persistedTheme, {
              iconUrl,
              persist: false
            });
          }
          return defaultTheme;
        });
      });
    }

    function getThemeForProvider(provider) {
      const hostKey = getProviderThemeHost(provider);
      const providerPageUrl = getThemePageUrlForSuggestion({ provider }, hostKey);
      const resolver = getPageFaviconUrlResolver();
      const iconUrl = resolver ? resolver.resolveFaviconSource(getProviderIcon(provider), providerPageUrl) : '';
      if (hostKey && themeHostCache.has(hostKey)) {
        const cachedTheme = themeHostCache.get(hostKey);
        if (cachedTheme && !isLowConfidenceTheme(cachedTheme)) {
          return Promise.resolve(cachedTheme);
        }
      }
      if (iconUrl && themeColorCache.has(iconUrl)) {
        const cachedIconTheme = themeColorCache.get(iconUrl);
        if (cachedIconTheme && !isLowConfidenceTheme(cachedIconTheme)) {
          return Promise.resolve(cachedIconTheme);
        }
      }
      const brandTheme = buildAndCacheBrandThemeForHost(hostKey, iconUrl);
      if (brandTheme) {
        return Promise.resolve(brandTheme);
      }
      const persistedTheme = getPersistedThemeForHost(hostKey);
      if (persistedTheme && !isHostFaviconVisitDirty(hostKey) && !isLowConfidenceTheme(persistedTheme)) {
        return Promise.resolve(persistedTheme);
      }
      const pageUrl = providerPageUrl;
      return requestSiteThemeColor(pageUrl, hostKey).then((siteTheme) => {
        return resolveThemeWithFaviconFallback(hostKey, iconUrl, persistedTheme, siteTheme, pageUrl);
      });
    }

    function shouldUseBrandTheme(suggestion) {
      if (!suggestion) {
        return false;
      }
      const neutralTypes = ['googleSuggest', 'newtab', 'modeSwitch', 'zenSwitch', 'chatgpt', 'perplexity', 'commandNewTab', 'commandSettings', 'commandDocumentPip'];
      if (neutralTypes.includes(suggestion.type)) {
        return false;
      }
      return true;
    }

    function getCustomShortcutThemeImageDataUrl(suggestion) {
      const dataUrl = String(
        suggestion && suggestion.customIconDataUrl
          ? suggestion.customIconDataUrl
          : ''
      ).trim();
      return /^data:image\/(?:png|jpe?g|webp);base64,/i.test(dataUrl)
        ? dataUrl
        : '';
    }

    function getCustomShortcutThemeCacheKey(dataUrl) {
      const source = String(dataUrl || '');
      return source
        ? `shortcut-custom-icon:${source.length}:${stableHashCode(source)}`
        : '';
    }

    function markCustomShortcutTheme(theme) {
      if (theme && theme !== defaultTheme && !theme._xIsDefault) {
        theme._xIsCustomShortcutIcon = true;
      }
      return theme || defaultTheme;
    }

    function getThemeForSuggestion(suggestion) {
      if (!shouldUseBrandTheme(suggestion)) {
        return Promise.resolve(defaultTheme);
      }
      const customShortcutIcon = getCustomShortcutThemeImageDataUrl(suggestion);
      if (customShortcutIcon) {
        const customThemeCacheKey = getCustomShortcutThemeCacheKey(customShortcutIcon);
        if (customThemeCacheKey && themeColorCache.has(customThemeCacheKey)) {
          return Promise.resolve(markCustomShortcutTheme(
            themeColorCache.get(customThemeCacheKey)
          ));
        }
        return loadThemeFromImageSource(
          customThemeCacheKey,
          customShortcutIcon,
          '',
          false
        ).then(markCustomShortcutTheme);
      }
      if (suggestion && suggestion.provider) {
        return getThemeForProvider(suggestion.provider);
      }
      const hostKey = getThemeHostForSuggestion(suggestion);
      const iconUrl = getThemeSourceForSuggestion(suggestion);
      const brandTheme = buildAndCacheBrandThemeForHost(hostKey, iconUrl);
      if (brandTheme) {
        return Promise.resolve(brandTheme);
      }
      if (suggestion && suggestion.type === 'shortcut') {
        // Tint from the artwork the tile actually shows, not whatever icon another
        // surface happened to load for the same host.
        if (!iconUrl) {
          return Promise.resolve(defaultTheme);
        }
        return getThemeFromUrl(iconUrl, hostKey, { preferIconTheme: true }).then((theme) => {
          if (theme && !theme._xIsDefault) {
            return theme;
          }
          const hostTheme = hostKey ? themeHostCache.get(hostKey) : null;
          return hostTheme && !hostTheme._xIsDefault && !isLowConfidenceTheme(hostTheme)
            ? hostTheme
            : theme;
        });
      }
      const persistedTheme = getPersistedThemeForHost(hostKey);
      if (persistedTheme && !isHostFaviconVisitDirty(hostKey) && !isLowConfidenceTheme(persistedTheme)) {
        return Promise.resolve(persistedTheme);
      }
      const pageUrl = getThemePageUrlForSuggestion(suggestion, hostKey);
      return requestSiteThemeColor(pageUrl, hostKey).then((siteTheme) => {
        return resolveThemeWithFaviconFallback(hostKey, iconUrl, persistedTheme, siteTheme, pageUrl);
      });
    }

    function getImmediateThemeForSuggestion(suggestion) {
      if (!shouldUseBrandTheme(suggestion)) {
        return defaultTheme;
      }
      const customShortcutIcon = getCustomShortcutThemeImageDataUrl(suggestion);
      if (customShortcutIcon) {
        const customThemeCacheKey = getCustomShortcutThemeCacheKey(customShortcutIcon);
        return customThemeCacheKey && themeColorCache.has(customThemeCacheKey)
          ? markCustomShortcutTheme(themeColorCache.get(customThemeCacheKey))
          : defaultTheme;
      }
      if (suggestion && suggestion.provider) {
        const hostKey = getProviderThemeHost(suggestion.provider);
        const iconUrl = getProviderIcon(suggestion.provider);
        if (hostKey && themeHostCache.has(hostKey)) {
          const cachedTheme = themeHostCache.get(hostKey);
          if (cachedTheme && !isLowConfidenceTheme(cachedTheme)) {
            return cachedTheme;
          }
        }
        if (iconUrl && themeColorCache.has(iconUrl)) {
          const cachedIconTheme = themeColorCache.get(iconUrl);
          if (cachedIconTheme && !isLowConfidenceTheme(cachedIconTheme)) {
            return cachedIconTheme;
          }
        }
        const brandTheme = buildAndCacheBrandThemeForHost(hostKey, iconUrl);
        if (brandTheme) {
          return brandTheme;
        }
        const persistedTheme = getPersistedThemeForHost(hostKey);
        if (persistedTheme && !isLowConfidenceTheme(persistedTheme)) {
          return persistedTheme;
        }
        return defaultTheme;
      }
      if (suggestion && suggestion.url) {
        const hostKey = getHostFromUrl(suggestion.url);
        if (suggestion.type === 'shortcut') {
          const iconUrl = getThemeSourceForSuggestion(suggestion);
          const iconTheme = iconUrl ? themeColorCache.get(iconUrl) : null;
          if (iconTheme && !iconTheme._xIsDefault) {
            return iconTheme;
          }
        }
        if (hostKey && themeHostCache.has(hostKey)) {
          const cachedTheme = themeHostCache.get(hostKey);
          if (cachedTheme && !isLowConfidenceTheme(cachedTheme)) {
            return cachedTheme;
          }
        }
        if (themeColorCache.has(suggestion.url)) {
          const cachedUrlTheme = themeColorCache.get(suggestion.url);
          if (cachedUrlTheme && !isLowConfidenceTheme(cachedUrlTheme)) {
            return cachedUrlTheme;
          }
        }
        const brandTheme = buildAndCacheBrandThemeForHost(hostKey, suggestion.url);
        if (brandTheme) {
          return brandTheme;
        }
        const persistedTheme = getPersistedThemeForHost(hostKey);
        if (persistedTheme && !isLowConfidenceTheme(persistedTheme)) {
          return persistedTheme;
        }
        return defaultTheme;
      }
      return defaultTheme;
    }

    function shouldUseUrlFallbackThemeForSuggestion(suggestion, theme) {
      if (!suggestion || !shouldUseBrandTheme(suggestion)) {
        return false;
      }
      const resolvedTheme = theme || defaultTheme;
      if (!resolvedTheme._xIsDefault && !isLowConfidenceTheme(resolvedTheme)) {
        return false;
      }
      const iconUrl = getThemeSourceForSuggestion(suggestion);
      return Boolean(iconUrl && isFaviconProxyUrl(iconUrl));
    }

    const themeResolutionQueue = [];
    const queuedThemeResolutionByTarget = new WeakMap();
    let themeResolutionSequence = 0;
    let themeResolutionFlushTimer = null;
    let themeResolutionCacheWaitStarted = false;

    function scheduleThemeResolutionFlush(delayMs) {
      if (themeResolutionFlushTimer !== null) {
        return;
      }
      themeResolutionFlushTimer = window.setTimeout(() => {
        themeResolutionFlushTimer = null;
        flushThemeResolutionQueue();
      }, Math.max(0, Number(delayMs) || 0));
    }

    function flushThemeResolutionQueue() {
      if (themeResolutionQueue.length === 0) {
        return;
      }
      if (!areFaviconRenderCachesReady()) {
        if (!themeResolutionCacheWaitStarted) {
          themeResolutionCacheWaitStarted = true;
          pageState.faviconCacheRuntime.ensureCachesReady().then(() => {
            themeResolutionCacheWaitStarted = false;
            scheduleThemeResolutionFlush(0);
          });
        }
        return;
      }
      themeResolutionQueue.sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        return a.sequence - b.sequence;
      });
      const batch = themeResolutionQueue.splice(0, THEME_RESOLUTION_BATCH_SIZE);
      batch.forEach((item) => {
        if (!item || !item.target || !item.target.isConnected) {
          return;
        }
        if (queuedThemeResolutionByTarget.get(item.target) !== item) {
          return;
        }
        queuedThemeResolutionByTarget.delete(item.target);
        getThemeForSuggestion(item.suggestion).then((theme) => {
          if (!item.target || !item.target.isConnected) {
            return;
          }
          item.applyTheme(theme || defaultTheme);
        });
      });
      if (themeResolutionQueue.length > 0) {
        scheduleThemeResolutionFlush(THEME_RESOLUTION_BATCH_DELAY_MS);
      }
    }

    function queueThemeForTarget(target, suggestion, applyTheme, options) {
      if (!target || typeof applyTheme !== 'function') {
        return;
      }
      if (!shouldUseBrandTheme(suggestion)) {
        return;
      }
      const existing = queuedThemeResolutionByTarget.get(target);
      const item = {
        target,
        suggestion,
        applyTheme,
        priority: Number.isFinite(options && options.priority) ? options.priority : 1,
        sequence: themeResolutionSequence += 1
      };
      if (existing) {
        existing.suggestion = item.suggestion;
        existing.applyTheme = item.applyTheme;
        existing.priority = Math.min(existing.priority, item.priority);
        existing.sequence = item.sequence;
      } else {
        queuedThemeResolutionByTarget.set(target, item);
        themeResolutionQueue.push(item);
      }
      scheduleThemeResolutionFlush(options && Number.isFinite(options.delayMs)
        ? options.delayMs
        : THEME_RESOLUTION_BATCH_DELAY_MS);
    }

    function isNewtabDarkMode() {
      return document.body.getAttribute('data-theme') === 'dark';
    }

    function getFaviconPreferredTheme() {
      return isNewtabDarkMode() ? 'dark' : 'light';
    }

    function getThemeForMode(theme) {
      return NEWTAB_FAVICON_THEME.getThemeForMode(theme, {
        defaultTheme,
        isDarkMode: isNewtabDarkMode
      });
    }

    function getHoverColors(theme) {
      return NEWTAB_FAVICON_THEME.getHoverColors(theme, {
        defaultTheme,
        isDarkMode: isNewtabDarkMode
      });
    }

    function getNeutralHoverActionColors() {
      return isNewtabDarkMode()
        ? {
          bg: 'rgba(255, 255, 255, 0.10)',
          border: 'rgba(255, 255, 255, 0.18)',
          text: '#E5E7EB'
        }
        : {
          bg: 'rgba(200, 208, 218, 0.45)',
          border: 'rgba(148, 163, 184, 0.28)',
          text: '#4B5563'
        };
    }

    function applyThemeVariables(target, theme) {
      if (!target || !theme) {
        return;
      }
      const resolvedTheme = getThemeForMode(theme);
      target.style.setProperty('--x-ext-mark-bg', resolvedTheme.markBg);
      target.style.setProperty('--x-ext-mark-text', resolvedTheme.markText);
      target.style.setProperty('--x-ext-tag-bg', resolvedTheme.tagBg);
      target.style.setProperty('--x-ext-tag-text', resolvedTheme.tagText);
      target.style.setProperty('--x-ext-tag-border', resolvedTheme.tagBorder);
      target.style.setProperty('--x-ext-key-bg', resolvedTheme.keyBg);
      target.style.setProperty('--x-ext-key-text', resolvedTheme.keyText);
      target.style.setProperty('--x-ext-key-border', resolvedTheme.keyBorder);
      target.style.setProperty('--x-ext-icon-color', resolvedTheme.accent);
      const highlight = getHighlightColors(theme);
      const hover = resolvedTheme._xIsBrand
        ? getHoverColors(theme)
        : {
          bg: 'var(--x-nt-hover-bg, #F3F4F6)',
          border: 'transparent'
      };
      target.style.setProperty('--x-nt-suggestion-active-bg', highlight.bg);
      target.style.setProperty('--x-nt-suggestion-hover-bg', hover.bg);
    }

    function applyMarkVariables(target, theme, active) {
      if (!target || !theme) {
        return;
      }
      const resolvedTheme = getThemeForMode(theme);
      const markBg = active
        ? resolvedTheme.activeMarkBg || resolvedTheme.markBg
        : resolvedTheme.markBg;
      const markText = active
        ? resolvedTheme.activeMarkText || resolvedTheme.markText
        : resolvedTheme.markText;
      target.style.setProperty('--x-ext-mark-bg', markBg);
      target.style.setProperty('--x-ext-mark-text', markText);
    }

    return {
      normalizeFaviconHost,
      isFaviconProxyUrl,
      themeColorCache,
      themeHostCache,
      getHostFromUrl,
      getCanonicalPageUrlForFavicon,
      normalizeAccentRgb,
      normalizeThemeConfidence,
      getThemeSourcePriority,
      getThemeSource,
      buildThemeFromAccent,
      isLowConfidenceTheme,
      isPersistableTheme,
      getProviderThemeHost,
      getThemeHostForSuggestion,
      setResolvedThemeForHost,
      getThemeForProvider,
      getThemeForSuggestion,
      getImmediateThemeForSuggestion,
      shouldUseUrlFallbackThemeForSuggestion,
      scheduleThemeResolutionFlush,
      queueThemeForTarget,
      isNewtabDarkMode,
      getThemeForMode,
      getHoverColors,
      getNeutralHoverActionColors,
      applyThemeVariables,
      applyMarkVariables
    };
  }

  root.LumnoNewtabSiteThemeResolver = { createSiteThemeResolver };
})(globalThis);
