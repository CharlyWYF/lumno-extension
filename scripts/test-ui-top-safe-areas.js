const assert = require('assert');
const fs = require('fs');
const { readPageSource } = require('./helpers/page-source');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');

const newtabHtml = readPageSource('newtab.html');
const newtabJs = readNewtabRuntimeSource();
const wallpaperViewReact = fs.readFileSync(
  'react-src/newtab/wallpaper-view.tsx',
  'utf8'
);
const shortcutDialogCss = fs.readFileSync('src/newtab/shortcut-dialog.css', 'utf8');
const optionsHtml = readPageSource('src/options/options.html');
const onboardingHtml = readPageSource('src/onboarding/onboarding.html');
const contentHotkeySource = fs.readFileSync('src/content/hotkey-listener.js', 'utf8');
const overlayLifecycleSource = fs.readFileSync('src/overlay/lifecycle.js', 'utf8');
const tabSwitcherSource = fs.readFileSync('src/overlay/tab-switcher.js', 'utf8');

assert.match(
  newtabHtml,
  /--x-nt-visual-viewport-top-inset:\s*0px;[\s\S]*?--x-nt-top-safe-inset:\s*max\([\s\S]*?env\(safe-area-inset-top\),[\s\S]*?var\(--x-nt-visual-viewport-top-inset,\s*0px\)[\s\S]*?--x-nt-top-occupied-inset:\s*var\(--x-nt-top-safe-inset\);/,
  'newtab should combine device and visual viewport top insets in one shared token'
);
assert.match(
  newtabHtml,
  /body\[data-nt-top-occupied="true"\]\s*\{[\s\S]*?36px \+ var\(--x-nt-top-safe-inset\)/,
  'newtab should reserve both the top bookmark bar and the viewport safe area'
);
assert.match(
  newtabHtml,
  /body:not\(\[data-nt-ready="1"\]\) #_x_extension_newtab_bottom_dock_2024_unique_\s*\{[\s\S]*?visibility:\s*hidden;/,
  'newtab should not flash the bottom dock before the stored layout mode is restored'
);
const bookmarkTopbarRule = newtabHtml.match(
  /\.x-nt-bookmarks-topbar\s*\{([\s\S]*?)\}/
);
assert.ok(bookmarkTopbarRule, 'newtab should define the top bookmark bar');
assert.match(
  bookmarkTopbarRule[1],
  /position:\s*absolute;[\s\S]*?top:\s*env\(safe-area-inset-top\);/,
  'the top bookmark bar should stay in page coordinates while clearing the device safe area'
);
assert.doesNotMatch(
  bookmarkTopbarRule[1],
  /position:\s*fixed|--x-nt-visual-viewport-top-inset|--x-nt-top-safe-inset|(?:transform:\s*scale|zoom\s*:)/,
  'the top bookmark bar should not independently follow or scale with the visual viewport'
);
assert.match(
  newtabHtml,
  /\.x-nt-wallpaper-panel\s*\{[\s\S]*?max-height:\s*calc\(100dvh - 76px - var\(--x-nt-top-bar-max-inset\)\);[\s\S]*?overflow:\s*hidden;[\s\S]*?\.x-nt-wallpaper-panel-scroll\s*\{[\s\S]*?overflow:\s*hidden auto;[\s\S]*?overscroll-behavior:\s*contain;/,
  'the appearance panel should stay below the top bar however it shows and contain scrolling inside its body'
);
assert.match(
  newtabHtml,
  /\.x-nt-appearance-header\s*\{[\s\S]*?flex:\s*0 0 auto;[\s\S]*?position:\s*relative;[\s\S]*?z-index:\s*6;[\s\S]*?background:\s*var\(--x-nt-panel-surface\);/,
  'the appearance heading should remain outside the panel scroll body'
);
assert.match(
  wallpaperViewReact,
  /className="x-nt-wallpaper-panel"[\s\S]*?className="x-nt-appearance-header"[\s\S]*?className="x-nt-wallpaper-panel-scroll"[\s\S]*?className="x-nt-appearance-section"/,
  'the React wallpaper view should keep the appearance heading above one shared content scroller'
);
assert.match(
  newtabHtml,
  /\.x-nt-feedback-control\[data-detail-open="true"\] \.x-nt-feedback-popover\s*\{[\s\S]*?calc\(100dvh - 84px - var\(--x-nt-top-occupied-inset,\s*0px\)\)/,
  'feedback details should not grow underneath occupied top UI'
);
assert.match(
  shortcutDialogCss,
  /\.x-nt-shortcut-dialog-backdrop\s*\{[\s\S]*?var\(--x-nt-top-occupied-inset,\s*0px\)[\s\S]*?\.x-nt-shortcut-dialog\s*\{[\s\S]*?max-height:\s*calc\([\s\S]*?var\(--x-nt-top-occupied-inset,\s*0px\)[\s\S]*?overflow:\s*hidden auto;[\s\S]*?overscroll-behavior:\s*contain;/,
  'shortcut dialogs should remain scrollable inside the unobscured viewport'
);
assert.match(
  newtabJs,
  /function syncNewtabVisualViewportInsets\(\)[\s\S]*?--x-nt-visual-viewport-top-inset[\s\S]*?visualViewport\.addEventListener\([\s\S]*?'resize'[\s\S]*?visualViewport\.addEventListener\([\s\S]*?'scroll'/,
  'newtab should resync safe-area tokens for visual viewport resize and scroll changes'
);
assert.match(
  newtabJs,
  /getViewportTopInset:\s*(?:\(\.\.\.args\) => )?getNewtabViewportTopPaddingPx/,
  'newtab custom-select portals should receive the occupied top inset'
);
assert.match(
  newtabJs,
  /const runtime = typeof chrome !== 'undefined' && chrome && chrome\.runtime[\s\S]*?typeof runtime\.openOptionsPage === 'function'[\s\S]*?typeof runtime\.getURL === 'function'[\s\S]*?getExtensionResourceUrl\('src\/options\/options\.html'\)/,
  'the newtab settings control should degrade safely outside the extension runtime'
);

assert.match(
  optionsHtml,
  /padding-top:\s*max\([\s\S]*?env\(safe-area-inset-top\)[\s\S]*?padding-right:\s*max\(20px,\s*env\(safe-area-inset-right\)\);[\s\S]*?padding-bottom:\s*max\(40px,\s*env\(safe-area-inset-bottom\)\);/,
  'options content should clear device safe areas'
);
assert.match(
  optionsHtml,
  /\._x_extension_toast_2024_unique_\s*\{[\s\S]*?top:\s*max\(24px,\s*calc\(env\(safe-area-inset-top\) \+ 12px\)\);/,
  'options toasts should stay below the top safe area'
);
assert.match(
  optionsHtml,
  /\._x_extension_confirm_mask_2024_unique_\s*\{[\s\S]*?env\(safe-area-inset-top\)[\s\S]*?overflow:\s*auto;[\s\S]*?overscroll-behavior:\s*contain;[\s\S]*?\._x_extension_confirm_dialog_2024_unique_\s*\{[\s\S]*?max-height:\s*calc\(100dvh/,
  'options dialogs should scroll inside safe-area-aware masks'
);

assert.match(
  onboardingHtml,
  /\.copy-panel\s*\{[\s\S]*?padding:\s*max\(var\(--onboarding-copy-padding-y\),\s*calc\(env\(safe-area-inset-top\) \+ 12px\)\)[\s\S]*?max\(var\(--onboarding-copy-padding-y\),\s*calc\(env\(safe-area-inset-bottom\) \+ 12px\)\)/,
  'onboarding copy and actions should keep safe padding in every responsive tier'
);
assert.doesNotMatch(
  onboardingHtml,
  /\.copy-panel\s*\{[\s\S]{0,260}?padding:\s*var\(--onboarding-copy-padding-y\) var\(--onboarding-copy-padding-x\);/,
  'responsive onboarding overrides should not replace safe padding with unsafe shorthand'
);

assert.match(
  contentHotkeySource,
  /position:\s*fixed;[\s\S]*?top:\s*max\(24px,\s*calc\(env\(safe-area-inset-top\) \+ 12px\)\);/,
  'page-injected toasts should clear the host page safe area'
);
assert.match(
  overlayLifecycleSource,
  /visualViewport\.addEventListener\('resize',[\s\S]*?visualViewport\.addEventListener\('scroll'/,
  'overlay placement should track both visual viewport events'
);
assert.match(
  overlayLifecycleSource,
  /visualViewportTarget\.removeEventListener\('resize',[\s\S]*?visualViewportTarget\.removeEventListener\('scroll'/,
  'overlay placement should clean up both visual viewport events'
);
assert.match(
  tabSwitcherSource,
  /function applySwitcherViewportPlacement\([\s\S]*?offsetLeft[\s\S]*?offsetTop[\s\S]*?--x-tab-switcher-center-left[\s\S]*?--x-tab-switcher-center-top/,
  'the tab switcher should center itself within a shifted visual viewport'
);
assert.match(
  tabSwitcherSource,
  /switcherVisualViewport\.addEventListener\('resize',[\s\S]*?switcherVisualViewport\.addEventListener\('scroll'/,
  'the tab switcher should track visual viewport events'
);
assert.match(
  tabSwitcherSource,
  /switcherVisualViewport\.removeEventListener\('resize',[\s\S]*?switcherVisualViewport\.removeEventListener\('scroll'/,
  'the tab switcher should clean up visual viewport events'
);

console.log('UI top safe-area tests passed');
