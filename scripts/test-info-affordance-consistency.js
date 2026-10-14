const assert = require('assert');
const { readStylesheet } = require('./helpers/css-tokens');
const fs = require('fs');
const { readPageSource } = require('./helpers/page-source');

const optionsHtml = readPageSource('src/options/options.html');
const infoButtonCss = readStylesheet('src/shared/info-button.css');
const newtabHtml = readPageSource('newtab.html');
const optionsSource = fs.readFileSync('src/options/options.js', 'utf8');
const onboardingHtml = readPageSource('src/onboarding/onboarding.html');
const infoButtonSource = fs.readFileSync('react-src/options/info-button.tsx', 'utf8');
const optionReactSources = [
  'react-src/options/blacklist-list.tsx',
  'react-src/options/settings-forms.tsx',
  'react-src/options/site-search-list.tsx'
].map((file) => fs.readFileSync(file, 'utf8'));

function cssRule(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([\\s\\S]*?)\\}`));
  assert.ok(match, `missing CSS rule for ${selector}`);
  return match[1];
}

function assertCircularInfoButton(rule, label) {
  assert.match(rule, /width:\s*20px;/, `${label} should be 20px wide`);
  assert.match(rule, /height:\s*20px;/, `${label} should be 20px tall`);
  assert.match(rule, /border-radius:\s*999px;/, `${label} should use a circular hit area`);
  assert.match(rule, /color:\s*rgba\(107,\s*114,\s*128,\s*0\.74\);/, `${label} should use the shared info color`);
}

assertCircularInfoButton(
  cssRule(onboardingHtml, '.interaction-info-button'),
  'onboarding info button'
);
assertCircularInfoButton(
  cssRule(infoButtonCss, '._x_extension_info_button_2026_unique_'),
  'options shared info button'
);
for (const page of [optionsHtml, newtabHtml]) {
  assert.match(page, /href="\.\.\/shared\/info-button\.css"/, 'Options and New Tab should load the same info styles');
}

for (const [source, selector, label] of [
  [onboardingHtml, '.interaction-info-button:hover', 'onboarding info hover'],
  [infoButtonCss, '._x_extension_info_button_2026_unique_:hover', 'options info hover']
]) {
  assert.match(
    cssRule(source, selector),
    /background:\s*rgba\(37,\s*99,\s*235,\s*0\.1\);/,
    `${label} should use the shared blue background`
  );
}

assert.match(infoButtonSource, /ri-information-line/, 'the shared component should use the information icon');
assert.doesNotMatch(infoButtonSource, /ri-question-line/, 'the shared component should not use the question icon');
// Its button element, name and description are covered by react-src/options/info-button.test.tsx.

const staticHosts = [
  '_x_extension_restricted_action_info_2026_unique_',
  '_x_extension_bookmark_rows_info_2026_unique_',
  '_x_extension_bookmark_columns_info_2026_unique_',
  '_x_extension_overlay_page_theme_adaptation_info_2026_unique_'
];
staticHosts.forEach((id) => {
  assert.match(optionsHtml, new RegExp(`id="${id}"`), `${id} should exist as a component host`);
  assert.match(optionsSource, new RegExp(`getElementById\\('${id}'\\)`), `${id} should be mounted by the Options runtime`);
});
assert.match(
  optionsSource,
  /createInfoButtonController/,
  'static Options info affordances should share the InfoButton controller'
);

for (const source of optionReactSources) {
  assert.match(source, /import \{ InfoButton \} from '\.\/info-button';/);
  assert.match(source, /<InfoButton[\s\S]*?tooltip=/, 'dynamic Options info affordances should reuse InfoButton');
}

const adaptationHostStart = optionsHtml.indexOf('_x_extension_overlay_page_theme_adaptation_info_2026_unique_');
const adaptationToggleStart = optionsHtml.indexOf('_x_extension_overlay_page_theme_adaptation_toggle_2026_unique_');
assert(adaptationHostStart >= 0 && adaptationHostStart < adaptationToggleStart);
assert.doesNotMatch(
  optionsHtml.slice(adaptationHostStart, adaptationToggleStart),
  /ri-question-line/,
  'the webpage theme adaptation info should not retain the old question icon'
);

for (const [label, source] of [
  ['options.html', optionsHtml],
  ['site-search-list.tsx', optionReactSources[2]],
  ['wallpaper.js', fs.readFileSync('src/newtab/wallpaper.js', 'utf8')],
  ['wallpaper-view.tsx', fs.readFileSync('react-src/newtab/wallpaper-view.tsx', 'utf8')],
  ['onboarding-content.js', fs.readFileSync('src/onboarding/onboarding-content.js', 'utf8')]
]) {
  assert.doesNotMatch(source, /ri-question-(?:line|fill)|icons\?\.help/, `${label} should use the information icon for help affordances`);
}

console.log('info affordance consistency tests passed');
