const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const api = require('../src/newtab/surface-transparency.js');
const messages = require('../_locales/en/messages.json');
async function main() {
  assert.deepEqual(api.normalize({ search: -8, shortcut: 170 }), { search: 0, shortcut: 100 });
  assert.deepEqual(api.normalize({ search: '29.7', shortcut: NaN }), { search: 30, shortcut: 0 });
  assert.deepEqual(api.normalize({ search: null, shortcut: true }), { search: 0, shortcut: 0 });
  const dom = new JSDOM('<body></body>'); const document = dom.window.document;
  const listeners = new Set(); let stored = { search: 25, shortcut: 60 }; let fail = false; let errors = 0;
  const chrome = { runtime: {}, storage: { onChanged: { addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn) } } };
  const storage = { get(_keys, callback) { callback({ [api.KEY]: stored }); }, set(values, callback) {
    setImmediate(() => {
      if (fail) chrome.runtime.lastError = { message: 'save failed' };
      else stored = values[api.KEY];
      callback(); delete chrome.runtime.lastError;
    });
  } };
  const create = () => api.createRuntime({ documentObj: document, chromeObj: chrome, storageArea: storage,
    t: (key, fallback) => messages[key]?.message || fallback, showToast: () => errors++ });
  const runtime = create(); await runtime.ready;
  const refs = {};
  for (const field of ['search', 'shortcut']) {
    for (const [suffix, tag] of [['Label', 'span'], ['Hint', 'p'], ['Reset', 'button'], ['Slider', 'input'], ['Value', 'input']]) {
      refs[`${field}Transparency${suffix}`] = document.createElement(tag);
      document.body.append(refs[`${field}Transparency${suffix}`]);
    }
    refs[`${field}TransparencySlider`].type = 'range';
    refs[`${field}TransparencyValue`].type = 'number';
  }
  runtime.bindSettings(refs);
  assert.equal(document.body.dataset.searchTransparency, '25');
  assert.equal(document.body.style.getPropertyValue('--x-nt-shortcut-surface-strength'), '0.4');
  refs.searchTransparencySlider.value = '75'; refs.searchTransparencySlider.dispatchEvent(new dom.window.Event('input'));
  assert.equal(runtime.getValues().search, 75); assert.equal(stored.search, 25, 'Preview does not save on every input');
  await runtime.commit('search', 75); await runtime.commit('shortcut', 100);
  assert.deepEqual(stored, { search: 75, shortcut: 100 });
  assert.equal(refs.shortcutTransparencySlider.getAttribute('aria-valuetext'), '100%');
  fail = true; await runtime.commit('search', 90); fail = false;
  assert.deepEqual(runtime.getValues(), { search: 75, shortcut: 100 }, 'Failed save restores committed settings');
  assert.equal(errors, 1);
  await Promise.all([runtime.commit('search', 10), runtime.commit('shortcut', 35)]);
  assert.deepEqual(stored, { search: 10, shortcut: 35 }, 'Queued saves preserve both independently edited values');
  listeners.forEach(fn => fn({ [api.KEY]: { newValue: { search: 0, shortcut: 15 } } }, 'sync'));
  assert.equal(document.body.hasAttribute('data-search-transparency'), false, 'Zero restores original styling');
  assert.equal(refs.shortcutTransparencyValue.value, '15');
  listeners.forEach(fn => fn({ [api.KEY]: { newValue: undefined } }, 'sync'));
  assert.deepEqual(runtime.getValues(), { search: 0, shortcut: 0 }, 'Deleted settings restore original appearance');
  runtime.destroy(); assert.equal(listeners.size, 0);
  const restored = create(); await restored.ready;
  assert.deepEqual(restored.getValues(), stored); restored.destroy(); dom.window.close();
  console.log('Surface transparency: normalization, live preview, independent values, queued saves, save rollback, storage sync, reset and reload passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
