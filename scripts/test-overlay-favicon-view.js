const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { extractFunction: extractFunctionSource } = require('./helpers/extract-function');

const repoRoot = path.resolve(__dirname, '..');

function createRealPolicyRerender(deps) {
  const overlayJs = fs.readFileSync(path.join(repoRoot, 'src/overlay/search-panel.js'), 'utf8');
  const factory = new Function('runtimeDeps', `
    const suggestionsContainer = runtimeDeps.suggestionsContainer;
    const CustomEvent = runtimeDeps.CustomEvent;
    ${extractFunctionSource(overlayJs, 'rerenderReplacedFaviconRows')}
    return rerenderReplacedFaviconRows;
  `);
  return factory(deps);
}

function createFakeImage() {
  const attributes = new Map();
  const listeners = new Map();
  return {
    src: '',
    complete: false,
    naturalWidth: 0,
    naturalHeight: 0,
    isConnected: true,
    style: {
      setProperty() {},
      removeProperty() {}
    },
    parentElement: null,
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    getAttribute(name) {
      return attributes.has(name) ? attributes.get(name) : null;
    },
    removeAttribute(name) {
      attributes.delete(name);
    },
    addEventListener(type, listener) {
      if (!listeners.has(type)) {
        listeners.set(type, new Set());
      }
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) {
      const set = listeners.get(type);
      if (set) {
        set.delete(listener);
      }
    },
    dispatchEvent(type) {
      const set = listeners.get(type);
      if (!set) {
        return;
      }
      Array.from(set).forEach((listener) => listener.call(this, { type, target: this }));
    }
  };
}

