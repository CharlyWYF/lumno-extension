const assert = require('assert');
const { JSDOM } = require('jsdom');
const { createPanelHeightAnimator, setConditionalSettingsElementVisibility } = require('../src/options/options-panel-motion');

function setup(options) {
  const config = options || {};
  const dom = new JSDOM('<div id="root"><div id="panel"><button id="toggle">t</button><div id="row">row</div></div></div>');
  const { document } = dom.window;
  const window = dom.window;
  document.documentElement.setAttribute('data-lumno-options-ready', config.ready === false ? 'false' : 'true');
  const panel = document.getElementById('panel');
  const toggle = document.getElementById('toggle');
  let panelHeight = 400;
  let toggleTop = 300;
  panel.getBoundingClientRect = () => ({ height: panelHeight, top: 0, width: 600 });
  panel.getClientRects = () => [{}];
  toggle.getBoundingClientRect = () => ({ height: 20, top: toggleTop, width: 40 });
  const animations = [];
  panel.animate = (keyframes, timing) => {
    const animation = { keyframes, timing, cancelled: false, onfinish: null, cancel() { this.cancelled = true; } };
    animations.push(animation);
    return animation;
  };
  window.matchMedia = () => ({ matches: Boolean(config.reducedMotion) });
  const scrolls = [];
  window.scrollBy = (x, y) => {
    scrolls.push(y);
    toggleTop -= y;
  };
  Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, get: () => config.scrollHeight || 2000 });
  const animator = createPanelHeightAnimator({
    documentObj: document,
    panel,
    reserveHost: document.getElementById('root'),
    windowObj: window
  });
  return {
    animations,
    animator,
    document,
    panel,
    scrolls,
    toggle,
    setLayout(height, top) { panelHeight = height; toggleTop = top; }
  };
}

// The panel animates between its measured heights and lets go of the fill
// effect when the animation ends.
{
  const page = setup();
  const changed = page.animator.animate(() => {
    page.setLayout(480, 300);
    return true;
  });
  assert.strictEqual(changed, true);
  assert.strictEqual(page.animations.length, 1);
  assert.deepStrictEqual(page.animations[0].keyframes, [{ height: '400px' }, { height: '480px' }]);
  assert.strictEqual(page.animations[0].timing.duration, 280);
  assert.strictEqual(page.panel.style.height, '480px');
  assert.strictEqual(page.panel.getAttribute('data-height-animating'), 'true');
  page.animations[0].onfinish();
  assert.strictEqual(page.animations[0].cancelled, true, 'the fill effect is released');
  assert.strictEqual(page.panel.style.height, '');
  assert.strictEqual(page.panel.hasAttribute('data-height-animating'), false);
}

// The focused control keeps its place on screen through the change.
{
  const page = setup();
  page.toggle.focus();
  page.animator.animate(() => {
    page.setLayout(300, 260);
    return true;
  });
  assert.strictEqual(page.scrolls[0], -40, 'the page scrolls back by however far the control moved');
}

// Near the bottom of the page a reserve below the panel keeps that scroll
// from being clamped, and a click elsewhere releases it.
{
  const page = setup({ scrollHeight: 500 });
  const root = page.document.getElementById('root');
  page.toggle.focus();
  page.animator.animate(() => { page.setLayout(300, 300); return true; });
  assert.notStrictEqual(root.style.getPropertyValue('--settings-focus-anchor-reserve'), '');
  page.document.getElementById('row').dispatchEvent(new page.document.defaultView.Event('pointerdown', { bubbles: true }));
  assert.strictEqual(root.style.getPropertyValue('--settings-focus-anchor-reserve'), '');
}

// Nothing changes, nothing animates; a newer change replaces a running one.
{
  const page = setup();
  assert.strictEqual(page.animator.animate(() => false), false);
  assert.strictEqual(page.animations.length, 0);
  assert.strictEqual(page.panel.hasAttribute('data-height-animating'), false);
  page.animator.animate(() => { page.setLayout(500, 300); return true; });
  page.animator.animate(() => { page.setLayout(450, 300); return true; });
  assert.strictEqual(page.animations[0].cancelled, true);
  assert.deepStrictEqual(page.animations[1].keyframes, [{ height: '500px' }, { height: '450px' }]);
  page.animator.cancel();
  assert.strictEqual(page.animations[1].cancelled, true);
  assert.strictEqual(page.panel.style.height, '');
}

// Reduced motion and a page that is not ready yet change the layout at once.
[{ reducedMotion: true }, { ready: false }].forEach((options) => {
  const page = setup(options);
  assert.strictEqual(page.animator.animate(() => { page.setLayout(500, 300); return true; }), true);
  assert.strictEqual(page.animations.length, 0, JSON.stringify(options));
  assert.strictEqual(page.panel.hasAttribute('data-height-animating'), false);
});

// Conditional rows hide whole, or by display when a display value is given.
{
  const { document } = new JSDOM('<div id="row"></div><div id="flex"></div>').window;
  const row = document.getElementById('row');
  assert.strictEqual(setConditionalSettingsElementVisibility(row, false), true);
  assert.strictEqual(row.hidden, true);
  assert.strictEqual(row.getAttribute('aria-hidden'), 'true');
  assert.strictEqual(setConditionalSettingsElementVisibility(row, false), false, 'no change reported twice');
  const flex = document.getElementById('flex');
  assert.strictEqual(setConditionalSettingsElementVisibility(flex, false, 'flex'), true);
  assert.strictEqual(flex.style.display, 'none');
  setConditionalSettingsElementVisibility(flex, true, 'flex');
  assert.strictEqual(flex.style.display, 'flex');
  assert.strictEqual(setConditionalSettingsElementVisibility(null, true), false);
}

console.log('Options panel motion tests passed.');
