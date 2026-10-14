const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { JSDOM } = require('jsdom');

const pageTheme = require('../src/overlay/page-theme.js');
const faviconTheme = require('../src/newtab/favicon-theme.js');

function createElement(config) {
  const element = {
    id: config.id || '',
    nodeType: 1,
    parentElement: config.parentElement || null,
    children: [],
    _style: {
      backgroundColor: config.backgroundColor || 'rgba(0, 0, 0, 0)',
      color: config.color || 'rgb(17, 24, 39)',
      opacity: config.opacity || '1',
      display: config.display || 'block',
      visibility: config.visibility || 'visible'
    },
    hasAttribute(name) {
      return Boolean(config.attributes && Object.prototype.hasOwnProperty.call(config.attributes, name));
    },
    getAttribute(name) {
      if (name === 'id') {
        return this.id;
      }
      return config.attributes && Object.prototype.hasOwnProperty.call(config.attributes, name)
        ? config.attributes[name]
        : null;
    }
  };
  if (element.parentElement && element.parentElement.children) {
    element.parentElement.children.push(element);
  }
  return element;
}

function createDocumentWithSamples(samples, options) {
  const docEl = createElement({
    backgroundColor: options && options.rootBackgroundColor
      ? options.rootBackgroundColor
      : 'rgba(0, 0, 0, 0)'
  });
  const body = createElement({
    parentElement: docEl,
    backgroundColor: options && options.bodyBackgroundColor
      ? options.bodyBackgroundColor
      : 'rgba(0, 0, 0, 0)'
  });
  const document = {
    documentElement: docEl,
    body,
    elementFromPoint(x, y) {
      if (typeof samples === 'function') {
        return samples(x, y);
      }
      return samples.shift() || null;
    }
  };
  const window = {
    innerWidth: 1000,
    innerHeight: 800,
    getComputedStyle(element) {
      return element && element._style ? element._style : {};
    }
  };
  return { document, window, docEl, body };
}

function testVisualThemeUsesVisibleDarkSurfaces() {
  const { document, window, body } = createDocumentWithSamples([], {
    rootBackgroundColor: 'rgb(250, 250, 250)',
    bodyBackgroundColor: 'rgba(0, 0, 0, 0)'
  });
  const darkSurface = createElement({
    parentElement: body,
    backgroundColor: 'rgb(18, 18, 18)',
    color: 'rgb(238, 238, 238)'
  });
  document.elementFromPoint = () => darkSurface;

  assert.strictEqual(
    pageTheme.detectPageVisualTheme({ document, window }),
    'dark',
    'visible dark app surfaces should override a transparent body/root fallback'
  );
}

function testVisualThemeReturnsNullForAmbiguousSurfaces() {
  const { document, window, body } = createDocumentWithSamples([], {});
  const middleSurface = createElement({
    parentElement: body,
    backgroundColor: 'rgb(128, 128, 128)',
    color: 'rgb(96, 96, 96)'
  });
  document.elementFromPoint = () => middleSurface;

  assert.strictEqual(
    pageTheme.detectPageVisualTheme({ document, window }),
    null,
    'ambiguous mid-tone surfaces should not force a theme'
  );
}

function testVisualThemeUsesLightTextWhenBackgroundIsTransparent() {
  const { document, window, body } = createDocumentWithSamples([], {
    rootBackgroundColor: 'rgba(0, 0, 0, 0)',
    bodyBackgroundColor: 'rgba(0, 0, 0, 0)'
  });
  const transparentDarkUiSurface = createElement({
    parentElement: body,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    color: 'rgb(245, 245, 245)'
  });
  document.elementFromPoint = () => transparentDarkUiSurface;

  assert.strictEqual(
    pageTheme.detectPageVisualTheme({ document, window }),
    'dark',
    'light text on transparent sampled surfaces should count as a dark UI signal'
  );
}

function testVisualThemeIgnoresLumnoOverlayElements() {
  const { document, window, body } = createDocumentWithSamples([], {});
  const overlayPanel = createElement({
    id: '_x_extension_overlay_2024_unique_',
    parentElement: body,
    backgroundColor: 'rgb(20, 20, 20)',
    color: 'rgb(238, 238, 238)'
  });
  const lightSurface = createElement({
    parentElement: body,
    backgroundColor: 'rgb(255, 255, 255)',
    color: 'rgb(17, 24, 39)'
  });
  let calls = 0;
  document.elementFromPoint = () => {
    calls += 1;
    return calls <= 2 ? overlayPanel : lightSurface;
  };

  assert.strictEqual(
    pageTheme.detectPageVisualTheme({ document, window }),
    'light',
    'theme sampling should ignore Lumno overlay elements to avoid self-reinforcing detection'
  );
}

