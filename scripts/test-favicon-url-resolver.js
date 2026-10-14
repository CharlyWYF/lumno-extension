const assert = require('assert');
const utils = require('../src/shared/favicon-utils.js');

const runtimeBase = 'chrome-extension://abc';
const createResolver = (options) => utils.createFaviconUrlResolver({
  getRuntimeUrl: (assetPath) => `${runtimeBase}/${String(assetPath || '').replace(/^\/+/, '')}`,
  ...options
});

{
  // Proxy-check kinds come from the candidate kind, or from the URL for
  // primary, page-specific and persisted-url candidates.
  const { getFaviconProxyCheckKind } = createResolver();
  assert.strictEqual(getFaviconProxyCheckKind(null), '');
  assert.strictEqual(getFaviconProxyCheckKind({ kind: 'extension', url: '' }), '');
  assert.strictEqual(getFaviconProxyCheckKind({ kind: 'extension', url: 'data:x' }), 'extension');
  assert.strictEqual(getFaviconProxyCheckKind({ kind: 'gstatic', url: 'data:x' }), 'gstatic');
  assert.strictEqual(getFaviconProxyCheckKind({ kind: 'browser', url: 'chrome-extension://abc/_favicon/?x=1' }), '');
  for (const kind of ['primary', 'page-specific', 'persisted-url']) {
    assert.strictEqual(getFaviconProxyCheckKind({ kind, url: ' chrome-extension://abc/_favicon/?x=1' }), 'extension');
    assert.strictEqual(getFaviconProxyCheckKind({ kind, url: 'https://t2.gstatic.cn/faviconV2?url=x' }), 'gstatic');
    assert.strictEqual(getFaviconProxyCheckKind({ kind, url: 'https://example.com/favicon.ico' }), '');
  }
  assert.strictEqual(getFaviconProxyCheckKind({ kind: 'persisted-data', url: 'https://t2.gstatic.com/favicon' }), '');
}

{
  // Lumno's own pages render its bundled icon; other extensions' pages and
  // Lumno's _favicon endpoint do not count as Lumno pages.
  const resolver = createResolver();
  const lumnoIcon = `${runtimeBase}/assets/images/lumno.png`;
  assert.strictEqual(resolver.getPageFaviconCandidateUrl(`${runtimeBase}/newtab.html`), lumnoIcon);
  assert.deepStrictEqual(resolver.getPageFaviconRenderCandidates(`${runtimeBase}/options.html`, ''), {
    primaryUrl: lumnoIcon,
    browserUrl: ''
  });
  assert.deepStrictEqual(
    resolver.getPageFaviconRenderCandidates('chrome-extension://other/popup.html', 'data:image/png;base64,QQ=='),
    { primaryUrl: '', browserUrl: '' }
  );
  assert.strictEqual(resolver.getPageFaviconCandidateUrl('moz-extension://other/popup.html'), '');
  assert.strictEqual(
    resolver.getSafeFaviconCandidateUrl('data:image/png;base64,QQ==', 'chrome-extension://other/popup.html'),
    ''
  );
  assert.notStrictEqual(resolver.getPageFaviconCandidateUrl(`${runtimeBase}/_favicon/?pageUrl=x`), lumnoIcon);

  // Without a known own id, every extension page belongs to someone else.
  const anonymous = utils.createFaviconUrlResolver({});
  assert.strictEqual(anonymous.getPageFaviconCandidateUrl(`${runtimeBase}/newtab.html`), '');
}

{
  // Gstatic is only told the site origin, so its answer stands for that
  // origin. Favicon.is may stand for the same host, but only when the caller
  // opts in.
  const resolver = createResolver();
  const page = 'https://docs.example.com/guide';
  const samePageProxy = resolver.getGstaticFaviconUrl(page);
  assert.ok(samePageProxy);
  assert.strictEqual(new URL(samePageProxy).searchParams.get('url'), 'https://docs.example.com/');
  assert.strictEqual(resolver.getSafeFaviconCandidateUrl(samePageProxy, page), samePageProxy);
  assert.strictEqual(resolver.getSafeFaviconCandidateUrl(resolver.getGstaticFaviconUrl('https://docs.example.com/'), page),
    samePageProxy);
  assert.strictEqual(resolver.getSafeFaviconCandidateUrl(resolver.getGstaticFaviconUrl('https://api.example.com/'), page), '');
  assert.strictEqual(resolver.getSafeFaviconCandidateUrl('https://favicon.is/docs.example.com', page), '');
  assert.strictEqual(
    resolver.getSafeFaviconCandidateUrl('https://favicon.is/docs.example.com', page, 'explicit', { allowDomainProxy: true }),
    'https://favicon.is/docs.example.com'
  );
  assert.strictEqual(
    resolver.getSafeFaviconCandidateUrl('https://favicon.is/other.example.com', page, 'explicit', { allowDomainProxy: true }),
    ''
  );
}

{
  // Shortcut fetch candidates follow the selected icon source.
  const resolver = createResolver({
    shouldBlockFaviconForHost: (host) => host === 'blocked.example.com'
  });
  const page = 'https://shop.example.com/cart#top';
  const kinds = (iconSource) => resolver.getShortcutFaviconFetchCandidates(page, iconSource)
    .map((candidate) => candidate.kind);
  assert.deepStrictEqual(kinds(), ['browser-cache', 'proxy']);
  assert.deepStrictEqual(kinds('service'), ['proxy']);
  assert.deepStrictEqual(kinds('cache'), ['browser-cache']);
  const [faviconIs] = resolver.getShortcutFaviconFetchCandidates(page, 'favicon-is');
  assert.strictEqual(faviconIs.kind, 'favicon-is');
  assert.strictEqual(faviconIs.url, utils.getFaviconIsUrl(page));
  assert.strictEqual(faviconIs.placeholderUrl, utils.getFaviconIsUrl('https://lumno.invalid/'));
  const [browserCache, proxy] = resolver.getShortcutFaviconFetchCandidates(page);
  assert.ok(browserCache.placeholderUrl.includes('__favicon_placeholder_probe__'));
  assert.ok(proxy.placeholderUrl.includes('lumno.invalid'));
  assert.strictEqual(new URL(proxy.url).searchParams.get('url').includes('#'), false,
    'the proxy request drops the page hash');
  assert.deepStrictEqual(resolver.getShortcutFaviconFetchCandidates('https://blocked.example.com/', 'service'), []);
  assert.deepStrictEqual(resolver.getShortcutFaviconFetchCandidates('chrome://settings/'), []);
}

{
  // Plans run local artwork first, then data:, then browser-cache requests,
  // then remote proxies; an opted-in remote primary ranks with data:.
  const resolver = createResolver();
  const page = 'https://news.example.com/';
  const plan = resolver.buildFaviconCandidatePlan({
    pageUrl: page,
    persistedDataUrl: 'data:image/png;base64,QQ==',
    primaryUrl: `${runtimeBase}/assets/images/site-search/tile.png`
  });
  assert.deepStrictEqual(plan.map((candidate) => candidate.kind),
    ['primary', 'persisted-data', 'extension', 'gstatic']);

  const remotePlan = resolver.buildFaviconCandidatePlan({
    pageUrl: page,
    primaryUrl: 'https://cdn.example.net/logo.png',
    persistedDataUrl: 'data:image/png;base64,QQ==',
    allowRemoteImage: true
  });
  assert.deepStrictEqual(remotePlan.map((candidate) => candidate.kind),
    ['persisted-data', 'primary', 'extension', 'gstatic']);
}

console.log('favicon url resolver tests passed');
