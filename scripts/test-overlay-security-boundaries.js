const assert = require('assert');
const fs = require('fs');

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

const overlayKeyCaptureBlock = getFunctionBlock(
  overlaySource,
  'overlayKeyCaptureHandler = function(e)',
  "window.addEventListener('keydown', overlayKeyCaptureHandler, true)"
);
assert.match(
  overlayKeyCaptureBlock,
  /e\.isTrusted !== true[\s\S]*return;/,
  'the page-facing overlay keyboard capture must reject synthetic events'
);

const overlayDocumentKeydownBlock = getFunctionBlock(
  overlaySource,
  'keydownHandler = function(e)',
  'keyupHandler = function(e)'
);
assert.match(
  overlayDocumentKeydownBlock,
  /e\.isTrusted !== true[\s\S]*return;/,
  'the document-level overlay keydown fallback must reject synthetic events'
);

const overlayTabCaptureBlock = getFunctionBlock(
  overlaySource,
  'captureTabHandler = function(e)',
  "document.addEventListener('keydown', captureTabHandler, true)"
);
assert.match(
  overlayTabCaptureBlock,
  /e\.isTrusted !== true[\s\S]*return;/,
  'the document-level Tab capture must reject synthetic events'
);

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
