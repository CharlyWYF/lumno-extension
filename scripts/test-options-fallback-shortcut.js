const assert = require('assert');
const { JSDOM } = require('jsdom');
const settings = require('../src/shared/settings');
const shortcutKeys = require('../src/options/options-shortcut-keys');
const { createFallbackShortcutSection } = require('../src/options/options-fallback-shortcut');

function setup(options) {
  const config = options || {};
  const dom = new JSDOM(`
    <div class="wrap"><input id="input" placeholder="Press keys"></div>
    <button id="clear"></button><button id="reset"></button><span id="status"></span>`, { pretendToBeVisual: true });
  const window = dom.window;
  const document = window.document;
  const renders = [];
  const writes = [];
  const toasts = [];
  const chromeApi = {
    commands: config.commands === null ? undefined : {
      getAll: (callback) => callback(config.commands || [])
    },
    runtime: { lastError: null }
  };
  const section = createFallbackShortcutSection({
    chromeApi,
    documentObj: document,
    elements: {
      clearShortcutButton: document.getElementById('clear'),
      fallbackShortcutInput: document.getElementById('input'),
      fallbackShortcutWrap: document.querySelector('.wrap'),
      resetShortcutButton: document.getElementById('reset'),
      shortcutsStatus: document.getElementById('status')
    },
    // The raw chord is stored; only the chip shows it formatted.
    formatShortcutForDisplay: (shortcut) => `fmt(${shortcut})`,
    getMessage: (key, fallback) => fallback,
    isMacPlatform: Boolean(config.mac),
    settings,
    shortcutHotkeyController: { render: (model) => renders.push(model) },
    shortcutKeys,
    showToast: (message, isError) => toasts.push([message, isError]),
    storageArea: {
      set(payload, callback) {
        writes.push(payload);
        callback();
      }
    },
    windowObj: window
  });
  section.bindControls();
  return { document, renders, section, toasts, window, writes };
}

// The browser's command chord is shown, and its default when there is none.
{
  const page = setup({ commands: [{ name: 'show-search', shortcut: 'Alt+K' }] });
  page.section.loadCurrentShortcut();
  assert.strictEqual(page.document.getElementById('status').textContent, 'fmt(Alt+K)');
  assert.deepStrictEqual(page.renders.at(-1).tokens, ['ALT', 'K']);
  assert.strictEqual(page.document.getElementById('reset').disabled, false, 'a custom chord can be reset');

  const unset = setup({ commands: [{ name: 'show-search', shortcut: '' }], mac: true });
  unset.section.loadCurrentShortcut();
  assert.strictEqual(unset.document.getElementById('status').textContent, 'fmt(Command+Shift+K)');
  assert.strictEqual(unset.document.getElementById('reset').disabled, true, 'the default cannot be reset');

  const noCommands = setup({ commands: null });
  noCommands.section.loadCurrentShortcut();
  assert.strictEqual(noCommands.document.getElementById('status').textContent, 'fmt(Ctrl+Shift+K)');
}

// Focusing the field records the next chord and stores it raw.
{
  const page = setup({ commands: [] });
  page.section.loadCurrentShortcut();
  const input = page.document.getElementById('input');
  input.focus();
  assert.strictEqual(page.document.querySelector('.wrap').getAttribute('data-capturing'), 'true');
  const press = (init) => input.dispatchEvent(new page.window.KeyboardEvent('keydown', Object.assign({ bubbles: true, cancelable: true }, init)));
  press({ key: 'Shift', code: 'ShiftLeft', shiftKey: true });
  assert.deepStrictEqual(page.writes, [], 'a lone modifier records nothing');
  press({ key: 'j', code: 'KeyJ', ctrlKey: true, altKey: true });
  assert.deepStrictEqual(page.writes, [{ [settings.FALLBACK_SHORTCUT_STORAGE_KEY]: 'Ctrl+Alt+J' }]);
  assert.strictEqual(page.document.getElementById('status').textContent, 'fmt(Ctrl+Alt+J)');
  assert.strictEqual(page.renders.at(-1).animate, true);
}

// Escape cancels; the clear and reset buttons store an empty or default chord.
{
  const page = setup({ commands: [{ name: 'show-search', shortcut: 'Alt+K' }] });
  page.section.loadCurrentShortcut();
  const input = page.document.getElementById('input');
  input.focus();
  input.dispatchEvent(new page.window.KeyboardEvent('keydown', { bubbles: true, key: 'Escape', code: 'Escape' }));
  assert.deepStrictEqual(page.writes, []);
  assert.strictEqual(page.document.querySelector('.wrap').hasAttribute('data-capturing'), false);

  page.document.getElementById('clear').click();
  assert.deepStrictEqual(page.writes.at(-1), { [settings.FALLBACK_SHORTCUT_STORAGE_KEY]: '' });
  assert.strictEqual(page.document.getElementById('status').textContent, '未设置');
  page.document.getElementById('reset').click();
  assert.deepStrictEqual(page.writes.at(-1), { [settings.FALLBACK_SHORTCUT_STORAGE_KEY]: 'Ctrl+Shift+K' });
  assert.deepStrictEqual(page.toasts, []);
}

console.log('Options fallback shortcut tests passed.');
