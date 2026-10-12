const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Windows (and macOS set to always show scrollbars) draws a wide system
// scrollbar in any scroll box that does not style or hide its own. Inside a
// rounded panel that bar crowds the rows and leaves uneven insets, so every
// scroll box in our UI, the pages included, must either draw the thin bar or
// hide it. Where macOS draws overlay scrollbars that only show while
// scrolling, our pages keep them: src/shared/scrollbar-mode.js marks
// <html data-lumno-scrollbars="overlay">, and every thin-bar rule is scoped
// away from it, since any ::-webkit-scrollbar style turns an overlay bar into
// a permanent one.
const repoRoot = path.resolve(__dirname, '..');
const stylesheets = [
  'src/newtab/newtab.css',
  'src/newtab/recent-history-dialog.css',
  'src/newtab/shortcut-dialog.css',
  'src/newtab/folder-color-picker.css',
  'src/newtab/remote-content.css',
  'src/options/options.css',
  'src/onboarding/onboarding.css',
  'src/overlay/suggestions-view.css',
  'src/shared/search-input.css',
  'src/shared/menu-surface.css',
  'src/shared/custom-select.css'
].filter((file) => fs.existsSync(path.join(repoRoot, file)));

const OVERLAY_SCOPE = ':root:not([data-lumno-scrollbars="overlay"])';
// Body overflow scrolls the viewport, whose bar is styled on :root below.
const pageLevelScrollers = new Map([
  ['body', 'the page scrolls the viewport, styled through :root'],
  ['body.x-nt-mobile-flow', 'the narrow New Tab scrolls the viewport, styled through :root'],
  ['._x_extension_confirm_mask_2024_unique_', 'a dialog taller than the window scrolls the page-wide mask']
]);

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

// Flattens nested at-rules into [selector, body] pairs.
function collectRules(css) {
  const rules = [];
  const stack = [];
  let buffer = '';
  for (const char of css) {
    if (char === '{') {
      stack.push(buffer.trim());
      buffer = '';
    } else if (char === '}') {
      const selector = stack.pop();
      if (selector !== undefined && !selector.startsWith('@')) {
        rules.push([selector, buffer]);
      }
      buffer = '';
    } else {
      buffer += char;
    }
  }
  return rules;
}

const allRules = stylesheets.flatMap((file) => (
  collectRules(stripComments(fs.readFileSync(path.join(repoRoot, file), 'utf8')))
    .map(([selector, body]) => ({ file, selector, body }))
));

