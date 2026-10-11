const assert = require('assert');
const fs = require('fs');
const helpCenterSearch = require('../src/shared/help-center-search.js');
const communityLinks = require('../src/shared/community-links.js');
const searchUtils = require('../src/shared/search-utils.js');

const ORIGIN = 'https://lumno.kubai.design';
const index = helpCenterSearch.normalizeIndex([
  {
    title: 'Lumno 是什么',
    href: '/help/what-is-lumno/',
    sections: [
      { id: 'command-bar', title: '命令栏：一搜即达' },
      { id: 'new-tab', title: '新标签页：每次打开都是一幅画' }
    ],
    text: 'Lumno 是一款免费、开源的浏览器扩展。在任意网页按下快捷键，唤出命令栏；把新标签页换成简洁的起始页。'
  },
  {
    title: '新标签页的壁纸与外观',
    href: '/help/newtab-wallpaper/',
    sections: [{ id: 'filters', title: '滤镜' }],
    text: '在新标签页右下角打开外观面板，选择壁纸和滤镜。'
  },
  {
    title: '站内搜索与问 AI',
    href: '/help/site-search/',
    sections: [{ id: 'how', title: '如何使用站内搜索' }],
    text: '输入网站的缩写，按 Tab 进入站内搜索。'
  },
  { title: 'broken entry without href' },
  null
]);

assert.strictEqual(index.length, 3, 'malformed index entries should be dropped');

const newTabResults = helpCenterSearch.searchIndex(index, '新标签页', { origin: ORIGIN });
assert.deepStrictEqual(
  newTabResults.map((item) => item.url),
  [
    `${ORIGIN}/help/newtab-wallpaper/`,
    `${ORIGIN}/help/what-is-lumno/#new-tab`
  ],
  'a title hit should outrank a heading hit, and a heading hit should link to its section'
);
assert.strictEqual(newTabResults[1].detail, '新标签页：每次打开都是一幅画', 'a heading hit should show the heading');

const bodyResults = helpCenterSearch.searchIndex(index, 'tab', { origin: ORIGIN });
assert.strictEqual(bodyResults.length, 1);
assert.strictEqual(bodyResults[0].url, `${ORIGIN}/help/site-search/`, 'a body hit should link to the page itself');
assert.match(bodyResults[0].detail, /Tab/, 'a body hit should show the passage around the match');

assert.deepStrictEqual(
  helpCenterSearch.searchIndex(index, '壁纸 不存在', { origin: ORIGIN }),
  [],
  'every term must match, like the search box on the help center'
);
assert.deepStrictEqual(helpCenterSearch.searchIndex(index, '   ', { origin: ORIGIN }), []);
assert.strictEqual(
  helpCenterSearch.searchIndex(index, 'lumno', { origin: ORIGIN, limit: 1 }).length,
  1,
  'results should respect the limit'
);

assert.strictEqual(
  communityLinks.getHelpSearchIndexUrl('zh_CN'),
  `${ORIGIN}/help/search-index.json`,
  'Simplified Chinese reads the root index'
);
assert.strictEqual(communityLinks.getHelpSearchIndexUrl('zh_TW'), `${ORIGIN}/zh-tw/help/search-index.json`);
assert.strictEqual(communityLinks.getHelpSearchIndexUrl('ja'), `${ORIGIN}/ja/help/search-index.json`);
assert.strictEqual(communityLinks.getHelpSearchIndexUrl('fr'), `${ORIGIN}/en/help/search-index.json`);

const builtinProvider = searchUtils.getDefaultSiteSearchProviders().find((item) => item.key === 'lm');
assert.ok(searchUtils.isHelpCenterSiteSearchProvider(builtinProvider), 'the built-in provider searches the help center');
assert.ok(
  searchUtils.isHelpCenterSiteSearchProvider({ ...builtinProvider, key: 'help', builtinKey: 'lm', _xIsCustom: true }),
  'an edited built-in provider keeps its help center results'
);
assert.ok(
  !searchUtils.isHelpCenterSiteSearchProvider({ ...builtinProvider, template: 'https://example.com/?q={query}' }),
  'a provider pointed elsewhere should not list help center pages'
);
assert.ok(
  !searchUtils.isHelpCenterSiteSearchProvider(searchUtils.getDefaultSiteSearchProviders().find((item) => item.key === 'gh'))
);
assert.deepStrictEqual(
  searchUtils.getSiteSearchProviderDisplayNameMessage(builtinProvider),
  { messageKey: 'site_search_name_lumno_help', fallback: 'Lumno Help Center' }
);
['en', 'ja', 'zh_CN', 'zh_TW'].forEach((locale) => {
  const messages = JSON.parse(fs.readFileSync(`_locales/${locale}/messages.json`, 'utf8'));
  assert.match(messages.site_search_name_lumno_help.message, /^Lumno /, `${locale} should name the Lumno Help Center`);
});

