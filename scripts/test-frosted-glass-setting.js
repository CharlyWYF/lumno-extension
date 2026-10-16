const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const postcss = require('postcss');
const settings = require('../src/shared/settings.js');

const key = settings.NEWTAB_FROSTED_GLASS_ENABLED_STORAGE_KEY;
assert(settings.CHROME_SYNC_STORAGE_KEYS.includes(key));
for (const value of [undefined, null, false, 'true', 1, {}]) {
  assert.strictEqual(settings.normalizeNewtabFrostedGlassEnabled(value), false);
}
assert.strictEqual(settings.normalizeNewtabFrostedGlassEnabled(true), true);

const source = fs.readFileSync('src/newtab/newtab.js', 'utf8');
const start = source.indexOf('  function applyNewtabFrostedGlass(');
const end = source.indexOf('  function loadNewtabActionButtonVisibility(', start);
assert(start >= 0 && end > start);
const handlerStart = source.indexOf('  storageChanges.on(NEWTAB_FROSTED_GLASS_ENABLED_STORAGE_KEY,');
const handlerEnd = source.indexOf('  storageChanges.on(NEWTAB_FEEDBACK_BUTTON_VISIBLE_STORAGE_KEY,', handlerStart);
assert(handlerStart >= 0 && handlerEnd > handlerStart);

async function boot(value, hasStorage = true) {
  const attributes = {};
  let listener;
  const context = vm.createContext({
    SETTINGS: settings,
    updateWallpaperAppearanceSelectionUi() {},
    NEWTAB_FROSTED_GLASS_ENABLED_STORAGE_KEY: key,
    document: { body: { setAttribute(name, next) { attributes[name] = next; } } },
    storageArea: hasStorage ? {
      get(keys, callback) {
        assert.strictEqual(keys[0], key);
        callback({ [key]: value });
      }
    } : null,
    storageChanges: { on(storageKey, callback) {
      assert.strictEqual(storageKey, key);
      listener = callback;
    } }
  });
  vm.runInContext(source.slice(start, end) + source.slice(handlerStart, handlerEnd), context);
  await vm.runInContext('loadNewtabFrostedGlass()', context);
  return {
    enabled: () => attributes['data-frosted-glass'],
    change(next) { listener({ [key]: { newValue: next } }); }
  };
}

async function main() {
  const fresh = await boot(undefined);
  assert.strictEqual(fresh.enabled(), 'false', 'new installations keep the original style');
  const restored = await boot(true);
  assert.strictEqual(restored.enabled(), 'true', 'a saved choice applies during startup');
  restored.change(false);
  assert.strictEqual(restored.enabled(), 'false', 'switching off restores the original style live');
  restored.change(true);
  assert.strictEqual(restored.enabled(), 'true', 'a synchronized enable applies live');
  restored.change(undefined);
  assert.strictEqual(restored.enabled(), 'false', 'removing the setting restores the default');
  assert.strictEqual((await boot(true, false)).enabled(), 'false', 'missing storage keeps the default');

  const css = postcss.parse(fs.readFileSync('src/newtab/frosted-glass.css', 'utf8'));
  css.walkRules((rule) => {
    for (const selector of rule.selectors) {
      assert(selector.startsWith('body[data-frosted-glass="true"]'),
        `a disabled style must not affect the page: ${selector}`);
    }
  });
  console.log('frosted glass setting tests passed');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
