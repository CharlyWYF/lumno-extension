// One Escape closes one New Tab layer: the open layer that opened last, or
// an active drag (higher priority) whenever one runs. Layers register once
// and the stack notices on its own when they open.
const assert = require('assert');
const path = require('path');

const { createDismissStack } = require(path.join(__dirname, '..', 'src', 'newtab', 'dismiss-stack.js'));

function createDocument() {
  const target = new EventTarget();
  return {
    addEventListener: (...args) => target.addEventListener(...args),
    removeEventListener: (...args) => target.removeEventListener(...args),
    // A menu underneath that listens on the document too, added later.
    addLaterListener(listener) {
      target.addEventListener('keydown', listener, true);
    },
    fire(type, init) {
      const event = new Event(type, { cancelable: true });
      Object.assign(event, init || {});
      target.dispatchEvent(event);
      return event;
    },
    press(key, init) {
      return this.fire('keydown', { key, ...(init || {}) });
    },
    // A pointer press that opens `layer` (the press comes first).
    openWithPress(layer) {
      this.fire('pointerdown');
      layer.open = true;
    }
  };
}

function createLayer(name, closed, extra) {
  const layer = {
    open: false,
    isOpen: () => layer.open,
    close: () => {
      layer.open = false;
      closed.push(name);
    },
    ...(extra || {})
  };
  return layer;
}

// Layers close one per Escape, most recently opened first, whatever order
// they registered in.
{
  const documentObj = createDocument();
  const stack = createDismissStack({ documentObj });
  const closed = [];
  const panel = createLayer('panel', closed);
  const popover = createLayer('popover', closed);
  const menu = createLayer('menu', closed);
  stack.register('menu', menu);
  stack.register('panel', panel);
  stack.register('popover', popover);
  let pageSawEscape = false;
  documentObj.addLaterListener(() => { pageSawEscape = true; });

  documentObj.openWithPress(popover);
  documentObj.openWithPress(panel);
  documentObj.openWithPress(menu);
  const first = documentObj.press('Escape');
  assert.deepStrictEqual(closed, ['menu']);
  assert.strictEqual(first.defaultPrevented, true);
  assert.strictEqual(pageSawEscape, false, 'the Escape that closed a layer reaches nothing else');
  documentObj.press('Escape');
  assert.deepStrictEqual(closed, ['menu', 'panel'], 'a panel registered early but opened later closes first');
  documentObj.press('Escape');
  assert.deepStrictEqual(closed, ['menu', 'panel', 'popover']);

  const unhandled = documentObj.press('Escape');
  assert.strictEqual(unhandled.defaultPrevented, false, 'with nothing open Escape passes through');
  assert.strictEqual(pageSawEscape, true);
}

// A layer closed some other way is skipped; reopening puts it on top.
{
  const documentObj = createDocument();
  const stack = createDismissStack({ documentObj });
  const closed = [];
  const panel = createLayer('panel', closed);
  const menu = createLayer('menu', closed);
  stack.register('panel', panel);
  stack.register('menu', menu);
  documentObj.openWithPress(panel);
  documentObj.openWithPress(menu);
  assert.strictEqual(stack.getTopKey(), 'menu');
  menu.open = false;
  assert.strictEqual(stack.getTopKey(), 'panel');
  documentObj.openWithPress(menu);
  assert.strictEqual(stack.getTopKey(), 'menu');
  panel.open = false;
  documentObj.openWithPress(panel);
  assert.strictEqual(stack.getTopKey(), 'panel', 'reopening raises a layer');
}

// A drag outranks layers opened after it started (a drag-mode folder menu).
{
  const documentObj = createDocument();
  const stack = createDismissStack({ documentObj });
  const closed = [];
  const drag = createLayer('drag', closed, { priority: 1 });
  const menu = createLayer('menu', closed);
  stack.register('drag', drag);
  stack.register('menu', menu);
  documentObj.openWithPress(drag);
  menu.open = true;
  documentObj.press('Escape');
  assert.deepStrictEqual(closed, ['drag']);
  documentObj.press('Escape');
  assert.deepStrictEqual(closed, ['drag', 'menu']);
}

// Other keys, composing input and ignored moments pass by.
{
  const documentObj = createDocument();
  let ignore = false;
  const stack = createDismissStack({ documentObj, shouldIgnore: () => ignore });
  const closed = [];
  const menu = createLayer('menu', closed);
  stack.register('menu', menu);
  documentObj.openWithPress(menu);
  documentObj.press('ArrowDown');
  documentObj.press('Escape', { isComposing: true });
  ignore = true;
  documentObj.press('Escape');
  assert.deepStrictEqual(closed, []);
  ignore = false;
  documentObj.press('Escape');
  assert.deepStrictEqual(closed, ['menu']);
}

console.log('newtab dismiss stack tests passed');
