const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const repoRoot = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const dom = new JSDOM(
  '<html style="overflow-y: scroll"><body><button id="trigger">Join</button></body></html>',
  { url: 'https://lumno.test/', pretendToBeVisual: true, runScripts: 'outside-only' }
);
const { window } = dom;
window.eval(read('src/shared/community-qr-dialog.js'));
const dialog = window.LumnoCommunityQrDialog;
const { document } = window;
const trigger = document.getElementById('trigger');
trigger.focus();

const controller = dialog.open({
  imageUrl: 'https://lumno.kubai.design/qrcode.webp',
  title: 'Bug 反馈 & 新功能提需',
  alt: 'Lumno 微信群二维码',
  closeLabel: '关闭',
  theme: 'dark',
  returnFocus: trigger
});
const host = document.getElementById(dialog.HOST_ID);
assert.ok(host && controller, 'opening shows the dialog over the page');
assert.strictEqual(host.getAttribute('data-theme'), 'dark', 'the dialog follows the surface theme');
const shadow = host.shadowRoot;
assert.strictEqual(shadow.querySelector('img').getAttribute('src'), 'https://lumno.kubai.design/qrcode.webp');
assert.strictEqual(shadow.querySelector('[role="dialog"]').getAttribute('aria-modal'), 'true');
assert.strictEqual(shadow.activeElement, shadow.querySelector('.close'), 'focus moves into the dialog');
assert.strictEqual(document.documentElement.style.overflowY, 'scroll', 'the page keeps its scrollbar');
assert.strictEqual(document.body.getAttribute('style'), null, 'the page body is left untouched');

const wheel = new window.WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 120 });
shadow.querySelector('.backdrop').dispatchEvent(wheel);
assert.ok(wheel.defaultPrevented, 'the page behind cannot scroll while the dialog is open');

let pageSawEscape = false;
document.addEventListener('keydown', () => {
  pageSawEscape = true;
});
shadow.querySelector('.close').dispatchEvent(new window.KeyboardEvent('keydown', {
  key: 'Escape',
  bubbles: true,
  composed: true,
  cancelable: true
}));
assert.strictEqual(dialog.isOpen(), false, 'Escape closes the dialog');
assert.strictEqual(pageSawEscape, false, 'Escape does not reach the page or the search box behind');
assert.strictEqual(document.activeElement, trigger, 'focus returns to where it was');

dialog.open({ imageUrl: 'https://lumno.kubai.design/a.webp' });
dialog.open({ imageUrl: 'https://lumno.kubai.design/b.webp' });
assert.strictEqual(dialog.isOpen(), true);
dialog.close();
assert.strictEqual(dialog.open({ imageUrl: '' }), null, 'nothing opens without a QR image');

// Joining the WeChat group never opens the QR image in a new tab.
const overlaySource = read('src/overlay/search-panel.js');
const newtabSource = read('src/newtab/newtab.js');
const suggestionsControllerSource = read('src/newtab/suggestions-controller.js');
assert.match(
  read('src/background/background.js'),
  /'src\/shared\/community-links\.js',\s*'src\/shared\/community-qr-dialog\.js'/,
  'the overlay loads the dialog'
);
assert.match(read('newtab.html'), /community-qr-dialog\.js/, 'the new tab loads the dialog');
assert.strictEqual(
  (overlaySource.match(/feedbackKey === 'community'\) \{\s*openOverlayCommunityQrDialog\(/g) || []).length,
  2,
  'the overlay opens the dialog from the help search row by click and by Enter'
);
assert.match(newtabSource, /feedbackKey === 'community'\) \{\s*openCommunityQrDialog\(/, 'Enter on the new tab opens the dialog');
assert.match(suggestionsControllerSource, /feedbackKey === 'community' &&[\s\S]{0,80}openCommunityQrDialog\(suggestion\.url\)/, 'a click on the new tab opens the dialog');
assert.match(overlaySource, /if \(isWechat\) \{\s*openOverlayCommunityQrDialog\(url\);/, 'the overlay engagement notice opens the dialog');
assert.match(newtabSource, /if \(isWechat\) \{\s*openCommunityQrDialog\(url\);/, 'the new tab engagement notice opens the dialog');

window.close();
console.log('Community QR dialog tests passed.');
