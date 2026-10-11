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

  // Only the start is trimmed here; the row's own ellipsis cuts the end at whatever width it has.
  const SNIPPET_LEAD = 24;
  const SNIPPET_LENGTH = 240;

  function snippet(text, term) {
    const at = text.toLowerCase().indexOf(term);
    const start = at < 0 ? 0 : Math.max(0, at - SNIPPET_LEAD);
    return `${start > 0 ? '…' : ''}${text.slice(start, start + SNIPPET_LENGTH)}`;
  }

  const RECOMMENDED_LIMIT = 3;
  // Words that phrase a question rather than name a topic; removing them leaves what the
  // person is asking about (怎么改快捷键 → 改快捷键, "how do I change the shortcut" → change shortcut).
  const QUERY_FILLERS = [
    '怎么样', '怎么办', '怎么', '怎样', '如何', '为什么', '为啥', '什么', '是否', '请问', '一下', '可以', '能不能',
    '怎麼樣', '怎麼辦', '怎麼', '為什麼', '什麼', '請問',
    'どうやって', 'どうすれば', 'どうして', 'なぜ', 'したい', 'ですか', 'ますか',
    '吗', '嗎', '呢', '吧', '啊', '的', '了'
  ];
  const LATIN_STOP_WORDS = new Set([
    'a', 'an', 'the', 'how', 'do', 'does', 'did', 'can', 'could', 'i', 'my', 'me', 'to', 'is', 'are', 'was',
    'what', 'why', 'where', 'when', 'which', 'it', 'its', 'in', 'on', 'of', 'for', 'with', 'and', 'or', 'not',
    "don't", "doesn't", "can't", 'be', 'you', 'your', 'this', 'that', 'there', 'way', 'get', 'use', 'using'
  ]);
  const CJK_RUN = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uac00-\ud7af]+/g;

  function toUrl(origin, href) {
    return /^https?:\/\//i.test(href) ? href : `${origin}${href}`;
  }

  // A title hit outranks a heading hit, which outranks a hit in the body; every term must match.
  function matchExactly(index, terms) {
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
        return {
          doc,
          score,
          order,
          section,
          detail: section ? section.title : snippet(doc.text, terms[0])
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || a.order - b.order);
  }

  function stripFillers(query) {
    let text = String(query || '').toLowerCase();
    QUERY_FILLERS.forEach((filler) => {
      text = text.split(filler).join(' ');
    });
    return text;
  }

  // Words that must all appear, without the question's filler words when anything else is left.
  function getExactTerms(query) {
    const terms = stripFillers(query).split(/\s+/)
      .filter((term) => term && !LATIN_STOP_WORDS.has(term));
    return terms.length ? terms : String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  }

  // The pieces a loose match compares: pairs of characters for CJK text, which has no spaces
  // between words, and whole words for the rest, each without the question's filler words.
  function getQueryUnits(query) {
    const text = stripFillers(query);
    const units = new Set();
    (text.match(CJK_RUN) || []).forEach((run) => {
      if (run.length === 1) {
        units.add(run);
        return;
      }
      for (let i = 0; i < run.length - 1; i += 1) {
        units.add(run.slice(i, i + 2));
      }
    });
    text.replace(CJK_RUN, ' ').split(/[^\p{L}\p{N}']+/u).forEach((word) => {
      if (word.length >= 2 && !LATIN_STOP_WORDS.has(word)) {
        units.add(word);
      }
    });
    return [...units];
  }

  function coverage(text, units) {
    const value = text.toLowerCase();
    return units.filter((unit) => value.includes(unit)).length / units.length;
  }

  // The longest stretch of the query's CJK text found as typed (快捷键老是失灵 → 快捷键 in 修改快捷键).
  function longestSharedRun(text, runs) {
    const value = text.toLowerCase();
    let longest = 0;
    runs.forEach((run) => {
      for (let start = 0; start < run.length; start += 1) {
        for (let end = run.length; end - start > longest; end -= 1) {
          if (value.includes(run.slice(start, end))) {
            longest = end - start;
            break;
          }
        }
      }
    });
    return longest;
  }

  // How well a title or heading answers the query: the share of its pieces it contains,
  // or, for a long question, a phrase of three or more characters taken from it.
  function headingMatch(text, units, runs) {
    const value = coverage(text, units);
    return longestSharedRun(text, runs) >= 3 ? Math.max(value, 0.4) + 0.1 : value;
  }

  // When the words don't appear as typed, the pages whose title or a heading share most of
  // the query's pieces are still worth reading; the body only breaks ties.
  function recommend(index, query, excludedDocs) {
    const units = getQueryUnits(query);
    if (!units.length) {
      return [];
    }
    const runs = stripFillers(query).match(CJK_RUN) || [];
    return index
      .map((doc, order) => {
        if (excludedDocs.has(doc)) {
          return null;
        }
        let headingCoverage = headingMatch(doc.title, units, runs);
        let section = null;
        doc.sections.forEach((item) => {
          const value = headingMatch(item.title, units, runs) * 0.9;
          if (value > headingCoverage) {
            headingCoverage = value;
            section = item;
          }
        });
        const bodyCoverage = coverage(doc.text, units);
        if (headingCoverage < 0.4 && !(units.length > 1 && bodyCoverage === 1)) {
          return null;
        }
        return {
          doc,
          order,
          section,
          score: headingCoverage + bodyCoverage * 0.25,
          detail: section ? section.title : snippet(doc.text, units[0]),
          recommended: true
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || a.order - b.order)
      .slice(0, RECOMMENDED_LIMIT);
  }

  // Exact matches first; when they leave room, the closest pages follow as recommended reading.
  function searchIndex(index, query, options) {
    const settings = options && typeof options === 'object' ? options : {};
    const origin = String(settings.origin || '');
    const limit = Number.isFinite(Number(settings.limit)) ? Number(settings.limit) : RESULT_LIMIT;
    if (!String(query || '').trim() || !Array.isArray(index)) {
      return [];
    }
    const terms = getExactTerms(query);
    const exact = matchExactly(index, terms).slice(0, limit);
    const recommended = exact.length < limit
      ? recommend(index, query, new Set(exact.map((item) => item.doc))).slice(0, limit - exact.length)
      : [];
    return [...exact, ...recommended].map((item) => {
      const result = {
        title: item.doc.title,
        detail: item.detail,
        url: toUrl(origin, item.section ? `${item.doc.href}#${item.section.id}` : item.doc.href)
      };
      if (item.recommended) {
        result.recommended = true;
      }
      return result;
    });
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
  // When nothing in the help center matches, the ways to ask instead: the WeChat group where
  // that is the community channel, a GitHub issue and the author on X (no store rating here).
  function buildFeedbackSuggestions(feedback) {
    const config = feedback && typeof feedback === 'object' ? feedback : null;
    if (!config) {
      return [];
    }
    const links = config.links && typeof config.links === 'object' ? config.links : {};
    const t = typeof config.t === 'function' ? config.t : (key, fallback) => fallback;
    return [
      config.channel === 'wechat' && links.wechatQr
        ? ['community', links.wechatQr, 'ri-wechat-line', t('settings_feedback_support_wechat_action', '加入反馈群')]
        : null,
      links.githubIssue
        ? ['github-issue', links.githubIssue, 'ri-github-line', t('settings_feedback_support_github_issue_action', '创建 Issue')]
        : null,
      links.x
        ? ['contact-author', links.x, 'ri-twitter-x-line', t('settings_feedback_support_contact_author_action', '联系作者')]
        : null
    ].filter(Boolean).map(([feedbackKey, url, iconName, title]) => ({
      type: 'helpFeedback',
      feedbackKey,
      title: String(title || ''),
      url: String(url),
      iconName
    }));
  }

  function createSuggestionSource(options) {
    const config = options && typeof options === 'object' ? options : {};
    const sendMessage = typeof config.sendMessage === 'function' ? config.sendMessage : () => false;
    const onUpdate = typeof config.onUpdate === 'function' ? config.onUpdate : () => {};
    let current = { key: '', items: [] };
    let pendingKey = '';

    // feedback ({ links, channel, t }) fills the list with ways to ask when nothing matched.
    function getSuggestions(query, locale, favicon, feedback) {
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
          current = {
            key,
            items: response && Array.isArray(response.items) ? response.items : [],
            // An index that could not load says nothing about the help center's content.
            failed: !response || Boolean(response.reason)
          };
          onUpdate(query);
        });
        if (!sent) {
          pendingKey = '';
          current = { key, items: [], failed: true };
        }
      }
      if (current.key === key && !current.failed && current.items.length === 0) {
        return buildFeedbackSuggestions(feedback);
      }
      return current.items.map((item) => ({
        type: 'helpArticle',
        title: String(item && item.title || ''),
        detail: String(item && item.detail || ''),
        url: String(item && item.url || ''),
        favicon: String(favicon || ''),
        recommended: Boolean(item && item.recommended)
      })).filter((item) => item.title && item.url);
    }

    return Object.freeze({ getSuggestions });
  }

  return Object.freeze({
    RESULT_LIMIT,
    INDEX_CACHE_TTL_MS,
    normalizeIndex,
    getExactTerms,
    getQueryUnits,
    searchIndex,
    createIndexLoader,
    buildFeedbackSuggestions,
    createSuggestionSource
  });
});
