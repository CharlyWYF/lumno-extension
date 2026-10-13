(function(root) {
  'use strict';

  // The editable fallback shortcut on the Options page is stored as
  // "Ctrl+Alt+Shift+Command+Key" (modifiers in that order, at least one) and
  // only turned into keycap labels when shown.

  const KEY_ALIASES = Object.freeze({
    tab: 'Tab',
    enter: 'Enter',
    return: 'Enter',
    esc: 'Escape',
    escape: 'Escape',
    space: 'Space',
    spacebar: 'Space',
    up: 'ArrowUp',
    down: 'ArrowDown',
    left: 'ArrowLeft',
    right: 'ArrowRight',
    comma: 'Comma',
    period: 'Period',
    slash: 'Slash',
    semicolon: 'Semicolon',
    quote: 'Quote',
    minus: 'Minus',
    plus: 'Plus',
    backslash: 'Backslash',
    backquote: 'Backquote',
    bracketleft: 'BracketLeft',
    bracketright: 'BracketRight'
  });

  // Printed characters, shifted or not, name the physical key.
  const KEY_CHARACTERS = Object.freeze({
    ' ': 'Space',
    ',': 'Comma',
    '<': 'Comma',
    '.': 'Period',
    '>': 'Period',
    '/': 'Slash',
    '?': 'Slash',
    ';': 'Semicolon',
    ':': 'Semicolon',
    '\'': 'Quote',
    '"': 'Quote',
    '-': 'Minus',
    '_': 'Minus',
    '+': 'Plus',
    '\\': 'Backslash',
    '|': 'Backslash',
    '`': 'Backquote',
    '[': 'BracketLeft',
    '{': 'BracketLeft',
    ']': 'BracketRight',
    '}': 'BracketRight'
  });

  const KEY_CODES = Object.freeze({
    Backquote: 'Backquote',
    Minus: 'Minus',
    Equal: 'Plus',
    BracketLeft: 'BracketLeft',
    BracketRight: 'BracketRight',
    Backslash: 'Backslash',
    Semicolon: 'Semicolon',
    Quote: 'Quote',
    Comma: 'Comma',
    Period: 'Period',
    Slash: 'Slash',
    Space: 'Space',
    Tab: 'Tab',
    Enter: 'Enter',
    Escape: 'Escape',
    ArrowUp: 'ArrowUp',
    ArrowDown: 'ArrowDown',
    ArrowLeft: 'ArrowLeft',
    ArrowRight: 'ArrowRight'
  });

  const PUNCTUATION_LABELS = Object.freeze({
    Comma: ',',
    Period: '.',
    Slash: '/',
    Semicolon: ';',
    Quote: '\'',
    Minus: '-',
    Plus: '+',
    Backslash: '\\',
    Backquote: '`',
    BracketLeft: '[',
    BracketRight: ']'
  });
  const ARROW_LABELS = Object.freeze({
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→'
  });
  const MAC_KEY_LABELS = Object.freeze(Object.assign({}, ARROW_LABELS, PUNCTUATION_LABELS, {
    Enter: '↩',
    Escape: '⎋',
    Tab: '⇥',
    Space: 'Space'
  }));
  const DEFAULT_KEY_LABELS = Object.freeze(Object.assign({}, ARROW_LABELS, PUNCTUATION_LABELS, {
    Escape: 'Esc'
  }));
  const MAC_MODIFIER_LABELS = Object.freeze({
    Ctrl: '⌃',
    Alt: '⌥',
    Shift: '⇧',
    Command: '⌘'
  });
  const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph']);

  // A key name or printed character -> its token ('K', 'F5', 'Comma', ...), or ''.
  function normalizeShortcutKeyToken(rawKey) {
    const value = String(rawKey || '').trim();
    if (!value) {
      return '';
    }
    const lower = value.toLowerCase();
    if (KEY_ALIASES[lower]) {
      return KEY_ALIASES[lower];
    }
    if (/^f\d{1,2}$/.test(lower)) {
      return lower.toUpperCase();
    }
    if (value.length === 1) {
      if (KEY_CHARACTERS[value]) {
        return KEY_CHARACTERS[value];
      }
      if (/^[a-z0-9]$/i.test(value)) {
        return value.toUpperCase();
      }
    }
    return '';
  }

  // KeyboardEvent.code -> token; independent of keyboard layout and Shift.
  function getShortcutKeyTokenFromCode(rawCode) {
    const code = String(rawCode || '').trim();
    if (!code) {
      return '';
    }
    if (/^Key[A-Z]$/.test(code)) {
      return code.slice(3);
    }
    if (/^Digit[0-9]$/.test(code)) {
      return code.slice(5);
    }
    if (KEY_CODES[code]) {
      return KEY_CODES[code];
    }
    if (/^F\d{1,2}$/.test(code)) {
      return code;
    }
    return '';
  }

  function getShortcutKeyTokenFromEvent(event) {
    if (!event) {
      return '';
    }
    return getShortcutKeyTokenFromCode(event.code) || normalizeShortcutKeyToken(event.key);
  }

  // Any spelling of a chord ("cmd+shift+k", "MacCtrl+Option+,") -> the stored
  // form, or '' when it has no modifier, an unknown part or no key.
  function normalizeFallbackShortcut(value) {
    const text = String(value || '').trim();
    if (!text) {
      return '';
    }
    const parts = text
      .split('+')
      .map((token) => String(token || '').trim())
      .filter(Boolean);
    if (parts.length < 2) {
      return '';
    }
    const keyToken = normalizeShortcutKeyToken(parts.pop());
    if (!keyToken) {
      return '';
    }
    const modifierState = {
      ctrl: false,
      alt: false,
      shift: false,
      meta: false
    };
    for (const token of parts) {
      const lower = token.toLowerCase();
      if (lower === 'ctrl' || lower === 'control' || lower === 'macctrl') {
        modifierState.ctrl = true;
      } else if (lower === 'alt' || lower === 'option') {
        modifierState.alt = true;
      } else if (lower === 'shift') {
        modifierState.shift = true;
      } else if (lower === 'command' || lower === 'cmd' || lower === 'meta' || lower === 'super') {
        modifierState.meta = true;
      } else {
        return '';
      }
    }
    if (!modifierState.ctrl && !modifierState.alt && !modifierState.shift && !modifierState.meta) {
      return '';
    }
    const normalized = [];
    if (modifierState.ctrl) normalized.push('Ctrl');
    if (modifierState.alt) normalized.push('Alt');
    if (modifierState.shift) normalized.push('Shift');
    if (modifierState.meta) normalized.push('Command');
    normalized.push(keyToken);
    return normalized.join('+');
  }

  // The chord a keydown would record, or '' for a lone modifier or no modifier.
  function buildShortcutFromEvent(event) {
    if (!event) {
      return '';
    }
    const key = String(event.key || '');
    if (!key || MODIFIER_KEYS.has(key)) {
      return '';
    }
    const keyToken = getShortcutKeyTokenFromEvent(event);
    if (!keyToken) {
      return '';
    }
    const modifiers = [];
    if (event.ctrlKey) modifiers.push('Ctrl');
    if (event.altKey) modifiers.push('Alt');
    if (event.shiftKey) modifiers.push('Shift');
    if (event.metaKey) modifiers.push('Command');
    if (modifiers.length === 0) {
      return '';
    }
    modifiers.push(keyToken);
    return modifiers.join('+');
  }

  // Keycap labels for a stored chord. macSymbols uses ⌃⌥⇧⌘ and Mac key
  // glyphs; otherwise words (Cmd for Command). Multi-letter labels are upper case.
  function getShortcutDisplayTokens(shortcut, options) {
    const normalized = normalizeFallbackShortcut(shortcut);
    if (!normalized) {
      return [];
    }
    const macSymbols = Boolean(options && options.macSymbols);
    const parts = normalized.split('+').filter(Boolean);
    const keyToken = parts.pop();
    const tokens = parts.map((token) => {
      if (macSymbols) {
        return MAC_MODIFIER_LABELS[token];
      }
      return token === 'Command' ? 'Cmd' : token;
    });
    const keyLabels = macSymbols ? MAC_KEY_LABELS : DEFAULT_KEY_LABELS;
    tokens.push(keyLabels[keyToken] || keyToken);
    return tokens.map((token) => {
      const text = String(token || '');
      return text.length > 1 ? text.toUpperCase() : text;
    });
  }

  const api = Object.freeze({
    buildShortcutFromEvent,
    getShortcutDisplayTokens,
    getShortcutKeyTokenFromCode,
    getShortcutKeyTokenFromEvent,
    normalizeFallbackShortcut,
    normalizeShortcutKeyToken
  });
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.LumnoOptionsShortcutKeys = api;
})(globalThis);
