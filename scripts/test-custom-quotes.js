const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const custom = require('../src/newtab/custom-quotes.js');
const settings = require('../src/shared/settings.js');
require('../src/newtab/remote-content.js');
const quotesApi = require('../src/newtab/quotes.js');
const locale = require('../_locales/en/messages.json');
const tick = () => new Promise(resolve => setImmediate(resolve));

async function main() {
  const parsed = custom.parseMarkdown('# 我的句库\n\n> **千里之行**，始于足下。\n> — 老子\n\n- Keep learning.\n- [Be curious](https://example.com/).\n\n```js\nalert(1)\n```');
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0].text, '千里之行，始于足下。'); assert.equal(parsed[0].author, '老子');
  assert.equal(parsed[2].text, 'Be curious.');
  assert.throws(() => custom.parseMarkdown('# Empty\n```\ncode\n```'), /empty/);
  assert.throws(() => custom.parseMarkdown('a'.repeat(501)), /limit/);
  assert.throws(() => custom.parseMarkdown('a'.repeat(custom.MAX_BYTES + 1)), /too-large/);
  assert.throws(() => custom.parseMarkdown(Array.from({ length: 1001 }, (_, i) => `- Quote ${i}`).join('\n')), /limit/);
  const library = { version: 1, filename: 'quotes.md', revision: 7, quotes: parsed };
  const today = new Date(2026, 9, 14);
  const selected = custom.select(library, today, null, false);
  assert.deepEqual(custom.select(library, today, null, false), selected);
  const shuffled = custom.select(library, today, selected.pick, true);
  assert.notEqual(shuffled.pick.index, selected.pick.index);
  assert.deepEqual(custom.select(library, today, shuffled.pick, false), shuffled);
  assert.equal(custom.normalizeLibrary({ version: 1, quotes: [] }), null);

  const dom = new JSDOM('<body><div id="search"></div><div id="shortcuts"></div></body>', { url: 'https://test.invalid/' });
  const document = dom.window.document;
  let prefs = { enabled: true, position: 'search', provider: 'custom' };
  let local = {}; let networkCalls = 0; let failSave = false;
  const chromeObj = { runtime: { lastError: null } };
  const localArea = {
    get(_keys, callback) { callback({ ...local }); },
    set(values, callback) {
      if (failSave) chromeObj.runtime.lastError = { message: 'storage error' }; else Object.assign(local, values);
      callback(); chromeObj.runtime.lastError = null;
    }
  };
  const makeRuntime = () => quotesApi.createRuntime({ documentObj: document, windowObj: dom.window,
    t: (key, fallback) => locale[key]?.message || fallback, getLocale: () => 'en', chromeObj,
    getSearchRoot: () => document.querySelector('#search'), getShortcutSection: () => document.querySelector('#shortcuts'),
    localStorageArea: localArea, storageArea: { get(_keys, callback) { callback({ [settings.NEWTAB_QUOTE_PREFS_STORAGE_KEY]: prefs }); },
      set(values, callback) { prefs = values[settings.NEWTAB_QUOTE_PREFS_STORAGE_KEY]; callback(); } },
    client: { getQuote() { networkCalls++; return Promise.resolve({ text: 'Remote', author: '', source: '', url: 'https://hitokoto.cn/' }); } }
  });
  const runtime = makeRuntime(); await runtime.mount(); await tick();
  const refs = Object.fromEntries(['quoteTitle', 'quoteBody', 'quoteCategory', 'quoteImportStatus'].map(key => [key, document.createElement('div')]));
  refs.quoteEnabledToggle = document.createElement('input');
  refs.quoteEnabledToggle.type = 'checkbox';
  runtime.bindSettings(refs);
  assert.equal(networkCalls, 0); assert.equal(runtime.element.hidden, true);
  const file = { name: 'my.md', size: 200, text: async () => 'First local quote.\n\nSecond local quote.' };
  assert.equal(await runtime.importMarkdown(file), true); await tick();
  assert.equal(local[custom.KEY].quotes.length, 2);
  assert.equal(runtime.element.hidden, false, 'Custom text is available for English UI too');
  assert.ok(runtime.textElement.textContent.includes('local quote'));
  assert.equal(runtime.element.querySelector('a').hasAttribute('href'), false, 'Custom quotes never link to Hitokoto');
  assert.equal(networkCalls, 0);
  const before = JSON.stringify(local[custom.KEY]);
  assert.equal(await runtime.importMarkdown({ ...file, text: async () => '# Empty' }), false);
  assert.equal(JSON.stringify(local[custom.KEY]), before);
  assert.equal(await runtime.importMarkdown({ ...file, name: 'wrong.txt' }), false);
  assert.match(refs.quoteImportStatus.textContent, /valid Markdown file/);
  failSave = true; assert.equal(await runtime.importMarkdown(file), false); failSave = false;
  assert.equal(JSON.stringify(local[custom.KEY]), before, 'Failed save preserves the previous collection');
  assert.match(refs.quoteImportStatus.textContent, /Could not save on this device.*previous collection is retained/);
  assert.doesNotMatch(refs.quoteImportStatus.textContent, /valid Markdown file/);
  assert.equal(refs.quoteImportStatus.getAttribute('role'), 'alert');
  runtime.element.querySelector('.x-nt-quote-shuffle').click(); await tick();
  const afterShuffle = runtime.textElement.textContent;
  assert.ok(local[custom.PICK_KEY]);
  runtime.destroy();
  const restored = makeRuntime(); await restored.mount(); await tick();
  assert.equal(restored.textElement.textContent, afterShuffle, 'Shuffle selection survives refresh');
  assert.equal(networkCalls, 0); restored.destroy(); dom.window.close();
  console.log('Custom Markdown quotes: parsing, limits, safe plain text, import failure, local storage, daily selection, shuffle persistence and no remote requests passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
