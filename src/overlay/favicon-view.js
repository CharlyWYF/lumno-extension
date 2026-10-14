(function(root, factory) {
  const api = factory(root);
  root.LumnoOverlayFaviconView = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(root) {
  function noop() {}

  function createOverlayFaviconViewRuntime(options) {
    const config = options || {};
    const doc = config.document || (typeof document !== 'undefined' ? document : null);
    const win = config.windowObj || (typeof window !== 'undefined' ? window : {});
    const chromeApi = config.chromeApi || (typeof chrome !== 'undefined' ? chrome : {});
    const getRiSvg = typeof config.getRiSvg === 'function' ? config.getRiSvg : (() => '');
    const getHostFromUrl = typeof config.getHostFromUrl === 'function' ? config.getHostFromUrl : (() => '');
    const getExtensionFaviconUrl = typeof config.getExtensionFaviconUrl === 'function' ? config.getExtensionFaviconUrl : (() => '');
    const getGstaticFaviconUrl = typeof config.getGstaticFaviconUrl === 'function' ? config.getGstaticFaviconUrl : (() => '');
    const getChromeFaviconUrl = typeof config.getChromeFaviconUrl === 'function' ? config.getChromeFaviconUrl : (() => '');
    const shouldBlockFaviconForHost = typeof config.shouldBlockFaviconForHost === 'function' ? config.shouldBlockFaviconForHost : (() => false);
    const shouldAvoidDirectFaviconForHost = typeof config.shouldAvoidDirectFaviconForHost === 'function'
      ? config.shouldAvoidDirectFaviconForHost
      : (() => false);
    const shouldBlockOverlayFaviconForHost = typeof config.shouldBlockOverlayFaviconForHost === 'function'
      ? config.shouldBlockOverlayFaviconForHost
      : shouldBlockFaviconForHost;
    const isEnhancedFaviconFetchEnabled = typeof config.isEnhancedFaviconFetchEnabled === 'function'
      ? config.isEnhancedFaviconFetchEnabled
      : (() => true);
    const getStrictFaviconReason = typeof config.getStrictFaviconReason === 'function'
      ? config.getStrictFaviconReason
      : (() => '');
    const logFaviconDecision = typeof config.logFaviconDecision === 'function'
      ? config.logFaviconDecision
      : noop;
    const isFaviconProxyUrl = typeof config.isFaviconProxyUrl === 'function' ? config.isFaviconProxyUrl : (() => false);
    const isBlockedLocalFaviconUrl = typeof config.isBlockedLocalFaviconUrl === 'function'
      ? config.isBlockedLocalFaviconUrl
      : (() => false);
    const isChromeMonogramFaviconUrl = typeof config.isChromeMonogramFaviconUrl === 'function'
      ? config.isChromeMonogramFaviconUrl
      : ((url) => /^chrome:\/\/favicon2\//i.test(String(url || '').trim()));
    const preloadThemeFromFavicon = typeof config.preloadThemeFromFavicon === 'function' ? config.preloadThemeFromFavicon : noop;
    const hasThemeForHost = typeof config.hasThemeForHost === 'function' ? config.hasThemeForHost : (() => false);
    const getOverlayPanel = typeof config.getOverlayPanel === 'function' ? config.getOverlayPanel : (() => null);
    const getSuggestionRowsRoot = typeof config.getSuggestionRowsRoot === 'function'
      ? config.getSuggestionRowsRoot
      : (() => null);
    const rerenderReplacedFaviconRows = typeof config.rerenderReplacedFaviconRows === 'function'
      ? config.rerenderReplacedFaviconRows
      : (() => false);
    const setPersistedFaviconUrl = typeof config.setPersistedFaviconUrl === 'function'
      ? config.setPersistedFaviconUrl
      : noop;
    const setPersistedFaviconData = typeof config.setPersistedFaviconData === 'function'
      ? config.setPersistedFaviconData
      : noop;
    const requestFaviconDataFromBackground = typeof config.requestFaviconData === 'function'
      ? config.requestFaviconData
      : null;
    const faviconDataCache = config.faviconDataCache || new Map();
    const faviconDataPending = config.faviconDataPending || new Map();
    const iconPreloadCache = config.iconPreloadCache || new Map();
    const setTimer = typeof win.setTimeout === 'function' ? win.setTimeout.bind(win) : setTimeout;
    const clearTimer = typeof win.clearTimeout === 'function' ? win.clearTimeout.bind(win) : clearTimeout;
    const faviconCandidateLoadTimeoutMs = Number.isFinite(config.faviconCandidateLoadTimeoutMs)
      ? Math.max(0, config.faviconCandidateLoadTimeoutMs)
      : 2600;
    const faviconUtils = root.LumnoFaviconUtils;
    function isSourceAllowedByEnhancedFetchPolicy(url, pageUrl) {
      return faviconUtils.isFaviconSourceAllowedByEnhancedFetchPolicy(
        url,
        isEnhancedFaviconFetchEnabled(pageUrl || url),
        { chromeApi, allowThirdPartyFetch: getStrictFaviconReason(pageUrl || url) !== 'exclusion' }
      );
    }
    const faviconResolverOptions = {
      chromeApi,
      size: 128,
      getExtensionFaviconUrl,
      getGstaticFaviconUrl,
      getChromeFaviconUrl,
      shouldBlockFaviconForHost,
      shouldAvoidDirectFaviconForHost,
      isBlockedLocalFaviconUrl,
      isEnhancedFaviconFetchEnabled,
      getStrictFaviconReason,
      logFaviconDecision
    };
    const faviconUrlResolver = faviconUtils.createFaviconUrlResolver({
      ...faviconResolverOptions,
      shouldBlockFaviconForHost: shouldBlockOverlayFaviconForHost
    });
    const faviconDataSourceResolver = faviconUtils.createFaviconUrlResolver(faviconResolverOptions);
    const faviconViewCoreApi = root.LumnoFaviconViewCore;
    const faviconViewCore = faviconViewCoreApi.createFaviconViewCore({
      document: doc,
      windowObj: win,
      chromeApi,
      getHostFromUrl,
      shouldBlockFaviconForHost: shouldBlockOverlayFaviconForHost,
      isBlockedLocalFaviconUrl: isBlockedOverlayFaviconUrl,
      showResolvedFavicon: (img) => showResolvedFavicon(img),
      showPendingFallbackIcon: (img) => showPendingFallbackIcon(img),
      getPersistCacheKey: (img) => img.getAttribute('data-x-ov-favicon-cache-key') || '',
      setPersistedFaviconUrl,
      setPersistedFaviconData,
      shouldPersistFaviconUrl: (url) => !isChromeMonogramFaviconUrl(url) && !isFaviconProxyUrl(url),
      requestFaviconData: config.requestFaviconData,
      preloadThemeFromFavicon,
      getThemeFaviconUrl: getGstaticFaviconUrl,
      hasThemeForHost,
      faviconDataCache,
      faviconDataPending,
      iconPreloadCache,
      detectDefaultExtensionFavicon: config.detectDefaultExtensionFavicon
    });
    const {
      setFaviconLoadState,
      setFallbackNodeVisible,
      applyFaviconOpticalShift,
      applyFaviconOpticalAlignment,
      setFaviconSrcWithAnimation,
      canReuseCurrentFavicon
    } = faviconViewCore;

    function setFaviconVisibility(img, visibility) {
      if (!img) {
        return;
      }
      if (visibility) {
        img.setAttribute('data-favicon-visibility', visibility);
      } else {
        img.removeAttribute('data-favicon-visibility');
      }
    }

    function createFallbackIconNode(img) {
      const node = doc.createElement('span');
      node.className = 'x-ov-suggestion-inline-icon x-ov-suggestion-favicon-fallback _x_extension_overlay_favicon_fallback_2026_unique_';
      node.innerHTML = getRiSvg('ri-link', 'ri-size-16');
      setFallbackNodeVisible(node, true);
      img.parentElement.insertBefore(node, img.nextSibling);
      return node;
    }

    const {
      ensureFallbackIconNode,
      removeFallbackIconNode,
      showResolvedFavicon,
      showPendingFallbackIcon,
      applyFallbackIcon
    } = faviconViewCoreApi.createFallbackIconPresenter({
      fallbackClassName: '_x_extension_overlay_favicon_fallback_2026_unique_',
      nodeMap: config.faviconFallbackNodeMap,
      createFallbackNode: createFallbackIconNode,
      setImageVisible: (img, visible) => setFaviconVisibility(img, visible ? 'visible' : 'hidden'),
      clearCandidateTimer: clearOverlayCandidateLoadTimer,
      setTimer
    });

    function getSafeOverlayFaviconCandidateUrl(value, pageUrl, candidateKind, sourceOptions) {
      return faviconUrlResolver.getSafeFaviconCandidateUrl(value, pageUrl, candidateKind, sourceOptions);
    }

    function isBrowserInternalPageUrl(url) {
      return faviconUrlResolver.isBrowserInternalPageUrl(url);
    }

    function isBlockedOverlayFaviconPageUrl(url) {
      return faviconUrlResolver.isBlockedFaviconPageUrl(url);
    }

    function isBlockedOverlayFaviconUrl(url) {
      return faviconUrlResolver.isBlockedFaviconUrl(url);
    }

    function getRuntimeExtensionFaviconUrl(pageUrl) {
      return getSafeOverlayFaviconCandidateUrl(getRuntimeExtensionFaviconDataSourceUrl(pageUrl));
    }

    function getRuntimeExtensionFaviconDataSourceUrl(pageUrl) {
      return isBrowserInternalPageUrl(pageUrl)
        ? faviconUrlResolver.getBrowserPageFaviconUrl(pageUrl)
        : faviconUrlResolver.getExtensionFaviconUrl(pageUrl);
    }

    function getRuntimeGstaticFaviconUrl(pageUrl) {
      return getSafeOverlayFaviconCandidateUrl(getRuntimeGstaticFaviconDataSourceUrl(pageUrl));
    }

    function getRuntimeGstaticFaviconDataSourceUrl(pageUrl) {
      return faviconDataSourceResolver.getSafeFaviconCandidateUrl(
        faviconDataSourceResolver.getGstaticFaviconUrl(pageUrl), pageUrl, 'third-party-proxy'
      );
    }

    function getRuntimeChromeFaviconUrl(pageUrl) {
      return faviconUrlResolver.getChromeFaviconUrl(pageUrl);
    }

    function requestFaviconData(url, pageUrl) {
      if (!isSourceAllowedByEnhancedFetchPolicy(url, pageUrl)) {
        return Promise.resolve(null);
      }
      return faviconViewCore.requestFaviconData(url, pageUrl);
    }

    function requestFaviconDataBypassingOverlayBlock(url, pageUrl) {
      const sourceUrl = faviconDataSourceResolver.getSafeFaviconCandidateUrl(url, pageUrl || url, 'blocked-data');
      if (!sourceUrl) {
        return Promise.resolve(null);
      }
      if (!isSourceAllowedByEnhancedFetchPolicy(sourceUrl, pageUrl)) {
        return Promise.resolve(null);
      }
      if (sourceUrl.startsWith('data:')) {
        return Promise.resolve(sourceUrl);
      }
      if (!isBlockedOverlayFaviconUrl(sourceUrl)) {
        return requestFaviconData(sourceUrl, pageUrl);
      }
      if (faviconDataCache.has(sourceUrl)) {
        return Promise.resolve(faviconDataCache.get(sourceUrl));
      }
      if (faviconDataPending.has(sourceUrl)) {
        return faviconDataPending.get(sourceUrl);
      }
      const promise = new Promise((resolve) => {
        const finish = (dataUrl) => {
          const value = String(dataUrl || '').trim();
          if (value && value.startsWith('data:')) {
            faviconViewCore.cacheFaviconData(sourceUrl, value);
            resolve(value);
            return;
          }
          resolve(null);
        };
        if (requestFaviconDataFromBackground) {
          Promise.resolve(requestFaviconDataFromBackground(sourceUrl, pageUrl))
            .then(finish)
            .catch(() => finish(''));
          return;
        }
        if (!chromeApi.runtime || typeof chromeApi.runtime.sendMessage !== 'function') {
          finish('');
          return;
        }
        chromeApi.runtime.sendMessage({
          action: 'getFaviconData',
          url: sourceUrl,
          pageUrl: pageUrl || ''
        }, (response) => {
          finish(response && response.data ? response.data : '');
        });
      }).then((dataUrl) => {
        faviconDataPending.delete(sourceUrl);
        return dataUrl || null;
      }).catch(() => {
        faviconDataPending.delete(sourceUrl);
        return null;
      });
      faviconDataPending.set(sourceUrl, promise);
      return promise;
    }

    function getLastWorkingFaviconSrc(img) {
      const source = faviconViewCore.getLastWorkingFaviconSrc(img);
      return isBackgroundFetchedFavicon(source) ? (faviconDataCache.get(source) || '') : source;
    }

    function restoreWorkingFaviconOrFail(img, previousSrc, onFailed) {
      return faviconViewCore.restoreWorkingFaviconOrFallback(img, previousSrc, {
        removeFallbackNode: removeFallbackIconNode,
        onFailed,
        applyFallbackIcon
      });
    }

    function createOverlayThemeAwareFaviconState(img, pageUrl, hostKey, fallbackUrl, onFailed, sourceOptions) {
      img._xOverlayThemeFaviconSession = (img._xOverlayThemeFaviconSession || 0) + 1;
      const session = img._xOverlayThemeFaviconSession;
      const normalizedHostKey = hostKey || getHostFromUrl(pageUrl);
      const rawFallbackUrl = String(fallbackUrl || '').trim();
      const cachedSourcePage = faviconUtils.getPageUrlFromFaviconProxyUrl(rawFallbackUrl);
      const mappedSource = faviconUtils.isFaviconProxyUrl(rawFallbackUrl) ||
        faviconUtils.isSafeVirtualFaviconRequestUrl(rawFallbackUrl);
      const canReuseCachedData = !mappedSource || Boolean(
        cachedSourcePage &&
        faviconUtils.getFaviconPersistCacheKey(cachedSourcePage) === faviconUtils.getFaviconPersistCacheKey(pageUrl) &&
        !faviconUtils.isChromeMonogramFaviconUrl(rawFallbackUrl) &&
        (!faviconUtils.isSafeVirtualFaviconRequestUrl(rawFallbackUrl) ||
          new URL(rawFallbackUrl).searchParams.get('fallbackToHost') === '0')
      );
      const cachedFallbackData = canReuseCachedData ? faviconDataCache.get(rawFallbackUrl) : '';
      const safeFallbackUrl = getSafeOverlayFaviconCandidateUrl(rawFallbackUrl, pageUrl, 'primary', sourceOptions) ||
        getSafeOverlayFaviconCandidateUrl(cachedFallbackData, pageUrl, 'cached-data');
      const previousSrc = getLastWorkingFaviconSrc(img);
      const previousPage = img.getAttribute('data-x-ov-favicon-page-url') || '';
      const canReusePrevious = previousPage
        ? faviconUtils.getFaviconPersistCacheKey(previousPage) === faviconUtils.getFaviconPersistCacheKey(pageUrl)
        : !String(previousSrc || '').startsWith('data:');

      return {
        pageUrl: String(pageUrl || ''),
        hostKey: String(normalizedHostKey || ''),
        rawFallbackUrl,
        fallbackUrl: safeFallbackUrl,
        primaryUrl: safeFallbackUrl,
        allowRemoteImage: Boolean(sourceOptions && sourceOptions.allowRemoteImage === true),
        extensionFavicon: getRuntimeExtensionFaviconUrl(pageUrl),
        browserUrl: /^https?:\/\//i.test(String(pageUrl || '')) ? '' : getRuntimeChromeFaviconUrl(pageUrl),
        gstaticFavicon: getRuntimeGstaticFaviconUrl(pageUrl),
        previousWorkingSrc: getSafeOverlayFaviconCandidateUrl(
          canReusePrevious ? previousSrc : '',
          pageUrl,
          'previous'
        ),
        hasFailedHandler: typeof onFailed === 'function',
        handleFailed: typeof onFailed === 'function' ? onFailed : function() {},
        isSessionCurrent() {
          return Boolean(img && img._xOverlayThemeFaviconSession === session);
        },
        isSessionMounted() {
          return Boolean(img && img.isConnected && img._xOverlayThemeFaviconSession === session);
        }
      };
    }

    function buildBlockedOverlayFaviconDataSourcePlan(state) {
      const unique = [];
      const seen = new Set();
      [
        state.rawFallbackUrl,
        getRuntimeExtensionFaviconDataSourceUrl(state.pageUrl),
        getRuntimeGstaticFaviconDataSourceUrl(state.pageUrl)
      ].forEach((url) => {
        const value = String(url || '').trim();
        if (!value || seen.has(value) || !isSourceAllowedByEnhancedFetchPolicy(value, state.pageUrl)) {
          return;
        }
        seen.add(value);
        unique.push(value);
      });
      return unique;
    }

    function attachBlockedOverlayFaviconData(img, state) {
      const candidates = buildBlockedOverlayFaviconDataSourcePlan(state);
      if (candidates.length === 0) {
        finalizeOverlayOwnedFaviconFailure(img, state);
        return;
      }
      showPendingFallbackIcon(img);
      let index = 0;
      const tryNext = () => {
        if (!img || !state.isSessionCurrent()) {
          return;
        }
        const sourceUrl = candidates[index];
        index += 1;
        if (!sourceUrl) {
          finalizeOverlayOwnedFaviconFailure(img, state);
          return;
        }
        requestFaviconDataBypassingOverlayBlock(sourceUrl, state.pageUrl).then((dataUrl) => {
          if (!img || !state.isSessionCurrent()) {
            return;
          }
          if (!dataUrl) {
            tryNext();
            return;
          }
          const applied = setFaviconSrcWithAnimation(img, dataUrl, {
            sourceUrl,
            persist: false
          });
          if (!applied && canReuseCurrentFavicon(img, dataUrl)) {
            showResolvedFavicon(img);
          }
          preloadThemeFromFavicon(sourceUrl, dataUrl, state.hostKey);
        }).catch(() => {
          if (img && state.isSessionCurrent()) {
            tryNext();
          }
        });
      };
      tryNext();
    }

    function syncOverlayThemeAwareFaviconAttributes(img, state) {
      img.setAttribute('data-x-ov-theme-favicon', '1');
      img.setAttribute('data-x-ov-favicon-page-url', state.pageUrl);
      img.setAttribute('data-x-ov-favicon-host', state.hostKey);
      img.setAttribute('data-x-ov-favicon-fallback-url', state.rawFallbackUrl);
      img.setAttribute('data-x-ov-favicon-custom-image', state.allowRemoteImage ? '1' : '0');
      img.removeAttribute('data-x-ov-favicon-cache-key');
    }

    function buildOverlayThemeAwareFaviconCandidatePlan(state) {
      return faviconUrlResolver.buildFaviconCandidatePlan(state);
    }

    function clearOverlayCandidateLoadTimer(img) {
      if (!img || img._xOverlayThemeFaviconLoadTimer === null || img._xOverlayThemeFaviconLoadTimer === undefined) {
        return;
      }
      clearTimer(img._xOverlayThemeFaviconLoadTimer);
      img._xOverlayThemeFaviconLoadTimer = null;
    }

    function isOverlayCandidateLoaded(img, nextUrl) {
      if (!img || !nextUrl) {
        return false;
      }
      const resolvedSrc = img.getAttribute('data-favicon-current-src') || '';
      if (resolvedSrc === nextUrl) {
        return true;
      }
      return Boolean(img.complete && img.naturalWidth > 0);
    }

    function scheduleOverlayCandidateLoadTimer(img, state, nextUrl) {
      if (!img || !state || !nextUrl || faviconCandidateLoadTimeoutMs <= 0) {
        return;
      }
      clearOverlayCandidateLoadTimer(img);
      const expectedToken = img._xFaviconLoadToken || 0;
      const expectedSrc = String(nextUrl);
      img._xOverlayThemeFaviconLoadTimer = setTimer(() => {
        img._xOverlayThemeFaviconLoadTimer = null;
        if (!img || !state.isSessionCurrent()) {
          return;
        }
        if ((img._xFaviconLoadToken || 0) !== expectedToken) {
          return;
        }
        const currentRenderedSrc = String(img.getAttribute('src') || img.src || '');
        if (currentRenderedSrc && currentRenderedSrc !== expectedSrc) {
          return;
        }
        if (isOverlayCandidateLoaded(img, expectedSrc)) {
          return;
        }
        if (typeof img._xOverlayThemeFaviconErrorHandler === 'function') {
          img._xOverlayThemeFaviconErrorHandler();
        }
      }, faviconCandidateLoadTimeoutMs);
    }

    function tryApplyOverlayThemeAwareFaviconCandidate(img, state, tried, candidate) {
      const nextUrl = candidate && candidate.url ? String(candidate.url) : '';
      if (!nextUrl || !img || !state.isSessionCurrent()) {
        return false;
      }
      if (tried.has(nextUrl)) {
        return false;
      }
      tried.add(nextUrl);
      clearOverlayCandidateLoadTimer(img);
      img._xOverlayThemeFaviconCandidateToken = (img._xOverlayThemeFaviconCandidateToken || 0) + 1;
      const candidateToken = img._xOverlayThemeFaviconCandidateToken;

      if (isBackgroundFetchedFavicon(nextUrl)) {
        attachBackgroundFaviconCandidate(img, state, nextUrl);
        return true;
      }

      const faviconProxyCheckKind = faviconUrlResolver.getFaviconProxyCheckKind(candidate);
      const shouldCheckDefaultProxy = Boolean(faviconProxyCheckKind);
      let defaultProxyCheckStarted = false;
      const scheduleDefaultProxyFaviconCheck = () => {
        if (!shouldCheckDefaultProxy) {
          return;
        }
        if (defaultProxyCheckStarted) {
          return;
        }
        defaultProxyCheckStarted = true;
        setTimer(() => {
          if (!img || !state.isSessionCurrent() || img._xOverlayThemeFaviconCandidateToken !== candidateToken) {
            return;
          }
          const currentSrc = img.getAttribute('data-favicon-current-src') || img.src || '';
          if (currentSrc !== nextUrl) {
            return;
          }
          const defaultCheckPromise = faviconProxyCheckKind === 'extension'
            ? faviconViewCore.detectDefaultExtensionFavicon(img, nextUrl)
            : faviconViewCore.requestFaviconData(nextUrl, state.pageUrl).then((dataUrl) => !dataUrl);
          defaultCheckPromise.catch(() => false).then((isDefault) => {
            if (!img || !state.isSessionCurrent() || img._xOverlayThemeFaviconCandidateToken !== candidateToken) {
              return;
            }
            const latestSrc = img.getAttribute('data-favicon-current-src') || img.src || '';
            if (latestSrc !== nextUrl) {
              return;
            }
            if (isDefault) {
              if (faviconProxyCheckKind === 'gstatic') {
                finalizeOverlayDefaultProxyFaviconFailure(img, state);
                return;
              }
              if (typeof img._xOverlayThemeFaviconErrorHandler === 'function') {
                img._xOverlayThemeFaviconErrorHandler();
              }
              return;
            }
            showResolvedFavicon(img);
          });
        }, 0);
      };
      const handleProxyLoad = () => {
        scheduleDefaultProxyFaviconCheck();
      };
      if (shouldCheckDefaultProxy) {
        img.addEventListener('load', handleProxyLoad, { once: true });
      }
      const applied = setFaviconSrcWithAnimation(img, nextUrl, {
        persist: false,
        deferResolve: shouldCheckDefaultProxy
      });
      const reused = !applied && canReuseCurrentFavicon(img, nextUrl);
      if (!applied && !reused) {
        img.removeEventListener('load', handleProxyLoad);
        return false;
      }
      if (reused) {
        img.removeEventListener('load', handleProxyLoad);
        if (shouldCheckDefaultProxy) {
          showPendingFallbackIcon(img);
          scheduleDefaultProxyFaviconCheck();
        } else {
          showResolvedFavicon(img);
        }
      } else {
        if (!shouldCheckDefaultProxy) {
          setFaviconVisibility(img, 'visible');
        }
        scheduleOverlayCandidateLoadTimer(img, state, nextUrl);
        if (shouldCheckDefaultProxy && img.complete && img.naturalWidth > 0) {
          scheduleDefaultProxyFaviconCheck();
        }
      }
      return true;
    }

    // Icon services and the browser's _favicon cache are fetched by the
    // extension background: the host page only renders local image bytes, never
    // connects to a service, and the _favicon endpoint stays unreachable from
    // web pages (it would reveal which sites the user has visited).
    function isBackgroundFetchedFavicon(url) {
      return (/^https:\/\//i.test(String(url || '')) && faviconUtils.isFaviconProxyUrl(url)) ||
        faviconUtils.isExtensionFaviconEndpointUrl(url);
    }

    function attachBackgroundFaviconCandidate(img, state, sourceUrl) {
      const token = img._xOverlayThemeFaviconCandidateToken;
      let settled = false;
      showPendingFallbackIcon(img);
      const finish = (value) => {
        if (settled) {
          return;
        }
        settled = true;
        if (!state.isSessionCurrent() || img._xOverlayThemeFaviconCandidateToken !== token) {
          return;
        }
        clearOverlayCandidateLoadTimer(img);
        const dataUrl = String(value || '');
        if (!dataUrl.startsWith('data:image/')) {
          if (typeof img._xOverlayThemeFaviconErrorHandler === 'function') {
            img._xOverlayThemeFaviconErrorHandler();
          }
          return;
        }
        faviconViewCore.cacheFaviconData(sourceUrl, dataUrl);
        const applied = setFaviconSrcWithAnimation(img, dataUrl, { sourceUrl, persist: false });
        if (!applied && canReuseCurrentFavicon(img, dataUrl)) {
          showResolvedFavicon(img);
        } else if (applied) {
          scheduleOverlayCandidateLoadTimer(img, state, dataUrl);
        } else if (typeof img._xOverlayThemeFaviconErrorHandler === 'function') {
          img._xOverlayThemeFaviconErrorHandler();
        }
        preloadThemeFromFavicon(sourceUrl, dataUrl, state.hostKey);
      };
      if (faviconCandidateLoadTimeoutMs > 0) {
        img._xOverlayThemeFaviconLoadTimer = setTimer(() => finish(null), faviconCandidateLoadTimeoutMs);
      }
      requestFaviconData(sourceUrl, state.pageUrl).then(finish).catch(() => finish(null));
    }

    function finalizeOverlayOwnedFaviconFailure(img, state) {
      clearOverlayCandidateLoadTimer(img);
      if (state.hasFailedHandler) {
        removeFallbackIconNode(img);
        state.handleFailed();
        return;
      }
      applyFallbackIcon(img);
    }

    function finalizeOverlayDefaultProxyFaviconFailure(img, state) {
      finalizeOverlayOwnedFaviconFailure(img, state);
    }

    function finalizeOverlayThemeAwareFaviconFailure(img, state) {
      clearOverlayCandidateLoadTimer(img);
      restoreWorkingFaviconOrFail(img, state.previousWorkingSrc, state.handleFailed);
    }

    function attachResolvedFaviconWithFallbacks(img, pageUrl, hostKey, fallbackUrl, onFailed, sourceOptions) {
      if (!img) {
        return;
      }
      if (img._xOverlayThemeFaviconErrorHandler) {
        img.removeEventListener('error', img._xOverlayThemeFaviconErrorHandler);
        img._xOverlayThemeFaviconErrorHandler = null;
      }
      clearOverlayCandidateLoadTimer(img);

      const state = createOverlayThemeAwareFaviconState(img, pageUrl, hostKey, fallbackUrl, onFailed, sourceOptions);
      if (state.hostKey &&
          shouldBlockOverlayFaviconForHost(state.hostKey) &&
          !isBrowserInternalPageUrl(state.pageUrl)) {
        syncOverlayThemeAwareFaviconAttributes(img, state);
        attachBlockedOverlayFaviconData(img, state);
        return;
      }
      syncOverlayThemeAwareFaviconAttributes(img, state);
      const candidates = buildOverlayThemeAwareFaviconCandidatePlan(state);
      const tried = new Set();
      let candidateIndex = 0;

      const tryNextAvailableCandidate = () => {
        while (candidateIndex < candidates.length) {
          const candidate = candidates[candidateIndex];
          candidateIndex += 1;
          if (tryApplyOverlayThemeAwareFaviconCandidate(img, state, tried, candidate)) {
            return true;
          }
        }
        return false;
      };

      const handleImageError = () => {
        if (!state.isSessionCurrent()) {
          return;
        }
        if (tryNextAvailableCandidate()) {
          return;
        }
        finalizeOverlayThemeAwareFaviconFailure(img, state);
      };

      img._xOverlayThemeFaviconErrorHandler = handleImageError;
      img.addEventListener('error', handleImageError);

      const appliedInitial = tryNextAvailableCandidate();
      if (!appliedInitial) {
        finalizeOverlayThemeAwareFaviconFailure(img, state);
      }
    }

    function refreshOverlayThemeAwareFavicons(optionsArg) {
      const overlay = getOverlayPanel();
      if (!overlay) {
        return;
      }
      const skipWithin = optionsArg && optionsArg.skipWithin ? optionsArg.skipWithin : null;
      overlay.querySelectorAll('img[data-x-ov-theme-favicon="1"]').forEach((img) => {
        if (!img || !img.isConnected) {
          return;
        }
        if (skipWithin && typeof skipWithin.contains === 'function' && skipWithin.contains(img)) {
          return;
        }
        const pageUrl = img.getAttribute('data-x-ov-favicon-page-url') || '';
        if (!pageUrl) {
          return;
        }
        const hostKey = img.getAttribute('data-x-ov-favicon-host') || '';
        const fallbackUrl = img.getAttribute('data-x-ov-favicon-fallback-url') || '';
        attachResolvedFaviconWithFallbacks(img, pageUrl, hostKey, fallbackUrl, null, {
          allowRemoteImage: img.getAttribute('data-x-ov-favicon-custom-image') === '1'
        });
      });
    }

    function refreshOverlayFaviconsForPolicyChange() {
      let rowsRerendered = false;
      try {
        rowsRerendered = rerenderReplacedFaviconRows() === true;
      } catch (e) {
        rowsRerendered = false;
      }
      refreshOverlayThemeAwareFavicons({
        skipWithin: rowsRerendered ? getSuggestionRowsRoot() : null
      });
      return rowsRerendered;
    }

    function attachFaviconData(img, url, hostOverride, pageUrl) {
      const safeUrl = getSafeOverlayFaviconCandidateUrl(url, pageUrl || url, 'data');
      if (safeUrl) {
        faviconViewCore.attachFaviconData(img, safeUrl, hostOverride, pageUrl || url);
      }
    }

    function preloadIcon(url, pageUrl) {
      const safeUrl = faviconUrlResolver.resolveFaviconSource(url, pageUrl || '');
      if (safeUrl) {
        if (isBackgroundFetchedFavicon(safeUrl)) {
          requestFaviconData(safeUrl, pageUrl).then((dataUrl) => {
            if (dataUrl) {
              preloadThemeFromFavicon(safeUrl, dataUrl, getHostFromUrl(pageUrl || ''));
            }
          }).catch(noop);
          return;
        }
        faviconViewCore.preloadIcon(safeUrl);
      }
    }

    function warmIconCache(list) {
      if (!Array.isArray(list)) {
        return;
      }
      faviconViewCore.warmIconCache(list.map((item) => {
        if (!item || !item.favicon) {
          return item;
        }
        const favicon = faviconUrlResolver.resolveFaviconSource(item.favicon, item.url || '');
        if (isBackgroundFetchedFavicon(favicon)) {
          preloadIcon(favicon, item.url || '');
        }
        return {
          ...item,
          favicon: isBackgroundFetchedFavicon(favicon) ? '' : favicon
        };
      }));
    }

    return Object.freeze({
      applyFaviconOpticalShift,
      applyFaviconOpticalAlignment,
      isBlockedLocalFaviconUrl: isBlockedOverlayFaviconUrl,
      isChromeMonogramFaviconUrl,
      requestFaviconData,
      setFaviconSrcWithAnimation,
      attachFaviconData,
      attachResolvedFaviconWithFallbacks,
      refreshOverlayThemeAwareFavicons,
      refreshOverlayFaviconsForPolicyChange,
      preloadIcon,
      warmIconCache
    });
  }

  return Object.freeze({
    createOverlayFaviconViewRuntime
  });
});
