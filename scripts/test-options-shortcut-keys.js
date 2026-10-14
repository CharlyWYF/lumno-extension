const assert = require('assert');
const keys = require('../src/options/options-shortcut-keys');

// Stored chords: fixed modifier order, at least one modifier, a known key.
assert.strictEqual(keys.normalizeFallbackShortcut('shift+cmd+k'), 'Shift+Command+K');
assert.strictEqual(keys.normalizeFallbackShortcut('MacCtrl+Option+,'), 'Ctrl+Alt+Comma');
assert.strictEqual(keys.normalizeFallbackShortcut('Control+Meta+f5'), 'Ctrl+Command+F5');
assert.strictEqual(keys.normalizeFallbackShortcut('Super+Shift+up'), 'Shift+Command+ArrowUp');
assert.strictEqual(keys.normalizeFallbackShortcut('K'), '', 'a chord needs a modifier');
assert.strictEqual(keys.normalizeFallbackShortcut('Hyper+K'), '', 'unknown modifiers are rejected');
assert.strictEqual(keys.normalizeFallbackShortcut('Ctrl+é'), '', 'unknown keys are rejected');
assert.strictEqual(keys.normalizeFallbackShortcut(''), '');

// Printed characters name the physical key, shifted or not.
assert.strictEqual(keys.normalizeShortcutKeyToken('<'), 'Comma');
assert.strictEqual(keys.normalizeShortcutKeyToken('?'), 'Slash');
assert.strictEqual(keys.normalizeShortcutKeyToken('esc'), 'Escape');
assert.strictEqual(keys.normalizeShortcutKeyToken('f12'), 'F12');

// Recording a keydown prefers the layout-independent code.
assert.strictEqual(keys.buildShortcutFromEvent({ code: 'KeyK', key: 'k', metaKey: true, shiftKey: true }), 'Shift+Command+K');
assert.strictEqual(keys.buildShortcutFromEvent({ code: 'Equal', key: '+', ctrlKey: true, shiftKey: true }), 'Ctrl+Shift+Plus');
assert.strictEqual(keys.buildShortcutFromEvent({ code: 'IntlRo', key: '/', altKey: true }), 'Alt+Slash',
  'without a known code the printed key is used');
assert.strictEqual(keys.buildShortcutFromEvent({ code: 'ShiftLeft', key: 'Shift', shiftKey: true }), '',
  'a lone modifier records nothing');
assert.strictEqual(keys.buildShortcutFromEvent({ code: 'KeyK', key: 'k' }), '', 'a bare key records nothing');

// Arrow keys record and save like any other key, and the saved chord is the
// one the shared matcher recognizes on a keydown.
{
  const matcher = require('../src/shared/shortcut-key-matcher');
  [['ArrowUp', '↑'], ['ArrowDown', '↓'], ['ArrowLeft', '←'], ['ArrowRight', '→']].forEach(([arrow, label]) => {
    const event = { code: arrow, key: arrow, altKey: true, shiftKey: true };
    const recorded = keys.buildShortcutFromEvent(event);
    assert.strictEqual(recorded, `Alt+Shift+${arrow}`);
    const saved = keys.normalizeFallbackShortcut(recorded);
    assert.strictEqual(saved, recorded, `${arrow} survives saving`);
    assert.deepStrictEqual(keys.getShortcutDisplayTokens(saved, { macSymbols: true }), ['⌥', '⇧', label]);
    assert.strictEqual(matcher.eventMatchesShortcut(event, saved), true, `the matcher recognizes a saved ${arrow}`);
  });
}

// Keycap labels: Mac symbols, or words elsewhere; arrows use symbols on both.
assert.deepStrictEqual(keys.getShortcutDisplayTokens('Ctrl+Alt+Shift+Command+K', { macSymbols: true }), ['⌃', '⌥', '⇧', '⌘', 'K']);
assert.deepStrictEqual(keys.getShortcutDisplayTokens('Ctrl+Shift+Command+up', { macSymbols: false }), ['CTRL', 'SHIFT', 'CMD', '↑']);
assert.deepStrictEqual(keys.getShortcutDisplayTokens('Alt+Escape', { macSymbols: true }), ['⌥', '⎋']);
assert.deepStrictEqual(keys.getShortcutDisplayTokens('Alt+Escape', { macSymbols: false }), ['ALT', 'ESC']);
assert.deepStrictEqual(keys.getShortcutDisplayTokens('Ctrl+Space', { macSymbols: false }), ['CTRL', 'SPACE']);
assert.deepStrictEqual(keys.getShortcutDisplayTokens('Ctrl+BracketLeft', { macSymbols: true }), ['⌃', '[']);
assert.deepStrictEqual(keys.getShortcutDisplayTokens('nonsense'), []);

console.log('Options shortcut key tests passed.');
