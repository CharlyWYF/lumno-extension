// One Escape closes one New Tab layer: the open layer pushed last, or an
// active drag (higher priority) whenever one runs.
const assert = require('assert');
const path = require('path');

const { createDismissStack } = require(path.join(__dirname, '..', 'src', 'newtab', 'dismiss-stack.js'));

function createDocument() {
  const target = new EventTarget();
  const laterListeners = [];
  return {
    addEventListener: (...args) => target.addEventListener(...args),
    removeEventListener: (...args) => target.removeEventListener(...args),
    // A menu underneath that listens on the document too, added later.
    addLaterListener(listener) {
      laterListeners.push(listener);
      target.addEventListener('keydown', listener, true);
    },
    press(key, init) {
      const event = new Event('keydown', { cancelable: true });
      Object.assign(event, { key }, init || {});
      target.dispatchEvent(event);
      return event;
    }
  };
}

function createLayer(name, closed, initiallyOpen) {
  const layer = {
    open: initiallyOpen !== false,
    isOpen: () => layer.open,
    close: () => {
      layer.open = false;
      closed.push(name);
    }
  };
  return layer;
}

// Layers close one per Escape, most recently opened first.
{
  const documentObj = createDocument();
  const stack = createDismissStack({ documentObj });
  const closed = [];
  const panel = createLayer('panel', closed);
  const menu = createLayer('menu', closed);
  const contextMenu = createLayer('context-menu', closed);
  stack.push('panel', panel);
  stack.push('menu', menu);
  stack.push('context-menu', contextMenu);
  let pageSawEscape = false;
  documentObj.addLaterListener(() => { pageSawEscape = true; });

  const first = documentObj.press('Escape');
  assert.deepStrictEqual(closed, ['context-menu']);
  assert.strictEqual(first.defaultPrevented, true);
  assert.strictEqual(pageSawEscape, false, 'the Escape that closed a layer reaches nothing else');
  documentObj.press('Escape');
  documentObj.press('Escape');
  assert.deepStrictEqual(closed, ['context-menu', 'menu', 'panel']);

  const unhandled = documentObj.press('Escape');
  assert.strictEqual(unhandled.defaultPrevented, false, 'with nothing open Escape passes through');
  assert.strictEqual(pageSawEscape, true);
}

// A layer closed some other way is skipped; reopening raises it to the top.
{
  const stack = createDismissStack({ documentObj: createDocument() });
  const closed = [];
  const panel = createLayer('panel', closed);
  const menu = createLayer('menu', closed);
  stack.push('panel', panel);
  stack.push('menu', menu);
  menu.open = false;
  assert.strictEqual(stack.getTopKey(), 'panel');
  menu.open = true;
  stack.push('panel', panel);
  assert.strictEqual(stack.getTopKey(), 'panel', 'pushing again moves a layer to the top');
  stack.remove('panel');
  assert.strictEqual(stack.getTopKey(), 'menu');
}

// A drag outranks layers opened after it started (a drag-mode folder menu).
{
  const documentObj = createDocument();
  const stack = createDismissStack({ documentObj });
  const closed = [];
  const drag = createLayer('drag', closed, false);
  stack.push('drag', { ...drag, isOpen: () => drag.open, close: drag.close, priority: 1 });
  drag.open = true;
  stack.push('menu', createLayer('menu', closed));
  documentObj.press('Escape');
  assert.deepStrictEqual(closed, ['drag']);
  documentObj.press('Escape');
  assert.deepStrictEqual(closed, ['drag', 'menu']);
}

// Other keys, composing input, handled Escapes and ignored moments pass by.
{
  const documentObj = createDocument();
  let ignore = false;
  const stack = createDismissStack({ documentObj, shouldIgnore: () => ignore });
  const closed = [];
  stack.push('menu', createLayer('menu', closed));
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
