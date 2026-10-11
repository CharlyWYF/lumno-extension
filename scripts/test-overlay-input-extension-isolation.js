const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const searchPanelSource = fs.readFileSync(
  path.join(__dirname, '../src/overlay/search-panel.js'),
  'utf8'
);

const handlerStart = searchPanelSource.indexOf('overlayKeyCaptureHandler = function(e) {');
const handlerEnd = searchPanelSource.indexOf(
  "window.addEventListener('keydown', overlayKeyCaptureHandler, true);",
  handlerStart
);
assert.ok(handlerStart > 0 && handlerEnd > handlerStart, 'overlay should define an early key capture handler');

const handlerSource = searchPanelSource.slice(handlerStart, handlerEnd);
// JSDOM cannot construct an Event with isTrusted=true. The behavioral harness
// below exercises the browser-generated input branch after the source-level
// security contract has verified that untrusted events are rejected.
const trustedHandlerSource = handlerSource.replace(
  'e.isTrusted !== true',
  'false'
);
assert.match(
  handlerSource,
  /if \(isImeCompositionEvent\(e\)\) \{\s*e\.stopImmediatePropagation\(\);\s*return;\s*\}/,
  'input isolation should keep IME keys away from the host page without running Lumno key handling'
);
assert.ok(
  handlerSource.includes('if (e.metaKey || e.ctrlKey || e.altKey)'),
  'input isolation should leave browser and system modifier shortcuts untouched'
);
assert.match(
  handlerSource,
  /e\.type === 'keydown' && searchInputActive && getSuggestionNavigationKey\(e\)[\s\S]*?handleSearchInputKeydown\(e\);[\s\S]*?e\.stopImmediatePropagation\(\);[\s\S]*?return;/,
  'enabled macOS Ctrl navigation should be consumed once before modifier keys reach the host page'
);
assert.ok(
  !handlerSource.includes('e.shiftKey'),
  'Shift-modified text should remain isolated from page and extension shortcuts'
);
assert.ok(
  handlerSource.includes("if (e.type === 'keydown')") &&
    handlerSource.includes('handleSearchInputKeydown(e);') &&
    handlerSource.includes('inputModeController.handleModeMenuKeyEvent(e);'),
  'captured keydown events should still run Lumno input and scope-panel behavior'
);
assert.ok(
  handlerSource.includes('e.stopImmediatePropagation();'),
  'captured text keys should not reach document-level extension shortcuts'
);
assert.match(
  searchPanelSource,
  /if \(e\.key === 'Tab'\) \{\s*handleTabKey\(e\);\s*return;\s*\}/,
  'the double-Tab scope shortcut should run inside the isolated input key handler'
);

['keydown', 'keypress', 'keyup'].forEach((eventName) => {
  assert.ok(
    searchPanelSource.includes(
      `window.addEventListener('${eventName}', overlayKeyCaptureHandler, true);`
    ),
    `overlay should isolate ${eventName} during capture`
  );
  assert.ok(
    searchPanelSource.includes(
      `window.removeEventListener('${eventName}', overlayKeyCaptureHandler, true);`
    ),
    `overlay should remove the ${eventName} isolation listener on close`
  );
});

const dom = new JSDOM('<!doctype html><div id="overlay"></div><div id="lumno-host"></div>');
const { window } = dom;
const { document } = window;
const overlay = document.getElementById('overlay');
const host = document.getElementById('lumno-host');
const suggestionsContainer = document.createElement('div');
overlay.appendChild(suggestionsContainer);
const shadowRoot = host.attachShadow({ mode: 'open' });
const searchInput = document.createElement('input');
const modeMenu = document.createElement('div');
modeMenu.tabIndex = -1;
shadowRoot.append(searchInput, modeMenu);

