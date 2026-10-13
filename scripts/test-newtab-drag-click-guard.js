// Every New Tab drag (shortcut tiles, bookmark cards, group titles) shares one
// policy for the click its release fires: swallow that single click, wherever
// it lands, within a time cap; a new press ends the guard.
const assert = require('assert');
const path = require('path');

const {
  DRAG_CLICK_GUARD_MS,
  createDragClickGuard
} = require(path.join(__dirname, '..', 'src', 'newtab', 'drag-click-guard.js'));

function createFixture() {
  let time = 1000;
  const windowObj = new EventTarget();
  const guard = createDragClickGuard({ windowObj, now: () => time });
  const opened = [];
  // The window sees an event first; the page (React's root, the cascade
  // menu's buttons) only gets a click that was not stopped there.
  const fire = (type, init) => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, init || {});
    windowObj.dispatchEvent(event);
    if (type === 'click' && !event.cancelBubble) {
      opened.push(event.label);
    }
    return event;
  };
  return {
    guard,
    opened,
    fire,
    click: (label) => fire('click', { label }),
    advance: (ms) => { time += ms; }
  };
}

assert.strictEqual(DRAG_CLICK_GUARD_MS, 420);

// A released drag swallows exactly the click that follows it.
{
  const { guard, opened, click } = createFixture();
  guard.armAfterDrag({ pointerId: 1 }, 1);
  const swallowed = click('release');
  assert.strictEqual(swallowed.defaultPrevented, true);
  assert.deepStrictEqual(opened, [], 'page listeners never see the release click');
  click('next');
  assert.deepStrictEqual(opened, ['next'], 'the click after it works again');
  assert.strictEqual(guard.isArmed(), false);
}

// A release that fires no click leaves no guard behind once the cap passes.
{
  const { guard, opened, click, advance } = createFixture();
  guard.armAfterRelease();
  advance(DRAG_CLICK_GUARD_MS + 1);
  assert.strictEqual(guard.isArmed(), false);
  const late = click('late');
  assert.strictEqual(late.defaultPrevented, false);
  assert.deepStrictEqual(opened, ['late']);
}

// A new press ends the guard, so a quick deliberate click still works.
{
  const { guard, opened, click, fire } = createFixture();
  guard.armAfterRelease();
  fire('pointerdown', { pointerId: 2 });
  click('deliberate');
  assert.deepStrictEqual(opened, ['deliberate']);
}

// Escape cancels while the mouse is held: holding never expires the guard,
// another pointer's release does not count, and the held pointer's release
// guards its click.
{
  const { guard, opened, click, fire, advance } = createFixture();
  guard.armAfterDrag(null, 7);
  advance(5000);
  assert.strictEqual(guard.isArmed(), true, 'holding the mouse keeps the guard');
  fire('pointerup', { pointerId: 8 });
  advance(5000);
  assert.strictEqual(guard.isArmed(), true, 'another pointer does not end the gesture');
  fire('pointerup', { pointerId: 7 });
  click('release');
  assert.deepStrictEqual(opened, [], 'the click of the held release is swallowed');
  click('next');
  assert.deepStrictEqual(opened, ['next']);
}

// Arming again replaces the earlier guard rather than stacking listeners.
{
  const { guard, opened, click } = createFixture();
  guard.armAfterDrag(null, 7);
  guard.armAfterRelease();
  guard.armAfterRelease();
  click('release');
  click('next');
  assert.deepStrictEqual(opened, ['next']);
}

console.log('newtab drag click guard tests passed');
