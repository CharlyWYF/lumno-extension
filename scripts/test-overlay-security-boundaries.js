const assert = require('assert');
const fs = require('fs');
const { JSDOM } = require('jsdom');
const { createOverlayKeyRouter } = require('../src/overlay/keyboard.js');

const shellSource = fs.readFileSync('react-src/overlay/shell.tsx', 'utf8');
const overlaySource = fs.readFileSync('src/overlay/search-panel.js', 'utf8');
const switcherSource = fs.readFileSync('src/overlay/tab-switcher.js', 'utf8');

function getFunctionBlock(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  assert.notStrictEqual(start, -1, `${startNeedle} should exist`);
  const end = source.indexOf(endNeedle, start);
  assert.notStrictEqual(end, -1, `${endNeedle} should exist after ${startNeedle}`);
  return source.slice(start, end);
}

assert.match(
  shellSource,
  /attachShadow\(\{ mode: 'closed' \}\)/,
  'the search overlay should mount in a closed ShadowRoot'
);
assert.doesNotMatch(
  shellSource,
  /attachShadow\(\{ mode: 'open' \}\)/,
  'the search overlay source must not reopen its page-facing ShadowRoot'
);
assert.match(
  switcherSource,
  /attachShadow\(\{ mode: 'closed' \}\)/,
  'the tab switcher should mount in a closed ShadowRoot'
);
assert.doesNotMatch(
  switcherSource,
  /attachShadow\(\{ mode: 'open' \}\)/,
  'the tab switcher source must not reopen its page-facing ShadowRoot'
);

const closeOtherTabsBlock = getFunctionBlock(
  overlaySource,
  'function confirmCloseOtherTabs(event)',
  '// Add focus styles'
);
assert.match(
  closeOtherTabsBlock,
  /event\.isTrusted !== true[\s\S]*return;[\s\S]*action: 'closeOtherTabsForOverlay'/,
  'close-other-tabs must reject synthetic clicks before the privileged runtime action'
);

// Synthetic (untrusted) key events must never drive the overlay: the capture
// router swallows them before the page sees them, and the Tab capture and
// document fallbacks ignore them. JSDOM events are always untrusted, so the
// router's default trust predicate is exercised directly.
{
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  const { window } = dom;
  const { document } = window;
  const host = document.createElement('div');
  document.body.appendChild(host);
  const shadowRoot = host.attachShadow({ mode: 'closed' });
  const input = document.createElement('input');
  shadowRoot.appendChild(input);
  input.focus();
  const calls = [];
  const record = (name) => (event) => {
    calls.push(`${name}:${event && event.key}`);
    return true;
  };
  const router = createOverlayKeyRouter(window, {
    getMount: () => ({ document, host, panel: input }),
    isOverlayConnected: () => true,
    isSearchInputActive: () => true,
    handleInputKeydown: record('input'),
    handleTab: record('tab'),
    handleOverlayKeydown: record('overlay-keydown'),
    handleOverlayKeyup: record('overlay-keyup'),
    handleNumberShortcut: () => false,
    onEscapeOutside: record('escape')
  });
  router.start();
  const pageKeys = [];
  document.addEventListener('keydown', (event) => pageKeys.push(event.key));
  ['Enter', 'Tab', 'ArrowDown', 'Escape'].forEach((key) => {
    input.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, composed: true }));
    document.body.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true }));
    document.body.dispatchEvent(new window.KeyboardEvent('keyup', { key, bubbles: true }));
  });
  assert.deepStrictEqual(calls, [], 'synthetic keys must not reach any overlay key handler');
  assert.deepStrictEqual(pageKeys, [],
    'the page-facing capture should swallow synthetic keys instead of acting on them');
  router.stop();

  // Control: the same router acts on trusted keys, so the check above is not vacuous.
  const trustedRouter = createOverlayKeyRouter(window, {
    isTrustedEvent: () => true,
    getMount: () => ({ document, host, panel: input }),
    isOverlayConnected: () => true,
    isSearchInputActive: () => true,
    handleInputKeydown: record('input'),
    handleNumberShortcut: () => false
  });
  trustedRouter.start();
  input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
  trustedRouter.stop();
  assert.deepStrictEqual(calls, ['input:Enter']);
  window.close();
}

const switcherActivateBlock = getFunctionBlock(
  switcherSource,
  'onActivate(index, event)',
  'const panel = tabSwitcherReactView.panel'
);
assert.match(
  switcherActivateBlock,
  /event\.isTrusted !== true[\s\S]*return;[\s\S]*switchToSelected\(\)/,
  'tab switcher card activation must reject synthetic clicks'
);

const switcherKeydownBlock = getFunctionBlock(
  switcherSource,
  'function handleKeydown(event)',
  'function handleKeyup(event)'
);
assert.match(
  switcherKeydownBlock,
  /event\.isTrusted !== true[\s\S]*return;/,
  'tab switcher keydown handling must reject synthetic events'
);

const switcherKeyupBlock = getFunctionBlock(
  switcherSource,
  'function handleKeyup(event)',
  'function handlePointerDown(event)'
);
assert.match(
  switcherKeyupBlock,
  /event\.isTrusted !== true[\s\S]*return;/,
  'tab switcher keyup handling must reject synthetic events'
);

console.log('overlay security boundary tests passed');
