const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../src/newtab/newtab.js'), 'utf8');
const handler = source.match(/bookmarkSection\.addEventListener\('wheel', \(event\) => \{([\s\S]*?)\n  \}, \{ passive: false \}\);/)[1];
function fixture(overrides = {}) {
  const calls = [];
  const context = { bookmarkSection: {}, isContentSectionVisible: () => true, getBookmarkPageCount: () => 4,
    pageState: { bookmarkCurrentPage: 1, bookmarkPageAnimating: false }, bookmarkWheelLastAt: 0,
    BOOKMARK_WHEEL_SWITCH_COOLDOWN_MS: 220, Date: { now: () => 1000 }, window: { innerWidth: 1200 },
    switchBookmarkPage: page => { calls.push(page); context.pageState.bookmarkCurrentPage = page; }, ...overrides };
  vm.createContext(context);
  vm.runInContext(`globalThis.wheel = (event) => {${handler}}`, context);
  const send = event => {
    let prevented = false;
    context.wheel({ preventDefault() { prevented = true; }, ...event });
    return prevented;
  };
  return { context, calls, send };
}
for (const [event, expected] of [
  [{ deltaX: 20 }, 2], [{ deltaX: -20 }, 0],
  [{ deltaY: 20 }, 2], [{ deltaY: -20 }, 0],
  [{ deltaX: -25, deltaY: 10 }, 0], [{ deltaX: -10, deltaY: 25 }, 2],
  [{ deltaX: 1, deltaMode: 1 }, 2], [{ deltaX: -1, deltaMode: 2 }, 0]
]) {
  const f = fixture();
  assert.equal(f.send(event), true);
  assert.deepEqual(f.calls, [expected]);
}
for (const event of [{ deltaX: 3, deltaY: 2 }, { deltaX: 20, ctrlKey: true }]) {
  const f = fixture();
  assert.equal(f.send(event), false);
  assert.deepEqual(f.calls, []);
}
const locked = fixture();
locked.context.pageState.bookmarkPageAnimating = true;
locked.send({ deltaX: 20 });
assert.deepEqual(locked.calls, [], 'horizontal input respects the single-page animation lock');
const throttled = fixture();
throttled.send({ deltaX: 20 });
throttled.send({ deltaX: 20 });
assert.deepEqual(throttled.calls, [2]);
const boundary = fixture();
boundary.context.pageState.bookmarkCurrentPage = 0;
boundary.send({ deltaX: -20 });
assert.deepEqual(boundary.calls, []);
console.log('Bookmark wheel tests passed: horizontal/vertical input, dominant axis, units, zoom, animation lock and boundaries');