async function testIndexLoader() {
  let now = 0;
  const requests = [];
  let failNext = true;
  const loader = helpCenterSearch.createIndexLoader({
    now: () => now,
    ttlMs: 1000,
    fetchImpl: (url) => {
      requests.push(url);
      if (failNext) {
        failNext = false;
        return Promise.reject(new Error('offline'));
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([{ title: 'A', href: '/help/a/', text: '' }]) });
    }
  });
  await assert.rejects(loader.load('https://index.test/a.json'), /offline/);
  const first = await loader.load('https://index.test/a.json');
  assert.strictEqual(first.length, 1, 'a failed load should be retried by the next query');
  await loader.load('https://index.test/a.json');
  assert.strictEqual(requests.length, 2, 'a loaded index should be reused within its lifetime');
  now = 1500;
  await loader.load('https://index.test/a.json');
  assert.strictEqual(requests.length, 3, 'an expired index should be fetched again');
  await loader.load('https://index.test/b.json');
  assert.strictEqual(requests.length, 4, 'each language keeps its own index');
}

function testSuggestionSource() {
  const sent = [];
  const updates = [];
  const source = helpCenterSearch.createSuggestionSource({
    sendMessage: (message, callback) => {
      sent.push({ message, callback });
      return true;
    },
    onUpdate: (query) => updates.push(query)
  });
  assert.deepStrictEqual(source.getSuggestions('新标签页', 'zh_CN', 'tile.png'), [], 'nothing shows before the first answer');
  assert.deepStrictEqual(sent[0].message, {
    action: 'getHelpCenterSearchResults',
    query: '新标签页',
    locale: 'zh_CN'
  });
  source.getSuggestions('新标签页', 'zh_CN', 'tile.png');
  assert.strictEqual(sent.length, 1, 'a repeated render should not send the same request again');
  sent[0].callback({ items: [{ title: '新标签页的壁纸与外观', detail: '滤镜', url: `${ORIGIN}/help/newtab-wallpaper/` }] });
  assert.deepStrictEqual(updates, ['新标签页'], 'arriving pages should re-render the list');
  assert.deepStrictEqual(source.getSuggestions('新标签页', 'zh_CN', 'tile.png'), [{
    type: 'helpArticle',
    title: '新标签页的壁纸与外观',
    detail: '滤镜',
    url: `${ORIGIN}/help/newtab-wallpaper/`,
    favicon: 'tile.png'
  }]);
  assert.strictEqual(
    source.getSuggestions('新标签页 壁纸', 'zh_CN', 'tile.png').length,
    1,
    'the previous pages stay in place while the next query loads'
  );
  sent[1].callback(null);
  assert.deepStrictEqual(source.getSuggestions('新标签页 壁纸', 'zh_CN', 'tile.png'), [], 'an unavailable index shows no pages');
  sent[0].callback({ items: [{ title: 'stale', url: 'https://stale.test/' }] });
  assert.strictEqual(updates.length, 2, 'a late answer for an older query should be ignored');
}

const backgroundSource = fs.readFileSync('src/background/background.js', 'utf8');
const importBlock = backgroundSource.match(/importScripts\(([\s\S]*?)\);/)[1];
assert.ok(importBlock.includes("'src/shared/community-links.js'") && importBlock.includes("'src/shared/help-center-search.js'"));
assert.match(backgroundSource, /'getHelpCenterSearchResults',\n/, 'the message should be routed to the site search handler');
assert.match(backgroundSource, /case 'getHelpCenterSearchResults':/);
const overlayFiles = backgroundSource.slice(backgroundSource.indexOf('const overlayInjectionFiles'));
assert.ok(
  overlayFiles.indexOf("'src/shared/help-center-search.js'") > 0 &&
    overlayFiles.indexOf("'src/shared/help-center-search.js'") < overlayFiles.indexOf("'src/overlay/search-panel.js'"),
  'the overlay should load the help center module before the search panel'
);
const newtabHtml = fs.readFileSync('newtab.html', 'utf8');
assert.ok(
  newtabHtml.indexOf('../shared/help-center-search.js') > 0 &&
    newtabHtml.indexOf('../shared/help-center-search.js') < newtabHtml.indexOf('suggestions-controller.js'),
  'the new tab should load the help center module before its suggestions controller'
);
assert.match(
  fs.readFileSync('src/newtab/suggestions-controller.js', 'utf8'),
  /\[siteSearchSuggestion, \.\.\.helpCenterSuggestions\]/
);
assert.match(
  fs.readFileSync('src/overlay/search-panel.js', 'utf8'),
  /\[siteSearchSuggestion, \.\.\.getHelpCenterSuggestions\(query\)\]/
);

testSuggestionSource();
testIndexLoader().then(() => {
  console.log('help center search tests passed');
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
