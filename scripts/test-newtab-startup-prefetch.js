const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = path.resolve(__dirname, '..');
const settings = require('../src/shared/settings.js');
const source = fs.readFileSync(path.join(repoRoot, 'src/newtab/newtab-storage-prefetch.js'), 'utf8');

function run(cache) {
  const fetched = [];
  const sandbox = {
    LumnoSettings: Object.assign({}, settings, {
      createProviderStorageRuntime: () => null
    }),
    fetch(url, options) {
      fetched.push({ url, options });
      return Promise.resolve({ json: () => Promise.resolve({}) });
    }
  };
  sandbox.window = {
    chrome: { runtime: { getURL: (resource) => `chrome-extension://id/${resource}` } },
    localStorage: {
      getItem: (key) => (Object.prototype.hasOwnProperty.call(cache, key) ? cache[key] : null)
    }
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename: 'newtab-storage-prefetch.js' });
  return { fetched, prefetch: sandbox.LumnoNewtabLocalePrefetch };
}

const prefetched = run({ [settings.NEWTAB_LOCALE_CACHE_KEY]: 'zh_CN' });
assert.strictEqual(prefetched.prefetch.locale, 'zh_CN');
assert.deepStrictEqual(prefetched.fetched.map((entry) => entry.url), [
  'chrome-extension://id/_locales/zh_CN/messages.json'
]);
assert.strictEqual(prefetched.fetched[0].options.cache, 'no-store');
const unknownLocale = run({ [settings.NEWTAB_LOCALE_CACHE_KEY]: '../evil' });
assert.strictEqual(unknownLocale.prefetch, undefined);
assert.strictEqual(unknownLocale.fetched.length, 0);
assert.strictEqual(run({}).prefetch, undefined);

console.log('New Tab startup prefetch tests passed: locale prefetch');
