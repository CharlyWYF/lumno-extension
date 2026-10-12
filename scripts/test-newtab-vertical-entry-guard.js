const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { readPageSource } = require('./helpers/page-source');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');

const repoRoot = path.resolve(__dirname, '..');
const newtabHtml = readPageSource('newtab.html');
const featureHintsCss = fs.readFileSync(
  path.join(repoRoot, 'src/shared/feature-hints.css'),
  'utf8'
);
const shortcutDialogCss = fs.readFileSync(
  path.join(repoRoot, 'src/newtab/shortcut-dialog.css'),
  'utf8'
);
const newtabSource = readNewtabRuntimeSource();
const searchInputModeSource = fs.readFileSync(
  path.join(repoRoot, 'src/shared/search-input-mode.js'),
  'utf8'
);

function collectRuleBlocks(source) {
  const blocks = [];
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
  let match = rulePattern.exec(source);
  while (match) {
    blocks.push({
      selector: match[1].trim().replace(/\s+/g, ' '),
      declarations: match[2]
    });
    match = rulePattern.exec(source);
  }
  return blocks;
}

function getBalancedCssBlock(source, marker) {
  const markerIndex = source.indexOf(marker);
  assert.ok(markerIndex >= 0, `missing CSS block: ${marker}`);
  const openIndex = source.indexOf('{', markerIndex);
  assert.ok(openIndex >= 0, `missing opening brace: ${marker}`);
  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    if (source[index] === '{') {
      depth += 1;
    } else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(markerIndex, index + 1);
      }
    }
  }
  assert.fail(`missing closing brace: ${marker}`);
}

const ruleBlocks = collectRuleBlocks(newtabHtml);
const featureHintRuleBlocks = collectRuleBlocks(featureHintsCss);
const shortcutDialogRuleBlocks = collectRuleBlocks(shortcutDialogCss);
const verticalTranslationPattern = /\btranslate(?:Y|3d)?\s*\(|\btranslate\s*:/;

[
  '.x-nt-feedback-popover',
  '.x-nt-feedback-menu',
  '.x-nt-feedback-detail',
  '.x-nt-shortcut-context-menu-portal',
  '.x-nt-section-mode-portal',
  '.x-nt-wallpaper-panel',
  '.x-nt-wallpaper-body',
  '.x-nt-wallpaper-mode-row',
  '.x-nt-wallpaper-grid[data-motion="enter"]',
  '.x-nt-search-width-control',
  '.x-nt-effect-slider-control',
  '.x-nt-folder-preview',
  '.x-nt-bookmark-cascade-debug-label',
  '.x-nt-bookmark-cascade-level',
  '.x-nt-recent-action',
  '.x-nt-recent-pin'
].forEach((selectorFragment) => {
  const matchingBlocks = ruleBlocks.filter(({ selector }) => selector.includes(selectorFragment));
  assert.ok(matchingBlocks.length > 0, `missing guarded New Tab selector: ${selectorFragment}`);
  matchingBlocks.forEach(({ selector, declarations }) => {
    assert.doesNotMatch(
      declarations,
      verticalTranslationPattern,
      `${selector} should reveal in place without vertical translation`
    );
  });
});

[
  '.x-lumno-feature-hint--newtab-ai-quick-jump',
  '.x-lumno-feature-hint--newtab-tab-switcher',
  '.x-lumno-feature-hint--newtab-webdav-sync',
  '.x-lumno-feature-hint--newtab-help-center-ask',
  '.x-lumno-feature-hint--update-notice-newtab'
].forEach((selectorFragment) => {
  const matchingBlocks = featureHintRuleBlocks.filter(({ selector }) => (
    selector.includes(selectorFragment)
  ));
  assert.ok(matchingBlocks.length > 0, `missing guarded feature hint: ${selectorFragment}`);
  matchingBlocks.forEach(({ selector, declarations }) => {
    assert.doesNotMatch(
      declarations,
      verticalTranslationPattern,
      `${selector} should reveal in place without vertical translation`
    );
  });
});

const wallpaperHintBlocks = featureHintRuleBlocks.filter(({ selector }) => (
  selector.includes('.x-lumno-feature-hint--newtab-wallpaper')
));
assert.ok(wallpaperHintBlocks.length > 0, 'missing guarded New Tab wallpaper feature hint');
wallpaperHintBlocks.forEach(({ selector, declarations }) => {
  const verticalTranslations = declarations.match(/translateY\([^)]*\)/g) || [];
  verticalTranslations.forEach((translation) => {
    assert.strictEqual(
      translation,
      'translateY(-50%)',
      `${selector} should use vertical translation only for fixed anchor centering`
    );
  });
});

const shortcutDialogBlocks = shortcutDialogRuleBlocks.filter(({ selector }) => (
  selector.includes('.x-nt-shortcut-dialog') &&
  !selector.includes('.x-lumno-action-button')
));
assert.ok(shortcutDialogBlocks.length > 0, 'missing guarded New Tab shortcut dialog');
shortcutDialogBlocks.forEach(({ selector, declarations }) => {
  assert.doesNotMatch(
    declarations,
    verticalTranslationPattern,
    `${selector} should open in place without vertical translation`
  );
});

assert.doesNotMatch(
  newtabSource,
  /topContentContainer\.style\.setProperty\([\s\S]*?'transform'[\s\S]*?translate3d\(0,\s*-8px,\s*0\)/,
  'top content visibility changes should not add a vertical hidden-state offset'
);

assert.match(
  newtabHtml,
  /html body \._x_extension_tooltip_2026_unique_[\s\S]*?html body \._x_extension_tooltip_2026_unique_\._x_extension_cursor_tooltip_tag_2026_unique_\[data-tooltip-kind\]\[data-visible="true"\][\s\S]*?\{\s*transform:\s*none;/,
  'New Tab tooltips should override shared vertical reveal motion'
);

assert.match(
  searchInputModeSource,
  /const modeMenuClosedTransform = surface === 'newtab'\s*\? `\$\{modeMenuPositionTransform\} scale\(0\.96, 0\.86\)`/,
  'the New Tab search mode menu should keep the same vertical coordinate while opening'
);

[
  '_x_nt_time_seconds_soft_swap_2026_unique_',
  '_x_nt_wordmark_enter_2026_unique_',
  '_x_nt_shortcut_entry_2026_unique_',
  '_x_nt_content_section_entry_2026_unique_',
  '_x_nt_corner_control_entry_2026_unique_',
  '_x_nt_topbar_entry_2026_unique_',
  '_x_nt_topbar_floating_entry_2026_unique_',
  '_x_nt_topbar_content_entry_2026_unique_'
].forEach((keyframesName) => {
  assert.doesNotMatch(
    getBalancedCssBlock(newtabHtml, `@keyframes ${keyframesName}`),
    verticalTranslationPattern,
    `${keyframesName} should keep every element at its final vertical coordinate`
  );
});

assert.match(
  newtabHtml,
  /\.x-nt-wallpaper-grid\[data-motion="enter-next"\][\s\S]*?translateX\(8px\)[\s\S]*?\.x-nt-wallpaper-grid\[data-motion="enter-prev"\][\s\S]*?translateX\(-8px\)/,
  'wallpaper source tabs should retain their intentional horizontal direction cue'
);

console.log('newtab vertical entry guard tests passed');
