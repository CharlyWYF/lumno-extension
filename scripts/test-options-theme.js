const assert = require('assert');
const { JSDOM } = require('jsdom');
const settings = require('../src/shared/settings');
const { createThemeSection } = require('../src/options/options-theme');

function setup(stored, options) {
  const config = options || {};
  const dom = new JSDOM('<head><meta name="theme-color" content=""></head><body><div id="panel"></div></body>', {
    url: 'https://lumno.test/options.html'
  });
  const window = dom.window;
  const document = window.document;
  const mediaListeners = new Set();
  const media = {
    matches: Boolean(config.systemDark),
    addEventListener: (type, listener) => mediaListeners.add(listener),
    removeEventListener: (type, listener) => mediaListeners.delete(listener)
  };
  window.matchMedia = () => media;
  const values = Object.assign({}, stored);
  const writes = [];
  const storageArea = {
    get(keys, callback) {
      callback(Object.fromEntries(keys.filter((key) => key in values).map((key) => [key, values[key]])));
    },
    set(payload, callback) {
      writes.push(payload);
      Object.assign(values, payload);
      callback();
    }
  };
  const pickerModels = [];
  const shown = [];
  const section = createThemeSection({
    documentObj: document,
    getMessage: (key, fallback) => fallback,
    onModeShown: (mode) => shown.push(mode),
    panel: document.getElementById('panel'),
    picker: { render: (model) => pickerModels.push(model) },
    settings,
    storageArea,
    windowObj: window
  });
  return {
    document,
    media,
    mediaListeners,
    pickerModels,
    section,
    shown,
    window,
    writes,
    cached: () => window.localStorage.getItem(settings.OPTIONS_THEME_PRELOAD_STORAGE_KEY),
    pageTheme: () => document.body.getAttribute('data-theme')
  };
}

(async () => {
  // Startup shows the stored mode and refreshes the preloader's cache.
  {
    const page = setup({ [settings.THEME_STORAGE_KEY]: 'dark' });
    await page.section.init();
    assert.strictEqual(page.pageTheme(), 'dark');
    assert.strictEqual(page.document.getElementById('panel').getAttribute('data-theme'), 'dark');
    assert.strictEqual(page.document.documentElement.style.colorScheme, 'dark');
    assert.strictEqual(page.document.querySelector('meta[name="theme-color"]').getAttribute('content'), '#111111');
    assert.strictEqual(page.document.documentElement.getAttribute('data-theme-ready'), 'true');
    assert.strictEqual(page.cached(), 'dark');
    assert.strictEqual(page.pickerModels.at(-1).activeMode, 'dark');
    assert.deepStrictEqual(page.pickerModels.at(-1).options.map((option) => option.mode), ['system', 'light', 'dark']);
    assert.deepStrictEqual(page.shown, ['dark'], 'dependent settings hear about the shown mode');
    assert.strictEqual(page.mediaListeners.size, 0, 'a fixed theme ignores the OS setting');
  }

  // "System" follows the OS, including changes while the page is open.
  {
    const page = setup({}, { systemDark: true });
    await page.section.init();
    assert.strictEqual(page.pickerModels.at(-1).activeMode, 'system');
    assert.strictEqual(page.pageTheme(), 'dark');
    page.media.matches = false;
    page.mediaListeners.forEach((listener) => listener());
    assert.strictEqual(page.pageTheme(), 'light');
  }

  // Choosing a theme writes it through the shared global-theme helper.
  {
    const page = setup({});
    await page.section.init();
    page.section.setMode('light');
    assert.deepStrictEqual(page.writes, [settings.createGlobalThemeModeStorageUpdate('light')]);
    assert.strictEqual(page.cached(), 'light');
    assert.strictEqual(page.pageTheme(), 'light');
    assert.strictEqual(page.mediaListeners.size, 0);
    page.section.setMode('system');
    assert.strictEqual(page.mediaListeners.size, 1);
  }

  // A choice made on another page is shown here, and "system" follows the OS.
  {
    const page = setup({ [settings.THEME_STORAGE_KEY]: 'light' }, { systemDark: true });
    await page.section.init();
    page.section.applyStorageChange('dark');
    assert.strictEqual(page.pageTheme(), 'dark');
    page.section.applyStorageChange(undefined);
    assert.strictEqual(page.pickerModels.at(-1).activeMode, 'system');
    assert.strictEqual(page.mediaListeners.size, 1);
    page.media.matches = false;
    page.mediaListeners.forEach((listener) => listener());
    assert.strictEqual(page.pageTheme(), 'light');
  }

  console.log('Options theme tests passed.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
