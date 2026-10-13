const assert = require('assert');
const { JSDOM } = require('jsdom');

delete globalThis.LumnoOverlayLifecycle;
require('../src/overlay/lifecycle.js');

const { isOverlayKeyEvent } = globalThis.LumnoOverlayLifecycle;

// The overlay listens for keys on the host document. It may only claim keys
// that come from its own (closed) shadow tree or that reach the page while
// nothing is focused; a focused host-page control must keep its arrows,
// Enter and digits.

const dom = new JSDOM(`<!doctype html><html><body>
  <textarea id="page-field"></textarea>
  <button id="page-button">Page</button>
  <div id="page-editor" contenteditable="true"></div>
</body></html>`);
const { window } = dom;
const { document } = window;
const host = document.createElement('div');
document.documentElement.appendChild(host);
const shadowRoot = host.attachShadow({ mode: 'closed' });
const panel = document.createElement('div');
const overlayInput = document.createElement('input');
const overlayButton = document.createElement('button');
panel.append(overlayInput, overlayButton);
shadowRoot.appendChild(panel);
const mount = { document, host, panel };

function ownershipAtDocument(target, key) {
  let owned = null;
  const listener = (event) => {
    owned = isOverlayKeyEvent(event, mount);
  };
  document.addEventListener('keydown', listener);
  target.dispatchEvent(new window.KeyboardEvent('keydown', {
    key: key || 'ArrowDown',
    bubbles: true,
    composed: true,
    cancelable: true
  }));
  document.removeEventListener('keydown', listener);
  return owned;
}

assert.strictEqual(ownershipAtDocument(overlayInput), true,
  'keys from the overlay input belong to the overlay');
assert.strictEqual(ownershipAtDocument(overlayButton, 'Enter'), true,
  'keys from other overlay controls belong to the overlay');
assert.strictEqual(ownershipAtDocument(document.body), true,
  'keys sent while nothing on the page is focused belong to the overlay');
assert.strictEqual(ownershipAtDocument(document.documentElement), true);
assert.strictEqual(ownershipAtDocument(document.getElementById('page-field'), 'Enter'), false,
  'a focused host-page text field keeps Enter');
assert.strictEqual(ownershipAtDocument(document.getElementById('page-field')), false,
  'a focused host-page text field keeps its arrow keys');
assert.strictEqual(ownershipAtDocument(document.getElementById('page-button'), '2'), false,
  'a focused host-page control keeps digits');
assert.strictEqual(ownershipAtDocument(document.getElementById('page-editor')), false,
  'a host-page rich-text editor keeps its keys');

document.body.setAttribute('contenteditable', 'true');
assert.strictEqual(ownershipAtDocument(document.body), false,
  'an editable host-page body keeps its keys');
document.body.removeAttribute('contenteditable');

assert.strictEqual(isOverlayKeyEvent(null, mount), false);

console.log('overlay key ownership tests passed');
