(function(root, factory) {
  const api = factory();
  root.LumnoUrlGuards = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  function isBrowserExtensionProtocol(protocol) {
    const normalized = String(protocol || '').toLowerCase();
    return normalized === 'chrome-extension:' ||
      normalized === 'moz-extension:' ||
      normalized === 'ms-browser-extension:';
  }

  function isBrowserInternalUrl(url) {
    const lower = String(url || '').toLowerCase();
    return lower.startsWith('chrome://') ||
      lower.startsWith('edge://') ||
      lower.startsWith('brave://') ||
      lower.startsWith('vivaldi://') ||
      lower.startsWith('opera://') ||
      lower.startsWith('about:');
  }

  function isBrowserNewtabUrl(url) {
    const lower = String(url || '').trim().toLowerCase().replace(/[?#].*$/, '').replace(/\/+$/, '');
    return lower === 'chrome://newtab' ||
      lower === 'chrome://new-tab-page' ||
      lower === 'edge://newtab' ||
      lower === 'brave://newtab' ||
      lower === 'vivaldi://newtab' ||
      lower === 'opera://startpage' ||
      lower === 'about:newtab' ||
      lower === 'about:home';
  }

  // Firefox forbids content scripts on its add-ons site; Chromium does not.
  function isFirefoxRuntime() {
    const profile = globalThis.LumnoBrowserProfile;
    return Boolean(profile && profile.isFirefoxExtensionRuntime());
  }

  function isExtensionStoreUrl(url) {
    if (!url) {
      return false;
    }
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      const path = parsed.pathname.toLowerCase();
      return (host === 'chrome.google.com' && path.startsWith('/webstore')) ||
        host === 'chromewebstore.google.com' ||
        (host === 'microsoftedge.microsoft.com' && path.startsWith('/addons')) ||
        host === 'addons.opera.com' ||
        (host === 'addons.mozilla.org' && isFirefoxRuntime());
    } catch (e) {
      return false;
    }
  }

  function isRestrictedUrl(url) {
    if (!url || isBrowserInternalUrl(url)) {
      return true;
    }
    try {
      const parsed = new URL(url);
      const protocol = String(parsed.protocol || '').toLowerCase();
      if (isBrowserExtensionProtocol(protocol)) {
        return true;
      }
      if (protocol !== 'http:' && protocol !== 'https:') {
        return true;
      }
      return isExtensionStoreUrl(url);
    } catch (e) {
      return true;
    }
  }

  function canOpenOverlayOnUrl(url) {
    if (!url || isBrowserInternalUrl(url)) {
      return false;
    }
    try {
      const parsed = new URL(url);
      const protocol = String(parsed.protocol || '').toLowerCase();
      if (isBrowserExtensionProtocol(protocol)) {
        return false;
      }
      if (protocol === 'file:') {
        return true;
      }
      if (protocol !== 'http:' && protocol !== 'https:') {
        return false;
      }
      return !isExtensionStoreUrl(url);
    } catch (e) {
      return false;
    }
  }

  function canFetchPageForFavicon(url) {
    if (!url || isBrowserInternalUrl(url) || isExtensionStoreUrl(url)) {
      return false;
    }
    try {
      const protocol = String(new URL(url).protocol || '').toLowerCase();
      return protocol === 'http:' || protocol === 'https:';
    } catch (e) {
      return false;
    }
  }

  // Whether a tab may be opened on a URL a web-page context (content script or
  // in-page overlay) asked for. Typed and bookmarked targets stay openable
  // (http(s), file:, mailto:, browser pages ...), but never script, inline
  // data documents or another extension's pages.
  function canOpenUrlFromWebPageContext(url, ownExtensionBaseUrl) {
    const raw = String(url || '').trim();
    if (!raw) {
      return false;
    }
    let parsed = null;
    try {
      parsed = new URL(raw);
    } catch (e) {
      return false;
    }
    const protocol = String(parsed.protocol || '').toLowerCase();
    if (protocol === 'javascript:' || protocol === 'data:' || protocol === 'vbscript:') {
      return false;
    }
    if (protocol === 'view-source:') {
      return canOpenUrlFromWebPageContext(raw.slice(protocol.length), ownExtensionBaseUrl);
    }
    if (isBrowserExtensionProtocol(protocol)) {
      const base = String(ownExtensionBaseUrl || '');
      return Boolean(base) && parsed.href.startsWith(base);
    }
    return true;
  }

  return Object.freeze({
    canFetchPageForFavicon,
    canOpenUrlFromWebPageContext,
    canOpenOverlayOnUrl,
    isBrowserExtensionProtocol,
    isBrowserInternalUrl,
    isBrowserNewtabUrl,
    isExtensionStoreUrl,
    isRestrictedUrl
  });
});