function splitSelectors(selector) {
  return selector.split(/,(?![^(]*\))/).map((part) => part.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

// The last compound selector names the scroll box, e.g. "#a .b[data-x]" -> ".b".
function scrollBoxKey(selector) {
  const last = selector.split(/\s+|>/).filter(Boolean).pop() || '';
  const match = last.match(/^(#[\w-]+|\.[\w-]+|[a-z]+(?:\.[\w-]+)?)/);
  return match ? match[1] : last;
}

function hasOwnScrollbarTreatment(key) {
  return allRules.some(({ selector, body }) => splitSelectors(selector).some((part) => (
    part.includes(key) && (
      (/::-webkit-scrollbar\b/.test(part)) ||
      (/scrollbar-width:\s*(none|thin)/.test(body))
    )
  )));
}

const scrollBoxes = new Map();
allRules.forEach(({ file, selector, body }) => {
  if (!/overflow(-x|-y)?:\s*(auto|scroll)/.test(body)) {
    return;
  }
  splitSelectors(selector).forEach((part) => {
    if (part.includes('::')) {
      return;
    }
    const key = pageLevelScrollers.has(part) ? part : scrollBoxKey(part);
    if (!scrollBoxes.has(key)) {
      scrollBoxes.set(key, file);
    }
  });
});

assert.ok(scrollBoxes.size >= 8, 'the audit should find the extension\'s scroll boxes');

const unstyled = [...scrollBoxes.entries()]
  .filter(([key]) => !pageLevelScrollers.has(key) && !hasOwnScrollbarTreatment(key))
  .map(([key, file]) => `${key} (${file})`);

assert.deepStrictEqual(
  unstyled,
  [],
  `these scroll boxes would show the system scrollbar on Windows; give them the thin bar or hide it:\n  ${unstyled.join('\n  ')}`
);

[
  '#_x_extension_newtab_bottom_dock_scroller_2024_unique_',
  '#_x_extension_newtab_suggestions_container_2024_unique_',
  '._x_extension_aggregate_search_sources_2026_unique_'
].forEach((key) => {
  assert.ok(scrollBoxes.has(key), `${key} should still be found as a scroll box`);
  assert.ok(
    allRules.some(({ selector, body }) => selector.includes(key) && /scrollbar-gutter:\s*stable/.test(body)),
    `${key} should keep a stable gutter so rows do not shift when the scrollbar appears`
  );
});

// The dock's scrollbar sits on the wallpaper, so its thumb follows the ink
// sampled under its track like the headings and pager beside it.
const newtabSource = fs.readFileSync(path.join(repoRoot, 'src/newtab/newtab.js'), 'utf8');
assert.match(
  newtabSource,
  /function createWallpaperAdaptiveToneTargets\(\)[\s\S]*?element:\s*bottomDockScroller,\s*sampleElement:\s*bottomDockScrollbarTrackArea,[\s\S]*?disabled:\s*!isBottomDockScrollbarShown\(\)/,
  'the dock scroller should be a wallpaper tone target sampled along its scrollbar track'
);
const newtabCss = stripComments(fs.readFileSync(path.join(repoRoot, 'src/newtab/newtab.css'), 'utf8'));
assert.match(
  newtabCss,
  /body #_x_extension_newtab_bottom_dock_scroller_2024_unique_\[data-wallpaper-ink\]::-webkit-scrollbar-thumb\s*\{[^}]*background-color:\s*var\(--x-nt-wallpaper-adaptive-ink-muted\);[^}]*box-shadow:\s*inset 0 0 0 1px var\(--x-nt-bottom-dock-scrollbar-hairline\);/,
  'over a wallpaper the dock thumb should take the sampled ink with an opposite-tone hairline'
);

// Page scrollbars: the viewport on Settings and New Tab, the shell on onboarding.
[
  ['src/options/options.css', `${OVERLAY_SCOPE}::-webkit-scrollbar-thumb`],
  ['src/newtab/newtab.css', `${OVERLAY_SCOPE}::-webkit-scrollbar-thumb`],
  ['src/onboarding/onboarding.css', `${OVERLAY_SCOPE} .onboarding-shell::-webkit-scrollbar-thumb`]
].forEach(([file, selector]) => {
  assert.ok(
    allRules.some((rule) => rule.file === file && splitSelectors(rule.selector).includes(selector)),
    `${file} should draw the thin page scrollbar (${selector})`
  );
});

// Any ::-webkit-scrollbar style makes macOS overlay bars permanent, so every
// thin-bar rule on our own pages stays off where the system overlays them.
// Hiding rules and the command bar (which runs on other sites' pages) are exempt.
const unscoped = allRules
  .filter(({ file, selector, body }) => (
    file !== 'src/overlay/suggestions-view.css' &&
    selector.includes('::-webkit-scrollbar') &&
    !/display:\s*none/.test(body)
  ))
  .flatMap(({ file, selector }) => splitSelectors(selector)
    .filter((part) => !part.startsWith(OVERLAY_SCOPE))
    .map((part) => `${part} (${file})`));
assert.deepStrictEqual(unscoped, [], `thin-bar rules should keep macOS overlay bars:\n  ${unscoped.join('\n  ')}`);

// Insets that make room for the thin bar collapse with overlay bars.
[
  ['src/newtab/newtab.css', /:root\[data-lumno-scrollbars="overlay"\] #_x_extension_newtab_suggestions_container_2024_unique_\s*\{\s*--x-nt-suggestions-scrollbar-gutter:\s*0px;/],
  ['src/newtab/newtab.css', /:root\[data-lumno-scrollbars="overlay"\] \.x-nt-appearance-help-footer\s*\{\s*--x-nt-panel-scrollbar-gutter:\s*0px;/],
  ['src/options/options.css', /:root\[data-lumno-scrollbars="overlay"\] \._x_extension_aggregate_search_sources_2026_unique_\s*\{\s*--x-aggregate-sources-scrollbar-gutter:\s*0px;/]
].forEach(([file, pattern]) => {
  assert.match(fs.readFileSync(path.join(repoRoot, file), 'utf8'), pattern, `${file} should drop the gutter inset for overlay bars`);
});

// Every page marks the scrollbar kind in <head>, before its styles paint.
['newtab.html', 'src/options/options.html', 'src/onboarding/onboarding.html'].forEach((file) => {
  const html = fs.readFileSync(path.join(repoRoot, file), 'utf8');
  const head = html.slice(0, html.indexOf('</head>'));
  assert.match(head, /<script src="\.\.\/shared\/scrollbar-mode\.js"><\/script>/, `${file} should load the scrollbar mode marker in <head>`);
});

// The marker measures an unstyled probe: no width means overlay bars.
function runScrollbarMode(probeWidth) {
  const attributes = new Map();
  const listeners = {};
  const root = {
    getAttribute: (name) => (attributes.has(name) ? attributes.get(name) : null),
    setAttribute: (name, value) => attributes.set(name, String(value)),
    appendChild(probe) {
      probe.offsetWidth = 100;
      probe.clientWidth = 100 - probeWidth();
    }
  };
  const document = {
    documentElement: root,
    hidden: false,
    createElement: () => ({ style: {}, setAttribute() {}, remove() {} }),
    addEventListener: (type, listener) => { listeners[`document:${type}`] = listener; }
  };
  const window = { addEventListener: (type, listener) => { listeners[`window:${type}`] = listener; } };
  const source = fs.readFileSync(path.join(repoRoot, 'src/shared/scrollbar-mode.js'), 'utf8');
  new Function('document', 'window', source)(document, window);
  return { attributes, listeners };
}
let systemBarWidth = 0;
const marker = runScrollbarMode(() => systemBarWidth);
assert.strictEqual(marker.attributes.get('data-lumno-scrollbars'), 'overlay', 'a zero-width system bar means macOS overlay bars');
systemBarWidth = 15;
marker.listeners['window:focus']();
assert.strictEqual(marker.attributes.get('data-lumno-scrollbars'), 'classic', 'plugging in a mouse should switch to the thin bar on the next focus');

// macOS overlay bars can't be styled, only toned through color-scheme, so the
// dark themes declare it and the dock follows the wallpaper under its track.
['src/newtab/newtab.css', 'src/options/options.css'].forEach((file) => {
  assert.match(
    stripComments(fs.readFileSync(path.join(repoRoot, file), 'utf8')),
    /:root:has\(> body\[data-theme="dark"\]\)\s*\{\s*color-scheme:\s*dark;/,
    `${file} should declare the dark theme's color-scheme so overlay bars turn light`
  );
});
assert.match(
  newtabCss,
  /:root\[data-lumno-scrollbars="overlay"\] #_x_extension_newtab_bottom_dock_scroller_2024_unique_\[data-wallpaper-ink="light"\]\s*\{\s*color-scheme:\s*dark;[\s\S]*?\[data-wallpaper-ink="dark"\]\s*\{\s*color-scheme:\s*light;/,
  'overlay bars over the dock should take a light thumb on dark wallpaper and a dark one on light wallpaper'
);
const shownMatch = newtabSource.match(/function isBottomDockScrollbarShown\(\) \{[\s\S]*?\n  \}/);
assert.ok(shownMatch, 'the dock should report when its scrollbar shows');
assert.doesNotMatch(
  shownMatch[0],
  /getBottomDockScrollbarGutter/,
  'overlay bars take no gutter, so the dock tone must not wait for one'
);

console.log(`Scrollbar style tests passed (${scrollBoxes.size} scroll boxes checked).`);
