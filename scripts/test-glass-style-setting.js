const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const postcss = require('postcss');
const settings = require('../src/shared/settings.js');

const key = settings.NEWTAB_GLASS_STYLE_STORAGE_KEY;
assert(settings.CHROME_SYNC_STORAGE_KEYS.includes(key));
assert.deepStrictEqual(Array.from(settings.NEWTAB_GLASS_STYLES), ['none', 'frosted', 'liquid']);
for (const value of [undefined, null, false, true, 'Frosted', 'glass', 1, {}]) {
  assert.strictEqual(settings.normalizeNewtabGlassStyle(value), 'none');
}
for (const value of ['none', 'frosted', 'liquid']) {
  assert.strictEqual(settings.normalizeNewtabGlassStyle(value), value);
}

const source = fs.readFileSync('src/newtab/newtab.js', 'utf8');
const start = source.indexOf('  // Surfaces whose rim bends the wallpaper under the liquid style;');
const end = source.indexOf('  function loadNewtabActionButtonVisibility(', start);
assert(start >= 0 && end > start);
const handlerStart = source.indexOf('  storageChanges.on(NEWTAB_GLASS_STYLE_STORAGE_KEY,');
const handlerEnd = source.indexOf('  storageChanges.on(NEWTAB_FEEDBACK_BUTTON_VISIBLE_STORAGE_KEY,', handlerStart);
assert(handlerStart >= 0 && handlerEnd > handlerStart);

async function boot(value, hasStorage = true) {
  const attributes = {};
  const surfaces = { created: 0, destroyed: 0, selector: '' };
  let listener;
  const context = vm.createContext({
    SETTINGS: settings,
    updateWallpaperAppearanceSelectionUi() {},
    scheduleWallpaperAdaptiveToneUpdate() {},
    syncBookmarkTopbarSurfaceAppearance() {},
    MutationObserver: class { observe() {} disconnect() {} },
    NEWTAB_GLASS_STYLE_STORAGE_KEY: key,
    window: {},
    document: { body: {
      setAttribute(name, next) { attributes[name] = next; },
      removeAttribute(name) { delete attributes[name]; }
    } },
    globalThis: { LumnoNewtabLiquidSurfaces: { create(options) {
      surfaces.created += 1;
      surfaces.selector = options.selector;
      assert.strictEqual(options.property, '--x-nt-glass-refraction');
      return { destroy() { surfaces.destroyed += 1; }, refresh() {} };
    } } },
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
  await vm.runInContext('loadNewtabGlassStyle()', context);
  return {
    style: () => attributes['data-glass-style'],
    surfaces,
    change(next) { listener({ [key]: { newValue: next } }); }
  };
}

async function main() {
  const fresh = await boot(undefined);
  assert.strictEqual(fresh.style(), undefined, 'new installations keep the original surfaces');
  assert.strictEqual(fresh.surfaces.created, 0);
  const frosted = await boot('frosted');
  assert.strictEqual(frosted.style(), 'frosted', 'a saved choice applies during startup');
  assert.strictEqual(frosted.surfaces.created, 0, 'frosted glass needs no refraction maps');
  frosted.change('liquid');
  assert.strictEqual(frosted.style(), 'liquid', 'a synchronized choice applies live');
  assert.strictEqual(frosted.surfaces.created, 1, 'liquid glass starts the rim refraction');
  // The search stack and the dock's cards bend; menus and the panel, on layers of their own,
  // sometimes show their lens's map in Chrome 155. The bookmarks bar keeps its own glass.
  assert(frosted.surfaces.selector.includes('#_x_extension_newtab_suggestions_surface_2026_unique_'));
  assert(frosted.surfaces.selector.includes('.x-nt-recent-card-visual'));
  assert(frosted.surfaces.selector.includes(':not(.x-nt-bookmarks-topbar .x-nt-bookmark-card)'));
  assert(!frosted.surfaces.selector.includes('_x_extension_menu_surface_2024_unique_'));
  frosted.change('liquid');
  assert.strictEqual(frosted.surfaces.created, 1, 'staying on liquid keeps the same maps');
  frosted.change('none');
  assert.strictEqual(frosted.style(), undefined, 'switching back restores the original surfaces');
  assert.strictEqual(frosted.surfaces.destroyed, 1, 'leaving liquid drops its maps');
  frosted.change('glass');
  assert.strictEqual(frosted.style(), undefined, 'unknown values fall back to the default');
  assert.strictEqual((await boot('liquid', false)).style(), undefined, 'missing storage keeps the default');

  const css = postcss.parse(fs.readFileSync('src/newtab/glass-style.css', 'utf8'));
  css.walkRules((rule) => {
    for (const selector of rule.selectors) {
      assert(selector.startsWith('body[data-glass-style'),
        `the default style must stay untouched: ${selector}`);
    }
  });
  const html = fs.readFileSync('newtab.html', 'utf8');
  assert(html.indexOf('href="glass-style.css"') > html.indexOf('href="newtab.css"'),
    'the glass styles load after the page styles they override');
  console.log('glass style setting tests passed');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
