(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.LumnoHelpCenterSearch = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  // Searches the help center's own index (lumno.kubai.design/<locale>/help/search-index.json)
  // with the same rules as the search box on the site, so both list the same pages.
  const RESULT_LIMIT = 6;
  const INDEX_CACHE_TTL_MS = 10 * 60 * 1000;
  const FETCH_TIMEOUT_MS = 4000;

  function normalizeIndex(payload) {
    return (Array.isArray(payload) ? payload : [])
      .filter((doc) => doc && typeof doc.title === 'string' && typeof doc.href === 'string')
      .map((doc) => ({
        title: doc.title,
        href: doc.href,
        text: typeof doc.text === 'string' ? doc.text : '',
        sections: (Array.isArray(doc.sections) ? doc.sections : [])
          .filter((section) => section && typeof section.id === 'string' && typeof section.title === 'string')
      }));
  }

  function snippet(text, term) {
    const at = text.toLowerCase().indexOf(term);
    if (at < 0) {
      return text.slice(0, 60);
    }
    const start = Math.max(0, at - 24);
    return `${start > 0 ? '…' : ''}${text.slice(start, at + term.length + 36)}…`;
  }

  // A title hit outranks a heading hit, which outranks a hit in the body; every term must match.
  function searchIndex(index, query, options) {
    const settings = options && typeof options === 'object' ? options : {};
    const origin = String(settings.origin || '');
    const limit = Number.isFinite(Number(settings.limit)) ? Number(settings.limit) : RESULT_LIMIT;
    const terms = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length || !Array.isArray(index)) {
      return [];
    }
    return index
      .map((doc, order) => {
        const title = doc.title.toLowerCase();
        const text = doc.text.toLowerCase();
        let score = 0;
        let section = null;
        for (const term of terms) {
          const heading = doc.sections.find((item) => item.title.toLowerCase().includes(term));
          if (title.includes(term)) {
            score += 10;
          } else if (heading) {
            score += 4;
          } else if (text.includes(term)) {
            score += 1;
          } else {
            return null;
          }
          if (heading && !section) {
            section = heading;
          }
        }
        const href = section ? `${doc.href}#${section.id}` : doc.href;
        return {
          score,
          order,
          title: doc.title,
          detail: section ? section.title : snippet(doc.text, terms[0]),
          url: /^https?:\/\//i.test(href) ? href : `${origin}${href}`
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || a.order - b.order)
      .slice(0, limit)
      .map(({ title, detail, url }) => ({ title, detail, url }));
  }

  // One cached index per language; a failed load is forgotten so the next query retries.
  function createIndexLoader(options) {
    const config = options && typeof options === 'object' ? options : {};
    const fetchImpl = config.fetchImpl;
    const now = typeof config.now === 'function' ? config.now : () => Date.now();
    const ttlMs = Number.isFinite(Number(config.ttlMs)) ? Number(config.ttlMs) : INDEX_CACHE_TTL_MS;
    const timeoutMs = Number.isFinite(Number(config.timeoutMs)) ? Number(config.timeoutMs) : FETCH_TIMEOUT_MS;
    const cache = new Map();

    function load(url) {
      const key = String(url || '');
      const cached = cache.get(key);
      if (cached && now() - cached.loadedAt < ttlMs) {
        return cached.promise;
      }
      if (typeof fetchImpl !== 'function' || !key) {
        return Promise.resolve([]);
      }
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : 0;
      const promise = Promise.resolve(fetchImpl(key, controller ? { signal: controller.signal } : undefined))
        .then((response) => {
          if (!response || !response.ok || typeof response.json !== 'function') {
            throw new Error('help center index unavailable');
          }
          return response.json();
        })
        .then(normalizeIndex)
        .catch((error) => {
          if (cache.get(key) && cache.get(key).promise === promise) {
            cache.delete(key);
          }
          throw error;
        })
        .finally(() => {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
        });
      cache.set(key, { loadedAt: now(), promise });
      return promise;
    }

    return Object.freeze({ load });
  }

  // For a search surface: rows for the pages matching the query, fetched through background
  // (getHelpCenterSearchResults). Until a new query's pages arrive the previous ones stay in
  // place so the list does not jump on every keystroke; onUpdate re-renders when they land.
  function createSuggestionSource(options) {
    const config = options && typeof options === 'object' ? options : {};
    const sendMessage = typeof config.sendMessage === 'function' ? config.sendMessage : () => false;
    const onUpdate = typeof config.onUpdate === 'function' ? config.onUpdate : () => {};
    let current = { key: '', items: [] };
    let pendingKey = '';

    function getSuggestions(query, locale, favicon) {
      const trimmed = String(query || '').trim();
      if (!trimmed) {
        return [];
      }
      const key = `${String(locale || '')}\n${trimmed}`;
      if (current.key !== key && pendingKey !== key) {
        pendingKey = key;
        const sent = sendMessage({
          action: 'getHelpCenterSearchResults',
          query: trimmed,
          locale: String(locale || '')
        }, (response) => {
          if (pendingKey !== key) {
            return;
          }
          pendingKey = '';
          current = { key, items: response && Array.isArray(response.items) ? response.items : [] };
          onUpdate(query);
        });
        if (!sent) {
          pendingKey = '';
          current = { key, items: [] };
        }
      }
      return current.items.map((item) => ({
        type: 'helpArticle',
        title: String(item && item.title || ''),
        detail: String(item && item.detail || ''),
        url: String(item && item.url || ''),
        favicon: String(favicon || '')
      })).filter((item) => item.title && item.url);
    }

    return Object.freeze({ getSuggestions });
  }

  return Object.freeze({
    RESULT_LIMIT,
    INDEX_CACHE_TTL_MS,
    normalizeIndex,
    searchIndex,
    createIndexLoader,
    createSuggestionSource
  });
});