const handledInputKeys = [];
const handledModeMenuKeys = [];
const hostPageKeys = [];
const hostPageKeyups = [];
const activatedSuggestionIndexes = [];
const suggestionItems = Array.from({ length: 3 }, (_, index) => ({
  click() {
    activatedSuggestionIndexes.push(index);
  }
}));
const createHandler = new Function(
  'overlay',
  'searchInput',
  'inputModeController',
  'document',
  'isImeCompositionEvent',
  'handleSearchInputKeydown',
  'syncSuggestionActionModifiersFromEvent',
  'SUGGESTION_NAVIGATION',
  'suggestionItems',
  'suggestionsContainer',
  'numberShortcutOptions',
  'getSuggestionNavigationKey',
  'imeKeyGuard',
  `let overlayKeyCaptureHandler;\n${trustedHandlerSource}\nreturn overlayKeyCaptureHandler;`
);
const numberShortcutSignals = [];
let imeKeyUpCount = 0;
let macosCtrlNavigationEnabled = false;
const overlayKeyCaptureHandler = createHandler(
  overlay,
  searchInput,
  {
    handleModeMenuKeyEvent(event) {
      handledModeMenuKeys.push(event.key);
      event.preventDefault();
      if (event.key === 'Tab') {
        searchInput.focus();
      }
      return true;
    },
    shouldHandleModeMenuKeyEvent() {
      return shadowRoot.activeElement === modeMenu;
    }
  },
  document,
  (event) => Boolean(event && event.isComposing),
  (event) => {
    handledInputKeys.push(event.key);
    if (event.key === 'Tab') {
      event.preventDefault();
    }
  },
  () => {},
  require('../src/shared/suggestion-navigation.js'),
  suggestionItems,
  suggestionsContainer,
  {
    primaryModifier: 'meta',
    holdDurationMs: 5,
    timeoutMs: 50,
    onHoldStart() {
      numberShortcutSignals.push('toast-show');
    },
    onHoldEnd() {
      numberShortcutSignals.push('toast-hide');
    }
  },
  (event) => macosCtrlNavigationEnabled && event.ctrlKey && event.key.toLowerCase() === 'n'
    ? 'ArrowDown'
    : '',
  {
    markKeyUp() {
      imeKeyUpCount += 1;
    }
  }
);

window.addEventListener('keydown', overlayKeyCaptureHandler, true);
window.addEventListener('keyup', overlayKeyCaptureHandler, true);
document.addEventListener('keydown', (event) => {
  hostPageKeys.push({ key: event.key, targetTag: event.target.tagName });
});
document.addEventListener('keyup', (event) => {
  hostPageKeyups.push({ key: event.key, targetTag: event.target.tagName });
});