function testVisualThemeSamplesOverlayFootprint() {
  const { document, window, body } = createDocumentWithSamples([], {
    bodyBackgroundColor: 'rgb(18, 18, 18)'
  });
  const darkSurface = createElement({
    parentElement: body,
    backgroundColor: 'rgb(18, 18, 18)',
    color: 'rgb(238, 238, 238)'
  });
  let sampleCount = 0;
  document.elementFromPoint = () => {
    sampleCount += 1;
    return darkSurface;
  };

  assert.strictEqual(pageTheme.detectPageVisualTheme({ document, window }), 'dark');
  assert.ok(
    sampleCount >= 24,
    'visual theme sampling should cover the overlay footprint with more than a tiny set of points'
  );
}

function testTransparentCssColorsDoNotBecomeDarkThemeSignals() {
  assert.strictEqual(
    pageTheme.getCssColorThemeSignal('rgba(0, 0, 0, 0)', 0.78),
    null,
    'a fully transparent root background should not count as a black page surface'
  );
  assert.strictEqual(
    pageTheme.getCssColorThemeSignal('rgba(0, 0, 0, 0.1)', 0.78).theme,
    'light',
    'a faint translucent black surface should be composited over the page canvas before classification'
  );
}

function testWappalyzerLikeLightPageSignalsResolveLight() {
  const signals = [
    { theme: 'light', confidence: 0.74, weight: 0.48 },
    { theme: 'light', confidence: 0.62, weight: 0.26 },
    pageTheme.getCssColorThemeSignal('#4608ad', 0.72),
    pageTheme.getCssColorThemeSignal('rgba(0, 0, 0, 0)', 0.78),
    pageTheme.getCssColorThemeSignal('rgba(0, 0, 0, 0)', 0.58),
    { theme: 'light', confidence: 0.62, weight: 1.05 }
  ];
  assert.strictEqual(
    pageTheme.resolvePageThemeSignals(signals),
    'light',
    'explicit light mode and a mostly light viewport should beat a dark brand theme-color'
  );
}

function createThemedPage(html, options) {
  const settings = options || {};
  const dom = new JSDOM(`<!doctype html><html${settings.htmlAttributes || ''}><head>${settings.head || ''}</head><body${settings.bodyAttributes || ''}>${html || ''}</body></html>`, {
    pretendToBeVisual: true
  });
  const { window } = dom;
  if (settings.visualSample) {
    // JSDOM has no layout; let every viewport sample land on one element.
    const sample = window.document.createElement('div');
    sample.style.backgroundColor = settings.visualSample.backgroundColor;
    sample.style.color = settings.visualSample.color;
    sample.style.opacity = '1';
    window.document.body.appendChild(sample);
    window.document.elementFromPoint = () => sample;
  }
  return window;
}

function detectTheme(window) {
  return pageTheme.detectPageTheme({
    document: window.document,
    window,
    parseThemeColorRgb: faviconTheme.parseCssColor
  });
}

function testPageThemeFusesThemeColorWithVisualSignals() {
  const darkBrandOnLightPage = createThemedPage('', {
    head: '<meta name="theme-color" content="#1a0b3d">',
    visualSample: { backgroundColor: 'rgb(255, 255, 255)', color: 'rgb(17, 24, 39)' },
    bodyAttributes: ' style="background-color: rgb(255, 255, 255)"'
  });
  assert.strictEqual(detectTheme(darkBrandOnLightPage), 'light',
    'a dark brand theme-color must not override a visibly light page');
  darkBrandOnLightPage.close();

  const themeColorOnly = createThemedPage('', {
    head: '<meta name="theme-color" content="#111111">'
  });
  assert.strictEqual(detectTheme(themeColorOnly), 'dark',
    'theme-color still counts as a weighted signal when nothing else speaks');
  themeColorOnly.close();

  const transparentThemeColor = createThemedPage('', {
    head: '<meta name="theme-color" content="transparent">'
  });
  assert.strictEqual(detectTheme(transparentThemeColor), null,
    'an unparseable theme-color adds no signal');
  transparentThemeColor.close();
}

