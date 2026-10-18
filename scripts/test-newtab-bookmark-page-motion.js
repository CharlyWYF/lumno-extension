const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

async function run() {
  const dom = new JSDOM('<div id="grid"></div>', { runScripts: 'outside-only' });
  const { window } = dom;
  const grid = window.document.getElementById('grid');
  grid.style.columnGap = '12px';
  grid.style.gridTemplateColumns = '200px 200px';
  grid.getBoundingClientRect = () => ({ width: 412 });
  let reducedMotion = false;
  const animations = [];
  window.Element.prototype.animate = function(keyframes, options) {
    let resolve;
    const animation = { element: this, keyframes, options, startTime: 0,
      finished: new Promise(done => { resolve = done; }), cancel() { this.cancelled = true; }, resolve: () => resolve() };
    animations.push(animation);
    return animation;
  };
  window.LumnoNewtabCrossSurfaceDrag = { prefersReducedMotion: () => reducedMotion };
  window.eval(fs.readFileSync(require.resolve('../src/newtab/bookmark-pager.js'), 'utf8'));
  const state = { bookmarkGrid: grid, bookmarkAllItems: Array.from({ length: 8 }, (_, id) => ({ id })), bookmarkCurrentPage: 0 };
  const pager = window.LumnoNewtabBookmarkPager.createBookmarkPager({ pageState: state,
    isBookmarkTopbarMode: () => false, getBookmarkLimit: () => 2,
    NEWTAB_BOOKMARKS_STORE: { getBookmarkPageItems: (items, page, limit) => items.slice(page * limit, (page + 1) * limit) },
    hideTopActionTooltip() {}, getBookmarkGridColumnCount: () => 2, updateBookmarkSectionPosition() {},
    renderBookmarks(items) {
      // Like React, remove only owned cards, leaving foreign nodes alone.
      [...grid.children].filter(child => child.tagName === 'BUTTON').forEach(card => card.remove());
      grid.append(...items.map(item => {
        const card = window.document.createElement('button');
        card.id = `card-${item.id}`;
        card.textContent = String(item.id);
        return card;
      }));
    }
  });
  pager.renderCurrentBookmarkPage();
  pager.switchBookmarkPage(1);
  assert.equal(state.bookmarkCurrentPage, 1);
  assert.equal(animations.length, 3, 'both pages animate together');
  assert.equal(animations[0].keyframes[1].transform, 'translateX(-424px)');
  assert.equal(animations[1].keyframes[0].transform, 'translateX(424px)');
  assert(animations.every(animation => animation.options.duration === 520 && animation.startTime === 0));
  assert(animations.every(animation => animation.keyframes.length === 2 &&
    animation.options.easing === 'cubic-bezier(0.16, 1, 0.3, 1)'), 'decelerate directly into place without an overshoot');
  const outgoing = grid.lastElementChild;
  assert.equal(outgoing.getAttribute('aria-hidden'), 'true');
  assert.equal(outgoing.inert, true);
  assert.equal(outgoing.querySelectorAll('[id]').length, 0);
  for (let index = 0; index < 120; index++) pager.switchBookmarkPage(index % 4);
  assert.equal(state.bookmarkCurrentPage, 1, 'ignore rapid clicks until the current page settles');
  assert.equal(animations.length, 3, 'rapid clicks never start overlapping animations');
  assert.equal(grid.children.length, 3, 'only one outgoing page exists');
  animations.forEach(animation => animation.resolve());
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(state.bookmarkPageAnimating, false);
  assert.equal(state.bookmarkCurrentPage, 1, 'rapid requests are not queued');
  assert.equal(grid.children.length, 2);
  assert.equal(grid.style.overflow, '');
  pager.switchBookmarkPage(0);
  assert.equal(animations[3].keyframes[1].transform, 'translateX(424px)', 'previous page reverses the direction');
  pager.renderCurrentBookmarkPage();
  assert.equal(state.bookmarkPageAnimating, false, 'data refresh cleans up the interrupted animation');
  assert.equal(grid.children.length, 2);
  reducedMotion = true;
  const previousCount = animations.length;
  pager.switchBookmarkPage(1);
  assert.equal(animations.length, previousCount);
  reducedMotion = false;
  window.document.documentElement.setAttribute('data-lumno-motion-effects', 'off');
  pager.switchBookmarkPage(0);
  assert.equal(animations.length, previousCount, 'motion preference is respected');
  dom.window.close();
  console.log('Bookmark page motion tests passed: single-page sliding, rapid click lock, cleanup and motion preferences');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
