const assert = require('assert');
const { JSDOM } = require('jsdom');
const { createNoticeLayer } = require('../src/overlay/notices.js');

// The overlay notice layer mounts the update and engagement notices beside
// (above) the overlay panel inside its shadow root, counts one update-notice
// exposure per mount, and keeps the notices' frame matched to the panel.

function createPage(options) {
  const settings = options || {};
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
  const { window } = dom;
  const frames = [];
  window.requestAnimationFrame = (callback) => {
    frames.push(callback);
    return frames.length;
  };
  window.matchMedia = () => ({ matches: Boolean(settings.reducedMotion) });
  const host = window.document.createElement('div');
  window.document.documentElement.appendChild(host);
  const styleRoot = host.attachShadow({ mode: 'open' });
  const panel = window.document.createElement('div');
  panel.style.setProperty('width', '680px');
  panel.style.setProperty('top', '18vh');
  panel.style.setProperty('--x-ov-visible-scale', '0.9');
  panel.setAttribute('data-theme', 'dark');
  styleRoot.appendChild(panel);
  return { window, frames, styleRoot, panel };
}

function createNotice(window, visible) {
  const element = window.document.createElement('div');
  element.setAttribute('data-visible', visible === false ? 'false' : 'true');
  return {
    element,
    exposures: 0,
    recordExposure() {
      this.exposures += 1;
    }
  };
}

function runFrames(frames) {
  while (frames.length > 0) {
    frames.shift()();
  }
}

// Mounting places both notices above the panel, outside it, with an entry state.
{
  const { window, frames, styleRoot, panel } = createPage();
  const update = createNotice(window);
  const engagement = createNotice(window);
  const decorated = [];
  const layer = createNoticeLayer(window, {
    getUpdateNotice: () => update,
    getEngagementNotice: () => engagement,
    getSizePreset: () => ({ width: 760 }),
    decorate: (element) => decorated.push(element)
  });
  layer.mount(panel, styleRoot);
  assert.deepStrictEqual(Array.from(styleRoot.children), [update.element, engagement.element, panel],
    'notices mount in the shadow root just before the panel, never inside it');
  assert.strictEqual(panel.contains(update.element), false);
  assert.strictEqual(update.exposures, 1, 'mounting counts one exposure');
  assert.deepStrictEqual(decorated, [update.element, engagement.element]);
  assert.strictEqual(update.element.getAttribute('data-overlay-mounting'), 'true',
    'a visible notice enters with the mounting state');
  runFrames(frames);
  assert.strictEqual(update.element.hasAttribute('data-overlay-mounting'), false,
    'the mounting state clears after the entry frames');
  assert.strictEqual(update.element.style.getPropertyValue('width'), '680px');
  assert.strictEqual(update.element.style.getPropertyPriority('width'), 'important');
  assert.strictEqual(update.element.style.getPropertyValue('top'), '18vh');
  assert.strictEqual(update.element.style.getPropertyValue('--x-ov-visible-scale'), '0.9');
  assert.strictEqual(engagement.element.getAttribute('data-theme'), 'dark');

  layer.mount(panel, styleRoot);
  assert.strictEqual(update.exposures, 1, 'an already mounted notice is not counted again');
  window.close();
}

// The OS reduced-motion preference (and only that: the layer never sees the
// Lumno motion setting) skips the entry state.
{
  const { window, frames, styleRoot, panel } = createPage({ reducedMotion: true });
  const update = createNotice(window);
  const layer = createNoticeLayer(window, { getUpdateNotice: () => update });
  layer.mount(panel, styleRoot);
  assert.strictEqual(update.element.hasAttribute('data-overlay-mounting'), false);
  assert.strictEqual(frames.length, 0);
  assert.strictEqual(update.element.style.getPropertyValue('width'), '680px');
  window.close();
}

// Without an update notice nothing mounts, not even the engagement notice.
{
  const { window, styleRoot, panel } = createPage();
  const engagement = createNotice(window);
  const layer = createNoticeLayer(window, {
    getUpdateNotice: () => null,
    getEngagementNotice: () => engagement
  });
  layer.mount(panel, styleRoot);
  assert.strictEqual(engagement.element.parentNode, null);
  window.close();
}

// A scheduled mount waits for its delay and is dropped if the panel closed or the layer stopped.
(async () => {
  {
    const { window, styleRoot, panel } = createPage({ reducedMotion: true });
    const update = createNotice(window);
    const layer = createNoticeLayer(window, { getUpdateNotice: () => update });
    layer.scheduleMount(panel, styleRoot, 5);
    assert.strictEqual(update.element.parentNode, null, 'mounting waits for the delay');
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.strictEqual(update.element.parentNode, styleRoot);
    window.close();
  }
  {
    const { window, styleRoot, panel } = createPage({ reducedMotion: true });
    const update = createNotice(window);
    const layer = createNoticeLayer(window, { getUpdateNotice: () => update });
    layer.scheduleMount(panel, styleRoot, 0);
    panel.remove();
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.strictEqual(update.element.parentNode, null, 'a closed panel gets no notice');
    window.close();
  }
  {
    const { window, styleRoot, panel } = createPage({ reducedMotion: true });
    const update = createNotice(window);
    const layer = createNoticeLayer(window, { getUpdateNotice: () => update });
    layer.scheduleMount(panel, styleRoot, 0);
    layer.stop();
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.strictEqual(update.element.parentNode, null, 'stopping cancels a pending mount');
    window.close();
  }
  // Frame sync follows viewport resizes until stopped.
  {
    const { window, styleRoot, panel } = createPage({ reducedMotion: true });
    const update = createNotice(window);
    const layer = createNoticeLayer(window, { getUpdateNotice: () => update });
    layer.mount(panel, styleRoot);
    layer.startFrameSync(panel);
    panel.style.setProperty('width', '520px');
    window.dispatchEvent(new window.Event('resize'));
    assert.strictEqual(update.element.style.getPropertyValue('width'), '520px');
    layer.stop();
    panel.style.setProperty('width', '400px');
    window.dispatchEvent(new window.Event('resize'));
    assert.strictEqual(update.element.style.getPropertyValue('width'), '520px',
      'a stopped layer no longer follows resizes');
    window.close();
  }
  console.log('overlay notice layer tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
