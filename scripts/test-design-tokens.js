const assert = require('assert');
const fs = require('fs');
const { readLightTokens } = require('./helpers/css-tokens');

const read = (file) => fs.readFileSync(file, 'utf8');
const pages = {
  'newtab.html': read('newtab.html'),
  'src/options/options.html': read('src/options/options.html'),
  'src/onboarding/onboarding.html': read('src/onboarding/onboarding.html')
};

// Tokens load before any stylesheet that reads them (only font and icon CSS may precede).
Object.entries(pages).forEach(([file, html]) => {
  const sheets = Array.from(html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g), (m) => m[1]);
  const tokensIndex = sheets.indexOf('../shared/tokens.css');
  assert.ok(tokensIndex >= 0, `${file} should load the shared tokens`);
  sheets.slice(0, tokensIndex).forEach((href) => {
    assert.match(href, /^\.\.\/\.\.\/assets\//, `${file} should load ${href} after tokens.css`);
  });
});

// Every token a stylesheet references must exist.
const tokens = readLightTokens();
const stylesheets = [
  ...fs.readdirSync('src/shared').filter((f) => f.endsWith('.css')).map((f) => `src/shared/${f}`),
  'src/options/options.css', 'src/options/webdav-options.css', 'src/newtab/newtab.css',
  'src/newtab/shortcut-dialog.css', 'src/newtab/folder-color-picker.css',
  'src/newtab/remote-content.css', 'src/onboarding/onboarding.css', 'src/overlay/suggestions-view.css'
];
stylesheets.forEach((file) => {
  for (const match of read(file).matchAll(/var\((--lumno-[\w-]+)/g)) {
    assert.ok(tokens.has(match[1]), `${file} references unknown token ${match[1]}`);
  }
});

// Stylesheets injected into web pages have no tokens there, so each reference needs a fallback.
[
  'src/shared/tooltip.css', 'src/shared/menu-surface.css', 'src/shared/toast.css',
  'src/shared/search-input.css', 'src/shared/feature-hints.css', 'src/shared/cursor-tooltip.css',
  'src/overlay/suggestions-view.css'
].forEach((file) => {
  const bare = read(file).match(/var\(--lumno-[\w-]+\)/g) || [];
  assert.deepStrictEqual(bare, [], `${file} is injected into web pages; give every token a fallback`);
});

// Every page loads tokens.css first, so its page-wide rules reach every component:
// reduced motion drops transitions and finishes animations at once (they still end,
// so animationend fires), and keyboard focus always shows a ring.
const tokensCss = read('src/shared/tokens.css');
const reducedMotion = tokensCss.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/);
assert.ok(reducedMotion, 'tokens.css should hold the page-wide reduced-motion rule');
assert.match(reducedMotion[1], /\*[^{]*\{[^}]*animation-duration:\s*0\.01ms !important/,
  'reduced motion should finish every animation at once without removing it');
assert.match(reducedMotion[1], /\*[^{]*\{[^}]*transition-duration:\s*0s !important/,
  'reduced motion should drop every transition');
assert.match(tokensCss, /:focus-visible \{[^}]*outline: 2px solid var\(--lumno-color-focus-ring\)/,
  'tokens.css should give every control the shared focus ring');

// Shared components are defined once; pages only resize them.
const optionsCss = read('src/options/options.css');
const newtabCss = read('src/newtab/newtab.css');
[optionsCss, newtabCss].forEach((css) => {
  assert.doesNotMatch(css, /--switch-track-on-bg|--switch-knob-shadow|switch-slider[^{]*::before\s*\{/,
    'switch colors and knob rules belong to src/shared/switch.css');
  assert.doesNotMatch(css, /^(?:\._x_extension_theme_check_2026_unique_|\.x-nt-appearance-check)\s*\{[^}]*linear-gradient/m,
    'theme card check badges belong to src/shared/choice-card.css');
});
assert.doesNotMatch(optionsCss, /^\._x_extension_toast_2024_unique_ \{[^}]*background:/m,
  'the Options toast uses src/shared/toast.css');

// One indicator implementation: classic scripts call the shared module.
assert.doesNotMatch(read('src/options/options.js'), /function measure\w*Indicator/,
  'options.js should not measure segmented indicators itself');
assert.match(read('src/newtab/quotes.js'), /globalThis\.LumnoSegmentedIndicator/,
  'quotes.js should position indicators through the shared segmented indicator');
// The appearance panel's segmented controls are React components that use the shared
// hook; react-src/newtab/wallpaper-view.test.tsx checks their indicators move.
['react-src/newtab/react-islands-entry.ts', 'react-src/options/options-islands-entry.ts'].forEach((file) => {
  assert.match(read(file), /runtime\.LumnoSegmentedIndicator = createSegmentedIndicatorApi\(\)/,
    `${file} should expose the shared segmented indicator to classic scripts`);
});

console.log('design token tests passed');
