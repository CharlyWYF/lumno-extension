const assert = require('assert');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true });
const { window } = dom;
global.window = window;
global.document = window.document;
const sortable = require('../src/shared/sortable-drag.js');

// jsdom has no layout, so each item reports a fixed box: a column of 40px
// rows with 10px gaps, or a row of 80px tiles.
function createList(count, layout) {
  const container = document.createElement('div');
  for (let index = 0; index < count; index += 1) {
    const item = document.createElement('div');
    item.className = 'item';
    item.dataset.key = `k${index}`;
    const control = document.createElement('button');
    control.className = 'control';
    item.appendChild(control);
    const box = layout === 'row'
      ? { left: index * 90, top: 0, width: 80, height: 40 }
      : { left: 0, top: index * 50, width: 200, height: 40 };
    item.getBoundingClientRect = () => ({
      ...box,
      right: box.left + box.width,
      bottom: box.top + box.height
    });
    container.appendChild(item);
  }
  document.body.appendChild(container);
  return container;
}

function pointer(target, type, x, y) {
  const event = new window.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
  target.dispatchEvent(event);
  return event;
}

function attach(container, calls) {
  return sortable.attach(container, {
    itemSelector: '.item',
    getPeers: () => Array.from(container.children),
    onReorder: (item, fromIndex, toIndex) => calls.push([item.dataset.key, fromIndex, toIndex])
  });
}

function testColumnDragReorders() {
  const container = createList(4, 'column');
  const calls = [];
  const detach = attach(container, calls);
  const first = container.children[0];
  pointer(first, 'pointerdown', 20, 20);
  pointer(window, 'pointermove', 20, 40);
  assert.strictEqual(first.getAttribute('data-sort-dragging'), 'true');
  assert.match(first.style.getPropertyValue('transform'), /translate\(0px, 20px\)/);
  pointer(window, 'pointermove', 20, 125);
  assert.strictEqual(
    container.children[1].style.getPropertyValue('transform'),
    'translate(0px, -50px)',
    'rows the dragged one passes slide up by one row and gap'
  );
  pointer(window, 'pointerup', 20, 125);
  assert.deepStrictEqual(calls, [['k0', 0, 2]]);
  assert.strictEqual(first.hasAttribute('data-sort-dragging'), false);
  assert.strictEqual(container.children[1].style.getPropertyValue('transform'), '');
  // The click that ends the drag must not activate the row.
  let clicked = false;
  first.addEventListener('click', () => { clicked = true; });
  first.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  assert.strictEqual(clicked, false);
  detach();
}

function testSmallMovesStayClicks() {
  const container = createList(3, 'column');
  const calls = [];
  attach(container, calls);
  const first = container.children[0];
  let clicked = false;
  first.addEventListener('click', () => { clicked = true; });
  pointer(first, 'pointerdown', 20, 20);
  pointer(window, 'pointermove', 22, 22);
  pointer(window, 'pointerup', 22, 22);
  first.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  assert.deepStrictEqual(calls, []);
  assert.strictEqual(clicked, true);
}

function testControlsInsideItemsDoNotDrag() {
  const container = createList(3, 'column');
  const calls = [];
  attach(container, calls);
  const control = container.children[0].querySelector('.control');
  pointer(control, 'pointerdown', 20, 20);
  pointer(window, 'pointermove', 20, 120);
  pointer(window, 'pointerup', 20, 120);
  assert.deepStrictEqual(calls, []);
  assert.strictEqual(container.children[0].hasAttribute('data-sort-dragging'), false);
}

function testEscapeCancels() {
  const container = createList(3, 'column');
  const calls = [];
  attach(container, calls);
  pointer(container.children[2], 'pointerdown', 20, 120);
  pointer(window, 'pointermove', 20, 10);
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  pointer(window, 'pointerup', 20, 10);
  assert.deepStrictEqual(calls, []);
  assert.strictEqual(container.children[0].style.getPropertyValue('transform'), '');
}

function testRowLayoutAndCanStart() {
  const container = createList(3, 'row');
  const calls = [];
  let allowed = false;
  sortable.attach(container, {
    itemSelector: '.item',
    canStart: () => allowed,
    getPeers: () => Array.from(container.children),
    onReorder: (item, fromIndex, toIndex) => calls.push([item.dataset.key, fromIndex, toIndex])
  });
  pointer(container.children[2], 'pointerdown', 200, 20);
  pointer(window, 'pointermove', 10, 20);
  pointer(window, 'pointerup', 10, 20);
  assert.deepStrictEqual(calls, [], 'canStart can veto a drag');
  allowed = true;
  pointer(container.children[2], 'pointerdown', 200, 20);
  pointer(window, 'pointermove', 10, 20);
  pointer(window, 'pointerup', 10, 20);
  assert.deepStrictEqual(calls, [['k2', 2, 0]]);
}

testColumnDragReorders();
testSmallMovesStayClicks();
testControlsInsideItemsDoNotDrag();
testEscapeCancels();
testRowLayoutAndCanStart();

console.log('sortable drag tests passed');
