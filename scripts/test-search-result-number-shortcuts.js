const assert = require('assert');
const fs = require('fs');
const { readPageSource } = require('./helpers/page-source');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');

const read = (filePath) => fs.readFileSync(filePath, 'utf8');
const newtabSource = readNewtabRuntimeSource();
const newtabHtml = readPageSource('newtab.html');
const onboardingHtml = readPageSource('src/onboarding/onboarding.html');
const overlaySource = read('src/overlay/search-panel.js');
const overlayCss = read('src/overlay/suggestions-view.css');
const suggestionsSource = read('react-src/search/suggestions.tsx');
const suggestionNavigation = require('../src/shared/suggestion-navigation.js');

const macNavigator = { platform: 'MacIntel' };
const ctrlNavigationEvent = (key, code, overrides) => ({
  key,
  code,
  ctrlKey: true,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...(overrides || {})
});

assert.strictEqual(
  suggestionNavigation.getSuggestionNavigationKey(
    ctrlNavigationEvent('n', 'KeyN'),
    { macosCtrlEnabled: false, navigatorLike: macNavigator }
  ),
  '',
  'the macOS navigation experiment should be disabled by default'
);
assert.strictEqual(
  suggestionNavigation.getSuggestionNavigationKey(
    ctrlNavigationEvent('n', 'KeyN'),
    { macosCtrlEnabled: true, navigatorLike: macNavigator }
  ),
  'ArrowDown'
);
assert.strictEqual(
  suggestionNavigation.getSuggestionNavigationKey(
    ctrlNavigationEvent('p', 'KeyP'),
    { macosCtrlEnabled: true, navigatorLike: macNavigator }
  ),
  'ArrowUp'
);
assert.strictEqual(
  suggestionNavigation.getSuggestionNavigationKey(
    ctrlNavigationEvent('n', 'KeyN'),
    { macosCtrlEnabled: true, navigatorLike: { platform: 'Win32' } }
  ),
  '',
  'Ctrl+N/P should stay untouched outside macOS'
);
assert.strictEqual(
  suggestionNavigation.getSuggestionNavigationKey(
    ctrlNavigationEvent('n', 'KeyN', { shiftKey: true }),
    { macosCtrlEnabled: true, navigatorLike: macNavigator }
  ),
  '',
  'additional modifiers should not trigger the experiment'
);
assert.strictEqual(
  suggestionNavigation.getSuggestionNavigationKey(
    { key: 'ArrowDown' },
    { macosCtrlEnabled: false, navigatorLike: { platform: 'Win32' } }
  ),
  'ArrowDown',
  'existing arrow navigation should remain platform independent'
);

function createKeyEvent(overrides) {
  return {
    type: 'keydown',
    key: '',
    code: '',
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {
      this.propagationStopped = true;
    },
    ...(overrides || {})
  };
}

const activatedIndexes = [];
const shortcutItems = Array.from({ length: 3 }, (_, index) => ({
  click() {
    activatedIndexes.push(index);
  }
}));

const shortcutContainer = {
  attributes: new Map(),
  setAttribute(name, value) {
    this.attributes.set(name, value);
  },
  removeAttribute(name) {
    this.attributes.delete(name);
  },
  getAttribute(name) {
    return this.attributes.get(name) || null;
  }
};

const wait = (durationMs) => new Promise((resolve) => setTimeout(resolve, durationMs));