async function run() {
searchInput.focus();

const imeKeydown = new window.KeyboardEvent('keydown', {
  bubbles: true,
  composed: true,
  key: 'f',
  code: 'KeyF',
  isComposing: true
});
searchInput.dispatchEvent(imeKeydown);

assert.strictEqual(
  imeKeydown.defaultPrevented,
  false,
  'IME isolation should not prevent the browser from updating the composition'
);
assert.deepStrictEqual(
  handledInputKeys,
  [],
  'IME keys should not run Lumno search input shortcuts'
);
assert.deepStrictEqual(
  hostPageKeys,
  [],
  'IME keys from the Shadow DOM input should not reach host-page player shortcuts'
);

const regularKeydown = new window.KeyboardEvent('keydown', {
  bubbles: true,
  composed: true,
  key: 'x',
  code: 'KeyX'
});
searchInput.dispatchEvent(regularKeydown);

assert.deepStrictEqual(
  handledInputKeys,
  ['x'],
  'regular text keys should continue through Lumno input handling'
);
assert.deepStrictEqual(
  hostPageKeys,
  [],
  'regular text keys should remain isolated from host-page shortcuts'
);

const doubleTabEvents = [0, 1].map(() => new window.KeyboardEvent('keydown', {
  bubbles: true,
  cancelable: true,
  composed: true,
  key: 'Tab',
  code: 'Tab'
}));
doubleTabEvents.forEach((event) => {
  searchInput.dispatchEvent(event);
  searchInput.dispatchEvent(new window.KeyboardEvent('keyup', {
    bubbles: true,
    composed: true,
    key: 'Tab',
    code: 'Tab'
  }));
});

assert.deepStrictEqual(
  handledInputKeys,
  ['x', 'Tab', 'Tab'],
  'both presses of the double-Tab shortcut should stay in Lumno input handling'
);
assert.ok(
  doubleTabEvents.every((event) => event.defaultPrevented),
  'both Tab presses should keep focus inside the Lumno input'
);
assert.deepStrictEqual(
  hostPageKeys,
  [],
  'double-Tab keydown events should not reach host-page shortcuts'
);
assert.deepStrictEqual(
  hostPageKeyups,
  [],
  'double-Tab keyup events should not reach host-page shortcuts'
);

const disabledMacCtrlNavigationEvent = new window.KeyboardEvent('keydown', {
  bubbles: true,
  cancelable: true,
  composed: true,
  key: 'n',
  code: 'KeyN',
  ctrlKey: true
});
searchInput.dispatchEvent(disabledMacCtrlNavigationEvent);
assert.deepStrictEqual(
  hostPageKeys,
  [{ key: 'n', targetTag: 'DIV' }],
  'Ctrl+N should remain untouched while the Labs experiment is off'
);
hostPageKeys.length = 0;

macosCtrlNavigationEnabled = true;
const enabledMacCtrlNavigationEvent = new window.KeyboardEvent('keydown', {
  bubbles: true,
  cancelable: true,
  composed: true,
  key: 'n',
  code: 'KeyN',
  ctrlKey: true
});
searchInput.dispatchEvent(enabledMacCtrlNavigationEvent);
assert.strictEqual(
  handledInputKeys.filter((key) => key === 'n').length,
  1,
  'enabled Ctrl+N should run the Overlay input handler exactly once'
);
assert.deepStrictEqual(
  hostPageKeys,
  [],
  'enabled Ctrl+N should not leak to the host page'
);
macosCtrlNavigationEnabled = false;

const enterNumberModeEvent = new window.KeyboardEvent('keydown', {
  bubbles: true,
  cancelable: true,
  composed: true,
  key: 'Meta',
  code: 'MetaLeft',
  metaKey: true
});
searchInput.dispatchEvent(enterNumberModeEvent);
assert.strictEqual(
  suggestionsContainer.getAttribute('data-number-shortcuts-active'),
  null,
  'the Overlay capture handler should keep number badges hidden during the hold'
);
assert.strictEqual(enterNumberModeEvent.defaultPrevented, false);
assert.deepStrictEqual(
  hostPageKeys,
  [{ key: 'Meta', targetTag: 'DIV' }],
  'the initial modifier press should remain available to browser and host shortcuts'
);
await new Promise((resolve) => setTimeout(resolve, 10));
assert.deepStrictEqual(numberShortcutSignals, ['toast-show']);
assert.strictEqual(
  suggestionsContainer.getAttribute('data-number-shortcuts-scroll-locked'),
  'true',
  'the Overlay should lock result scrolling after the long-hold threshold'
);
const releaseNumberModeEvent = new window.KeyboardEvent('keyup', {
  bubbles: true,
  cancelable: true,
  composed: true,
  key: 'Meta',
  code: 'MetaLeft'
});
searchInput.dispatchEvent(releaseNumberModeEvent);
assert.strictEqual(
  suggestionsContainer.getAttribute('data-number-shortcuts-active'),
  'true',
  'releasing the modifier should reveal number jump mode'
);
assert.strictEqual(releaseNumberModeEvent.defaultPrevented, true);
assert.deepStrictEqual(numberShortcutSignals, ['toast-show', 'toast-hide']);
hostPageKeys.length = 0;

const chooseNumberEvent = new window.KeyboardEvent('keydown', {
  bubbles: true,
  cancelable: true,
  composed: true,
  key: '2',
  code: 'Digit2'
});
searchInput.dispatchEvent(chooseNumberEvent);
assert.deepStrictEqual(
  activatedSuggestionIndexes,
  [2],
  'a plain number should activate the mapped Overlay result'
);
assert.strictEqual(
  suggestionsContainer.getAttribute('data-number-shortcuts-active'),
  null,
  'the Overlay number jump mode should close after selection'
);
assert.strictEqual(chooseNumberEvent.defaultPrevented, true);
assert.deepStrictEqual(
  hostPageKeys,
  [],
  'number jump mode keys should not reach host-page shortcuts'
);

modeMenu.focus();
['ArrowDown', 'Enter', 'Tab'].forEach((key) => {
  modeMenu.dispatchEvent(new window.KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    composed: true,
    key
  }));
  const keyupTarget = key === 'Tab' ? searchInput : modeMenu;
  keyupTarget.dispatchEvent(new window.KeyboardEvent('keyup', {
    bubbles: true,
    composed: true,
    key
  }));
});

assert.deepStrictEqual(
  handledModeMenuKeys,
  ['ArrowDown', 'Enter', 'Tab'],
  'scope-panel navigation and selection should run through the isolated handler'
);
assert.strictEqual(
  shadowRoot.activeElement,
  searchInput,
  'scope-panel Tab should return focus to the Lumno input'
);
assert.deepStrictEqual(
  hostPageKeys,
  [],
  'scope-panel keydown events should not reach host-page shortcuts'
);
assert.deepStrictEqual(
  hostPageKeyups,
  [],
  'scope-panel keyup events should not reach host-page shortcuts'
);
assert.ok(
  imeKeyUpCount > 0,
  'overlay keyups should end the IME commit-Enter window'
);

console.log('overlay input extension isolation tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