function testPageThemeDoesNotShortCircuitExplicitHints() {
  const darkClassOnLightPage = createThemedPage('', {
    htmlAttributes: ' class="dark"',
    visualSample: { backgroundColor: 'rgb(255, 255, 255)', color: 'rgb(17, 24, 39)' },
    bodyAttributes: ' style="background-color: rgb(255, 255, 255)"'
  });
  assert.strictEqual(detectTheme(darkClassOnLightPage), 'light',
    'an explicit dark class hint is weighed against a visibly light page, not returned outright');
  darkClassOnLightPage.close();

  const explicitDark = createThemedPage('', { htmlAttributes: ' data-theme="dark"' });
  assert.strictEqual(detectTheme(explicitDark), 'dark',
    'an explicit theme attribute decides when nothing contradicts it');
  explicitDark.close();

  const schemeMeta = createThemedPage('', { head: '<meta name="color-scheme" content="dark">' });
  assert.strictEqual(detectTheme(schemeMeta), 'dark', 'a dark color-scheme meta becomes a signal');
  schemeMeta.close();

  const lightSchemeOnDarkPage = createThemedPage('', {
    head: '<meta name="color-scheme" content="light">',
    visualSample: { backgroundColor: 'rgb(18, 18, 18)', color: 'rgb(240, 240, 240)' },
    bodyAttributes: ' style="background-color: rgb(18, 18, 18)"'
  });
  assert.strictEqual(detectTheme(lightSchemeOnDarkPage), 'dark',
    'a light color-scheme hint must not short-circuit a visibly dark page');
  lightSchemeOnDarkPage.close();
}

function testPageThemeIgnoresBusinessClassNames() {
  assert.strictEqual(pageTheme.getThemeClassTokenTheme('light-rays'), null);
  assert.strictEqual(pageTheme.getThemeClassTokenTheme('dark-veil'), null);
  assert.strictEqual(pageTheme.getThemeClassTokenTheme('theme-dark'), 'dark');
  assert.strictEqual(pageTheme.getThemeClassTokenTheme('light-mode'), 'light');
  assert.strictEqual(pageTheme.getThemeClassTokenTheme('night'), 'dark');
  const businessClasses = createThemedPage('<div class="light-rays dark-veil"></div>', {
    bodyAttributes: ' class="dark-veil"'
  });
  assert.strictEqual(detectTheme(businessClasses), null,
    'business class names must not be read as theme switches');
  businessClasses.close();
}

function testPageThemeObserverBatchesChangesPerFrame() {
  const window = createThemedPage('');
  const frames = [];
  window.requestAnimationFrame = (callback) => {
    frames.push(callback);
    return frames.length;
  };
  window.cancelAnimationFrame = (id) => {
    frames[id - 1] = null;
  };
  let changes = 0;
  const observer = pageTheme.createPageThemeObserver(window, () => {
    changes += 1;
  });
  observer.start();
  observer.start();
  assert.strictEqual(observer.active, true);
  assert.strictEqual(frames.length, 1, 'starting schedules one initial sync');
  frames.shift()();
  assert.strictEqual(changes, 1);
  observer.stop();
  assert.strictEqual(observer.active, false);
  window.close();
}

async function testPageThemeObserverReactsToThemeAttributes() {
  const window = createThemedPage('');
  window.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  window.cancelAnimationFrame = (id) => clearTimeout(id);
  let changes = 0;
  const observer = pageTheme.createPageThemeObserver(window, () => {
    changes += 1;
  });
  observer.start();
  await new Promise((resolve) => setTimeout(resolve, 5));
  const afterStart = changes;
  window.document.documentElement.setAttribute('data-theme', 'dark');
  window.document.documentElement.setAttribute('data-color-mode', 'dark');
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.strictEqual(changes, afterStart + 1, 'theme attribute bursts collapse into one sync');
  window.document.documentElement.setAttribute('aria-label', 'unrelated');
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.strictEqual(changes, afterStart + 1, 'unrelated attributes are ignored');
  observer.stop();
  window.document.documentElement.setAttribute('data-theme', 'light');
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.strictEqual(changes, afterStart + 1, 'a stopped observer stays quiet');
  window.close();
}

