const assert = require('assert');
const { readStylesheet } = require('./helpers/css-tokens');
const fs = require('fs');
const path = require('path');
const { readPageSource } = require('./helpers/page-source');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');

const repoRoot = path.resolve(__dirname, '..');
const newtabHtml = readPageSource('newtab.html');
const newtabJs = readNewtabRuntimeSource();
const overlayCss = readStylesheet('src/overlay/suggestions-view.css');
const overlayJs = fs.readFileSync(path.join(repoRoot, 'src/overlay/search-panel.js'), 'utf8');
const suggestionsReact = fs.readFileSync(
  path.join(repoRoot, 'react-src/search/suggestions.tsx'),
  'utf8'
);

function getCssRuleBlock(source, selector) {
  // The selector may share its rule with siblings (the glass style's dark-palette variants).
  let start = source.indexOf(`${selector} {`);
  if (start === -1) {
    const listed = source.indexOf(`${selector},\n`);
    start = listed !== -1 && !source.slice(listed, source.indexOf('{', listed)).includes('}') ? listed : -1;
  }
  assert.notStrictEqual(start, -1, `missing CSS rule: ${selector}`);
  const end = source.indexOf('}', start);
  assert.notStrictEqual(end, -1, `unterminated CSS rule: ${selector}`);
  return source.slice(start, end + 1);
}

const newtabSuggestionBlock = getCssRuleBlock(newtabHtml, '.x-nt-suggestion-item');
const newtabActiveSuggestionBlock = getCssRuleBlock(
  newtabHtml,
  '.x-nt-suggestion-item[data-row-state="active"]'
);
const overlaySuggestionBlock = getCssRuleBlock(
  overlayCss,
  ':is(#_x_extension_overlay_2024_unique_, #_x_extension_onboarding_overlay_demo_2026_unique_) .x-ov-suggestion-item'
);
const overlayDarkActiveFaviconBlock = getCssRuleBlock(
  overlayCss,
  ':is(#_x_extension_overlay_2024_unique_[data-theme="dark"], #_x_extension_onboarding_overlay_demo_2026_unique_[data-theme="dark"]) .x-ov-suggestion-item[data-row-state="active"] .x-ov-suggestion-icon-slot[data-favicon="true"]'
);
const newtabDarkActiveFaviconBlock = getCssRuleBlock(
  newtabHtml,
  'body[data-theme="dark"] .x-nt-suggestion-item[data-row-state="active"] .x-nt-suggestion-icon-slot[data-favicon="true"]'
);

assert.match(
  newtabActiveSuggestionBlock,
  /background:\s*var\(--x-nt-suggestion-active-bg/,
  'newtab active suggestion rows should keep the existing background highlight'
);

assert.doesNotMatch(
  newtabActiveSuggestionBlock,
  /border(?:-color)?:|box-shadow:/,
  'newtab active suggestion rows should not add an outline or shadow'
);

assert.match(
  newtabSuggestionBlock,
  /border:\s*1px solid transparent;[\s\S]*?transition:\s*background-color (?:0\.2s|200ms) ease;/,
  'newtab suggestion rows should reserve transparent border space and animate only the background'
);

assert.match(
  overlaySuggestionBlock,
  /background:\s*var\(--x-ov-suggestion-row-bg[\s\S]*?border:\s*1px solid transparent;/,
  'overlay suggestion rows should keep the background highlight without an outline'
);

assert.doesNotMatch(
  overlaySuggestionBlock,
  /box-shadow:/,
  'overlay suggestion rows should not expose an active-row shadow'
);

assert.match(
  overlaySuggestionBlock,
  /transition:\s*background-color (?:0\.2s|200ms) ease;/,
  'overlay suggestion rows should animate only the background highlight'
);

assert.match(
  overlayDarkActiveFaviconBlock,
  /background-color:\s*#FFFFFF;/,
  'overlay dark active favicon slots should render on a white rounded rectangle'
);

assert.match(
  newtabDarkActiveFaviconBlock,
  /background-color:\s*#FFFFFF;/,
  'newtab dark active favicon slots should render on a white rounded rectangle'
);

assert.doesNotMatch(
  overlayCss + newtabHtml,
  /x-(?:ov|nt)-suggestion-item:last-child/,
  'suggestion list spacing should come from synchronized data-last state, not a last-child fallback'
);

assert.match(
  overlayJs,
  /function syncSuggestionLastState\(\)[\s\S]*?data-last[\s\S]*?index === suggestionItems\.length - 1 \? 'true' : 'false'/,
  'overlay append renders should resync which suggestion is the final row'
);

assert.match(
  suggestionsReact,
  /'--x-nt-suggestion-active-bg':\s*'--x-ov-suggestion-row-bg'/,
  'the shared React view should map the active background to the Overlay token'
);

assert.match(
  suggestionsReact,
  /const highlight = simpleMode[\s\S]*?: options\.getHighlightColors\(theme\);[\s\S]*?'--x-nt-suggestion-active-bg'[\s\S]*?highlight\.bg/,
  'React Overlay active suggestions should preserve themed backgrounds outside simple mode'
);
assert.match(
  suggestionsReact,
  /simpleMode[\s\S]*?'var\(--x-ov-hover-bg, #F3F4F6\)'[\s\S]*?'var\(--x-nt-hover-bg, #F3F4F6\)'/,
  'simple mode should use neutral active backgrounds on both search surfaces'
);

assert.doesNotMatch(
  newtabHtml + newtabJs + overlayCss + suggestionsReact,
  /--x-(?:nt-suggestion-(?:active|hover)-border|ov-suggestion-row-border)/,
  'search result rows should not expose active or hover outline variables'
);

assert.match(
  suggestionsReact,
  /item\.setAttribute\('data-row-state', 'active'\);/,
  'React active suggestions should expose row state for dark favicon styling'
);

assert.match(
  suggestionsReact,
  /item\.removeAttribute\('data-row-state'\);/,
  'React inactive suggestions should clear row state for dark favicon styling'
);

[newtabJs, overlayJs].forEach((source) => {
  assert.match(
    source,
    /function applyMarkVariables\(target, theme, active\)[\s\S]*?active\s*\?\s*resolvedTheme\.activeMarkBg\s*\|\|\s*resolvedTheme\.markBg\s*:\s*resolvedTheme\.markBg/,
    'suggestion theme bridges should strengthen match highlighting only for the selected row'
  );
});

assert.match(
  suggestionsReact,
  /data-favicon=\{isFavicon \? 'true' : 'false'\}/,
  'React favicon slots should expose whether their child is a favicon'
);

assert.doesNotMatch(
  newtabJs + overlayJs,
  /getSuggestionActiveShadow|suggestion-active-shadow|suggestion-row-shadow|rgba\(255, 255, 255, 0\.40\)/,
  'search result highlight code should not keep the removed active shadow helpers or variables'
);

console.log('search result highlight surface tests passed');