function attachFakeFallbackParent(img) {
  const children = [img];
  const parent = {
    children,
    querySelectorAll(selector) {
      if (selector === 'img') {
        return children.filter((node) => node === img && node.isConnected);
      }
      if (selector === '._x_extension_overlay_favicon_fallback_2026_unique_') {
        return children.filter((node) =>
          node !== img &&
          node.isConnected &&
          String(node.className || '').split(/\s+/).includes(
            '_x_extension_overlay_favicon_fallback_2026_unique_'
          )
        );
      }
      return [];
    },
    insertBefore(node, referenceNode) {
      const referenceIndex = children.indexOf(referenceNode);
      const insertIndex = referenceIndex === -1 ? children.length : referenceIndex;
      children.splice(insertIndex, 0, node);
      node.parentElement = parent;
      node.parentNode = parent;
      node.isConnected = true;
      return node;
    },
    removeChild(node) {
      const index = children.indexOf(node);
      if (index !== -1) {
        children.splice(index, 1);
      }
      node.parentElement = null;
      node.parentNode = null;
      node.isConnected = false;
      return node;
    }
  };
  img.parentElement = parent;
  img.parentNode = parent;
  return parent;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Web pages cannot load _favicon URLs; the background answers them with image
// bytes, which this stands in for (one distinct data: URL per source).
function browserCacheDataUrl(url) {
  return `data:image/png;base64,${Buffer.from(String(url)).toString('base64')}`;
}

function answerBrowserCacheRequests(url) {
  return Promise.resolve(/^chrome-extension:\/\/[^/]+\/_favicon\//i.test(String(url || ''))
    ? browserCacheDataUrl(url)
    : null);
}

// The favicon source an image shows: the background-fetched source behind a
// data: URL, or the URL it loads directly.
function renderedSource(img) {
  return img.getAttribute('data-favicon-data-source') || img.src;
}

function createRuntime(options) {
  const config = options || {};
  const preloadedUrls = [];
  const attachedDataUrls = [];
  const attachedDataRequestPages = [];
  const warmedIconLists = [];
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    URL
  };
  sandbox.globalThis = sandbox;
  sandbox.LumnoFaviconViewCore = {
    createFallbackIconPresenter: require('../src/shared/favicon-view-core.js').createFallbackIconPresenter,
    createFaviconViewCore(config) {
      return {
        setFallbackNodeVisible() {},
        setFaviconLoadState() {},
        applyFaviconOpticalShift() {},
        applyFaviconOpticalAlignment(img) {
          img.setAttribute('width', '128');
          img.setAttribute('height', '128');
        },
        cacheFaviconData() {},
        requestFaviconData() {
          return typeof config.requestFaviconData === 'function'
            ? config.requestFaviconData.apply(null, arguments)
            : Promise.resolve(null);
        },
        setFaviconSrcWithAnimation(img, nextSrc, optionsArg) {
          if (config.isBlockedLocalFaviconUrl(nextSrc)) {
            return false;
          }
          img.src = nextSrc;
          img.setAttribute('data-favicon-current-src', nextSrc);
          if (String(nextSrc || '').startsWith('data:') && optionsArg && optionsArg.sourceUrl) {
            img.setAttribute('data-favicon-data-source', optionsArg.sourceUrl);
          } else {
            img.removeAttribute('data-favicon-data-source');
          }
          return true;
        },
        canReuseCurrentFavicon() {
          return false;
        },
        getLastWorkingFaviconSrc(img) {
          return img ? (img.getAttribute('data-favicon-current-src') || '') : '';
        },
        restoreWorkingFaviconOrFallback(img, previousSrc, options) {
          if (previousSrc) {
            img.src = previousSrc;
            img.setAttribute('data-favicon-current-src', previousSrc);
            return true;
          }
          if (options && typeof options.onFailed === 'function') {
            options.onFailed();
          }
          return false;
        },
        attachFaviconData(_img, url, _hostOverride, pageUrlArg) {
          attachedDataUrls.push(url);
          attachedDataRequestPages.push(pageUrlArg || '');
        },
        preloadIcon(url) {
          preloadedUrls.push(url);
        },
        warmIconCache(list) {
          warmedIconLists.push(list);
        },
        detectDefaultExtensionFavicon() {
          return Promise.resolve(false);
        }
      };
    }
  };
  vm.runInNewContext(fs.readFileSync(path.join(repoRoot, 'src/shared/favicon-utils.js'), 'utf8'), sandbox, {
    filename: 'src/shared/favicon-utils.js'
  });
  vm.runInNewContext(fs.readFileSync(path.join(repoRoot, 'src/overlay/favicon-view.js'), 'utf8'), sandbox, {
    filename: 'src/overlay/favicon-view.js'
  });

  const localPageUrl = 'http://127.0.0.1:4321/';
  const extensionUrl = `chrome-extension://abc/_favicon/?pageUrl=${encodeURIComponent(localPageUrl)}&size=128&fallbackToHost=0`;
  const gstaticUrl = `https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=${encodeURIComponent(localPageUrl)}&size=128`;
  const browserPageUrl = 'chrome://extensions/';
  const browserPageExtensionUrl = `chrome-extension://abc/_favicon/?pageUrl=${encodeURIComponent(browserPageUrl)}&size=128`;
  const browserPageFavicon2Url = `chrome://favicon2/?pageUrl=${encodeURIComponent(browserPageUrl)}&size=128`;
  const vpnPageUrl = 'https://foo.example.com/';
  const vpnDirectFaviconUrl = 'https://foo.example.com/favicon.ico';
  const vpnExtensionUrl = `chrome-extension://abc/_favicon/?pageUrl=${encodeURIComponent(vpnPageUrl)}&size=128&fallbackToHost=0`;
  const vpnGstaticUrl = `https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=${encodeURIComponent(vpnPageUrl)}&size=128`;

  return {
    localPageUrl,
    extensionUrl,
    browserPageUrl,
    browserPageExtensionUrl,
    browserPageFavicon2Url,
    vpnPageUrl,
    vpnDirectFaviconUrl,
    vpnExtensionUrl,
    vpnGstaticUrl,
    preloadedUrls,
    attachedDataUrls,
    attachedDataRequestPages,
    warmedIconLists,
    runtime: sandbox.LumnoOverlayFaviconView.createOverlayFaviconViewRuntime({
      document: {
        createElement() {
          const attributes = new Map();
          return {
            className: '',
            innerHTML: '',
            isConnected: false,
            parentElement: null,
            parentNode: null,
            setAttribute(name, value) {
              attributes.set(name, String(value));
            },
            getAttribute(name) {
              return attributes.has(name) ? attributes.get(name) : null;
            },
            removeAttribute(name) {
              attributes.delete(name);
            }
          };
        }
      },
      windowObj: {
        setTimeout,
        clearTimeout
      },
      chromeApi: {
        runtime: {
          id: 'abc',
          getURL(path) {
            return `chrome-extension://abc${path}`;
          }
        }
      },
      requestFaviconData: Object.prototype.hasOwnProperty.call(config, 'requestFaviconData')
        ? config.requestFaviconData
        : answerBrowserCacheRequests,
      getRiSvg() {
        return '';
      },
      getHostFromUrl(url) {
        try {
          return new URL(url).hostname.toLowerCase();
        } catch (e) {
          return '';
        }
      },
      getExtensionFaviconUrl(url) {
        return `chrome-extension://abc/_favicon/?pageUrl=${encodeURIComponent(url)}&size=128` +
          (/^https?:\/\//i.test(url) ? '&fallbackToHost=0' : '');
      },
      getGstaticFaviconUrl(url) {
        return `https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=${encodeURIComponent(url)}&size=128`;
      },
      getChromeFaviconUrl(url) {
        return `chrome://favicon2/?pageUrl=${encodeURIComponent(url)}&size=128`;
      },
      shouldBlockFaviconForHost() {
        return false;
      },
      shouldBlockOverlayFaviconForHost(hostname) {
        if (typeof config.shouldBlockOverlayFaviconForHost === 'function') {
          return config.shouldBlockOverlayFaviconForHost(hostname);
        }
        const host = String(hostname || '').toLowerCase();
        return host === '127.0.0.1' || host === 'localhost';
      },
      isEnhancedFaviconFetchEnabled(pageUrl) {
        if (config.excludedPageUrl && pageUrl === config.excludedPageUrl) {
          return false;
        }
        return Object.prototype.hasOwnProperty.call(config, 'enhancedFaviconFetchEnabled')
          ? config.enhancedFaviconFetchEnabled
          : true;
      },
      isBlockedLocalFaviconUrl() {
        return false;
      },
      isFaviconProxyUrl(url) {
        return /_favicon\/|gstatic\.cn\/faviconV2/i.test(String(url || ''));
      },
      preloadThemeFromFavicon() {},
      faviconDataCache: config.faviconDataCache,
      getOverlayPanel: config.getOverlayPanel,
      getSuggestionRowsRoot: config.getSuggestionRowsRoot,
      rerenderReplacedFaviconRows: config.rerenderReplacedFaviconRows,
      getStrictFaviconReason(pageUrl) {
        return config.excludedPageUrl === pageUrl ? 'exclusion'
          : (config.enhancedFaviconFetchEnabled === false ? 'global-off' : '');
      },
      faviconCandidateLoadTimeoutMs: config.faviconCandidateLoadTimeoutMs === undefined
        ? 1000 : config.faviconCandidateLoadTimeoutMs
    })
  };
}

function testOverlayRendererLoadsFaviconPolicyBeforeInitialTabs() {
  const overlayJs = fs.readFileSync(path.join(repoRoot, 'src/overlay/search-panel.js'), 'utf8');
  assert.match(
    overlayJs,
    /let faviconEnhancedFetchEnabled = false;/,
    'overlay favicon policy should fail closed before storage returns'
  );
  assert.match(
    overlayJs,
    /initialFaviconEnhancedFetchReady = initialOverlaySettingsReady\.then[\s\S]*?FAVICON_ENHANCED_FETCH_ENABLED_STORAGE_KEY[\s\S]*?FAVICON_REQUEST_BLACKLIST_STORAGE_KEY[\s\S]*?overlayFaviconRequestBlacklistItems/,
    'overlay should hydrate the global setting and path-specific exclusions from the shared settings read'
  );
  assert.match(
    overlayJs,
    /const initialOverlayContentReady = Promise\.all\(\[\s*initialOverlayOpenTabsDefaultVisibleReady,\s*initialFaviconEnhancedFetchReady,\s*initialSimpleModeReady\s*\]\)[\s\S]*?requestTabsAndRender\(\)/,
    'first open-tab rendering should wait for favicon policy and simple-mode presentation without blocking the input shell'
  );
  assert.doesNotMatch(
    overlayJs.slice(overlayJs.lastIndexOf('const revealReady =')),
    /initialOverlayContentReady|initialFaviconEnhancedFetchReady/,
    'favicon policy and first open-tab rows should not block overlay reveal'
  );
  assert.match(
    overlayJs,
    /storageChangeListeners\.add\(\(changes,\s*areaName\) => \{[\s\S]*?!changes\[FAVICON_ENHANCED_FETCH_ENABLED_STORAGE_KEY\][\s\S]*?faviconEnhancedFetchEnabled = normalizeFaviconEnhancedFetchEnabled[\s\S]*?refreshOverlayFaviconsForPolicyChange\(\)[\s\S]*?\}\);/,
    'favicon setting changes should recover replaced rows after updating the policy state'
  );
  const faviconViewJs = fs.readFileSync(path.join(repoRoot, 'src/overlay/favicon-view.js'), 'utf8');
  assert.match(
    faviconViewJs,
    /data-x-ov-favicon-fallback-url', state\.rawFallbackUrl/,
    'favicon refresh metadata should retain the raw fallback so enabling the setting can restore normal behavior'
  );
}

function testOverlayRendererGuardsThemeSourcesInStrictMode() {
  const overlayJs = fs.readFileSync(path.join(repoRoot, 'src/overlay/search-panel.js'), 'utf8');
  const suggestionsReact = fs.readFileSync(
    path.join(repoRoot, 'react-src/search/suggestions.tsx'),
    'utf8'
  );
  assert.match(
    overlayJs,
    /function getOverlayFaviconUrlResolver\(\)[\s\S]*?isEnhancedFaviconFetchEnabled: isOverlayEnhancedFaviconFetchEnabled/,
    'overlay URL resolution should use the URL-specific enhanced-fetch policy state'
  );
  assert.doesNotMatch(overlayJs, /function getSiteFaviconUrl|\/favicon\.ico/, 'overlay theme extraction must not probe website root icons');
  const defaultSearchFaviconStart = overlayJs.indexOf('function getDefaultSearchEngineFaviconUrlForOverlay()');
  const defaultSearchFaviconEnd = overlayJs.indexOf('function getDefaultSearchEngineThemeUrlForOverlay()', defaultSearchFaviconStart);
  assert.notStrictEqual(defaultSearchFaviconStart, -1, 'overlay should define the default search favicon helper');
  assert.notStrictEqual(defaultSearchFaviconEnd, -1, 'default search favicon helper should have a bounded source block');
  const defaultSearchFaviconSource = overlayJs.slice(defaultSearchFaviconStart, defaultSearchFaviconEnd);
  assert.match(defaultSearchFaviconSource, /getPageFaviconCandidateUrl/, 'default search icons should use shared source resolution');
  assert.match(
    overlayJs,
    /function getThemeFromUrl\(url, hostOverride\)[\s\S]*?isBlockedLocalFaviconUrl\(url\)[\s\S]*?new Image\(\)[\s\S]*?image\.src = url/,
    'theme image assignment should remain behind the shared favicon source policy guard'
  );
  assert.match(
    overlayJs,
    /function buildModeSuggestion\(\)[\s\S]*?favicon:\s*chrome\.runtime\.getURL\('assets\/images\/lumno\.png'\)/,
    'mode-switch rows should source their favicon from a trusted extension resource'
  );
  assert.match(
    suggestionsReact,
    /options\.attachFaviconWithFallbacks\([\s\S]*?spec\.url \|\| spec\.favicon \|\| ''[\s\S]*?getFaviconCandidates\(/,
    'React suggestion favicon requests should include the page URL for path-specific exclusions'
  );
}

function testOverlayRendererLetsLocalFaviconsReachRuntime() {
  const overlayJs = fs.readFileSync(path.join(repoRoot, 'src/overlay/search-panel.js'), 'utf8');
  const suggestionsReact = fs.readFileSync(
    path.join(repoRoot, 'react-src/search/suggestions.tsx'),
    'utf8'
  );
  assert.doesNotMatch(
    overlayJs,
    /const useFallback = shouldBlockOverlayFaviconForHost\(hostForTab\);/,
    'overlay open-tab rendering should let local favicons reach the data-only runtime path'
  );
  assert.match(
    suggestionsReact,
    /if \(favicon \|\| useBrowserFavicon\)[\s\S]*?kind:\s*'favicon'[\s\S]*?attach:\s*true/,
    'the React suggestions view should route available favicon data through the runtime attachment path'
  );
  assert.match(
    suggestionsReact,
    /if \(host && options\.shouldBlockFaviconForHost\(host\)\) \{\s*return \{ kind: 'inline', iconName: 'ri-link' \};/,
    'the React suggestions view should keep a link-icon fallback for blocked favicon hosts'
  );
  assert.match(
    suggestionsReact,
    /options\.attachFaviconWithFallbacks\([\s\S]*?getFaviconCandidates\(/,
    'the React favicon element should delegate candidate loading to the data-only runtime'
  );
}

function testOverlayRendererDelegatesFallbackStateToReact() {
  const overlayJs = fs.readFileSync(path.join(repoRoot, 'src/overlay/search-panel.js'), 'utf8');
  const suggestionsReact = fs.readFileSync(
    path.join(repoRoot, 'react-src/search/suggestions.tsx'),
    'utf8'
  );
  assert.doesNotMatch(
    overlayJs,
    /replaceChild\([^)]*favicon|createSuggestionInlineIcon|createLinkIcon/,
    'the overlay adapter should not replace React-owned favicon nodes'
  );
  assert.match(
    overlayJs,
    /function attachReactOverlayFavicon\([\s\S]*?new CustomEvent\('lumno-favicon-fallback', \{\s*bubbles: true/,
    'favicon runtime failures should be reported back to the owning React component'
  );
  assert.match(
    suggestionsReact,
    /slot\.addEventListener\(\s*'lumno-favicon-fallback',[\s\S]*?setFailed\(true\)/,
    'the React favicon component should own its fallback state'
  );
  assert.match(
    suggestionsReact,
    /data-favicon-failed=\{failed \? 'true' : undefined\}[\s\S]*?<InlineIcon/,
    'failed favicon state should render the fallback icon through React'
  );
  assert.match(
    overlayJs,
    /function rerenderReplacedFaviconRows\(\)[\s\S]*?data-favicon-failed="true"[\s\S]*?new CustomEvent\('lumno-favicon-retry'\)/,
    'policy changes should ask failed React rows to retry without rebuilding their DOM'
  );
  assert.match(
    overlayJs,
    /attachFaviconWithFallbacks:\s*attachReactOverlayFavicon/,
    'search and open-tab React rows should share the same favicon attachment adapter'
  );
}

function testOverlayPolicyRecoverySignalsFailedReactRows() {
  const eventNames = [];
  const failedSlots = [{
    dispatchEvent(event) {
      eventNames.push(event.type);
    }
  }];
  function TestCustomEvent(type) {
    this.type = type;
  }
  const retryFailedRows = createRealPolicyRerender({
    CustomEvent: TestCustomEvent,
    suggestionsContainer: {
      querySelectorAll(selector) {
        assert.strictEqual(selector, '[data-favicon-failed="true"]');
        return failedSlots;
      }
    }
  });

  assert.strictEqual(retryFailedRows(), true, 'failed React rows should report a recovery attempt');
  assert.deepStrictEqual(
    eventNames,
    ['lumno-favicon-retry'],
    'each failed React row should receive a retry event'
  );
  const noFailedRows = createRealPolicyRerender({
    CustomEvent: TestCustomEvent,
    suggestionsContainer: {
      querySelectorAll() {
        return [];
      }
    }
  });
  assert.strictEqual(noFailedRows(), false, 'recovery should stay idle when React has no failed rows');
}

function testOverlayRendererBuildsBrowserPageFavicon2WhenMissingExplicitIcon() {
  const suggestionsReact = fs.readFileSync(
    path.join(repoRoot, 'react-src/search/suggestions.tsx'),
    'utf8'
  );
  assert.match(
    suggestionsReact,
    /const useBrowserFavicon =\s*type === 'browserPage'[\s\S]*?options\.isBrowserInternalUrl\(url\)[\s\S]*?if \(favicon \|\| useBrowserFavicon\)/,
    'the React suggestions view should synthesize a browser favicon candidate when no explicit icon is present'
  );
  assert.match(
    suggestionsReact,
    /getPageFaviconRenderCandidates:[\s\S]*?const browserPageUrl = getBrowserPageFaviconUrl\(url\)[\s\S]*?browserPageUrl \|\| explicitUrl/,
    'React browser-page suggestions should pass the synthesized favicon through the shared fallback chain'
  );
}

function testOverlayRendererUsesExtensionFaviconProxyForBrowserPages() {
  const overlayJs = fs.readFileSync(path.join(repoRoot, 'src/overlay/search-panel.js'), 'utf8');
  assert.match(
    overlayJs,
    /function getOverlayFaviconUrlResolver\(\)[\s\S]*?FAVICON_UTILS\.createFaviconUrlResolver[\s\S]*?shouldBlockFaviconForHost: shouldBlockOverlayFaviconForHost/,
    'overlay renderer should use the shared favicon URL resolver with overlay blocking rules'
  );
  assert.match(
    overlayJs,
    /function isBlockedOverlayFaviconUrl\(url\)[\s\S]*?resolver\.isBlockedFaviconUrl\(url\)/,
    'overlay renderer should share nested favicon URL blocking rules'
  );
  assert.match(
    overlayJs,
    /function getPageFaviconCandidateUrl\(pageUrl\)[\s\S]*?resolver\.getPageFaviconCandidateUrl\(pageUrl\)/,
    'browser-page favicon candidates should come from the shared resolver'
  );
}

function testOverlayRendererDefinesChromeMonogramHelper() {
  const overlayJs = fs.readFileSync(path.join(repoRoot, 'src/overlay/search-panel.js'), 'utf8');
  assert.match(
    overlayJs,
    /function isChromeMonogramFaviconUrl\(url\)[\s\S]*?FAVICON_UTILS\.isChromeMonogramFaviconUrl/,
    'overlay renderer should define a local chrome monogram favicon helper from shared favicon utils'
  );
  assert.match(
    overlayJs,
    /createOverlayFaviconViewRuntime\([\s\S]*?isChromeMonogramFaviconUrl,/,
    'overlay favicon runtime should receive the same chrome monogram helper'
  );
  assert.match(
    overlayJs,
    /function attachReactOverlayFavicon\([\s\S]*?attachResolvedFaviconWithFallbacks\(/,
    'React suggestion favicons should delegate to the runtime that owns chrome monogram filtering'
  );
}

async function testOverlayResolvesLocalFaviconThroughDataUrl() {
  const requestedUrls = [];
  const dataUrl = 'data:image/png;base64,bG9jYWw=';
  const { runtime, localPageUrl, extensionUrl } = createRuntime({
    requestFaviconData(url, pageUrl) {
      requestedUrls.push({ url, pageUrl: pageUrl || '' });
      return Promise.resolve(url === extensionUrl ? dataUrl : null);
    }
  });
  const img = createFakeImage();
  let failed = false;

  runtime.attachResolvedFaviconWithFallbacks(
    img,
    localPageUrl,
    '127.0.0.1',
    extensionUrl,
    () => {
      failed = true;
    }
  );

  await wait(0);

  assert.strictEqual(failed, false, 'local overlay favicon should not fall back when background returns data');
  assert.deepStrictEqual(
    requestedUrls,
    [{ url: extensionUrl, pageUrl: localPageUrl }],
    'local overlay favicon should preserve page-rule context when requesting data through background'
  );
  assert.strictEqual(img.src, dataUrl, 'local overlay favicon should only render the returned data URL');
  assert.strictEqual(
    img.getAttribute('data-favicon-data-source'),
    extensionUrl,
    'data URL should keep the unsafe source only as metadata'
  );
  assert.strictEqual(
    /127\.0\.0\.1|localhost/.test(img.src),
    false,
    'page-visible image src should never contain the local URL'
  );
}

async function testOverlayFallsBackWhenLocalFaviconDataUnavailable() {
  const { runtime, localPageUrl, extensionUrl } = createRuntime({ requestFaviconData: () => Promise.resolve(null) });
  const img = createFakeImage();
  const parent = attachFakeFallbackParent(img);
  let failed = false;
  let fallbackCountWhenReactTakesOwnership = -1;

  runtime.attachResolvedFaviconWithFallbacks(
    img,
    localPageUrl,
    '127.0.0.1',
    extensionUrl,
    () => {
      failed = true;
      fallbackCountWhenReactTakesOwnership = parent.querySelectorAll(
        '._x_extension_overlay_favicon_fallback_2026_unique_'
      ).length;
    }
  );

  await wait(0);

  assert.strictEqual(failed, true, 'local overlay favicon should fall back immediately');
  assert.strictEqual(
    fallbackCountWhenReactTakesOwnership,
    0,
    'runtime fallback should be removed before React renders the final fallback icon'
  );
  assert.strictEqual(img.src, '', 'local overlay favicon should not assign a page-visible image src');
}

async function testOverlaySkipsRootIconProbeWhenEnhancedFetchDisabled() {
  const requestedUrls = [];
  const { runtime, localPageUrl, extensionUrl } = createRuntime({
    enhancedFaviconFetchEnabled: false,
    requestFaviconData(url) {
      requestedUrls.push(url);
      return Promise.resolve(null);
    }
  });
  const img = createFakeImage();
  let failed = false;

  runtime.attachResolvedFaviconWithFallbacks(
    img,
    localPageUrl,
    '127.0.0.1',
    extensionUrl,
    () => {
      failed = true;
    }
  );

  await wait(4);

  assert.strictEqual(failed, true, 'disabled enhanced favicon fetching should still fall back cleanly');
  assert.deepStrictEqual(
    requestedUrls,
    [extensionUrl, `https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=${encodeURIComponent(localPageUrl)}&size=128`],
    'disabled enhanced fetching may request the public service but must not probe website icon files'
  );
}

async function testOverlayDisabledFetchKeepsWebsiteImagesOutOfPage() {
  const requestedUrls = [];
  const {
    runtime,
    vpnPageUrl,
    vpnDirectFaviconUrl,
    vpnExtensionUrl,
    vpnGstaticUrl,
    preloadedUrls,
    attachedDataUrls
  } = createRuntime({
    enhancedFaviconFetchEnabled: false,
    requestFaviconData(url) {
      requestedUrls.push(url);
      return Promise.resolve(null);
    }
  });
  const img = createFakeImage();

  runtime.attachFaviconData(img, vpnDirectFaviconUrl, 'foo.example.com');
  runtime.preloadIcon(vpnDirectFaviconUrl);
  runtime.preloadIcon(vpnGstaticUrl);
  runtime.preloadIcon(vpnExtensionUrl);
  runtime.attachResolvedFaviconWithFallbacks(
    img,
    vpnPageUrl,
    'foo.example.com',
    vpnDirectFaviconUrl
  );

  await wait(0);

  assert.deepStrictEqual(attachedDataUrls, [], 'strict mode should not request direct favicon data for a VPN hostname');
  assert.deepStrictEqual(preloadedUrls, [], 'the page should not preload any favicon URL itself');
  assert.deepStrictEqual(Array.from(new Set(requestedUrls)), [vpnGstaticUrl, vpnExtensionUrl],
    'only the approved public service and the browser cache may be fetched, in the background');
  assert.strictEqual(img.src.includes('_favicon'), false, 'the page must never load the _favicon endpoint');
  assert.strictEqual(img.src.includes('foo.example.com/favicon.ico'), false, 'strict mode should not assign the direct favicon');
  assert.strictEqual(img.src.includes('gstatic'), false, 'strict mode should not assign a third-party proxy favicon');
}

async function testOverlayFailsClosedBeforePolicyStateLoads() {
  const {
    runtime,
    vpnPageUrl,
    vpnDirectFaviconUrl,
    vpnExtensionUrl
  } = createRuntime({ enhancedFaviconFetchEnabled: undefined });
  const img = createFakeImage();

  runtime.attachResolvedFaviconWithFallbacks(
    img,
    vpnPageUrl,
    'foo.example.com',
    vpnDirectFaviconUrl
  );

  await wait(0);

  assert.strictEqual(renderedSource(img), vpnExtensionUrl, 'unloaded favicon policy should be treated as strict mode');
}

async function testOverlayExcludedPathUsesStrictCandidatesWhileEnhancedIsOn() {
  const requestedUrls = [];
  const {
    runtime,
    vpnPageUrl,
    vpnDirectFaviconUrl,
    vpnExtensionUrl,
    vpnGstaticUrl,
    preloadedUrls,
    attachedDataUrls,
    warmedIconLists
  } = createRuntime({
    enhancedFaviconFetchEnabled: true,
    excludedPageUrl: 'https://foo.example.com/',
    requestFaviconData(url) {
      requestedUrls.push(url);
      return answerBrowserCacheRequests(url);
    }
  });
  const img = createFakeImage();

  runtime.preloadIcon(vpnDirectFaviconUrl, vpnPageUrl);
  runtime.preloadIcon(vpnGstaticUrl, vpnPageUrl);
  runtime.preloadIcon(vpnExtensionUrl, vpnPageUrl);
  runtime.attachFaviconData({}, vpnDirectFaviconUrl, 'foo.example.com', vpnPageUrl);
  runtime.warmIconCache([{ url: vpnPageUrl, favicon: vpnDirectFaviconUrl }]);
  runtime.attachResolvedFaviconWithFallbacks(
    img,
    vpnPageUrl,
    'foo.example.com',
    vpnDirectFaviconUrl
  );

  await wait(0);

  assert.deepStrictEqual(preloadedUrls, [], 'the page should not preload any favicon URL itself');
  assert.deepStrictEqual(attachedDataUrls, [], 'excluded overlay paths should not request direct favicon data');
  assert.strictEqual(warmedIconLists[0][0].favicon, '',
    'the shared warmer should not receive the browser-cache URL, which the page cannot load');
  assert.deepStrictEqual(Array.from(new Set(requestedUrls)), [vpnExtensionUrl],
    'excluded overlay paths should fetch only the browser cache, never direct, proxy, or root candidates');
  assert.strictEqual(renderedSource(img), vpnExtensionUrl, 'excluded paths should keep only local and browser-cache candidates');
  assert.ok(img.src.startsWith('data:image/'));

  const staleImg = createFakeImage();
  staleImg.src = vpnDirectFaviconUrl;
  staleImg.setAttribute('data-favicon-current-src', vpnDirectFaviconUrl);
  runtime.attachResolvedFaviconWithFallbacks(staleImg, vpnPageUrl, 'foo.example.com', vpnDirectFaviconUrl);
  staleImg._xOverlayThemeFaviconErrorHandler();
  await wait(0);
  assert.notStrictEqual(
    staleImg.src,
    vpnDirectFaviconUrl,
    'excluded overlay paths should not restore a previously working direct favicon after strict candidates fail'
  );

  const publicImg = createFakeImage();
  const publicRuntime = createRuntime({ enhancedFaviconFetchEnabled: true });
  publicRuntime.runtime.attachResolvedFaviconWithFallbacks(
    publicImg,
    publicRuntime.vpnPageUrl,
    'foo.example.com',
    publicRuntime.vpnDirectFaviconUrl
  );
  await wait(0);
  assert.strictEqual(renderedSource(publicImg), publicRuntime.vpnExtensionUrl, 'enhanced-on paths must also prefer browser cache');
}

async function testOverlayUnifiedPathRuleMatrix() {
  const privatePageUrl = 'https://foo.example.com/private';
  const publicPageUrl = 'https://foo.example.com/public';
  const directUrl = 'https://foo.example.com/favicon.ico';
  const privateExtensionUrl = `chrome-extension://abc/_favicon/?pageUrl=${encodeURIComponent(privatePageUrl)}&size=128&fallbackToHost=0`;
  const publicExtensionUrl = `chrome-extension://abc/_favicon/?pageUrl=${encodeURIComponent(publicPageUrl)}&size=128&fallbackToHost=0`;
  const privateGstaticUrl = `https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=${encodeURIComponent(privatePageUrl)}&size=128`;
  const publicGstaticUrl = `https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=${encodeURIComponent(publicPageUrl)}&size=128`;
  const requestedUrls = [];
  const {
    runtime,
    preloadedUrls,
    attachedDataUrls,
    attachedDataRequestPages,
    warmedIconLists
  } = createRuntime({
    enhancedFaviconFetchEnabled: true,
    excludedPageUrl: privatePageUrl,
    requestFaviconData(url, pageUrl) {
      requestedUrls.push({ url, pageUrl: pageUrl || '' });
      return answerBrowserCacheRequests(url);
    }
  });

  const privateImg = createFakeImage();
  runtime.attachResolvedFaviconWithFallbacks(privateImg, privatePageUrl, 'foo.example.com', directUrl);
  await wait(0);
  assert.strictEqual(renderedSource(privateImg), privateExtensionUrl, 'excluded overlay matrix path should render only Lumno browser cache');
  privateImg._xOverlayThemeFaviconErrorHandler();
  assert.notStrictEqual(privateImg.src, privateGstaticUrl, 'excluded overlay matrix path should not fall through to gstatic');
  runtime.preloadIcon(directUrl, privatePageUrl);
  runtime.preloadIcon(privateGstaticUrl, privatePageUrl);
  runtime.preloadIcon(privateExtensionUrl, privatePageUrl);
  runtime.attachFaviconData(createFakeImage(), directUrl, 'foo.example.com', privatePageUrl);
  runtime.warmIconCache([{ url: privatePageUrl, favicon: directUrl }]);
  await wait(0);
  assert.deepStrictEqual(preloadedUrls, [], 'the page should not preload any favicon URL itself');
  assert.deepStrictEqual(attachedDataUrls, [], 'excluded overlay matrix path should not attach direct favicon data');
  assert.deepStrictEqual(Array.from(new Set(requestedUrls.map((entry) => entry.url))), [privateExtensionUrl],
    'excluded overlay matrix path should request only browser-cache data, never page, root, manifest, direct, or proxy data');
  assert.strictEqual(warmedIconLists[0][0].favicon, '', 'excluded matrix paths should warm browser cache in the background');

  const publicImg = createFakeImage();
  runtime.attachResolvedFaviconWithFallbacks(publicImg, publicPageUrl, 'foo.example.com', directUrl);
  await wait(0);
  assert.strictEqual(renderedSource(publicImg), publicExtensionUrl, 'enhanced-on paths should prefer browser cache');
  runtime.preloadIcon(directUrl, publicPageUrl);
  runtime.preloadIcon(publicGstaticUrl, publicPageUrl);
  runtime.attachFaviconData(createFakeImage(), directUrl, 'foo.example.com', publicPageUrl);
  runtime.warmIconCache([{ url: publicPageUrl, favicon: directUrl }]);
  await wait(0);
  assert.strictEqual(preloadedUrls.includes(directUrl), false, 'automatic sources must not preload website icons');
  assert.strictEqual(requestedUrls.some((entry) => entry.url === publicGstaticUrl), false, 'preloading should prefer browser cache');
  assert.deepStrictEqual(attachedDataUrls, [], 'automatic website icons must not reach the data loader');
  assert.deepStrictEqual(attachedDataRequestPages, [], 'blocked website icons must not reach background data requests');
  assert.ok(requestedUrls.some((entry) => entry.url === publicExtensionUrl && entry.pageUrl === publicPageUrl),
    'enhanced-on paths should warm browser cache');
}

async function testOverlayStrictModeReusesCachedFaviconData() {
  const faviconDataCache = new Map();
  const cachedDataUrl = 'data:image/png;base64,Y2FjaGVk';
  const {
    runtime,
    vpnPageUrl,
    vpnDirectFaviconUrl
  } = createRuntime({
    enhancedFaviconFetchEnabled: false,
    faviconDataCache
  });
  faviconDataCache.set(vpnDirectFaviconUrl, cachedDataUrl);
  const img = createFakeImage();

  runtime.attachResolvedFaviconWithFallbacks(
    img,
    vpnPageUrl,
    'foo.example.com',
    vpnDirectFaviconUrl
  );

  await wait(0);

  assert.strictEqual(img.src, cachedDataUrl, 'strict mode should prefer cached data without reusing its direct URL');
}

async function testOverlayPolicyEnableRecoversReplacedStrictFallback() {
  let replacementVisible = false;
  let rerenderCount = 0;
  let currentImg = createFakeImage();
  let runtime = null;
  let created = null;
  const suggestionRowsRoot = {
    contains(img) {
      return img === currentImg;
    }
  };
  const requestedUrls = [];
  let browserCacheAvailable = false;
  const runtimeOptions = {
    enhancedFaviconFetchEnabled: false,
    requestFaviconData(url) {
      requestedUrls.push(url);
      return browserCacheAvailable ? answerBrowserCacheRequests(url) : Promise.resolve(null);
    },
    getOverlayPanel() {
      return {
        querySelectorAll() {
          return currentImg && currentImg.isConnected ? [currentImg] : [];
        }
      };
    },
    getSuggestionRowsRoot() {
      return suggestionRowsRoot;
    }
  };
  const replaceFailedImage = () => {
    replacementVisible = true;
    currentImg.isConnected = false;
  };
  const failedSlot = {
    dispatchEvent(event) {
      assert.strictEqual(event.type, 'lumno-favicon-retry');
      replacementVisible = false;
      rerenderCount += 1;
      currentImg = createFakeImage();
      runtime.attachResolvedFaviconWithFallbacks(
        currentImg,
        created.vpnPageUrl,
        'foo.example.com',
        created.vpnDirectFaviconUrl,
        replaceFailedImage
      );
    }
  };
  function TestCustomEvent(type) {
    this.type = type;
  }
  runtimeOptions.rerenderReplacedFaviconRows = createRealPolicyRerender({
    CustomEvent: TestCustomEvent,
    suggestionsContainer: {
      querySelectorAll() {
        return replacementVisible ? [failedSlot] : [];
      }
    }
  });
  created = createRuntime(runtimeOptions);
  runtime = created.runtime;

  runtime.attachResolvedFaviconWithFallbacks(
    currentImg,
    created.vpnPageUrl,
    'foo.example.com',
    created.vpnDirectFaviconUrl,
    replaceFailedImage
  );
  assert.strictEqual(requestedUrls[0], created.vpnExtensionUrl, 'strict mode should initially try only the virtual favicon');
  assert.notStrictEqual(
    currentImg.src,
    created.vpnDirectFaviconUrl,
    'strict mode should not make the direct favicon retryable before the policy is enabled'
  );

  await wait(0);
  await wait(0);
  assert.strictEqual(replacementVisible, true, 'virtual favicon failure should replace the strict-mode image');

  browserCacheAvailable = true;
  runtimeOptions.enhancedFaviconFetchEnabled = true;
  runtime.refreshOverlayFaviconsForPolicyChange();
  await wait(0);

  assert.strictEqual(rerenderCount, 1, 'enabling enhanced fetching should rerender the replaced row once');
  assert.strictEqual(replacementVisible, false, 'the replacement should be consumed by the recovery rerender');
  assert.strictEqual(
    renderedSource(currentImg),
    created.vpnExtensionUrl,
    'enabling enhanced fetching should keep browser cache as the first candidate'
  );

  runtimeOptions.enhancedFaviconFetchEnabled = false;
  runtime.refreshOverlayFaviconsForPolicyChange();
  await wait(0);

  assert.strictEqual(rerenderCount, 1, 'disabling should refresh a surviving row without an unnecessary rerender');
  assert.strictEqual(renderedSource(currentImg), created.vpnExtensionUrl, 'disabling should restore the strict virtual favicon source');
  assert.strictEqual(currentImg.src.includes('favicon.ico'), false, 'disabling should not retain the direct target candidate');
  assert.strictEqual(currentImg.src.includes('gstatic'), false, 'disabling should not introduce a third-party fallback');
}

async function testOverlayOpenTabPolicyRecoveryIsSafeInBothDirections() {
  let replacementVisible = false;
  let rerenderCount = 0;
  let currentImg = createFakeImage();
  let runtime = null;
  let created = null;
  const suggestionRowsRoot = {
    contains(img) {
      return img === currentImg;
    }
  };
  const requestedUrls = [];
  let browserCacheAvailable = false;
  const runtimeOptions = {
    enhancedFaviconFetchEnabled: false,
    requestFaviconData(url) {
      requestedUrls.push(url);
      return browserCacheAvailable ? answerBrowserCacheRequests(url) : Promise.resolve(null);
    },
    getOverlayPanel() {
      return {
        querySelectorAll() {
          return currentImg && currentImg.isConnected ? [currentImg] : [];
        }
      };
    },
    getSuggestionRowsRoot() {
      return suggestionRowsRoot;
    }
  };
  const replaceFailedImage = () => {
    replacementVisible = true;
    currentImg.isConnected = false;
  };
  const failedSlot = {
    dispatchEvent(event) {
      assert.strictEqual(event.type, 'lumno-favicon-retry');
      replacementVisible = false;
      rerenderCount += 1;
      currentImg = createFakeImage();
      runtime.attachResolvedFaviconWithFallbacks(
        currentImg,
        created.vpnPageUrl,
        'foo.example.com',
        created.vpnDirectFaviconUrl,
        replaceFailedImage
      );
    }
  };
  function TestCustomEvent(type) {
    this.type = type;
  }
  runtimeOptions.rerenderReplacedFaviconRows = createRealPolicyRerender({
    CustomEvent: TestCustomEvent,
    suggestionsContainer: {
      querySelectorAll() {
        return replacementVisible ? [failedSlot] : [];
      }
    }
  });
  created = createRuntime(runtimeOptions);
  runtime = created.runtime;

  runtime.attachResolvedFaviconWithFallbacks(
    currentImg,
    created.vpnPageUrl,
    'foo.example.com',
    created.vpnDirectFaviconUrl,
    replaceFailedImage
  );
  assert.strictEqual(requestedUrls[0], created.vpnExtensionUrl, 'strict open-tab rows should start with the virtual favicon');

  await wait(0);
  await wait(0);
  assert.strictEqual(replacementVisible, true, 'failed strict open-tab favicons should expose a recoverable fallback');

  browserCacheAvailable = true;
  runtimeOptions.enhancedFaviconFetchEnabled = true;
  runtime.refreshOverlayFaviconsForPolicyChange();
  await wait(0);

  assert.strictEqual(rerenderCount, 1, 'enabling should rebuild a replaced open-tab row once');
  assert.strictEqual(renderedSource(currentImg), created.vpnExtensionUrl, 'enabled open-tab rows should retry browser cache');

  runtimeOptions.enhancedFaviconFetchEnabled = false;
  runtime.refreshOverlayFaviconsForPolicyChange();
  await wait(0);

  assert.strictEqual(rerenderCount, 1, 'disabling should refresh the surviving open-tab image without rebuilding it');
  assert.strictEqual(renderedSource(currentImg), created.vpnExtensionUrl, 'disabling should restore the open-tab virtual favicon');
  assert.strictEqual(currentImg.src.includes('favicon.ico'), false, 'strict open-tab rows should not retain a direct candidate');
  assert.strictEqual(currentImg.src.includes('gstatic'), false, 'strict open-tab rows should not introduce a third-party proxy');
}

async function testOverlayUsesChromeFavicon2ForBrowserInternalPages() {
  const requestedUrls = [];
  const {
    runtime,
    browserPageUrl,
    browserPageFavicon2Url
  } = createRuntime({
    requestFaviconData(url) {
      requestedUrls.push(url);
      return Promise.resolve(null);
    },
    shouldBlockOverlayFaviconForHost(hostname) {
      const host = String(hostname || '').toLowerCase();
      return host === '127.0.0.1' || host === 'localhost' || host === 'extensions';
    }
  });
  const img = createFakeImage();
  let failed = false;

  runtime.attachResolvedFaviconWithFallbacks(
    img,
    browserPageUrl,
    'extensions',
    browserPageFavicon2Url,
    () => {
      failed = true;
    }
  );

  await wait(0);

  assert.strictEqual(failed, false, 'browser internal pages should not use the local-network fallback path');
  assert.strictEqual(
    img.src,
    browserPageFavicon2Url,
    'browser internal pages should render chrome://favicon2 directly'
  );
  assert.deepStrictEqual(
    requestedUrls,
    [],
    'browser internal favicon2 should not be converted into a background data request first'
  );
}

async function testOverlayUsesExtensionFaviconProxyForBrowserInternalPagesWithoutExplicitIcon() {
  const {
    runtime,
    browserPageUrl,
    browserPageExtensionUrl
  } = createRuntime({
    shouldBlockOverlayFaviconForHost(hostname) {
      const host = String(hostname || '').toLowerCase();
      return host === '127.0.0.1' || host === 'localhost' || host === 'extensions';
    }
  });
  const img = createFakeImage();
  let failed = false;

  runtime.attachResolvedFaviconWithFallbacks(
    img,
    browserPageUrl,
    'extensions',
    '',
    () => {
      failed = true;
    }
  );

  await wait(0);

  assert.strictEqual(failed, false, 'browser internal pages should not fall back when no explicit icon was supplied');
  assert.strictEqual(
    renderedSource(img),
    browserPageExtensionUrl,
    'browser internal pages should use the extension _favicon proxy before chrome://favicon2'
  );
}

async function testOverlayRejectsRootFaviconForNestedPage() {
  const img = createFakeImage();
  const pageUrl = 'https://chrome.google.com/webstore/devconsole?hl=zh-CN';
  const rootSource = 'chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Fchrome.google.com%2F&size=128&fallbackToHost=0';
  const { runtime } = createRuntime({
    faviconDataCache: new Map([[rootSource, 'data:image/png;base64,d3Jvbmdyb290']])
  });
  runtime.attachResolvedFaviconWithFallbacks(img, pageUrl, 'chrome.google.com', rootSource);
  await wait(0);
  assert.ok(img.src.startsWith('data:image/'), 'the page renders background image bytes, never a _favicon URL');
  assert.strictEqual(new URL(renderedSource(img)).searchParams.get('pageUrl'), pageUrl,
    'overlay search and tab rendering must skip a root-page favicon for a nested URL');
  assert.strictEqual(new URL(renderedSource(img)).searchParams.get('fallbackToHost'), '0');
}

async function testOverlayDoesNotRestoreAnotherPagesImageData() {
  const pageUrl = 'https://chrome.google.com/webstore/devconsole?hl=zh-CN';
  const previousPageData = 'data:image/png;base64,cHJldmlvdXNwYWdl';
  for (const previousPageUrl of ['https://chrome.google.com/', '', pageUrl]) {
    const img = createFakeImage();
    img.src = previousPageData;
    img.setAttribute('data-favicon-current-src', previousPageData);
    if (previousPageUrl) {
      img.setAttribute('data-x-ov-favicon-page-url', previousPageUrl);
    }
    const { runtime } = createRuntime({
      enhancedFaviconFetchEnabled: false,
      requestFaviconData: () => Promise.resolve(null)
    });
    let failed = false;
    runtime.attachResolvedFaviconWithFallbacks(img, pageUrl, 'chrome.google.com', '', () => {
      failed = true;
    });
    // Candidates load as background bytes; until one does the old image is
    // only remembered, so a restore has to put it back explicitly.
    img.src = '';
    await wait(0);
    await wait(0);
    assert.strictEqual(img.src === previousPageData, previousPageUrl === pageUrl,
      'overlay acquisition may restore image data only for the same previous document');
    assert.strictEqual(failed, previousPageUrl !== pageUrl);
  }
}

async function testOverlayServicesRenderOnlyBackgroundImageData() {
  const dataUrl = 'data:image/png;base64,c2VydmljZQ==';
  for (const enhancedFaviconFetchEnabled of [true, false]) {
    const requested = [];
    const { runtime, vpnPageUrl, vpnExtensionUrl, vpnGstaticUrl, preloadedUrls, warmedIconLists } = createRuntime({
      enhancedFaviconFetchEnabled,
      requestFaviconData(url, pageUrl) {
        requested.push({ url, pageUrl });
        // The browser has no icon for the page (the background reports its
        // default globe as no data), so the service is asked next.
        return Promise.resolve(url === vpnGstaticUrl ? dataUrl : null);
      }
    });
    const img = createFakeImage();
    runtime.attachResolvedFaviconWithFallbacks(img, vpnPageUrl, 'foo.example.com', '');
    assert.notStrictEqual(img.src, vpnExtensionUrl, 'the page must never load the _favicon endpoint');
    assert.notStrictEqual(img.src, vpnGstaticUrl, 'the page must never load the remote service URL');
    await wait(0);
    await wait(0);
    assert.strictEqual(img.src, dataUrl, 'service artwork must arrive as local image bytes');
    assert.strictEqual(img.getAttribute('data-favicon-data-source'), vpnGstaticUrl);
    assert.deepStrictEqual(requested, [
      { url: vpnExtensionUrl, pageUrl: vpnPageUrl },
      { url: vpnGstaticUrl, pageUrl: vpnPageUrl }
    ], 'Chrome cache must precede the service, both through the background');

    runtime.preloadIcon(vpnGstaticUrl);
    runtime.warmIconCache([{ favicon: vpnGstaticUrl }]);
    await wait(0);
    assert.strictEqual(preloadedUrls.includes(vpnGstaticUrl), false,
      'service preloading must not create a remote image in the page');
    assert.strictEqual(warmedIconLists[0][0].favicon, '',
      'the shared warmer must not receive a remote service image URL');
  }

  for (const enhancedFaviconFetchEnabled of [true, false]) {
    const requested = [];
    const { runtime, vpnPageUrl, vpnGstaticUrl } = createRuntime({
      enhancedFaviconFetchEnabled,
      excludedPageUrl: 'https://foo.example.com/',
      requestFaviconData(url) { requested.push(url); return Promise.resolve(dataUrl); }
    });
    const img = createFakeImage();
    runtime.attachResolvedFaviconWithFallbacks(img, vpnPageUrl, 'foo.example.com', '');
    img.dispatchEvent('error');
    runtime.preloadIcon(vpnGstaticUrl, vpnPageUrl);
    await wait(0);
    assert.deepStrictEqual(requested.filter((url) => url.includes('gstatic')), [],
      'exclusions must block service fetching regardless of the global switch');
  }
}

async function testOverlayServiceTimeoutAndStaleResponses() {
  for (const replaceSession of [false, true]) {
    const pendingRequests = new Map();
    let failed = false;
    const { runtime, vpnPageUrl, vpnExtensionUrl, vpnGstaticUrl } = createRuntime({
      enhancedFaviconFetchEnabled: false,
      faviconCandidateLoadTimeoutMs: 10,
      requestFaviconData(url) { return new Promise((resolve) => { pendingRequests.set(url, resolve); }); }
    });
    const img = createFakeImage();
    runtime.attachResolvedFaviconWithFallbacks(img, vpnPageUrl, 'foo.example.com', '', () => { failed = true; });
    img.dispatchEvent('error');
    assert.strictEqual(typeof pendingRequests.get(vpnGstaticUrl), 'function');
    if (replaceSession) {
      runtime.attachResolvedFaviconWithFallbacks(img, 'https://other.example.com/page', 'other.example.com', '');
    } else {
      await wait(20);
      assert.strictEqual(failed, true, 'an unresponsive service must release the row to its fallback');
    }
    const currentSource = img.src;
    pendingRequests.get(vpnExtensionUrl)('data:image/png;base64,c3RhbGVjYWNoZQ==');
    pendingRequests.get(vpnGstaticUrl)('data:image/png;base64,c3RhbGU=');
    await wait(0);
    assert.strictEqual(img.src, currentSource, 'late service bytes must not replace a newer page or a timed-out fallback');
  }
}

testOverlayRejectsRootFaviconForNestedPage()
  .then(testOverlayServicesRenderOnlyBackgroundImageData)
  .then(testOverlayServiceTimeoutAndStaleResponses)
  .then(testOverlayDoesNotRestoreAnotherPagesImageData)
  .then(testOverlayResolvesLocalFaviconThroughDataUrl)
  .then(testOverlayFallsBackWhenLocalFaviconDataUnavailable)
  .then(testOverlaySkipsRootIconProbeWhenEnhancedFetchDisabled)
  .then(testOverlayDisabledFetchKeepsWebsiteImagesOutOfPage)
  .then(testOverlayFailsClosedBeforePolicyStateLoads)
  .then(testOverlayExcludedPathUsesStrictCandidatesWhileEnhancedIsOn)
  .then(testOverlayUnifiedPathRuleMatrix)
  .then(testOverlayStrictModeReusesCachedFaviconData)
  .then(testOverlayPolicyEnableRecoversReplacedStrictFallback)
  .then(testOverlayOpenTabPolicyRecoveryIsSafeInBothDirections)
  .then(testOverlayPolicyRecoverySignalsFailedReactRows)
  .then(testOverlayUsesChromeFavicon2ForBrowserInternalPages)
  .then(testOverlayUsesExtensionFaviconProxyForBrowserInternalPagesWithoutExplicitIcon)
  .then(testOverlayRendererLetsLocalFaviconsReachRuntime)
  .then(testOverlayRendererDelegatesFallbackStateToReact)
  .then(testOverlayRendererBuildsBrowserPageFavicon2WhenMissingExplicitIcon)
  .then(testOverlayRendererUsesExtensionFaviconProxyForBrowserPages)
  .then(testOverlayRendererDefinesChromeMonogramHelper)
  .then(testOverlayRendererLoadsFaviconPolicyBeforeInitialTabs)
  .then(testOverlayRendererGuardsThemeSourcesInStrictMode)
  .then(() => {
    console.log('overlay favicon view tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