function testSearchPanelAppliesInitialSystemThemeBeforeAppend() {
  const searchPanelSource = fs.readFileSync(path.join(__dirname, '../src/overlay/search-panel.js'), 'utf8');
  const initialThemeIndex = searchPanelSource.indexOf('applyOverlayThemeVariables(overlay, overlayThemeMode);');
  const themeTokensIndex = searchPanelSource.indexOf('const overlayThemeTokens = {');
  const appendIndex = searchPanelSource.indexOf('overlayMountParent.appendChild(overlayHost);');
  assert.ok(initialThemeIndex > 0, 'search-panel should apply a synchronous initial system theme');
  assert.ok(
    initialThemeIndex > themeTokensIndex,
    'initial system theme should run after overlay theme tokens are initialized'
  );
  assert.ok(
    initialThemeIndex < appendIndex,
    'initial system theme should be applied before the overlay host is appended'
  );
}

function testSearchPanelExcludesInputExtensionsBeforeMountAndFocus() {
  const searchPanelSource = fs.readFileSync(path.join(__dirname, '../src/overlay/search-panel.js'), 'utf8');
  const isolationFunctionIndex = searchPanelSource.indexOf(
    'function applyOverlayInputExtensionIsolation(input)'
  );
  const inputCreatedIndex = searchPanelSource.indexOf('let searchInput = inputParts.input;');
  const isolationCallIndex = searchPanelSource.indexOf(
    'applyOverlayInputExtensionIsolation(searchInput);'
  );
  const inputMountIndex = searchPanelSource.indexOf('overlay.appendChild(inputContainer);');
  const focusFunctionIndex = searchPanelSource.indexOf(
    'function focusOverlayInputForReveal()'
  );
  const focusIndex = searchPanelSource.indexOf(
    'focusOverlayInputForReveal();',
    focusFunctionIndex
  );
  const requiredAttributes = {
    'data-1p-ignore': 'true',
    'data-op-ignore': 'true',
    'data-lpignore': 'true',
    'data-bwignore': 'true',
    'data-form-type': 'other',
    'data-gramm': 'false',
    'data-lt-active': 'false',
    spellcheck: 'false',
    writingsuggestions: 'false'
  };
  assert.ok(isolationFunctionIndex > 0, 'search-panel should define input-extension isolation');
  Object.entries(requiredAttributes).forEach(([name, value]) => {
    assert.ok(
      searchPanelSource.includes(`'${name}': '${value}'`),
      `search-panel should isolate its input with ${name}=${value}`
    );
  });
  assert.ok(inputCreatedIndex > 0, 'search-panel should create the search input');
  assert.ok(
    isolationCallIndex > inputCreatedIndex,
    'search-panel should isolate its search input after creation'
  );
  assert.ok(
    isolationCallIndex < inputMountIndex &&
      inputMountIndex < focusFunctionIndex &&
      focusFunctionIndex < focusIndex,
    'input-extension exclusion should be applied before the input is mounted and reveal-owned focus runs'
  );
  assert.ok(
    !searchPanelSource.includes(
      'setTimeout(() => searchInput.focus({ preventScroll: true }), 100);'
    ),
    'overlay focus should follow the reveal transaction instead of an unrelated fixed timer'
  );
}

testVisualThemeUsesVisibleDarkSurfaces();
testVisualThemeReturnsNullForAmbiguousSurfaces();
testVisualThemeUsesLightTextWhenBackgroundIsTransparent();
testVisualThemeIgnoresLumnoOverlayElements();
testVisualThemeSamplesOverlayFootprint();
testTransparentCssColorsDoNotBecomeDarkThemeSignals();
testWappalyzerLikeLightPageSignalsResolveLight();
testPageThemeFusesThemeColorWithVisualSignals();
testPageThemeDoesNotShortCircuitExplicitHints();
testPageThemeIgnoresBusinessClassNames();
testPageThemeObserverBatchesChangesPerFrame();
testSearchPanelAppliesInitialSystemThemeBeforeAppend();
testSearchPanelExcludesInputExtensionsBeforeMountAndFocus();

testPageThemeObserverReactsToThemeAttributes().then(() => {
  console.log('overlay page theme tests passed');
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
