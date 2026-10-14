(function(root) {
  // Opening URLs, bookmarks, shortcuts and searches from the New Tab with the
  // right tab disposition.
  function createPageNavigation(deps) {
    const {
      NAVIGATION_DISPOSITION,
      getShortcutTileById,
      bookmarksRuntime,
      getShortcutFolderId,
      showToast,
      t,
      openBookmarkCascadeMenu,
      navigateBookmarkFolder,
      getDirectNavigationUrl,
      buildDefaultSearchUrl
    } = deps;

    // The page state object shared with newtab.js and the other modules.
    const pageState = deps.pageState;

    function navigateToUrl(url) {
      if (!url) {
        return;
      }
      if (chrome.tabs && chrome.tabs.getCurrent) {
        chrome.tabs.getCurrent(function(tab) {
          if (chrome.runtime.lastError) {
            window.location.href = url;
            return;
          }
          if (tab && tab.id) {
            chrome.tabs.update(tab.id, { url: url });
          } else {
            window.location.href = url;
          }
        });
      } else {
        window.location.href = url;
      }
    }

    function isMiddleClick(event) {
      return NAVIGATION_DISPOSITION.isMiddleClick(event);
    }

    function isBackgroundOpenEvent(event) {
      if (pageState.numberShortcutInstantEnabled) {
        return isMiddleClick(event);
      }
      return NAVIGATION_DISPOSITION.isBackgroundOpenEvent(event);
    }

    function getOpenDisposition(event, fallback) {
      if (typeof event === 'string') {
        return event === 'backgroundTab' ? 'backgroundTab' : (fallback || event || 'newTab');
      }
      return NAVIGATION_DISPOSITION.getDisposition(event, fallback);
    }

    function openExternalNewTabUrl(url, eventOrDisposition) {
      if (!url) {
        return false;
      }
      const disposition = typeof eventOrDisposition === 'string'
        ? eventOrDisposition
        : getOpenDisposition(eventOrDisposition, 'newTab');
      if (chrome && chrome.runtime && typeof chrome.runtime.sendMessage === 'function') {
        chrome.runtime.sendMessage({
          action: 'createTab',
          url,
          disposition
        });
        return true;
      }
      if (chrome && chrome.tabs && typeof chrome.tabs.create === 'function') {
        chrome.tabs.create({ url, active: disposition !== 'backgroundTab' });
        return true;
      }
      window.open(url, '_blank', 'noopener');
      return true;
    }

    // A plain click opens in the current tab unless the surface's "open in a new
    // tab" setting is on; a background-open click wins either way.
    function getSurfaceOpenDisposition(surface, openInBackgroundTab) {
      if (openInBackgroundTab) {
        return 'backgroundTab';
      }
      const prefs = pageState.newtabOpenInNewTab;
      return prefs && prefs[surface] === true ? 'newTab' : 'currentTab';
    }

    // Returns where the URL went, so a card can tell whether the New Tab is
    // navigating away or staying behind.
    function openUrlFromNewtabCard(url, options) {
      if (!url) {
        return '';
      }
      const config = options && typeof options === 'object' ? options : {};
      const disposition = getSurfaceOpenDisposition(config.surface, config.openInBackgroundTab);
      if (disposition !== 'currentTab' &&
          chrome && chrome.runtime && typeof chrome.runtime.sendMessage === 'function') {
        chrome.runtime.sendMessage({
          action: 'createTab',
          url: url,
          disposition
        });
        return disposition;
      }
      navigateToUrl(url);
      return 'currentTab';
    }

    function openShortcutUrl(shortcut, event) {
      if (shortcut && shortcut.type === 'folder') {
        const tile = getShortcutTileById(shortcut.id);
        bookmarksRuntime.ensureReady(false).then((ready) => {
          const node = ready && bookmarksRuntime.getNode(getShortcutFolderId(shortcut));
          if (!node || node.url) {
            showToast(t('newtab_shortcuts_folder_missing', 'This bookmark folder is no longer available.'), true);
            return;
          }
          openBookmarkCascadeMenu({ ...node, type: 'folder' }, tile);
        });
        return;
      }
      if (!shortcut || !shortcut.url) {
        return;
      }
      openUrlFromNewtabCard(shortcut.url, {
        openInBackgroundTab: isBackgroundOpenEvent(event),
        surface: 'shortcuts'
      });
    }

    function recordSearchSuggestionSelection(suggestion, rawQuery) {
      if (!suggestion || suggestion.forceSearch || suggestion.provider || !suggestion.url ||
          !chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
        return;
      }
      const query = String(rawQuery || pageState.latestRawQuery || (pageState.inputParts && pageState.inputParts.input ? pageState.inputParts.input.value : '') || '').trim();
      if (!query) {
        return;
      }
      chrome.runtime.sendMessage({
        action: 'recordSearchSuggestionSelection',
        query,
        url: suggestion.url,
        title: suggestion.title || '',
        type: suggestion.type || 'history',
        source: 'newtab'
      }, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          // Best-effort ranking signal.
        }
      });
    }

    function openBookmarkFolder(nodeId) {
      const id = String(nodeId || '').trim();
      if (!id) {
        return;
      }
      navigateBookmarkFolder(id);
    }

    function markCurrentTabForSearchTracking() {
      if (!chrome || !chrome.tabs || !chrome.tabs.getCurrent || !chrome.runtime || !chrome.runtime.sendMessage) {
        return;
      }
      chrome.tabs.getCurrent((tab) => {
        if (tab && typeof tab.id === 'number') {
          chrome.runtime.sendMessage({ action: 'trackSearchTab', tabId: tab.id });
        }
      });
    }

    function runBrowserSearch(query, disposition, onFail) {
      if (chrome && chrome.search && typeof chrome.search.query === 'function') {
        try {
          chrome.search.query({ text: query, disposition: disposition || 'CURRENT_TAB' }, () => {
            if (chrome.runtime && chrome.runtime.lastError && typeof onFail === 'function') {
              onFail();
            }
          });
          return true;
        } catch (e) {
          if (typeof onFail === 'function') {
            onFail();
          }
          return false;
        }
      }
      return false;
    }

    function navigateToQuery(query, forceSearch, disposition) {
      if (disposition && disposition !== 'currentTab' &&
          chrome && chrome.runtime && typeof chrome.runtime.sendMessage === 'function') {
        chrome.runtime.sendMessage({
          action: 'searchOrNavigate',
          query: query,
          forceSearch: Boolean(forceSearch),
          disposition
        });
        return;
      }
      const directUrl = !forceSearch ? getDirectNavigationUrl(query) : '';
      let targetUrl = query;
      if (directUrl) {
        navigateToUrl(directUrl);
        return;
      }
      markCurrentTabForSearchTracking();
      const attempted = runBrowserSearch(query, 'CURRENT_TAB', () => {
        const fallbackUrl = buildDefaultSearchUrl(query);
        navigateToUrl(fallbackUrl);
      });
      if (attempted) {
        return;
      }
      targetUrl = buildDefaultSearchUrl(query);
      navigateToUrl(targetUrl);
    }

    return {
      navigateToUrl,
      isMiddleClick,
      isBackgroundOpenEvent,
      getOpenDisposition,
      getSurfaceOpenDisposition,
      openExternalNewTabUrl,
      openUrlFromNewtabCard,
      openShortcutUrl,
      recordSearchSuggestionSelection,
      openBookmarkFolder,
      navigateToQuery
    };
  }

  root.LumnoNewtabPageNavigation = { createPageNavigation };
})(globalThis);