async function run() {
  const holdSignals = [];
  const commandHoldOptions = {
    primaryModifier: 'meta',
    holdDurationMs: 5,
    timeoutMs: 20,
    onHoldStart() {
      holdSignals.push('start');
    },
    onHoldEnd() {
      holdSignals.push('end');
    }
  };

  const commandDownEvent = createKeyEvent({
    key: 'Meta',
    code: 'MetaLeft',
    metaKey: true
  });
  assert.strictEqual(
    suggestionNavigation.handleNumberShortcutKeyEvent(
      commandDownEvent,
      shortcutItems,
      shortcutContainer,
      commandHoldOptions
    ),
    false,
    'pressing Command should begin the hold without consuming the browser event'
  );
  assert.strictEqual(commandDownEvent.defaultPrevented, false);
  assert.strictEqual(
    shortcutContainer.getAttribute('data-number-shortcuts-active'),
    null,
    'number badges should stay hidden while the hold threshold is pending'
  );
  await wait(10);
  assert.deepStrictEqual(holdSignals, ['start']);
  assert.strictEqual(
    shortcutContainer.getAttribute('data-number-shortcuts-scroll-locked'),
    'true',
    'reaching the hold threshold should lock result scrolling'
  );
  assert.strictEqual(
    shortcutContainer.getAttribute('data-number-shortcuts-active'),
    null,
    'reaching the hold threshold should show only the Toast, not the badges'
  );

  const wheelEvent = createKeyEvent();
  assert.strictEqual(
    suggestionNavigation.preventNumberShortcutWheel(wheelEvent, shortcutContainer),
    true,
    'wheel scrolling should be blocked once the long hold is armed'
  );
  assert.strictEqual(wheelEvent.defaultPrevented, true);

  const commandUpEvent = createKeyEvent({
    type: 'keyup',
    key: 'Meta',
    code: 'MetaLeft',
    metaKey: false
  });
  assert.strictEqual(
    suggestionNavigation.handleNumberShortcutKeyEvent(
      commandUpEvent,
      shortcutItems,
      shortcutContainer,
      commandHoldOptions
    ),
    true,
    'releasing Command after a long hold should enter number jump mode'
  );
  assert.deepStrictEqual(holdSignals, ['start', 'end']);
  assert.strictEqual(commandUpEvent.defaultPrevented, true);
  assert.strictEqual(
    shortcutContainer.getAttribute('data-number-shortcuts-active'),
    'true'
  );
  assert.strictEqual(
    shortcutContainer.getAttribute('data-number-shortcuts-scroll-locked'),
    'true'
  );
  assert.deepStrictEqual(activatedIndexes, []);

  const numberEvent = createKeyEvent({ key: '2', code: 'Digit2' });
  assert.strictEqual(
    suggestionNavigation.handleNumberShortcutKeyEvent(
      numberEvent,
      shortcutItems,
      shortcutContainer,
      commandHoldOptions
    ),
    true,
    'a plain number should activate its result after the modifier is released'
  );
  assert.strictEqual(numberEvent.defaultPrevented, true);
  assert.strictEqual(numberEvent.propagationStopped, true);
  assert.deepStrictEqual(activatedIndexes, [2]);
  assert.strictEqual(
    shortcutContainer.getAttribute('data-number-shortcuts-active'),
    null,
    'number jump mode should close after a selection'
  );
  assert.strictEqual(
    shortcutContainer.getAttribute('data-number-shortcuts-scroll-locked'),
    null
  );

  const quickSignals = [];
  const quickOptions = {
    primaryModifier: 'meta',
    holdDurationMs: 20,
    onHoldStart() {
      quickSignals.push('start');
    },
    onHoldEnd() {
      quickSignals.push('end');
    }
  };
  suggestionNavigation.handleNumberShortcutKeyEvent(
    createKeyEvent({ key: 'Meta', metaKey: true }),
    shortcutItems,
    shortcutContainer,
    quickOptions
  );
  const quickReleaseEvent = createKeyEvent({ type: 'keyup', key: 'Meta' });
  assert.strictEqual(
    suggestionNavigation.handleNumberShortcutKeyEvent(
      quickReleaseEvent,
      shortcutItems,
      shortcutContainer,
      quickOptions
    ),
    false,
    'a quick Command tap should remain invisible and unconsumed'
  );
  await wait(25);
  assert.deepStrictEqual(quickSignals, []);
  assert.strictEqual(shortcutContainer.getAttribute('data-number-shortcuts-active'), null);

  const oldCommandNumberEvent = createKeyEvent({ key: '1', metaKey: true });
  assert.strictEqual(
    suggestionNavigation.handleNumberShortcutKeyEvent(
      oldCommandNumberEvent,
      shortcutItems,
      shortcutContainer,
      commandHoldOptions
    ),
    false,
    'Command-number should remain available to Chrome while Command is held'
  );
  assert.strictEqual(oldCommandNumberEvent.defaultPrevented, false);
  assert.deepStrictEqual(activatedIndexes, [2]);

  const instantOptions = {
    primaryModifier: 'meta',
    timeoutMs: 5,
    instantActive: true
  };
  const instantCommandDownEvent = createKeyEvent({
    key: 'Meta',
    code: 'MetaLeft',
    metaKey: true
  });
  assert.strictEqual(
    suggestionNavigation.handleNumberShortcutKeyEvent(
      instantCommandDownEvent,
      shortcutItems,
      shortcutContainer,
      instantOptions
    ),
    false,
    'instant mode should reveal number badges without consuming Command'
  );
  assert.strictEqual(
    shortcutContainer.getAttribute('data-number-shortcuts-active'),
    'true',
    'instant mode should reveal badges on the trusted modifier keydown'
  );
  await wait(10);
  assert.strictEqual(
    shortcutContainer.getAttribute('data-number-shortcuts-active'),
    'true',
    'instant mode should stay active while the primary modifier remains held'
  );
  const instantCommandUpEvent = createKeyEvent({
    type: 'keyup',
    key: 'Meta',
    code: 'MetaLeft'
  });
  assert.strictEqual(
    suggestionNavigation.handleNumberShortcutKeyEvent(
      instantCommandUpEvent,
      shortcutItems,
      shortcutContainer,
      instantOptions
    ),
    false,
    'releasing Command in instant mode should not consume the browser event'
  );
  assert.strictEqual(
    shortcutContainer.getAttribute('data-number-shortcuts-active'),
    null,
    'trusted modifier keyup should dismiss instant number badges'
  );

  suggestionNavigation.handleNumberShortcutKeyEvent(
    createKeyEvent({ key: 'Meta', code: 'MetaLeft', metaKey: true }),
    shortcutItems,
    shortcutContainer,
    instantOptions
  );
  const instantNumberEvent = createKeyEvent({
    key: '1',
    code: 'Digit1',
    metaKey: true
  });
  assert.strictEqual(
    suggestionNavigation.handleNumberShortcutKeyEvent(
      instantNumberEvent,
      shortcutItems,
      shortcutContainer,
      instantOptions
    ),
    true,
    'instant mode should activate a digit while Command remains held'
  );
  assert.deepStrictEqual(activatedIndexes, [2, 1]);
  assert.strictEqual(shortcutContainer.getAttribute('data-number-shortcuts-active'), null);

  const cancelSignals = [];
  const controlOptions = {
    primaryModifier: 'ctrl',
    holdDurationMs: 5,
    timeoutMs: 10,
    onHoldStart() {
      cancelSignals.push('start');
    },
    onHoldEnd() {
      cancelSignals.push('end');
    }
  };
  suggestionNavigation.handleNumberShortcutKeyEvent(
    createKeyEvent({ key: 'Control', ctrlKey: true }),
    shortcutItems,
    shortcutContainer,
    controlOptions
  );
  await wait(10);
  const commandEnterEvent = createKeyEvent({ key: 'Enter', ctrlKey: true });
  assert.strictEqual(
    suggestionNavigation.handleNumberShortcutKeyEvent(
      commandEnterEvent,
      shortcutItems,
      shortcutContainer,
      controlOptions
    ),
    false,
    'another key should cancel an armed hold without intercepting Ctrl+Enter'
  );
  assert.deepStrictEqual(cancelSignals, ['start', 'end']);
  assert.strictEqual(commandEnterEvent.defaultPrevented, false);
  assert.strictEqual(shortcutContainer.getAttribute('data-number-shortcuts-scroll-locked'), null);

  suggestionNavigation.handleNumberShortcutKeyEvent(
    createKeyEvent({ key: 'Control', ctrlKey: true }),
    shortcutItems,
    shortcutContainer,
    controlOptions
  );
  await wait(10);
  suggestionNavigation.handleNumberShortcutKeyEvent(
    createKeyEvent({ type: 'keyup', key: 'Control' }),
    shortcutItems,
    shortcutContainer,
    controlOptions
  );
  const escapeEvent = createKeyEvent({ key: 'Escape', code: 'Escape' });
  assert.strictEqual(
    suggestionNavigation.handleNumberShortcutKeyEvent(
      escapeEvent,
      shortcutItems,
      shortcutContainer,
      controlOptions
    ),
    true,
    'Escape should cancel active number jump mode'
  );
  assert.strictEqual(escapeEvent.defaultPrevented, true);

  suggestionNavigation.handleNumberShortcutKeyEvent(
    createKeyEvent({ key: 'Control', ctrlKey: true }),
    shortcutItems,
    shortcutContainer,
    controlOptions
  );
  await wait(10);
  suggestionNavigation.handleNumberShortcutKeyEvent(
    createKeyEvent({ type: 'keyup', key: 'Control' }),
    shortcutItems,
    shortcutContainer,
    controlOptions
  );
  await wait(15);
  assert.strictEqual(
    shortcutContainer.getAttribute('data-number-shortcuts-active'),
    null,
    'number jump mode should expire after its timeout'
  );
  assert.strictEqual(
    suggestionNavigation.preventNumberShortcutWheel(createKeyEvent(), shortcutContainer),
    false,
    'wheel scrolling should resume after number jump mode closes'
  );

assert.match(
  suggestionsSource,
  /x-nt-suggestion-number-shortcut[\s\S]*?\{index\}/,
  'the shared result view should render each visible result number beside its icon'
);

assert.match(
  newtabSource,
  /const numberShortcutOptions = \{[\s\S]*?onHoldStart:[\s\S]*?showToast\([\s\S]*?search_number_jump_release_hint[\s\S]*?duration:\s*0[\s\S]*?onHoldEnd:\s*hideToast,[\s\S]*?instantActive:\s*\(\)\s*=>\s*numberShortcutInstantEnabled[\s\S]*?\};/,
  'New Tab should reuse its existing Toast while the number shortcut hold is armed'
);
assert.match(
  newtabSource,
  /document\.addEventListener\('keydown',[\s\S]*?handleNumberShortcutKeyEvent\(\s*event,\s*suggestionItems,\s*suggestionsContainer,\s*numberShortcutOptions\s*\)[\s\S]*?return;/,
  'New Tab should route keydown events through the long-hold state machine'
);

assert.match(
  overlaySource,
  /const numberShortcutOptions = \{[\s\S]*?onHoldStart:[\s\S]*?showOverlayToast\([\s\S]*?search_number_jump_release_hint[\s\S]*?duration:\s*0[\s\S]*?onHoldEnd:\s*hideOverlayToast,[\s\S]*?instantActive:\s*\(\)\s*=>\s*numberShortcutInstantEnabled[\s\S]*?\};/,
  'Overlay should reuse its existing Toast while the number shortcut hold is armed'
);
assert.match(
  newtabSource,
  /getSuggestionNavigationKey\(event,[\s\S]*?macosCtrlEnabled:\s*macosCtrlSuggestionNavigationEnabled/,
  'New Tab should gate Ctrl+N/P through the Labs preference'
);

const newtabModifierSource = newtabSource.slice(
  newtabSource.indexOf('function setSuggestionActionModifiersActive'),
  newtabSource.indexOf('function syncSuggestionActionModifiersFromEvent')
);
assert.ok(
  !newtabModifierSource.includes('setNumberShortcutsActive'),
  'New Tab should not reveal number badges for the background-open modifier alone'
);
const overlayModifierSource = overlaySource.slice(
  overlaySource.indexOf('function setSuggestionActionModifiersActive'),
  overlaySource.indexOf('function syncSuggestionActionModifiersFromEvent')
);
assert.ok(
  !overlayModifierSource.includes('setNumberShortcutsActive'),
  'Overlay should not reveal number badges for the background-open modifier alone'
);

assert.match(
  newtabSource,
  /document\.addEventListener\('pointerdown',[\s\S]*?cancelNumberShortcuts\(suggestionsContainer\)/,
  'New Tab should close number jump mode on pointer interaction'
);
assert.match(
  overlaySource,
  /overlay\.addEventListener\('pointerdown',[\s\S]*?cancelNumberShortcuts\(suggestionsContainer\)/,
  'Overlay should close number jump mode on pointer interaction'
);

assert.match(
  newtabHtml,
  /data-number-shortcuts-active="true"[\s\S]*?\.x-nt-suggestion-number-shortcut[\s\S]*?display:\s*inline-flex/,
  'New Tab should reveal number badges only while number jump mode is active'
);

assert.match(
  newtabHtml,
  /data-number-shortcuts-scroll-locked="true"[\s\S]*?overflow-y:\s*hidden/,
  'New Tab should lock scrolling before the badges are revealed'
);

assert.match(
  overlayCss,
  /data-number-shortcuts-active="true"[\s\S]*?\.x-ov-suggestion-number-shortcut[\s\S]*?display:\s*inline-flex/,
  'Overlay should reveal number badges only while number jump mode is active'
);

assert.match(
  overlayCss,
  /data-number-shortcuts-scroll-locked="true"[\s\S]*?overflow-y:\s*hidden/,
  'Overlay should lock scrolling before the badges are revealed'
);

assert.match(
  onboardingHtml,
  /x-nt-suggestion-number-shortcut/,
  'the New Tab onboarding mirror should include the shared number badge style'
);

assert.match(
  onboardingHtml,
  /href="\.\.\/overlay\/suggestions-view\.css"/,
  'the Overlay onboarding mirror should keep consuming the shared Overlay result styles'
);

[
  ['New Tab', newtabHtml, 'x-nt'],
  ['Overlay', overlayCss, 'x-ov'],
  ['New Tab onboarding mirror', onboardingHtml, 'x-nt']
].forEach(([surface, source, prefix]) => {
  const className = `${prefix}-suggestion-number-shortcut`;
  const styleBlocks = Array.from(source.matchAll(
    new RegExp(`[^\\n{}]*\\.${className}\\s*\\{([^{}]*)\\}`, 'g')
  )).map((match) => match[1]);
  const baseStyles = styleBlocks.find((block) => /all:\s*unset;/.test(block)) || '';
  assert.match(baseStyles, /width:\s*16px;/, `${surface} number label should be square`);
  assert.match(baseStyles, /height:\s*16px;/, `${surface} number label should be square`);
  assert.match(baseStyles, /border-radius:\s*5px;/, `${surface} should retain continuous rounded corners`);
  assert.match(
    baseStyles,
    /background:\s*#111827;[\s\S]*?color:\s*#FFFFFF;[\s\S]*?font:\s*600 11px/,
    `${surface} should use a lighter number weight without reducing contrast`
  );
  styleBlocks.filter((block) => /background:|width:/.test(block)).forEach((block) => {
    assert.doesNotMatch(block, /border(?:-color)?:|box-shadow:/, `${surface} number label should stay flat and borderless`);
  });
  assert.match(
    source,
    new RegExp(`@supports \\(corner-shape: superellipse\\(1\\.25\\)\\)[\\s\\S]*?\\.${className}[\\s\\S]*?corner-shape:\\s*superellipse\\(1\\.25\\)`),
    `${surface} should opt into continuous corners when supported`
  );
});

function relativeLuminance(hex) {
  const channels = String(hex).replace('#', '').match(/.{2}/g).map((value) => (
    parseInt(value, 16) / 255
  )).map((value) => (
    value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)
  ));
  return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
}

function contrastRatio(foreground, background) {
  const values = [relativeLuminance(foreground), relativeLuminance(background)]
    .sort((left, right) => right - left);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

assert.ok(
  contrastRatio('#FFFFFF', '#111827') >= 7,
  'the dark number label should exceed WCAG AAA contrast'
);
assert.ok(
  contrastRatio('#0F172A', '#FFFFFF') >= 7,
  'the light number label should exceed WCAG AAA contrast'
);

  console.log('search result number shortcut tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
